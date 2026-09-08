# Accounting posting and recovery

## Cash variance classification (2026-09-08)

`cash_over_short` is the debit-normal expense **عجز الصندوق** (default code 5210).
`cash_overage` is the credit-normal revenue **فائض الصندوق** (default code 4300).
Shortage debits the former and credits cash; overage debits cash and credits the latter.
Zero variance creates no journal. Income statements and Excel show overage under
other revenue, not as a negative expense. Reversals retain their signed amounts.

Migration `20260908054302_accounting_cash_overage_atomic_void.sql` seeds missing
charts before ensuring both accounts, including existing empty organizations.
The default-chart seed path also creates overage through the shortage insert
trigger. An occupied account code is preserved; the system account gets a
`-SYS-N` suffix instead. Organization locking serializes account creation.

Historical reclassification is deliberately narrow: adjustment journals whose
source ID starts with `session_var:`, with a credit-only line against the old
system account. Manual journals and debit shortage lines are untouched. Each
moved line emits `gl.cash_overage_reclassified` with old/new account IDs, line
ID, credit, entry number/date and migration identifier. No amounts, dates or
entry numbers change. Any later reversal of this migration must use that audit
evidence and a reviewed corrective migration; do not delete original journals.

## Expense cancellation

`void_expense_atomic` is the sole application cancellation path. It verifies
the authenticated active user, organization, permission, feature, store access,
session state and current accounting period. It locks the expense, reverses an
existing posted GL journal, reverses treasury, marks the expense voided and
inserts the audit event within one database transaction. Failure rolls back all
these effects. A repeated cancellation returns the already-voided expense.
Inventory purchases and closed-session expenses remain protected.

Original and reversal journals remain posted and visible for audit. Their net
effect is zero. Existing GL is reversed even if GL was disabled subsequently.

## Request lifetime and recovery

Financial posting is awaited in the authenticated request for checkout,
purchases/returns, sales credits/cost corrections, stock counts, shift variance
and customs costs. GL errors remain soft failures after the business operation
has committed: do not tell the caller to repeat the sale or receipt. Preparation
errors are audited too. Customs `posted_amount` advances only after successful
posting. Non-financial notifications may still run in `after()`.

`after()` itself supports cookies in Server Actions; the removed pattern was
detached `void` asynchronous work whose lifetime was not awaited. This change
does not make expired credentials valid. Authentication failures are surfaced
as posting failures rather than silently treated as a disabled feature. If
authentication also prevents writing the audit row, the server logs the failure;
this is not a durable queue or a guarantee of audit delivery during outages.

A successful retry writes `gl.posting_recovered` referencing `failure_id`.
The banner excludes resolved failures before pagination, retains original audit
records and displays a reload error instead of silently hiding unavailable data.
Skipped retries do not report recovery. Existing auto-journals must have balanced
lines before being accepted as a successful idempotent replay.

## Validation and rollout

- Run `node scripts/verify-accounting-cycle.mjs` against the local Docker stack.
  It applies the migration inside a rolled-back fixture transaction and checks
  fresh/existing charts, historical exclusions and audit evidence, treasury/GL
  failure rollback, closed periods, repeat cancellation, auth isolation and
  recovery filtering before pagination.
- Unit coverage includes variance signs/zero, the report equation, 13 posting
  wrappers under auth loss, checkout preparation failure after commit, awaited
  shift posting and retry outcomes. Run targeted Vitest files and
  `npx tsc --noEmit`; lint the affected modules.
- RTL browser QA used local fixtures at 390×844, 768×1024, 1280×800 and
  1536×960 for journals/detail, trial balance, income statement and balance sheet.
  The downloaded Excel workbook was read back and checked. Expected values:
  revenue 1633.98, discount 17.50, other revenue 442.49, expenses 0,
  profit 2058.97; assets 2683.97 = liabilities 625 + equity 2058.97.
  No browser runtime errors were reported. Tablet journal tables retain their
  existing internal horizontal scroll; report pages have no clipped values.
  Shared shell measurements retain a 1px overflow above phone width.
- `scripts/accounting-qa-local.mjs setup` creates local-only QA data;
  `cleanup` removes its journals and auth login, retaining an inactive audit
  actor because audit records are append-only. It rejects non-local API URLs.

Apply the migration to the intended deployment database before deploying the
application version requiring the new RPCs. Back up and review affected lines
first, then compare totals and audit counts. Implementation verification applied
the migration locally only; no hosted database or production deployment was
changed. Never point QA fixtures at production or use a database reset to ship
this migration.

### Hosted application of the migration

On 2026-09-08, at the user's explicit request, this migration was applied to
the linked `velora` project (`pbpyxxplrlpcyljttnoa`) through Supabase MCP.
Remote history records version `20260908061332`, name
`accounting_cash_overage_atomic_void`; the source file and audit identifier
remain `20260908054302`. CLI dry-run exposed pre-existing local/remote history
drift, so no unrelated migrations or history repairs were applied.

Verification: both organizations have the overage revenue account, three
historical lines totaling 442.49 were reclassified and audited, and no eligible
credit lines remain on the shortage account. All 63 journal lines remain;
total debit and credit are unchanged at 12166.47 each. The new cancellation
and unresolved-failure RPCs exist. Application deployment is still separate.
Security advisors flag authenticated execution of the intended SECURITY DEFINER
RPCs; these keep explicit authorization checks and fixed search paths, with
anonymous execution revoked. Other project-wide notices were not modified.
