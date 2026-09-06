import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260906160000_allow_privileged_users_to_sell_by_pin.sql",
  ),
  "utf8",
);

describe("authenticated POS operator PIN", () => {
  it("allows owner, manager, and cashier identities", () => {
    expect(sql).toContain("u.role IN ('owner', 'manager', 'cashier')");
    expect(sql).toContain("u.role IN ('owner', 'manager')");
  });

  it("does not redefine public PIN login for privileged accounts", () => {
    expect(sql).not.toContain("login_cashier_by_pin");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.verify_cashier_pin");
    expect(sql).toContain("TO authenticated");
  });
});
