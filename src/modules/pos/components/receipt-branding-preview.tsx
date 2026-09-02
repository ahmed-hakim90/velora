"use client";

import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  getReceiptSubtotal,
  type ReceiptPayload,
} from "@/modules/pos/services/receipt-format.service";
import { cn } from "@/lib/utils";

/** Shared branded receipt body for modal + success preview (matches print/ESC/POS fields). */
export function ReceiptBrandingPreview({
  receipt,
  compact = false,
}: {
  receipt: ReceiptPayload;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const subtotal = getReceiptSubtotal(receipt);
  const {
    branding,
    customer,
    discount,
    lines,
    orderNumber,
    orderStatus,
    paymentMethod,
    payments,
    total,
  } = receipt;
  const currency = branding.currency;
  const exceptionalStatus =
    orderStatus === "voided" || orderStatus === "refunded" ? orderStatus : null;

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[72mm] rounded-lg border border-dashed border-border bg-muted/25 font-mono text-[10px] leading-snug text-foreground",
        compact ? "p-2" : "p-2.5",
      )}
    >
      {!compact ? (
        <>
          <p className="text-center font-bold">
            {branding.orgName || "Velora"}
          </p>
          {branding.storeName ? (
            <p className="text-center text-xs">{branding.storeName}</p>
          ) : null}
          {branding.storeAddress ? (
            <p className="whitespace-pre-wrap break-words text-center text-xs">
              {branding.storeAddress}
            </p>
          ) : null}
          {branding.storePhone ? (
            <p className="text-center text-xs" dir="ltr">
              {branding.storePhone}
            </p>
          ) : null}
          {branding.receiptHeader ? (
            <p className="mt-1.5 whitespace-pre-wrap break-words text-center text-[11px]">
              {branding.receiptHeader}
            </p>
          ) : null}
          <p className="mt-1.5 text-center text-[11px]">
            {t("Order #")} {orderNumber}
          </p>
          {exceptionalStatus ? (
            <p className="mt-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-center text-xs font-bold uppercase text-destructive">
              {t(exceptionalStatus)}
            </p>
          ) : null}
          {customer ? (
            <p className="text-center text-xs">
              {t("Customer")}: {customer.name}
            </p>
          ) : null}
          <hr className="my-2 border-dashed" />
        </>
      ) : null}
      {compact && exceptionalStatus ? (
        <p className="mb-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-center text-[10px] font-bold uppercase text-destructive">
          {t(exceptionalStatus)}
        </p>
      ) : null}
      <ul className="space-y-1.5">
        {lines.map((line) => (
          <li key={line.id}>
            <div className="flex items-start justify-between gap-2">
              {compact ? (
                <span className="min-w-0 flex-1">
                  <span
                    className="line-clamp-2 block text-[11px] font-semibold leading-snug"
                    dir="auto"
                  >
                    {line.name}
                  </span>
                  <span
                    className="mt-0.5 block text-[9px] text-muted-foreground tabular-nums [unicode-bidi:plaintext]"
                    dir="auto"
                  >
                    {line.quantity} {line.saleUnit ?? t("piece")} ×{" "}
                    {formatCurrency(line.unitPrice, currency)}
                  </span>
                  {line.modifiers.length > 0 ? (
                    <span
                      className="mt-0.5 block truncate text-[9px] text-muted-foreground"
                      dir="auto"
                    >
                      +{" "}
                      {line.modifiers
                        .map((modifier) =>
                          modifier.price > 0
                            ? `${modifier.name} (+${formatCurrency(modifier.price, currency)})`
                            : modifier.name,
                        )
                        .join("، ")}
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="min-w-0 flex-1">
                  <span className="block break-words" dir="auto">
                    {line.name}
                  </span>
                  <span
                    className="block text-muted-foreground tabular-nums [unicode-bidi:plaintext]"
                    dir="auto"
                  >
                    {line.quantity} {line.saleUnit ?? t("piece")} ×{" "}
                    {formatCurrency(line.unitPrice, currency)}
                  </span>
                  {line.modifiers.length > 0 ? (
                    <span
                      className="block text-[10px] text-muted-foreground"
                      dir="auto"
                    >
                      +{" "}
                      {line.modifiers
                        .map((modifier) =>
                          modifier.price > 0
                            ? `${modifier.name} (+${formatCurrency(modifier.price, currency)})`
                            : modifier.name,
                        )
                        .join("، ")}
                    </span>
                  ) : null}
                </span>
              )}
              <span className="shrink-0 font-semibold tabular-nums">
                {formatCurrency(line.lineTotal, currency)}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <hr className={compact ? "my-1.5 border-dashed" : "my-2 border-dashed"} />
      <div className="flex justify-between">
        <span>{t("Subtotal")}</span>
        <span>{formatCurrency(subtotal, currency)}</span>
      </div>
      {discount > 0 ? (
        <div className="flex justify-between">
          <span>{t("Discount")}</span>
          <span>-{formatCurrency(discount, currency)}</span>
        </div>
      ) : null}
      <div className="flex justify-between font-bold">
        <span>
          {t("Total")} ({t(paymentMethod)})
        </span>
        <span>{formatCurrency(total, currency)}</span>
      </div>
      {payments.length > 1 ? (
        <div className="mt-2 space-y-1 text-xs">
          {payments.map((payment, index) => (
            <div
              key={`${payment.method}-${index}`}
              className="flex justify-between"
            >
              <span>{t(payment.method)}</span>
              <span>{formatCurrency(payment.amount, currency)}</span>
            </div>
          ))}
        </div>
      ) : null}
      {!compact ? (
        <p className="mt-3 whitespace-pre-wrap break-words text-center text-[11px]">
          {branding.receiptFooter || t("Thank you!")}
        </p>
      ) : null}
    </div>
  );
}
