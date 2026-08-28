"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n/use-translation";

interface ManagerOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  defaultReason: string;
  confirmLabel?: string;
  onConfirm: (reason: string, pin: string) => void;
}

function ManagerOverrideDialogForm({
  onOpenChange,
  title,
  description,
  defaultReason,
  confirmLabel,
  onConfirm,
}: Omit<ManagerOverrideDialogProps, "open">) {
  const { t } = useTranslation();
  const resolvedDescription = description ?? t("The owner or manager enters their account PIN, not the device cashier PIN.");
  const resolvedConfirmLabel = confirmLabel ? t(confirmLabel) : t("Confirm approval");
  const [reason, setReason] = useState(defaultReason);
  const [pin, setPin] = useState("");

  function handleConfirm() {
    const trimmed = reason.trim();
    const trimmedPin = pin.trim();
    if (!trimmed || trimmedPin.length < 4) return;
    onConfirm(trimmed, trimmedPin);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(94dvh,100%)] max-w-md gap-2.5 overflow-y-auto rounded-2xl p-3 max-sm:max-w-[calc(100%-0.5rem)] sm:max-w-md sm:p-4">
        <DialogHeader className="pe-7 text-start">
          <div className="flex items-center gap-2.5"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="size-4" /></div><div className="min-w-0"><DialogTitle className="text-base">{title}</DialogTitle><DialogDescription className="text-xs">{resolvedDescription}</DialogDescription></div></div>
        </DialogHeader>
        <div className="space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-2">
            <Label className="text-xs" htmlFor="manager-override-pin">{t("Owner or manager PIN")}</Label>
            <Input
              id="manager-override-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              className="h-11 rounded-lg text-center text-sm tracking-[0.25em]"
              dir="ltr"
              aria-describedby="manager-override-pin-hint"
            />
          </div>
          <p id="manager-override-pin-hint" className="text-[11px] text-muted-foreground">
            {t("PIN must be 4 to 8 digits.")}
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="manager-override-reason">{t("Approval reason")}</Label>
            <Textarea
              id="manager-override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="min-h-16 resize-none rounded-lg text-sm"
            />
          </div>
        </div>
        <DialogFooter className="grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-lg"
            onClick={() => onOpenChange(false)}
          >
            {t("Cancel")}
          </Button>
          <Button
            type="button"
            className="h-11 rounded-lg font-semibold"
            onClick={handleConfirm}
            disabled={!reason.trim() || pin.trim().length < 4}
          >
            {resolvedConfirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Remount when opened so defaultReason resets without an effect. */
export function ManagerOverrideDialog(props: ManagerOverrideDialogProps) {
  if (!props.open) return null;
  return <ManagerOverrideDialogForm key={props.defaultReason} {...props} />;
}
