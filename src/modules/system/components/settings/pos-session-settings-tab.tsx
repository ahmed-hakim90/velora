"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { OperationalCard } from "@/components/Velora/operational-card";
import {
  updateFeatureFlagsAction,
  updateOrgSettingsAction,
  updateReceiptFooterAction,
  updateReceiptHeaderAction,
  updateSessionSettingsAction,
} from "@/modules/system/actions/system.actions";
import {
  POS_OPERATIONAL_FEATURE_FLAGS,
  type FeatureFlag,
} from "@/lib/constants";
import type { SessionSettings } from "@/lib/types";
import { useTranslation } from "@/lib/i18n/use-translation";

const operationalFlagLabels: Record<
  (typeof POS_OPERATIONAL_FEATURE_FLAGS)[number],
  string
> = {
  payment_cash: "الدفع النقدي",
  payment_card: "الدفع بالكارت",
  payment_wallet: "الدفع بالمحفظة",
  payment_other: "طرق دفع أخرى",
  receipt_printing: "طباعة الإيصالات",
  cash_drawer: "درج النقدية",
  tax: "الضريبة",
};

interface PosSessionSettingsTabProps {
  canManageSettings: boolean;
  canManageSessions: boolean;
  org?: {
    taxRate: number;
    taxInclusive: boolean;
  };
  receiptHeader?: string;
  receiptFooter?: string;
  featureFlags?: Record<FeatureFlag, boolean>;
  sessionSettings: SessionSettings;
}

export function PosSessionSettingsTab({
  canManageSettings,
  canManageSessions,
  org,
  receiptHeader = "",
  receiptFooter = "",
  featureFlags,
  sessionSettings,
}: PosSessionSettingsTabProps) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [sessionForm, setSessionForm] = useState(sessionSettings);
  const [posForm, setPosForm] = useState({
    taxRate: org?.taxRate ?? 0,
    taxInclusive: org?.taxInclusive ?? true,
    receiptHeader,
    receiptFooter,
    operationalFlags: Object.fromEntries(
      POS_OPERATIONAL_FEATURE_FLAGS.map((flag) => [
        flag,
        featureFlags?.[flag] ?? true,
      ]),
    ) as Record<(typeof POS_OPERATIONAL_FEATURE_FLAGS)[number], boolean>,
  });

  return (
    <div className="space-y-6">
      {canManageSettings && org && featureFlags ? (
        <OperationalCard title={t("Receipts, tax, and payments")}>
          <div className="grid max-w-lg gap-4">
            <div className="space-y-2">
              <Label>{t("Tax rate (%)")}</Label>
              <Input
                type="number"
                step={0.01}
                value={posForm.taxRate * 100}
                onChange={(e) =>
                  setPosForm({
                    ...posForm,
                    taxRate: (parseFloat(e.target.value) || 0) / 100,
                  })
                }
              />
            </div>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={posForm.taxInclusive}
                onCheckedChange={(v) =>
                  setPosForm({ ...posForm, taxInclusive: v === true })
                }
              />
              <span className="text-sm">{t("Prices include tax")}</span>
            </label>
            <div className="space-y-2">
              <Label>{t("Receipt header")}</Label>
              <Input
                value={posForm.receiptHeader}
                onChange={(e) =>
                  setPosForm({ ...posForm, receiptHeader: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Receipt footer")}</Label>
              <Input
                value={posForm.receiptFooter}
                onChange={(e) =>
                  setPosForm({ ...posForm, receiptFooter: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Payment and receipt options")}</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {POS_OPERATIONAL_FEATURE_FLAGS.map((flag) => (
                  <label
                    key={flag}
                    className="flex items-center gap-2 rounded-[var(--mds-radius-lg)] border border-border/60 p-[var(--mds-space-3)]"
                  >
                    <Checkbox
                      checked={posForm.operationalFlags[flag]}
                      onCheckedChange={(v) =>
                        setPosForm({
                          ...posForm,
                          operationalFlags: {
                            ...posForm.operationalFlags,
                            [flag]: v === true,
                          },
                        })
                      }
                    />
                    <span className="text-sm">
                      {t(operationalFlagLabels[flag])}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await updateOrgSettingsAction({
                      taxRate: posForm.taxRate,
                      taxInclusive: posForm.taxInclusive,
                    });
                    await updateReceiptHeaderAction(posForm.receiptHeader);
                    await updateReceiptFooterAction(posForm.receiptFooter);
                    await updateFeatureFlagsAction(posForm.operationalFlags);
                    toast.success(t("Cashier settings saved"));
                  } catch {
                    toast.error(t("Could not save"));
                  }
                })
              }
            >
              {t("Save receipt and payment settings")}
            </Button>
          </div>
        </OperationalCard>
      ) : null}

      {canManageSessions ? (
        <OperationalCard title={t("Session / shift settings")}>
          <div className="grid max-w-lg gap-4">
            <div className="space-y-2">
              <Label>{t("Maximum open hours")}</Label>
              <Input
                type="number"
                min={1}
                value={sessionForm.max_open_hours}
                onChange={(e) =>
                  setSessionForm({
                    ...sessionForm,
                    max_open_hours: parseFloat(e.target.value) || 24,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Warn after hours")}</Label>
              <Input
                type="number"
                min={0}
                value={sessionForm.warn_after_hours}
                onChange={(e) =>
                  setSessionForm({
                    ...sessionForm,
                    warn_after_hours: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={sessionForm.block_sales_when_expired}
                onCheckedChange={(v) =>
                  setSessionForm({
                    ...sessionForm,
                    block_sales_when_expired: v === true,
                  })
                }
              />
              <span className="text-sm">
                {t("Block sales when the session expires")}
              </span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={sessionForm.require_manager_override_for_expired_sale}
                onCheckedChange={(v) =>
                  setSessionForm({
                    ...sessionForm,
                    require_manager_override_for_expired_sale: v === true,
                  })
                }
              />
              <span className="text-sm">
                {t("Require manager approval for sales after expiry")}
              </span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={sessionForm.allow_manager_force_close}
                onCheckedChange={(v) =>
                  setSessionForm({
                    ...sessionForm,
                    allow_manager_force_close: v === true,
                  })
                }
              />
              <span className="text-sm">
                {t("Allow managers to force-close sessions")}
              </span>
            </label>
            <div className="space-y-2">
              <Label>
                {t("Require manager approval above discount amount")}
              </Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={sessionForm.manager_discount_override_amount ?? ""}
                placeholder={t("No limit")}
                onChange={(e) =>
                  setSessionForm({
                    ...sessionForm,
                    manager_discount_override_amount:
                      e.target.value === ""
                        ? null
                        : Math.max(0, parseFloat(e.target.value) || 0),
                  })
                }
              />
            </div>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await updateSessionSettingsAction({
                      max_open_hours: sessionForm.max_open_hours,
                      warn_after_hours: sessionForm.warn_after_hours,
                      block_sales_when_expired:
                        sessionForm.block_sales_when_expired,
                      require_manager_override_for_expired_sale:
                        sessionForm.require_manager_override_for_expired_sale,
                      allow_manager_force_close:
                        sessionForm.allow_manager_force_close,
                      manager_discount_override_amount:
                        sessionForm.manager_discount_override_amount,
                    });
                    toast.success(t("Session settings saved"));
                  } catch {
                    toast.error(t("Could not save"));
                  }
                })
              }
            >
              {t("Save session settings")}
            </Button>
          </div>
        </OperationalCard>
      ) : null}
    </div>
  );
}
