"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { pairDeviceWithCodeAction } from "@/modules/auth/actions/device.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n/use-translation";

export function DevicePairForm({ returnTo }: { returnTo?: string }) {
  const { t } = useTranslation();
  const from = returnTo?.startsWith("/") ? returnTo : "/pos";
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await pairDeviceWithCodeAction(code);
      if (result.success) {
        toast.success(t("Device paired."));
        window.location.assign(from.startsWith("/") ? from : "/pos");
      } else {
        toast.error(result.error ? t(result.error) : t("Could not pair the device."));
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-[var(--mds-radius-xl)] border border-border bg-card shadow-[var(--mds-elevation-3)]">
      <div className="h-1.5 w-full bg-[var(--mds-color-action-primary)]" aria-hidden />
      <div className="space-y-[var(--mds-space-5)] p-[var(--mds-space-8)]">
        <div className="flex flex-col items-center text-center">
          <div className="mb-[var(--mds-space-4)] flex size-12 items-center justify-center rounded-[var(--mds-radius-md)] bg-[var(--mds-color-action-primary)] text-[var(--mds-color-text-inverse)]">
            <MonitorSmartphone className="size-6" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{t("Pair POS device")}</h1>
          <p className="mt-[var(--mds-space-2)] text-sm text-muted-foreground">
            {t("Enter the one-time code from Settings → Devices. The code expires after 15 minutes.")}
          </p>
        </div>

        <div className="rounded-[var(--mds-radius-lg)] border border-[color-mix(in_srgb,var(--mds-color-feedback-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--mds-color-feedback-warning)_10%,transparent)] p-[var(--mds-space-4)] text-sm">
          <p className="font-medium text-foreground">{t("Why am I seeing this?")}</p>
          <p className="mt-1 text-muted-foreground">
            {t("This browser is not registered as a POS device for the current branch. A new code may be needed after changing the URL, clearing cookies, disabling the device, or switching branches.")}
          </p>
          <ul className="mt-3 list-disc space-y-1 pe-5 text-xs text-muted-foreground">
            <li>{t("Use the same URL every day.")}</li>
            <li>{t("Refreshing does not remove pairing unless cookies are cleared or blocked.")}</li>
            <li>{t("If the branch changes, pair the device again from Settings → Devices.")}</li>
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pair-code">{t("Pairing code")}</Label>
          <Input
            id="pair-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t("8-character code")}
            className="h-11 rounded-[var(--mds-radius-md)] font-mono uppercase tracking-widest"
            maxLength={12}
            autoComplete="off"
          />
        </div>
        <Button
          type="button"
          className="h-10 w-full"
          disabled={pending || code.trim().length < 6}
          onClick={submit}
        >
          {pending ? t("Pairing…") : t("Pair device")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {t("You must")} {" "}
          <Link
            href={`/login?from=${encodeURIComponent("/device/pair")}`}
            className="text-[var(--mds-color-action-primary)] underline-offset-4 hover:underline"
          >
            {t("sign in")}
          </Link>{" "}
          {t("before pairing this device.")}
        </p>
      </div>
    </div>
  );
}
