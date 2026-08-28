"use client";

import { useState, useTransition } from "react";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationalCard } from "@/components/Velora/operational-card";
import {
  updateOrgSettingsAction,
  uploadOrganizationLogoAction,
} from "@/modules/system/actions/system.actions";
import { languageOptions } from "@/lib/i18n/translations";
import type { Organization } from "@/lib/types";
import { useUiStore } from "@/stores/ui-store";
import { useTranslation } from "@/lib/i18n/use-translation";

interface BusinessSettingsTabProps {
  org: {
    organization: Organization;
    taxRate: number;
    taxInclusive: boolean;
  };
}

export function BusinessSettingsTab({ org }: BusinessSettingsTabProps) {
  const [pending, startTransition] = useTransition();
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);
  const { t } = useTranslation();
  const [logoUrl, setLogoUrl] = useState(org.organization.logo_url ?? "");
  const [form, setForm] = useState({
    name: org.organization.name,
    timezone: org.organization.timezone || "Africa/Cairo",
    country: org.organization.country || "EG",
    phone: (org.organization.settings.phone as string | undefined) ?? "",
    address: (org.organization.settings.address as string | undefined) ?? "",
  });

  return (
    <div className="space-y-6">
      <OperationalCard title={t("Store details")}>
        <div className="grid max-w-lg gap-4">
          <div className="space-y-2">
            <Label>{t("Business Name")}</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("Logo")}</Label>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={t("Store logo")} className="mb-2 h-16 w-16 rounded-lg object-cover" />
            )}
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                startTransition(async () => {
                  try {
                    const fd = new FormData();
                    fd.set("logo", file);
                    const url = await uploadOrganizationLogoAction(fd);
                    setLogoUrl(url);
                    toast.success(t("Logo uploaded"));
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : t("Upload failed"));
                  }
                });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("Phone")}</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("Address")}</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("Country")}</Label>
            <Input
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("Currency")}</Label>
              <Input value="EGP" readOnly disabled aria-label={t("Currency")} />
              <p className="text-xs text-muted-foreground">{t("EGP is used across the system.")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("Timezone")}</Label>
              <Input
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2 border-t border-border/60 pt-4">
            <Label>{t("App language")}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Languages className="size-4 text-muted-foreground" />
              <div className="inline-flex rounded-md border border-border/70 bg-muted p-1">
                {languageOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={language === option.value ? "default" : "ghost"}
                    className="h-7 rounded-sm"
                    onClick={() => setLanguage(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await updateOrgSettingsAction({
                    name: form.name,
                    currency: "EGP",
                    timezone: form.timezone,
                    country: form.country,
                    phone: form.phone,
                    address: form.address,
                  });
                  toast.success(t("Store settings saved"));
                } catch {
                  toast.error(t("Failed to save"));
                }
              })
            }
          >
            {t("Save store settings")}
          </Button>
        </div>
      </OperationalCard>
    </div>
  );
}
