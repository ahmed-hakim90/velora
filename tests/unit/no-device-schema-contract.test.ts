import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260906150000_remove_device_system.sql"),
  "utf8",
);
const contract = readFileSync(
  join(process.cwd(), "scripts/sql/verify-no-device-schema.sql"),
  "utf8",
);

describe("device-free database contract", () => {
  it.each([
    "devices",
    "device_pairing_codes",
    "device_pairing_attempts",
    "user_device_access",
  ])("explicitly drops %s without a broad cascade", (table) => {
    expect(migration).toContain(`DROP TABLE IF EXISTS public.${table}`);
    expect(migration).not.toMatch(/DROP TABLE[^;]+CASCADE/i);
  });

  it("removes device columns, triggers, functions, and checkout parameters", () => {
    expect(migration).toContain("ALTER TABLE public.cashier_sessions DROP COLUMN IF EXISTS device_id");
    expect(migration).toContain("ALTER TABLE public.pos_held_carts DROP COLUMN IF EXISTS device_id");
    expect(migration).toContain("DROP TRIGGER IF EXISTS trg_session_device_store");
    expect(migration).not.toMatch(/CREATE OR REPLACE FUNCTION[\s\S]*?p_device_id/i);
  });

  it("audits pg_catalog and the UI-compatible PIN role contract", () => {
    expect(contract).toContain("pg_trigger");
    expect(contract).toContain("pg_get_function_arguments");
    expect(contract).toContain("set_user_pin");
    expect(contract).toContain("owner");
    expect(contract).toContain("manager");
    expect(contract).toContain("cashier");
  });
});
