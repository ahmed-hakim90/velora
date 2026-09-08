// Local-only rendered QA fixture. Never reads .env.local or a linked project.
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
const config = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(config.API_URL))
  throw new Error("Local Supabase required");
const db = createClient(config.API_URL, config.SERVICE_ROLE_KEY);
const userId = "b1000000-0000-4000-8000-000000000201";
const orgId = "00000000-0000-4000-8000-000000000001";
const storeId = "00000000-0000-4000-8000-000000000101";
const email = "accounting-qa@example.invalid";
const password = "Local-accounting-QA-2026!";
function sql(input) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_SweetFlow-pos",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input, encoding: "utf8" },
  );
}
if (process.argv[2] === "cleanup") {
  const authId = sql(
    `SELECT auth_user_id FROM users WHERE id='${userId}';`,
  ).trim();
  sql(`BEGIN;
    DELETE FROM journal_entries WHERE created_by='${userId}' AND entry_number LIKE 'QA-ACCOUNTING-%';
    UPDATE users SET auth_user_id=NULL,is_active=false WHERE id='${userId}'; COMMIT;`);
  if (authId) {
    const { error } = await db.auth.admin.deleteUser(authId);
    if (error) throw error;
  }
  console.log("Removed local accounting QA journals and login; retained inactive audit actor.");
} else {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const authId = data.user.id;
  sql(`BEGIN;
    INSERT INTO users(id,org_id,auth_user_id,name,email,role) VALUES('${userId}','${orgId}','${authId}','مراجعة المحاسبة','${email}','owner')
      ON CONFLICT(id) DO UPDATE SET auth_user_id=excluded.auth_user_id,is_active=true;
    SELECT seed_default_chart_of_accounts('${orgId}');
    INSERT INTO journal_entries(id,org_id,store_id,entry_number,entry_date,status,source,source_id,memo,created_by,posted_by,posted_at)
    VALUES
      ('b1000000-0000-4000-8000-000000000001','${orgId}','${storeId}','QA-ACCOUNTING-BASE','2026-09-07','posted','manual','qa-base','بيانات مراجعة محلية','${userId}','${userId}',now()),
      ('b1000000-0000-4000-8000-000000000002','${orgId}','${storeId}','QA-ACCOUNTING-EXPENSE','2026-09-07','posted','expense','qa-expense','مصروف اختبار','${userId}','${userId}',now()),
      ('b1000000-0000-4000-8000-000000000003','${orgId}','${storeId}','QA-ACCOUNTING-REVERSAL','2026-09-07','posted','adjustment','expense-void:qa-expense','عكس مصروف اختبار','${userId}','${userId}',now());
    INSERT INTO journal_lines(org_id,entry_id,account_id,debit,credit,line_no)
    SELECT '${orgId}',('b1000000-0000-4000-8000-00000000000'||v.entry)::uuid,a.id,v.debit,v.credit,v.line_no
    FROM (VALUES
      (1,'cash',2248.97,0,1),(1,'cash',0,3335,2),(1,'inventory',3770,0,3),(1,'ap',0,625,4),
      (1,'sales_revenue',190,0,5),(1,'sales_revenue',0,1823.98,6),(1,'sales_discount',17.50,0,7),(1,'cash_overage',0,442.49,8),
      (2,'expense_default',2970,0,1),(2,'cash',0,2970,2),(3,'expense_default',0,2970,1),(3,'cash',2970,0,2)
    )v(entry,system_key,debit,credit,line_no) JOIN gl_accounts a ON a.org_id='${orgId}' AND a.system_key=v.system_key;
    COMMIT;`);
  console.log("Local QA fixture ready: accounting-qa@example.invalid");
}
