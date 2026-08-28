"use client";

import { useMemo, useState, useTransition } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Pencil, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CompactAction,
  CompactActions,
} from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { StatusPill } from "@/components/Velora/status-pill";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import type { AppUser, Store, Permission, PermissionKey } from "@/lib/types";
import type { UserRole } from "@/lib/constants";
import { ROLE_LABELS, userRoleSupportsPin } from "@/lib/constants";
import { PermissionsMatrix } from "@/modules/accounting/components/permissions-matrix";
import { UserPermissionOverrides } from "@/modules/accounting/components/user-permission-overrides";
import {
  createUserAction,
  deactivateUserAction,
  deleteUserPermanentlyAction,
  resetUserPinAction,
  resetUserPasswordAction,
  updateUserAction,
} from "@/modules/system/actions/system.actions";
import { useTranslation } from "@/lib/i18n/use-translation";
/** Device ACL UI retired — cashiers use store slug + PIN only. */
const SHOW_DEVICE_ACL_UI = false;

function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}

type UserEditState = {
  name: string;
  email: string;
  role: AppUser["role"];
  storeIds: string[];
  deviceIds: string[];
  restrictDevices: boolean;
  isActive: boolean;
};

interface UsersPageProps {
  users: AppUser[];
  stores: Store[];
  devices: { id: string; store_id: string; name: string }[];
  userDeviceIds: Record<string, string[]>;
  actorRole?: UserRole;
  permissionsData: {
    permissions: Permission[];
    matrix: Record<UserRole, PermissionKey[]>;
    userGrants: Record<string, { permission_key: string; granted: boolean }[]>;
  } | null;
  embedded?: boolean;
}

export function UsersPage({
  users,
  stores,
  devices,
  userDeviceIds,
  actorRole = "owner",
  permissionsData,
  embedded,
}: UsersPageProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "cashier" as AppUser["role"],
    storeIds: [stores[0]?.id ?? ""].filter(Boolean),
    deviceIds: [] as string[],
    restrictDevices: false,
    pin: "",
    password: "",
  });
  const [edits, setEdits] = useState<Record<string, UserEditState>>(
    Object.fromEntries(
      users.map((u) => [
        u.id,
        {
          name: u.name,
          email: u.email,
          role: u.role,
          storeIds: u.store_ids,
          deviceIds: userDeviceIds[u.id] ?? [],
          restrictDevices: (userDeviceIds[u.id]?.length ?? 0) > 0,
          isActive: u.is_active,
        },
      ]),
    ),
  );

  const editingUser = useMemo(
    () => users.find((u) => u.id === editingUserId) ?? null,
    [users, editingUserId],
  );
  const editing = editingUserId ? edits[editingUserId] : null;

  const createRoleOptions = useMemo(
    () =>
      (["owner", "manager", "cashier", "inventory"] as const).filter(
        (role) => actorRole === "owner" || role !== "owner",
      ),
    [actorRole],
  );
  const editRoleOptions = useMemo(() => {
    const roles = (
      ["owner", "manager", "cashier", "inventory"] as const
    ).filter(
      (role) =>
        actorRole === "owner" || role !== "owner" || editing?.role === "owner",
    );
    return roles;
  }, [actorRole, editing?.role]);

  const canCreate =
    form.name.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.password.length >= 8 &&
    (form.role === "cashier"
      ? /^[0-9]{4,8}$/.test(form.pin)
      : !form.pin || /^[0-9]{4,8}$/.test(form.pin));

  const openEditor = (user: AppUser) => {
    setEditingUserId(user.id);
    setPinValue("");
    setPasswordValue("");
    setEdits((prev) => ({
      ...prev,
      [user.id]:
        prev[user.id] ??
        ({
          name: user.name,
          email: user.email,
          role: user.role,
          storeIds: user.store_ids,
          deviceIds: userDeviceIds[user.id] ?? [],
          restrictDevices: (userDeviceIds[user.id]?.length ?? 0) > 0,
          isActive: user.is_active,
        } satisfies UserEditState),
    }));
  };

  const patchEdit = (id: string, patch: Partial<UserEditState>) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id]!, ...patch },
    }));
  };

  const saveUser = (id: string) => {
    const current = edits[id];
    if (!current) return;

    const pinEntered = pinValue.length > 0;
    const passwordEntered = passwordValue.length > 0;

    if (pinEntered) {
      if (!userRoleSupportsPin(current.role)) {
        toast.error(
          t("PIN is available only for owners, managers, and cashiers."),
        );
        return;
      }
      if (!/^[0-9]{4,8}$/.test(pinValue)) {
        toast.error(t("PIN must be 4 to 8 digits."));
        return;
      }
    }
    if (passwordEntered && passwordValue.length < 8) {
      toast.error(t("Password must be at least 8 characters."));
      return;
    }

    startTransition(async () => {
      const result = await updateUserAction(id, {
        ...current,
        deviceIds: SHOW_DEVICE_ACL_UI
          ? current.restrictDevices
            ? current.deviceIds
            : []
          : [],
      });
      if (!result.success) {
        toast.error(result.error ?? t("Could not update user"));
        return;
      }

      if (pinEntered) {
        const pinResult = await resetUserPinAction(id, pinValue);
        if (!pinResult.success) {
          toast.error(
            pinResult.error ?? t("Details were saved, but PIN reset failed"),
          );
          return;
        }
        setPinValue("");
      }

      if (passwordEntered) {
        const passwordResult = await resetUserPasswordAction(id, passwordValue);
        if (!passwordResult.success) {
          toast.error(
            passwordResult.error ??
              t("Details were saved, but password reset failed"),
          );
          return;
        }
        setPasswordValue("");
      }

      toast.success(
        pinEntered || passwordEntered
          ? t("User and login details updated")
          : t("User updated"),
      );
      setEditingUserId(null);
    });
  };

  const create = () => {
    if (!canCreate) {
      toast.error(
        t(
          "Complete the required fields. Password must be at least 8 characters.",
        ),
      );
      return;
    }

    startTransition(async () => {
      const result = await createUserAction({
        ...form,
        deviceIds: SHOW_DEVICE_ACL_UI
          ? form.restrictDevices
            ? form.deviceIds
            : undefined
          : undefined,
      });
      if (result.success) {
        toast.success(t("User created"));
        setForm({
          name: "",
          email: "",
          role: "cashier",
          storeIds: [stores[0]?.id ?? ""].filter(Boolean),
          deviceIds: [],
          restrictDevices: false,
          pin: "",
          password: "",
        });
        return;
      }
      toast.error(result.error ?? t("Could not create user"));
    });
  };

  return (
    <>
      {embedded ? null : (
        <PageHeader
          title={t("Users and roles")}
          description={t("Manage your team and edit each user from one place.")}
        />
      )}

      <Tabs defaultValue="team" className="min-w-0 space-y-3">
        <div className="min-w-0">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="team">{t("Team")}</TabsTrigger>
            <TabsTrigger value="create">{t("Create user")}</TabsTrigger>
            {permissionsData ? (
              <TabsTrigger value="permissions">{t("Permissions")}</TabsTrigger>
            ) : null}
          </TabsList>
        </div>

        <TabsContent value="team">
          {users.length === 0 ? (
            <EmptyStateBlock
              title={t("No users")}
              description={t("Create the first team user from the Create tab.")}
            />
          ) : (
            <div className="grid gap-3">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-card-foreground sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Shield className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.name}</p>
                      <p className="break-all text-sm text-muted-foreground">
                        {u.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      label={t(roleLabel(u.role as UserRole))}
                      variant="info"
                    />
                    <StatusPill
                      label={u.is_active ? t("Active") : t("Inactive")}
                      variant={u.is_active ? "success" : "draft"}
                    />
                    <CompactActions>
                      <CompactAction
                        label={t("Edit")}
                        icon={Pencil}
                        onClick={() => openEditor(u)}
                      />
                    </CompactActions>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="create">
          <OperationalCard title={t("Create user")}>
            <div className="grid max-w-lg gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">{t("Name")}</Label>
                <Input
                  id="create-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email">{t("Email")}</Label>
                <Input
                  id="create-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password">
                  {t("Temporary password")}
                </Label>
                <PasswordInput
                  id="create-password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  minLength={8}
                />
                {form.password.length > 0 && form.password.length < 8 ? (
                  <p className="text-sm text-destructive">
                    {t("Password must be at least 8 characters.")}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-role">{t("Role")}</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => {
                    const role = (v ?? "cashier") as AppUser["role"];
                    setForm({
                      ...form,
                      role,
                      pin: userRoleSupportsPin(role) ? form.pin : "",
                    });
                  }}
                >
                  <SelectTrigger id="create-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {createRoleOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(ROLE_LABELS[r])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {userRoleSupportsPin(form.role) && (
                <div className="space-y-2">
                  <Label htmlFor="create-pin">
                    {form.role === "cashier"
                      ? t("PIN (4–8 digits)")
                      : t("Cashier approval PIN (optional)")}
                  </Label>
                  <Input
                    id="create-pin"
                    value={form.pin}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        pin: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    maxLength={8}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                  {form.role !== "cashier" ? (
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "Used to approve discounts, open the cash drawer, and sell after session expiry. It does not switch the device cashier.",
                      )}
                    </p>
                  ) : null}
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("Store access")}</Label>
                <div className="grid gap-2 rounded-xl border border-border/60 p-3">
                  {stores.map((store) => (
                    <label
                      key={store.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={form.storeIds.includes(store.id)}
                        onCheckedChange={(v) => {
                          const next =
                            v === true
                              ? [...new Set([...form.storeIds, store.id])]
                              : form.storeIds.filter((id) => id !== store.id);
                          setForm({ ...form, storeIds: next });
                        }}
                      />
                      {store.name}
                    </label>
                  ))}
                </div>
              </div>
              {SHOW_DEVICE_ACL_UI && form.role === "cashier" && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={form.restrictDevices}
                      onCheckedChange={(v) =>
                        setForm({
                          ...form,
                          restrictDevices: v === true,
                          deviceIds: v === true ? form.deviceIds : [],
                        })
                      }
                    />
                    {t("Restrict user to specific cashier devices")}
                  </label>
                  {form.restrictDevices ? (
                    <div className="grid gap-2 rounded-xl border border-border/60 p-3">
                      {devices
                        .filter((d) => form.storeIds.includes(d.store_id))
                        .map((device) => (
                          <label
                            key={device.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={form.deviceIds.includes(device.id)}
                              onCheckedChange={(v) => {
                                const next =
                                  v === true
                                    ? [
                                        ...new Set([
                                          ...form.deviceIds,
                                          device.id,
                                        ]),
                                      ]
                                    : form.deviceIds.filter(
                                        (id) => id !== device.id,
                                      );
                                setForm({ ...form, deviceIds: next });
                              }}
                            />
                            {device.name}
                          </label>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "Leave empty to allow all devices in permitted stores.",
                      )}
                    </p>
                  )}
                </div>
              )}
              <Button
                onClick={create}
                disabled={pending || !canCreate}
                className="min-h-10"
              >
                {t("Create user")}
              </Button>
            </div>
          </OperationalCard>
        </TabsContent>

        {permissionsData ? (
          <TabsContent value="permissions" className="space-y-6">
            <PermissionsMatrix
              permissions={permissionsData.permissions}
              matrix={permissionsData.matrix}
            />
            <UserPermissionOverrides
              users={users}
              permissions={permissionsData.permissions}
              initialGrants={permissionsData.userGrants}
            />
          </TabsContent>
        ) : null}
      </Tabs>

      <Sheet
        open={Boolean(editingUser)}
        onOpenChange={(open) => !open && setEditingUserId(null)}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-lg"
        >
          {editingUser && editing ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  {t("Edit")} {editingUser.name}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">{t("Name")}</Label>
                  <Input
                    id="edit-name"
                    value={editing.name}
                    onChange={(e) =>
                      patchEdit(editingUser.id, { name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">{t("Email")}</Label>
                  <Input
                    id="edit-email"
                    value={editing.email}
                    onChange={(e) =>
                      patchEdit(editingUser.id, { email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">{t("Role")}</Label>
                  <Select
                    value={editing.role}
                    onValueChange={(role) =>
                      patchEdit(editingUser.id, {
                        role: (role ?? editingUser.role) as AppUser["role"],
                      })
                    }
                  >
                    <SelectTrigger id="edit-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {editRoleOptions.map((role) => (
                        <SelectItem key={role} value={role}>
                          {t(ROLE_LABELS[role])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={editing.isActive}
                    onCheckedChange={(v) =>
                      patchEdit(editingUser.id, { isActive: v === true })
                    }
                  />
                  {t("Active")}
                </label>

                <div className="space-y-2">
                  <Label>{t("Store access")}</Label>
                  <div className="grid gap-2 rounded-xl border border-border/60 p-3">
                    {stores.map((store) => (
                      <label
                        key={store.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={editing.storeIds.includes(store.id)}
                          onCheckedChange={(v) => {
                            const next =
                              v === true
                                ? [...new Set([...editing.storeIds, store.id])]
                                : editing.storeIds.filter(
                                    (id) => id !== store.id,
                                  );
                            patchEdit(editingUser.id, { storeIds: next });
                          }}
                        />
                        {store.name}
                      </label>
                    ))}
                  </div>
                </div>

                {SHOW_DEVICE_ACL_UI && editing.role === "cashier" ? (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={editing.restrictDevices}
                        onCheckedChange={(v) =>
                          patchEdit(editingUser.id, {
                            restrictDevices: v === true,
                            deviceIds: v === true ? editing.deviceIds : [],
                          })
                        }
                      />
                      {t("Restrict to specific devices")}
                    </label>
                    {editing.restrictDevices ? (
                      <div className="grid gap-2 rounded-xl border border-border/60 p-3">
                        {devices
                          .filter((d) => editing.storeIds.includes(d.store_id))
                          .map((device) => (
                            <label
                              key={device.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <Checkbox
                                checked={editing.deviceIds.includes(device.id)}
                                onCheckedChange={(v) => {
                                  const next =
                                    v === true
                                      ? [
                                          ...new Set([
                                            ...editing.deviceIds,
                                            device.id,
                                          ]),
                                        ]
                                      : editing.deviceIds.filter(
                                          (id) => id !== device.id,
                                        );
                                  patchEdit(editingUser.id, {
                                    deviceIds: next,
                                  });
                                }}
                              />
                              {device.name}
                            </label>
                          ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {userRoleSupportsPin(editing.role) ? (
                  <div className="space-y-2 rounded-xl border border-border/60 p-3">
                    <Label htmlFor="edit-pin">{t("New PIN (optional)")}</Label>
                    <Input
                      id="edit-pin"
                      placeholder={t(
                        "Leave empty to keep it unchanged — 4 to 8 digits",
                      )}
                      maxLength={8}
                      inputMode="numeric"
                      autoComplete="off"
                      className="max-w-[18rem]"
                      value={pinValue}
                      onChange={(e) =>
                        setPinValue(e.target.value.replace(/\D/g, ""))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {editing.role === "cashier"
                        ? t(
                            "The new PIN will be applied when you save changes.",
                          )
                        : t(
                            "This PIN approves discounts, drawer opening, and sales after expiry. It is not the device cashier PIN.",
                          )}
                    </p>
                  </div>
                ) : null}

                {editingUser.auth_user_id ? (
                  <div className="space-y-2 rounded-xl border border-border/60 p-3">
                    <Label htmlFor="edit-password">
                      {t("New password (optional)")}
                    </Label>
                    <div className="w-full max-w-[18rem]">
                      <PasswordInput
                        id="edit-password"
                        placeholder={t(
                          "Leave empty to keep it unchanged — at least 8 characters",
                        )}
                        value={passwordValue}
                        onChange={(e) => setPasswordValue(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "The new password will be applied when you save changes.",
                      )}
                    </p>
                  </div>
                ) : null}
              </div>
              <SheetFooter className="gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => saveUser(editingUser.id)}
                >
                  {t("Save changes")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!editingUser.is_active || pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await deactivateUserAction(editingUser.id);
                      if (result.success) {
                        toast.success(t("User deactivated"));
                        setEditingUserId(null);
                        router.refresh();
                        return;
                      }
                      toast.error(
                        result.error ?? t("Could not deactivate user"),
                      );
                    });
                  }}
                >
                  {t("Deactivate")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => setUserToDelete(editingUser)}
                >
                  {t("Delete permanently")}
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmActionDialog
        open={userToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setUserToDelete(null);
        }}
        title={t("Delete user permanently?")}
        description={
          userToDelete
            ? language === "ar"
              ? `سيُحذف ${userToDelete.name} (${userToDelete.email}) من النظام وحساب الدخول. إذا كان مرتبطًا بطلبات أو جلسات أو مصروفات أو مخزون، استخدم التعطيل بدلًا من الحذف.`
              : `${userToDelete.name} (${userToDelete.email}) will be removed from the system and login account. If the user is linked to orders, sessions, expenses, or inventory, deactivate them instead.`
            : ""
        }
        confirmLabel={t("Delete permanently")}
        destructive
        onConfirm={async () => {
          if (!userToDelete) return;
          const result = await deleteUserPermanentlyAction(userToDelete.id);
          if (!result.success) {
            toast.error(result.error ?? t("Could not delete user permanently"));
            throw new Error(result.error ?? "delete failed");
          }
          toast.success(t("User permanently deleted"));
          setUserToDelete(null);
          setEditingUserId(null);
          router.refresh();
        }}
      />
    </>
  );
}
