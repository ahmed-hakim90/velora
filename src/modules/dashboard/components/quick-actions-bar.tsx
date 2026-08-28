"use client";

import { useState } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import {
  Banknote,
  Clock,
  FilePlus2,
  Receipt,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import type { SupplierListSummary } from "@/lib/types";
import { getSuppliersPageDataAction } from "@/modules/suppliers/actions/supplier.actions";
import { RecordPaymentDialog } from "@/modules/suppliers/components/record-payment-dialog";
import { useTranslation } from "@/lib/i18n/use-translation";

const linkActions = [
  {
    href: "/pos",
    label: "POS",
    icon: ShoppingCart,
  },
  {
    href: "/sessions",
    label: "Sessions",
    icon: Clock,
  },
  {
    href: "/orders",
    label: "Orders",
    icon: Receipt,
  },
  {
    href: "/expenses",
    label: "Expenses",
    icon: Wallet,
  },
];

export function QuickActionsBar({
  enableWholesaleSales = false,
}: {
  enableWholesaleSales?: boolean;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [showPayment, setShowPayment] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [summaries, setSummaries] = useState<SupplierListSummary[]>([]);
  const [currency, setCurrency] = useState("EGP");

  const openSupplierPayment = () => {
    // Open immediately — load suppliers in the background.
    setShowPayment(true);
    setPaymentLoading(true);
    void (async () => {
      try {
        const data = await getSuppliersPageDataAction();
        if (!data.canManagePayments) {
          setShowPayment(false);
          toast.error(t("Supplier payments are for owners and managers only"));
          return;
        }
        if (data.summaries.length === 0) {
          setShowPayment(false);
          toast.error(t("Add a supplier first"));
          return;
        }
        setSummaries(data.summaries);
        setCurrency(data.currency);
      } catch (e) {
        setShowPayment(false);
        toast.error(e instanceof Error ? e.message : t("Could not load suppliers"));
      } finally {
        setPaymentLoading(false);
      }
    })();
  };

  const openNewSalesInvoice = () => {
    router.push("/sales-invoices?create=1");
  };

  return (
    <>
      <CompactActions className="justify-start">
        {linkActions.map(({ href, label, icon }) => (
          <CompactAction key={href} label={t(label)} icon={icon} href={href} />
        ))}
        {enableWholesaleSales ? (
          <>
            <CompactAction
              label={t("Sales invoice")}
              icon={FilePlus2}
              onClick={openNewSalesInvoice}
            />
            <CompactAction
              label={t("Quotation")}
              icon={Receipt}
              href="/quotations?create=1"
            />
          </>
        ) : null}
        <CompactAction
          label={t("Supplier payment")}
          icon={Banknote}
          onClick={openSupplierPayment}
        />
      </CompactActions>

      <RecordPaymentDialog
        open={showPayment}
        onOpenChange={(open) => {
          setShowPayment(open);
          if (!open) setPaymentLoading(false);
        }}
        suppliers={summaries}
        currency={currency}
        loading={paymentLoading}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </>
  );
}
