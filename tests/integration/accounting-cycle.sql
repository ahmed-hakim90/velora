-- Run with: node scripts/verify-accounting-cycle.mjs
-- All fixture changes, injected failures and the migration are rolled back.
BEGIN;
CREATE FUNCTION pg_temp.assert_ok(ok BOOLEAN, message TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', message; END IF; END;
$$;
CREATE TEMP TABLE fixture AS
SELECT u.org_id, u.id AS actor, s.id AS store_id, gen_random_uuid() AS auth_id,
  gen_random_uuid() AS expense_id, gen_random_uuid() AS entry_id, gen_random_uuid() AS treasury_id
FROM users u JOIN stores s ON s.org_id = u.org_id WHERE u.role = 'owner' LIMIT 1;
SELECT pg_temp.assert_ok((SELECT count(*) = 1 FROM fixture), 'local fixture organization exists');
INSERT INTO auth.users (id, email) SELECT auth_id, 'accounting-txn-test@example.invalid' FROM fixture;
UPDATE users SET auth_user_id = f.auth_id FROM fixture f WHERE users.id = f.actor;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub',auth_id,'role','authenticated')::TEXT,true) FROM fixture;
INSERT INTO app_settings (org_id,key,value) SELECT org_id,'feature_flags','{"session_expenses":true,"monthly_closing":true,"general_ledger":true}' FROM fixture
  ON CONFLICT(org_id,key) DO UPDATE SET value=app_settings.value || excluded.value;
SELECT seed_default_chart_of_accounts(org_id) FROM fixture;

INSERT INTO journal_entries (org_id,store_id,entry_number,entry_date,status,source,source_id,created_by)
SELECT org_id,store_id,'TEST-OLD-' || kind,'2026-09-07','posted',
  CASE WHEN kind='manual' THEN 'manual'::journal_source ELSE 'adjustment'::journal_source END,
  'session_var:test-' || kind,actor FROM fixture CROSS JOIN (VALUES ('overage'),('shortage'),('manual')) k(kind);
INSERT INTO journal_lines (org_id,entry_id,account_id,debit,credit,line_no)
SELECT e.org_id,e.id,a.id,
  CASE WHEN (e.source_id LIKE '%shortage') = (a.system_key='cash_over_short') THEN 442.49 ELSE 0 END,
  CASE WHEN (e.source_id LIKE '%shortage') = (a.system_key='cash_over_short') THEN 0 ELSE 442.49 END,
  CASE WHEN a.system_key='cash' THEN 1 ELSE 2 END
FROM journal_entries e JOIN gl_accounts a ON a.org_id=e.org_id AND a.system_key IN ('cash','cash_over_short')
WHERE e.entry_number LIKE 'TEST-OLD-%';
CREATE TEMP TABLE before_lines AS SELECT l.*, e.entry_number,e.entry_date FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id WHERE e.entry_number LIKE 'TEST-OLD-%';

SELECT set_config('request.jwt.claims','{}',true);
INSERT INTO organizations(id,name) VALUES('a2000000-0000-4000-8000-000000000001','Empty organization migration test');
-- APPLY_MIGRATION
SELECT pg_temp.assert_ok((SELECT count(*)=3 FROM gl_accounts WHERE org_id='a2000000-0000-4000-8000-000000000001' AND system_key IN ('cash','cash_overage','expense_default')), 'empty organization gets complete default chart');
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',auth_id,'role','authenticated')::TEXT,true) FROM fixture;

SELECT pg_temp.assert_ok((SELECT count(*)=1 FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id JOIN gl_accounts a ON a.id=l.account_id WHERE e.entry_number='TEST-OLD-overage' AND a.system_key='cash_overage'), 'historical overage moved');
SELECT pg_temp.assert_ok(NOT EXISTS(SELECT 1 FROM before_lines b JOIN journal_lines l USING(id) JOIN journal_entries e ON e.id=l.entry_id WHERE b.debit<>l.debit OR b.credit<>l.credit OR b.entry_number<>e.entry_number OR b.entry_date<>e.entry_date), 'historical amounts/dates/numbers preserved');
SELECT pg_temp.assert_ok(NOT EXISTS(SELECT 1 FROM before_lines b JOIN journal_lines l USING(id) WHERE b.entry_number IN ('TEST-OLD-manual','TEST-OLD-shortage') AND b.account_id<>l.account_id), 'manual and shortage untouched');
SELECT pg_temp.assert_ok((SELECT count(*)=1 FROM audit_logs WHERE action='gl.cash_overage_reclassified' AND entity_id IN (SELECT entry_id::TEXT FROM before_lines)), 'migration audit recorded');

-- Direct default-CoA calls for new organizations must include both accounts.
SELECT set_config('request.jwt.claims','{}',true);
INSERT INTO organizations(id,name) VALUES('a1000000-0000-4000-8000-000000000001','Transactional accounting seed test');
SELECT seed_default_chart_of_accounts('a1000000-0000-4000-8000-000000000001');
SELECT pg_temp.assert_ok((SELECT count(*)=2 FROM gl_accounts WHERE org_id='a1000000-0000-4000-8000-000000000001' AND system_key IN ('cash_overage','cash_over_short')), 'new organization seeded');
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',auth_id,'role','authenticated')::TEXT,true) FROM fixture;

INSERT INTO expenses(id,store_id,amount,created_by,cost_center_id,expense_category_id,title,payment_method,expense_source,status)
SELECT f.expense_id,f.store_id,2970,f.actor,c.cost_center_id,c.id,'مصروف اختبار','cash','external','approved'
FROM fixture f JOIN LATERAL(SELECT * FROM expense_categories WHERE org_id=f.org_id AND is_active AND NOT requires_inventory_item LIMIT 1)c ON true;
SELECT pg_temp.assert_ok((SELECT count(*)=1 FROM expenses WHERE id=(SELECT expense_id FROM fixture)), 'expense fixture exists');
INSERT INTO journal_entries(id,org_id,store_id,entry_number,entry_date,status,source,source_id,created_by,posted_by,posted_at)
SELECT entry_id,org_id,store_id,'TEST-EXPENSE','2026-09-07','posted','expense',expense_id::TEXT,actor,actor,now() FROM fixture;
INSERT INTO journal_lines(org_id,entry_id,account_id,debit,credit,line_no)
SELECT f.org_id,f.entry_id,a.id,CASE WHEN system_key='expense_default' THEN 2970 ELSE 0 END,
  CASE WHEN system_key='cash' THEN 2970 ELSE 0 END,CASE WHEN system_key='cash' THEN 2 ELSE 1 END
FROM fixture f JOIN gl_accounts a ON a.org_id=f.org_id AND a.system_key IN ('expense_default','cash');
-- Use the existing store treasury or create one for the transactional fixture.
INSERT INTO cash_treasuries(org_id,kind,store_id,balance) SELECT org_id,'store',store_id,5000 FROM fixture
ON CONFLICT DO NOTHING;
UPDATE fixture f SET treasury_id=t.id FROM cash_treasuries t WHERE t.org_id=f.org_id AND t.store_id=f.store_id AND t.kind='store';
UPDATE cash_treasuries SET balance=5000 WHERE id=(SELECT treasury_id FROM fixture);
SELECT treasury_post_expense(treasury_id,expense_id,2970,'test') FROM fixture;

-- A failure at the treasury write happens after the GL reversal; both must roll back.
CREATE FUNCTION pg_temp.reject_treasury_write() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected treasury failure'; END; $$;
CREATE TRIGGER accounting_test_failure BEFORE INSERT ON cash_treasury_ledger FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_treasury_write();
DO $$ BEGIN
  BEGIN PERFORM void_expense_atomic((SELECT expense_id FROM fixture),'test'); RAISE EXCEPTION 'expected failure missing';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'injected treasury failure' THEN RAISE; END IF; END;
END $$;
SELECT pg_temp.assert_ok((SELECT status='approved' FROM expenses WHERE id=(SELECT expense_id FROM fixture)), 'failure preserved expense');
SELECT pg_temp.assert_ok(NOT EXISTS(SELECT 1 FROM journal_entries WHERE source_id='expense-void:'||(SELECT expense_id FROM fixture)), 'failure rolled back reversal');
SELECT pg_temp.assert_ok((SELECT balance=2030 FROM cash_treasuries WHERE id=(SELECT treasury_id FROM fixture)), 'failure preserved treasury');
DROP TRIGGER accounting_test_failure ON cash_treasury_ledger;

-- Invalid original journal must fail before touching cash or document state.
UPDATE journal_lines SET debit=2969 WHERE entry_id=(SELECT entry_id FROM fixture) AND debit>0;
DO $$ BEGIN
  BEGIN PERFORM void_expense_atomic((SELECT expense_id FROM fixture),'test'); RAISE EXCEPTION 'expected failure missing';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'القيد الأصلي غير متوازن' THEN RAISE; END IF; END;
END $$;
UPDATE journal_lines SET debit=2970 WHERE entry_id=(SELECT entry_id FROM fixture) AND debit>0;

INSERT INTO monthly_closes(org_id,store_id,period_start,period_end,status) SELECT org_id,store_id,current_date,current_date,'closed' FROM fixture;
DO $$ BEGIN
  BEGIN PERFORM void_expense_atomic((SELECT expense_id FROM fixture),'test'); RAISE EXCEPTION 'expected failure missing';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'الفترة مقفولة' THEN RAISE; END IF; END;
END $$;
DELETE FROM monthly_closes WHERE store_id=(SELECT store_id FROM fixture) AND period_start=current_date AND period_end=current_date;

SELECT void_expense_atomic(expense_id,'اختبار الإلغاء') IS NOT NULL FROM fixture;
SELECT void_expense_atomic(expense_id,'تكرار') IS NOT NULL FROM fixture;
SELECT pg_temp.assert_ok((SELECT status='voided' AND void_reason='اختبار الإلغاء' FROM expenses WHERE id=(SELECT expense_id FROM fixture)), 'successful cancellation is idempotent');
SELECT pg_temp.assert_ok((SELECT balance=5000 FROM cash_treasuries WHERE id=(SELECT treasury_id FROM fixture)), 'treasury restored exactly once');
SELECT pg_temp.assert_ok((SELECT count(*)=1 FROM journal_entries WHERE source_id='expense-void:'||(SELECT expense_id FROM fixture)), 'one reversal only');
SELECT pg_temp.assert_ok((SELECT sum(l.debit-l.credit)=0 FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id JOIN gl_accounts a ON a.id=l.account_id WHERE (e.source_id=(SELECT expense_id::TEXT FROM fixture) OR e.source_id='expense-void:'||(SELECT expense_id FROM fixture)) AND a.system_key='expense_default'), 'original expense and reversal net zero');
SELECT pg_temp.assert_ok((SELECT count(*)=1 FROM audit_logs WHERE action='expense.voided' AND entity_id=(SELECT expense_id::TEXT FROM fixture)), 'one cancellation audit');

-- Recovery filtering precedes the limit; unrelated failures remain open.
CREATE TEMP TABLE failure_ids AS SELECT insert_audit_log('gl.posting_failed','gl_journal',expense_id::TEXT,store_id,'{"label":"postExpenseJournal"}') AS id FROM fixture;
SELECT insert_audit_log('gl.posting_recovered','gl_journal',expense_id::TEXT,store_id,jsonb_build_object('failure_id',(SELECT id FROM failure_ids))) FROM fixture;
SELECT pg_temp.assert_ok(NOT EXISTS(SELECT 1 FROM list_unresolved_gl_failures(now()-interval '7 days',50) WHERE id IN(SELECT id FROM failure_ids)), 'resolved failure hidden');
SELECT insert_audit_log('gl.posting_failed','gl_journal',expense_id::TEXT,store_id,'{"label":"postExpenseJournal"}') FROM fixture;
SELECT pg_temp.assert_ok((SELECT count(*)=1 FROM list_unresolved_gl_failures(now()-interval '7 days',1)), 'new failure still visible');

-- Cross-tenant account creation and anonymous cancellation are rejected.
DO $$ BEGIN
  BEGIN PERFORM ensure_system_gl_accounts('a1000000-0000-4000-8000-000000000001'); RAISE EXCEPTION 'expected failure missing';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'Unauthorized' THEN RAISE; END IF; END;
END $$;
SELECT set_config('request.jwt.claims','{}',true);
DO $$ BEGIN
  BEGIN PERFORM void_expense_atomic((SELECT expense_id FROM fixture),'test'); RAISE EXCEPTION 'expected failure missing';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'Unauthorized' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
