"use client";

import { useState, useTransition } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { OperationalCard } from "@/components/Velora/operational-card";
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import {
  applyBusinessActivityPresetAction,
  updateBusinessActivitySettingsAction,
} from "@/modules/system/actions/system.actions";
import {
  BUSINESS_ACTIVITY_TYPES,
  BUSINESS_ACTIVITY_TYPE_LABELS,
  EXPIRY_POLICIES,
  INVENTORY_ROTATION_METHODS,
  INVENTORY_TRACKING_MODES,
  SALES_MODES,
  type BusinessActivitySettings,
  type BusinessActivityType,
  type ExpiryPolicy,
  type InventoryRotationMethod,
  type InventoryTrackingMode,
  type SalesMode,
} from "@/lib/constants";
import {
  EXPIRY_POLICY_LABELS,
  INVENTORY_ROTATION_METHOD_LABELS,
  INVENTORY_TRACKING_MODE_LABELS,
} from "@/lib/labels/inventory";
import { describeActivityPresetChanges } from "@/lib/business-activity-settings-summary";
import { variantsLockedByActivity } from "@/lib/business-activity-flags";
import { PosSetupGuide } from "@/modules/system/components/settings/pos-setup-guide";
import { useTranslation } from "@/lib/i18n/use-translation";

const SALES_MODE_LABELS: Record<SalesMode, string> = {
  retail: "تجزئة",
  wholesale: "جملة",
};

const selectClassName =
  "flex h-9 w-full rounded-[var(--mds-radius-md)] border border-input bg-transparent px-3 text-sm";

interface ActivitySettingsTabProps {
  businessActivity: BusinessActivitySettings;
}

export function ActivitySettingsTab({
  businessActivity,
}: ActivitySettingsTabProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<BusinessActivitySettings>(businessActivity);
  const [presetConfirmOpen, setPresetConfirmOpen] = useState(false);
  const [saveTypeConfirmOpen, setSaveTypeConfirmOpen] = useState(false);

  const [syncedActivity, setSyncedActivity] = useState(businessActivity);
  if (businessActivity !== syncedActivity) {
    setSyncedActivity(businessActivity);
    setForm(businessActivity);
  }

  const activityChanged = form.activity_type !== businessActivity.activity_type;

  const toggleSalesMode = (mode: SalesMode, enabled: boolean) => {
    setForm((prev) => {
      const enabled_sales_modes = enabled
        ? Array.from(new Set([...prev.enabled_sales_modes, mode]))
        : prev.enabled_sales_modes.filter((m) => m !== mode);
      const safeModes =
        enabled_sales_modes.length > 0
          ? enabled_sales_modes
          : (["retail"] as SalesMode[]);
      const default_sales_mode = safeModes.includes(prev.default_sales_mode)
        ? prev.default_sales_mode
        : safeModes[0]!;
      return { ...prev, enabled_sales_modes: safeModes, default_sales_mode };
    });
  };

  const persistSettings = async () => {
    try {
      await updateBusinessActivitySettingsAction(form);
      toast.success(t("Activity settings saved"));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Could not save"));
      throw error;
    }
  };

  const requestSave = () => {
    if (activityChanged) {
      setSaveTypeConfirmOpen(true);
      return;
    }
    startTransition(async () => {
      try {
        await persistSettings();
      } catch {
        // toast already shown in persistSettings
      }
    });
  };

  const applyPreset = async () => {
    try {
      await applyBusinessActivityPresetAction(form.activity_type);
      toast.success(t("Default activity settings applied"));
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("Could not apply settings"),
      );
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <PosSetupGuide activityType={form.activity_type} />
      <OperationalCard title={t("Business activity")}>
        <div className="grid max-w-lg gap-4">
          <div className="space-y-2">
            <Label htmlFor="activity-type">{t("Business activity")}</Label>
            <select
              id="activity-type"
              className={selectClassName}
              value={form.activity_type}
              onChange={(e) =>
                setForm({
                  ...form,
                  activity_type: e.target.value as BusinessActivityType,
                  ...(variantsLockedByActivity(
                    e.target.value as BusinessActivityType,
                  )
                    ? { enable_variants: false }
                    : {}),
                })
              }
            >
              {BUSINESS_ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(BUSINESS_ACTIVITY_TYPE_LABELS[type])}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setPresetConfirmOpen(true)}
            >
              {t("Apply default settings")}
            </Button>
          </div>
          <div className="rounded-[var(--mds-radius-md)] border border-border bg-muted/30 p-3 text-sm">
            <p className="mb-2 font-medium">
              {t("What changes with this activity?")}
            </p>
            <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
              {describeActivityPresetChanges(form.activity_type, language).map(
                (line) => (
                  <li key={line}>{line}</li>
                ),
              )}
            </ul>
          </div>
        </div>
      </OperationalCard>

      <OperationalCard title={t("Sales modes")}>
        <div className="grid max-w-lg gap-4">
          <div className="space-y-2">
            <Label>{t("Enabled modes")}</Label>
            <div className="flex flex-wrap gap-3">
              {SALES_MODES.map((mode) => (
                <label key={mode} className="flex items-center gap-2">
                  <Checkbox
                    checked={form.enabled_sales_modes.includes(mode)}
                    onCheckedChange={(v) => toggleSalesMode(mode, v === true)}
                  />
                  <span className="text-sm">{t(SALES_MODE_LABELS[mode])}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="default-sales-mode">{t("Default mode")}</Label>
            <select
              id="default-sales-mode"
              className={selectClassName}
              value={form.default_sales_mode}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_sales_mode: e.target.value as SalesMode,
                })
              }
            >
              {form.enabled_sales_modes.map((mode) => (
                <option key={mode} value={mode}>
                  {t(SALES_MODE_LABELS[mode])}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_piece_sales}
              onCheckedChange={(v) =>
                setForm({ ...form, enable_piece_sales: v === true })
              }
            />
            <span className="text-sm">{t("Sell by piece")}</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_weight_sales}
              onCheckedChange={(v) =>
                setForm({ ...form, enable_weight_sales: v === true })
              }
            />
            <span className="text-sm">{t("Sell by weight")}</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_price_by_amount}
              onCheckedChange={(v) =>
                setForm({ ...form, enable_price_by_amount: v === true })
              }
            />
            <span className="text-sm">
              {t("Sell by amount instead of weight")}
            </span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_variants}
              disabled={variantsLockedByActivity(form.activity_type)}
              onCheckedChange={(v) =>
                setForm({ ...form, enable_variants: v === true })
              }
            />
            <span className="text-sm">
              {t("Product variants")}
              {variantsLockedByActivity(form.activity_type) ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {form.activity_type === "pharmacy"
                    ? t("Disabled for pharmacies")
                    : t("Disabled for supermarkets")}
                </span>
              ) : null}
            </span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_wholesale_sales}
              onCheckedChange={(v) =>
                setForm({ ...form, enable_wholesale_sales: v === true })
              }
            />
            <span className="text-sm">{t("Wholesale sales")}</span>
          </label>
          {form.enable_wholesale_sales ? (
            <div className="grid gap-3 rounded-[var(--mds-radius-lg)] border border-border/60 p-3">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={form.allow_cashier_wholesale}
                  onCheckedChange={(v) =>
                    setForm({ ...form, allow_cashier_wholesale: v === true })
                  }
                />
                <span className="text-sm">
                  {t("Allow cashier wholesale sales")}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={form.require_manager_for_wholesale}
                  onCheckedChange={(v) =>
                    setForm({
                      ...form,
                      require_manager_for_wholesale: v === true,
                    })
                  }
                />
                <span className="text-sm">
                  {t("Require manager approval for wholesale")}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={form.auto_apply_wholesale_by_quantity}
                  onCheckedChange={(v) =>
                    setForm({
                      ...form,
                      auto_apply_wholesale_by_quantity: v === true,
                    })
                  }
                />
                <span className="text-sm">
                  {t("Apply wholesale pricing automatically by quantity")}
                </span>
              </label>
            </div>
          ) : null}
        </div>
      </OperationalCard>

      <OperationalCard title={t("Default inventory settings")}>
        <div className="grid max-w-lg gap-4">
          <div className="space-y-2">
            <Label htmlFor="tracking-mode">
              {t("Default tracking method")}
            </Label>
            <select
              id="tracking-mode"
              className={selectClassName}
              value={form.default_inventory_tracking_mode}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_inventory_tracking_mode: e.target
                    .value as InventoryTrackingMode,
                })
              }
            >
              {INVENTORY_TRACKING_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {t(INVENTORY_TRACKING_MODE_LABELS[mode])}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rotation-method">{t("Rotation method")}</Label>
            <select
              id="rotation-method"
              className={selectClassName}
              value={form.default_inventory_rotation_method}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_inventory_rotation_method: e.target
                    .value as InventoryRotationMethod,
                })
              }
            >
              {INVENTORY_ROTATION_METHODS.map((method) => (
                <option key={method} value={method}>
                  {t(INVENTORY_ROTATION_METHOD_LABELS[method])}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiry-policy">{t("Expiry policy")}</Label>
            <select
              id="expiry-policy"
              className={selectClassName}
              value={form.default_expiry_policy}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_expiry_policy: e.target.value as ExpiryPolicy,
                })
              }
            >
              {EXPIRY_POLICIES.map((policy) => (
                <option key={policy} value={policy}>
                  {t(EXPIRY_POLICY_LABELS[policy])}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_batch_tracking}
              onCheckedChange={(v) =>
                setForm({ ...form, enable_batch_tracking: v === true })
              }
            />
            <span className="text-sm">{t("Batch tracking")}</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_expiry_tracking}
              onCheckedChange={(v) =>
                setForm({ ...form, enable_expiry_tracking: v === true })
              }
            />
            <span className="text-sm">{t("Expiry tracking")}</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_serial_tracking}
              onCheckedChange={(v) =>
                setForm({ ...form, enable_serial_tracking: v === true })
              }
            />
            <span className="text-sm">{t("Serial number tracking")}</span>
          </label>
          <Button type="button" disabled={pending} onClick={requestSave}>
            {t("Save activity settings")}
          </Button>
        </div>
      </OperationalCard>

      <ConfirmActionDialog
        open={presetConfirmOpen}
        onOpenChange={setPresetConfirmOpen}
        title={t("Apply activity settings?")}
        description={
          language === "ar"
            ? activityChanged
              ? `سيتغيّر النشاط من «${BUSINESS_ACTIVITY_TYPE_LABELS[businessActivity.activity_type]}» إلى «${BUSINESS_ACTIVITY_TYPE_LABELS[form.activity_type]}»، وستُطبق إعدادات البيع والمنتجات الافتراضية.`
              : `ستُطبق إعدادات «${BUSINESS_ACTIVITY_TYPE_LABELS[form.activity_type]}» الافتراضية بدل التخصيصات الحالية.`
            : activityChanged
              ? `The activity will change from “${t(BUSINESS_ACTIVITY_TYPE_LABELS[businessActivity.activity_type])}” to “${t(BUSINESS_ACTIVITY_TYPE_LABELS[form.activity_type])}”, and the default sales and product settings will be applied.`
              : `The default “${t(BUSINESS_ACTIVITY_TYPE_LABELS[form.activity_type])}” settings will replace the current custom settings.`
        }
        confirmLabel={t("Apply settings")}
        destructive={activityChanged}
        onConfirm={applyPreset}
      />

      <ConfirmActionDialog
        open={saveTypeConfirmOpen}
        onOpenChange={setSaveTypeConfirmOpen}
        title={t("Change business activity?")}
        description={
          language === "ar"
            ? `سيتغيّر النشاط من «${BUSINESS_ACTIVITY_TYPE_LABELS[businessActivity.activity_type]}» إلى «${BUSINESS_ACTIVITY_TYPE_LABELS[form.activity_type]}» مع الإعدادات الحالية. لتطبيق كل الإعدادات الافتراضية، اختر «تطبيق الإعدادات الافتراضية».`
            : `The activity will change from “${t(BUSINESS_ACTIVITY_TYPE_LABELS[businessActivity.activity_type])}” to “${t(BUSINESS_ACTIVITY_TYPE_LABELS[form.activity_type])}” with the current settings. To apply all defaults, choose “Apply default settings”.`
        }
        confirmLabel={t("Save change")}
        destructive
        onConfirm={persistSettings}
      />
    </div>
  );
}
