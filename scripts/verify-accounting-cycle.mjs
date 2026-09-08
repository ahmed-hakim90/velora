import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260908054302_accounting_cash_overage_atomic_void.sql",
    import.meta.url,
  ),
  "utf8",
);
const test = readFileSync(
  new URL("../tests/integration/accounting-cycle.sql", import.meta.url),
  "utf8",
);
const result = spawnSync(
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
  ],
  {
    input: test.replace("-- APPLY_MIGRATION", () => migration),
    encoding: "utf8",
  },
);
if (result.status !== 0) {
  process.stderr.write(
    result.stderr || result.error?.message || "Accounting verification failed",
  );
  process.stdout.write(result.stdout || "");
  process.exit(1);
}
console.log(
  "Accounting database checks passed; fixtures and migration rolled back.",
);
