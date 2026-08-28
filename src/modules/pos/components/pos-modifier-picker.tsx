"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorStateBlock, LoadingStateBlock } from "@/components/Velora/state-blocks";
import { listActiveModifiersForPosAction } from "@/modules/products/actions/product-modifiers.actions";
import type { ProductModifierGroup } from "@/modules/products/services/product-modifiers.service";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/use-translation";

export function PosModifierPicker(props: {
  open: boolean;
  productName: string;
  productId: string;
  currency: string;
  onClose: () => void;
  onConfirm: (modifiers: { name: string; price: number }[]) => void;
}) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<ProductModifierGroup[]>([]);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!props.open) return;
    setLoading(true);
    setLoadError(null);
    setSelectionError(null);
    setSelected({});
    void listActiveModifiersForPosAction(props.productId)
      .then((next) => {
        setGroups(next);
        if (next.length === 0) {
          props.onConfirm([]);
          props.onClose();
        }
      })
      .catch((error) => {
        const message = t(error instanceof Error ? error.message : "Could not load modifiers");
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open/productId drive load
  }, [loadAttempt, props.open, props.productId]);

  function toggle(groupId: string, modifierId: string, maxSelect: number) {
    setSelectionError(null);
    setSelected((prev) => {
      const current = new Set(prev[groupId] ?? []);
      if (current.has(modifierId)) {
        current.delete(modifierId);
      } else {
        if (current.size >= maxSelect) {
          if (maxSelect === 1) current.clear();
          else return prev;
        }
        current.add(modifierId);
      }
      return { ...prev, [groupId]: current };
    });
  }

  function confirm() {
    for (const group of groups) {
      const count = selected[group.id]?.size ?? 0;
      if (count < group.minSelect) {
        setSelectionError(`${t("Choose at least")} ${group.minSelect} ${t("from")} “${group.name}”`);
        return;
      }
    }
    const mods: { name: string; price: number }[] = [];
    for (const group of groups) {
      const ids = selected[group.id] ?? new Set();
      for (const mod of group.modifiers) {
        if (ids.has(mod.id)) {
          mods.push({ name: mod.name, price: mod.priceDelta });
        }
      }
    }
    props.onConfirm(mods);
    props.onClose();
  }

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="flex max-h-[min(92dvh,100%)] max-w-md flex-col gap-0 overflow-hidden p-0 max-sm:max-w-[calc(100%-0.5rem)] sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-border/60 px-3 py-2.5 text-start sm:px-4 sm:py-3">
          <DialogTitle className="truncate pe-7 text-base sm:text-lg">
            {t("Modifiers")} — {props.productName}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <LoadingStateBlock
            label={t("Loading…")}
            className="m-3 min-h-0 flex-1 border-0 shadow-none"
          />
        ) : loadError ? (
          <ErrorStateBlock
            title={t("Could not load modifiers")}
            description={loadError}
            retryLabel={t("Try again")}
            onRetry={() => setLoadAttempt((current) => current + 1)}
            className="m-3 min-h-0 flex-1 border-0 px-3 py-5 shadow-none"
          />
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-2.5 py-2.5 sm:px-3">
            {groups.map((group) => (
              <div key={group.id} className="space-y-1.5">
                <p className="px-0.5 text-xs font-semibold">
                  {group.name}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({group.minSelect}–{group.maxSelect})
                  </span>
                </p>
                <ul className="space-y-1">
                  {group.modifiers.map((mod) => {
                    const checked = selected[group.id]?.has(mod.id) ?? false;
                    return (
                      <li key={mod.id}>
                        <label
                          className={cn(
                            "flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition active:scale-[0.99]",
                            checked
                              ? "border-primary/50 bg-primary/5"
                              : "border-border/70 bg-card hover:bg-muted/40"
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                toggle(group.id, mod.id, group.maxSelect)
                              }
                            />
                            <span className="truncate font-medium">{mod.name}</span>
                          </span>
                          <span dir="ltr" className="shrink-0 tabular-nums text-muted-foreground">
                            {mod.priceDelta === 0
                              ? "—"
                              : formatCurrency(mod.priceDelta, props.currency)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
        {selectionError ? (
          <p className="shrink-0 border-t border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">
            {selectionError}
          </p>
        ) : null}
        <DialogFooter className="mx-0 mb-0 grid shrink-0 grid-cols-2 gap-1.5 border-t border-border/60 px-2.5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3 sm:py-2.5 sm:pb-2.5">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-lg"
            onClick={props.onClose}
          >
            {t("Cancel")}
          </Button>
          <Button
            type="button"
            className="h-11 rounded-lg font-semibold"
            onClick={confirm}
            disabled={loading || Boolean(loadError)}
          >
            {t("Add to cart")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
