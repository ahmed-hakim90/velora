import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260906163000_fix_session_refund_double_count.sql",
  "utf8",
);

describe("session refund reconciliation migration", () => {
  it("counts cancelled cash receipts before subtracting their reversal", () => {
    expect(migration).toContain(
      "o.status IN ('completed', 'voided', 'refunded')",
    );
    expect(migration).toContain(
      "o.status IN ('voided', 'refunded') AND op.method = 'cash'",
    );
  });

  it("repairs only rows that still match the legacy calculation", () => {
    expect(migration).toContain(
      "ROUND(c.old_expected_cash, 2) = c.legacy_expected_cash",
    );
    expect(migration).toContain("session.reconciliation_repaired");
  });

  it("voids and replaces an existing posted session variance journal", () => {
    expect(migration).toContain("status = 'void'");
    expect(migration).toContain("'JE-REPAIR-' || session_id::text");
    expect(migration).toContain("a.system_key IN ('cash', 'cash_over_short')");
  });
});
