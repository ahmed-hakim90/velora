"use client";

import { useState, useTransition } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Store } from "lucide-react";
import { toast } from "sonner";
import { setActiveStoreAction } from "@/modules/auth/actions/set-store.action";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PosLogoutButton } from "@/modules/pos/components/pos-logout-button";
import { PosSetupStepper } from "@/modules/pos/components/pos-setup-stepper";
import { selectLabelById } from "@/lib/select-label";
import type { Store as StoreType } from "@/lib/types";
import { useTranslation } from "@/lib/i18n/use-translation";

interface PosStoreGateProps {
  stores: StoreType[];
  activeStoreId?: string | null;
  title?: string;
  description?: string;
  /** Explicit readiness for stepper — do not infer from title copy. */
  readinessState?: "store_required" | "store_mismatch";
}

export function PosStoreGate({
  stores,
  activeStoreId,
  title = "Choose store",
  description = "Choose the store where you will use the POS.",
  readinessState = "store_required",
}: PosStoreGateProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(activeStoreId ?? stores[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  function handleContinue() {
    if (!selectedId) {
      toast.error(t("Choose a store to continue"));
      return;
    }
    startTransition(async () => {
      try {
        await setActiveStoreAction(selectedId);
        router.refresh();
      } catch (error) {
        toast.error(t(error instanceof Error ? error.message : "Could not select store"));
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Store className="size-5 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">{t(title)}</span>
        </div>
        <PosLogoutButton />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-y-contain px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-6">
        <PosSetupStepper state={readinessState} className="mb-1.5" />
        <div className="w-full max-w-md space-y-3 rounded-xl border bg-card p-3 shadow-md ring-1 ring-foreground/5 sm:space-y-4 sm:p-4">
          <div className="space-y-1 text-center">
            <h1 className="text-lg font-semibold tracking-tight">{t(title)}</h1>
            <p className="text-xs text-muted-foreground">{t(description)}</p>
          </div>

          {stores.length === 0 ? (
            <p className="rounded-xl bg-muted/60 px-4 py-3 text-center text-sm text-muted-foreground">
              {t("No store is available for your account. Ask a manager for access.")}
            </p>
          ) : stores.length <= 4 ? (
            <div className="grid gap-1.5">
              {stores.map((store) => {
                const selected = selectedId === store.id;
                return (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => setSelectedId(store.id)}
                    className={
                      selected
                        ? "flex min-h-11 items-center justify-between rounded-lg border-2 border-primary bg-primary/5 px-3 py-2 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        : "flex min-h-11 items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-start hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    }
                    aria-pressed={selected}
                  >
                    <span className="truncate text-sm font-semibold">{store.name}</span>
                    {selected ? (
                      <span className="shrink-0 text-xs font-medium text-primary">{t("Selected")}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="pos-store">{t("Store")}</Label>
              <Select value={selectedId} onValueChange={(value) => setSelectedId(value ?? "")}>
                <SelectTrigger id="pos-store" className="h-11 rounded-lg text-sm">
                  <SelectValue placeholder={t("Choose store")}>
                    {(value) => selectLabelById(stores, value, (s) => s.name)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id} label={store.name}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            className="h-12 w-full rounded-xl text-sm font-semibold"
            disabled={pending || !selectedId}
            onClick={handleContinue}
          >
            {pending ? t("Saving…") : t("Continue")}
          </Button>
        </div>
      </div>
    </div>
  );
}
