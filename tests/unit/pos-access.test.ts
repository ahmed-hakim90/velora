import { describe, expect, it, vi, beforeEach } from "vitest";
import { resolvePosAccess, PosAccessError } from "@/lib/auth/pos-access";
import * as guards from "@/lib/auth/guards";
import * as session from "@/lib/auth/session";
import * as permissionRepo from "@/lib/repositories/permission.repository";

vi.mock("@/lib/auth/guards");
vi.mock("@/lib/auth/session");
vi.mock("@/lib/repositories/permission.repository");

const managerUser = {
  id: "mgr-1",
  org_id: "org-1",
  auth_user_id: "auth-mgr",
  name: "Manager",
  email: "mgr@test.com",
  role: "manager" as const,
  is_active: true,
  store_ids: ["store-1"],
};

const inventoryUser = {
  ...managerUser,
  id: "inventory-1",
  role: "inventory" as const,
};

describe("resolvePosAccess pos_access permission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(session.getActiveStoreId).mockResolvedValue("store-1");
    vi.mocked(permissionRepo.hasPermission).mockResolvedValue(false);
    vi.mocked(session.getActiveCashierId).mockResolvedValue("mgr-1");
  });

  it("denies when pos_access permission check fails", async () => {
    vi.mocked(guards.requireAuth).mockResolvedValue(inventoryUser);

    await expect(resolvePosAccess()).rejects.toMatchObject({
      code: "role_denied",
    } satisfies Partial<PosAccessError>);
  });

  it("allows when pos_access permission passes", async () => {
    vi.mocked(guards.requireAuth).mockResolvedValue(managerUser);

    const ctx = await resolvePosAccess();
    expect(ctx.storeId).toBe("store-1");
    expect(ctx.deviceId).toBeNull();
    expect(permissionRepo.hasPermission).not.toHaveBeenCalled();
  });

  it("allows an outside role when pos_access is granted", async () => {
    vi.mocked(guards.requireAuth).mockResolvedValue(inventoryUser);
    vi.mocked(permissionRepo.hasPermission).mockResolvedValue(true);

    const ctx = await resolvePosAccess();
    expect(ctx.user.role).toBe("inventory");
    expect(permissionRepo.hasPermission).toHaveBeenCalledWith("pos_access");
  });

  it("rejects a non-privileged user outside the active store", async () => {
    vi.mocked(guards.requireAuth).mockResolvedValue({
      ...inventoryUser,
      store_ids: ["store-2"],
    });
    vi.mocked(permissionRepo.hasPermission).mockResolvedValue(true);

    await expect(resolvePosAccess()).rejects.toMatchObject({
      code: "access_denied",
    } satisfies Partial<PosAccessError>);
  });

  it("requires PIN switch when manager has no active cashier cookie", async () => {
    vi.mocked(guards.requireAuth).mockResolvedValue(managerUser);
    vi.mocked(session.getActiveCashierId).mockResolvedValue(null);

    await expect(resolvePosAccess()).rejects.toMatchObject({
      code: "cashier_required",
    } satisfies Partial<PosAccessError>);
  });

  it("auto-unlocks logged-in cashier without a second PIN", async () => {
    const cashierUser = {
      ...managerUser,
      id: "cashier-1",
      role: "cashier" as const,
    };
    vi.mocked(guards.requireAuth).mockResolvedValue(cashierUser);
    vi.mocked(session.getActiveCashierId).mockResolvedValue(null);
    vi.mocked(session.setActiveCashierId).mockResolvedValue(undefined);

    const ctx = await resolvePosAccess({ persistCookies: true });
    expect(ctx.activeCashierId).toBe("cashier-1");
    expect(session.setActiveCashierId).toHaveBeenCalledWith("cashier-1", {
      storeId: "store-1",
    });
  });
});
