"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, CheckCircle2, ChevronDown, FileText, Loader2, MessageCircle, Printer, ShoppingCart, Usb } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { formatCurrency } from "@/lib/format";
import {
  ReceiptPrint,
  triggerReceiptPrint,
} from "@/modules/pos/components/receipt-print";
import { ReceiptBrandingPreview } from "@/modules/pos/components/receipt-branding-preview";
import {
  normalizeWhatsAppPhone,
  type ReceiptPayload,
} from "@/modules/pos/services/receipt-format.service";
import { DocumentPrintPreviewModal } from "@/components/print/document-print-preview-modal";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PosReceiptSuccessDialogProps {
  open: boolean;
  receipt: ReceiptPayload | null;
  onOpenChange: (open: boolean) => void;
  onUsbPrint: () => void | Promise<void>;
  onBrowserPrint?: () => void | Promise<void>;
  onWhatsApp: (phoneOverride?: string) => void | Promise<void>;
}

type ActionState = { status: "idle" | "pending" | "success" | "error"; message?: string };
const IDLE_ACTION: ActionState = { status: "idle" };

export function PosReceiptSuccessDialog({
  open,
  receipt,
  onOpenChange,
  onUsbPrint,
  onBrowserPrint,
  onWhatsApp,
}: PosReceiptSuccessDialogProps) {
  const [a4Open, setA4Open] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [compactForKeyboard, setCompactForKeyboard] = useState(false);
  const [printState, setPrintState] = useState<ActionState>(IDLE_ACTION);
  const [usbState, setUsbState] = useState<ActionState>(IDLE_ACTION);
  const [whatsAppState, setWhatsAppState] = useState<ActionState>(IDLE_ACTION);
  const [lastAction, setLastAction] = useState<"print" | "usb" | "whatsapp" | null>(null);
  const { t, language } = useTranslation();

  useEffect(() => {
    if (!open) return;
    setA4Open(false);
    setMoreOpen(false);
    setPhone("");
    setPhoneError(null);
    setCompactForKeyboard(false);
    setPrintState(IDLE_ACTION);
    setUsbState(IDLE_ACTION);
    setWhatsAppState(IDLE_ACTION);
    setLastAction(null);
  }, [open, receipt?.orderNumber]);

  if (!receipt) return null;

  const currency = receipt.branding.currency;
  const receiptPhone = receipt.customer?.phone;

  async function handleBrowserPrint() {
    setLastAction("print");
    setPrintState({ status: "pending" });
    try {
      if (onBrowserPrint) {
        await onBrowserPrint();
        setPrintState({ status: "success", message: t("Print dialog opened") });
        return;
      }
      if (typeof document !== "undefined" && !document.getElementById("Velora-receipt")) {
        const message = t("Could not print receipt — receipt is not ready");
        setPrintState({ status: "error", message });
        toast.error(message);
        return;
      }
      // Defer so the print stylesheet applies after paint.
      window.setTimeout(() => triggerReceiptPrint(), 100);
      setPrintState({ status: "success", message: t("Print dialog opened") });
    } catch (error) {
      const message = t(error instanceof Error ? error.message : "Could not print receipt");
      setPrintState({ status: "error", message });
      toast.error(message);
    }
  }

  async function handleUsbPrint() {
    setLastAction("usb");
    setUsbState({ status: "pending" });
    try {
      await onUsbPrint();
      setUsbState({ status: "success", message: t("Receipt sent to USB printer") });
    } catch (error) {
      const message = t(error instanceof Error ? error.message : "Could not print receipt");
      setUsbState({ status: "error", message });
      toast.error(message);
    }
  }

  async function handleWhatsApp() {
    setLastAction("whatsapp");
    setWhatsAppState({ status: "pending" });
    if (receiptPhone) {
      setPhoneError(null);
    } else if (!normalizeWhatsAppPhone(phone)) {
      const message = t("Enter a valid WhatsApp number");
      setPhoneError(message);
      setWhatsAppState({ status: "error", message });
      return;
    }
    try {
      setPhoneError(null);
      await onWhatsApp(receiptPhone ? undefined : phone);
      setWhatsAppState({ status: "success", message: t("WhatsApp opened") });
    } catch (error) {
      const message = t(error instanceof Error ? error.message : "Could not open WhatsApp");
      setWhatsAppState({ status: "error", message });
      toast.error(message);
    }
  }

  const actionState =
    lastAction === "whatsapp"
      ? whatsAppState
      : lastAction === "usb"
        ? usbState
        : lastAction === "print"
          ? printState
          : IDLE_ACTION;
  const actionMessage = actionState.message;
  const actionTone = actionState.status;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(96dvh,100%)] max-w-md flex-col overflow-hidden rounded-2xl p-0 max-sm:max-w-[calc(100%-0.5rem)] sm:max-w-md">
          <DialogHeader className="shrink-0 border-b border-border/70 px-3 py-2.5 text-start sm:px-4 sm:py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 sm:size-11 sm:rounded-xl">
                <CheckCircle2 className="size-5 sm:size-6" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base">{t("Order saved")}</DialogTitle>
                <DialogDescription className="truncate text-sm">
                  {t("Order")} {receipt.orderNumber} · {formatCurrency(receipt.total, currency)}
                  {receipt.customer?.name ? ` · ${receipt.customer.name}` : ""}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div
            className={cn(
              "min-h-0 max-h-[min(22dvh,180px)] flex-1 overflow-y-auto overscroll-y-contain px-3 py-2 sm:max-h-[min(26dvh,210px)] sm:px-4 sm:py-2.5",
              compactForKeyboard && "max-sm:hidden"
            )}
          >
            <ReceiptBrandingPreview receipt={receipt} compact />
          </div>

          <div className="shrink-0 space-y-2.5 border-t border-border/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
            {!receiptPhone ? (
              <div className="grid grid-cols-1 items-center gap-1.5 rounded-lg border border-border/70 bg-muted/35 p-2 min-[360px]:grid-cols-[6.5rem_minmax(0,1fr)] min-[360px]:gap-2">
                <label htmlFor="receipt-whatsapp-phone" className="text-xs font-medium leading-tight">
                  {t("Customer WhatsApp number")}
                </label>
                <Input
                  id="receipt-whatsapp-phone"
                  type="tel"
                  inputMode="tel"
                  enterKeyHint="send"
                  dir="ltr"
                  autoComplete="tel"
                  value={phone}
                  onFocus={() => {
                    setCompactForKeyboard(true);
                    setMoreOpen(false);
                  }}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    if (phoneError) setPhoneError(null);
                    if (whatsAppState.status !== "idle") {
                      setWhatsAppState(IDLE_ACTION);
                      if (lastAction === "whatsapp") setLastAction(null);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleWhatsApp();
                    }
                  }}
                  aria-invalid={Boolean(phoneError)}
                  aria-describedby={phoneError ? "receipt-whatsapp-phone-error" : undefined}
                  placeholder="0100 123 4567"
                  className="h-11 min-w-0 rounded-lg text-start text-sm"
                  disabled={whatsAppState.status === "pending"}
                />
                {phoneError ? (
                  <p id="receipt-whatsapp-phone-error" className="text-xs text-destructive min-[360px]:col-span-2" role="alert">
                    {phoneError}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-1.5">
              <Button className="h-11 rounded-lg px-1.5 text-xs" onClick={() => void handleBrowserPrint()} disabled={printState.status === "pending"}>
                {printState.status === "pending" ? <Loader2 className="size-4 animate-spin" /> : printState.status === "success" ? <Check className="size-4" /> : <Printer className="size-4" />}
                {t("Print")}
              </Button>
              <Button variant="outline" className="h-11 rounded-lg px-1.5 text-xs" onClick={() => void handleWhatsApp()} disabled={whatsAppState.status === "pending"}>
                {whatsAppState.status === "pending" ? <Loader2 className="size-4 animate-spin" /> : whatsAppState.status === "success" ? <Check className="size-4" /> : <MessageCircle className="size-4" />}
                {t("WhatsApp")}
              </Button>
              <Button variant="secondary" className="h-11 rounded-lg px-1.5 text-xs" onClick={() => onOpenChange(false)}>
                <ShoppingCart className="size-4" />
                {t("New sale")}
              </Button>
            </div>

            {actionMessage ? (
              <p
                className={actionTone === "error" ? "flex items-center gap-1.5 text-xs text-destructive" : "flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300"}
                role={actionTone === "error" ? "alert" : "status"}
                aria-live="polite"
              >
                {actionTone === "error" ? <AlertCircle className="size-3.5 shrink-0" /> : <Check className="size-3.5 shrink-0" />}
                <span className="min-w-0 truncate">{actionMessage}</span>
              </p>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 w-full rounded-lg text-xs text-muted-foreground"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((current) => !current)}
            >
              {t("More print options")}
              <ChevronDown className={`size-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
            </Button>
            {moreOpen ? (
              <CompactActions className="w-full justify-center">
                {receipt.orderId ? (
                  <CompactAction
                    label={t("A4 invoice")}
                    icon={FileText}
                    alwaysLabeled
                    className="flex-1 sm:h-11 sm:min-h-11"
                    onClick={() => setA4Open(true)}
                  />
                ) : null}
                <CompactAction
                  label={usbState.status === "pending" ? t("Printing…") : t("USB print")}
                  icon={usbState.status === "pending" ? Loader2 : usbState.status === "success" ? Check : Usb}
                  alwaysLabeled
                  className={cn(
                    "flex-1 sm:h-11 sm:min-h-11",
                    usbState.status === "pending" && "[&_svg]:animate-spin"
                  )}
                  disabled={usbState.status === "pending"}
                  onClick={() => void handleUsbPrint()}
                />
              </CompactActions>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <DocumentPrintPreviewModal
        open={a4Open}
        onOpenChange={setA4Open}
        href={receipt.orderId ? `/print/orders/${receipt.orderId}?embed=1&lang=${language}` : null}
        title={t("Cashier invoice")}
      />
      <ReceiptPrint receipt={receipt} />
    </>
  );
}
