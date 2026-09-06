import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260906164000_align_unpaid_checkout_current_signature.sql",
  "utf8",
).toLowerCase();

describe("unpaid checkout signature migration", () => {
  it("calls the current secured checkout signature", () => {
    expect(sql).toContain("public.complete_checkout(");
    expect(sql).toContain("'retail'::public.sales_mode");
    expect(sql).toContain("null::text");
    expect(sql).not.toContain("null::uuid");
    expect(sql).toContain("set search_path = public, pg_temp");
  });

  it("keeps the function unavailable to public and anon", () => {
    expect(sql).toContain("from public, anon");
    expect(sql).toContain("to authenticated, service_role");
  });
});
