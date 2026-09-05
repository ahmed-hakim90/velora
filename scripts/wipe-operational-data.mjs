/**
 * Wipe operational/transactional data while keeping master data.
 *
 * Usage:
 *   CONFIRM_WIPE=yes npm run db:wipe-operational
 */
import { readFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filename) {
  const path = resolve(root, filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

if (process.env.CONFIRM_WIPE !== "yes") {
  console.error("Refusing to wipe data. Re-run with: CONFIRM_WIPE=yes npm run db:wipe-operational");
  process.exit(1);
}

const TABLES_TO_WIPE = [
  "order_item_deductions",
  "order_payments",
  "order_items",
  "loyalty_ledger",
  "online_order_items",
  "online_orders",
  "orders",
  "journal_lines",
  "journal_entries",
  "cash_treasury_ledger",
  "cashier_vault_ledger",
  "inventory_batch_movements",
  "inventory_batches",
  "inventory_movements",
  "stock_count_lines",
  "stock_counts",
  "stock_levels",
  "pos_held_carts",
  "customer_ledger",
  "customer_payments",
  "expenses",
  "customs_certificate_costs",
  "customs_certificates",
  "purchase_container_lines",
  "purchase_containers",
  "purchase_invoice_lines",
  "purchase_invoices",
  "supplier_payments",
  "transfer_order_lines",
  "transfer_orders",
  "waste_records",
  "product_serial_numbers",
  "cashier_sessions",
  "monthly_closes",
  "document_number_counters",
  "audit_logs",
  "pin_attempts",
  "device_pairing_codes",
  "device_pairing_attempts",
  "import_jobs",
];

const KEEP_COUNTS = [
  "users",
  "stores",
  "products",
  "categories",
  "customers",
  "suppliers",
  "warehouses",
  "gl_accounts",
];

async function countTable(admin, table) {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function wipeTable(admin, table) {
  const filters = [
    ["id", "not", null],
    ["org_id", "not", null],
    ["store_id", "not", null],
    ["created_at", "gte", "1970-01-01T00:00:00Z"],
  ];
  let lastError = null;
  for (const [column, operator, value] of filters) {
    const query = admin.from(table).delete();
    const { error } =
      operator === "not"
        ? await query.not(column, "is", value)
        : await query.gte(column, value);
    if (!error) return;
    lastError = error;
  }
  throw new Error(`${table}: ${lastError?.message ?? "delete failed"}`);
}

async function resetMasterBalances(admin) {
  const updates = [
    ["customers", { account_balance: 0, total_spent: 0, visit_count: 0 }],
    ["suppliers", { opening_balance: 0 }],
    ["cash_treasuries", { balance: 0 }],
    ["cashier_vaults", { balance: 0, pending_opening_float: 0 }],
  ];
  for (const [table, values] of updates) {
    process.stdout.write(`Resetting ${table} balances...`);
    const { error } = await admin.from(table).update(values).not("id", "is", null);
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(" done");
  }
}

async function main() {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Before:");
  for (const table of [...KEEP_COUNTS, "cashier_sessions", "orders", "online_orders", "customers"]) {
    console.log(`  ${table}: ${await countTable(admin, table)}`);
  }

  for (const table of TABLES_TO_WIPE) {
    process.stdout.write(`Wiping ${table}...`);
    await wipeTable(admin, table);
    console.log(" done");
  }
  await resetMasterBalances(admin);

  console.log("\nAfter:");
  for (const table of [...KEEP_COUNTS, "cashier_sessions", "orders", "online_orders", "customers"]) {
    console.log(`  ${table}: ${await countTable(admin, table)}`);
  }
  console.log("\nDone. Master data was kept and its operational balances were reset.");
}

main().catch((error) => {
  console.error("Wipe failed:", error.message);
  process.exit(1);
});
