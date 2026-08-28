"use client";

import { FileText, MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ReceiptPrint,
  triggerReceiptPrint,
} from "@/modules/pos/components/receipt-print";
import { ReceiptBrandingPreview } from "@/modules/pos/components/receipt-branding-preview";
import {
  buildWhatsAppReceiptUrl,
  type ReceiptPayload,
} from "@/modules/pos/services/receipt-format.service";
import { printReceiptViaUsb } from "@/modules/pos/services/receipt-usb-printer.service";
import { DocumentPrintPreviewModal } from "@/components/print/document-print-preview-modal";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";

interface ReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: ReceiptPayload | null;
}

export function ReceiptModal({ open, onOpenChange, receipt }: ReceiptModalProps) {
  const [a4Open, setA4Open] = useState(false);
  const { t, language } = useTranslation();
  if (!receipt) return null;

  async function handleUsbPrint() {
    try {
      await printReceiptViaUsb(receipt!);
      toast.success(t("Receipt sent to USB printer"));
    } catch (error) {
      toast.error(t(error instanceof Error ? error.message : "Could not print receipt"));
    }
  }

  function handleBrowserPrint() {
    setTimeout(() => triggerReceiptPrint(), 50);
  }

  function handleWhatsApp() {
    const url = buildWhatsAppReceiptUrl(receipt!);
    if (!url) {
      toast.error(t("Customer phone number is not valid for WhatsApp"));
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[94dvh] max-w-md overflow-hidden rounded-2xl p-0 max-sm:max-w-[calc(100%-0.5rem)]">
          <DialogHeader className="border-b border-border/70 px-4 py-3">
            <DialogTitle className="flex items-center justify-between gap-2 pe-8">
              <span>{t("Receipt")} {receipt.orderNumber}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[calc(94dvh-120px)] overflow-y-auto px-3 py-2.5">
            <ReceiptBrandingPreview receipt={receipt} />
          </div>

          <div className="grid grid-cols-3 gap-1.5 border-t border-border/70 p-2.5">
            <Button type="button" className="h-11 rounded-lg px-2 text-xs" onClick={handleUsbPrint}>
              <Printer className="size-4" />
              {t("USB print")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-lg px-2 text-xs"
              onClick={handleWhatsApp}
              disabled={!receipt.customer?.phone}
            >
              <MessageCircle className="size-4" />
              <span>{t("WhatsApp")}</span>
            </Button>
            {receipt.orderId ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-lg px-2 text-xs"
                onClick={() => setA4Open(true)}
              >
                <FileText className="size-4" />
                {t("A4 invoice")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="col-span-3 h-11 rounded-lg text-xs sm:hidden"
              onClick={handleBrowserPrint}
            >
              {t("Browser print")}
            </Button>
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
