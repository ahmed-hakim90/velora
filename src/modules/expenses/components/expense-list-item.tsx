"use client";

import { useState, useTransition } from "react";
import { Ban, Check } from "lucide-react";
import { toast } from "sonner";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { StatusPill } from "@/components/Velora/status-pill";
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  approveExpenseAction,
  voidExpenseAction,
} from "@/modules/expenses/actions/expense.actions";
import type { Expense } from "@/lib/types";

const SOURCE_LABELS: Record<string, string> = {
  session_cash: "نقدية الجلسة",
  external: "خارجي",
  purchase: "شراء",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الموافقة",
  approved: "معتمد",
  voided: "ملغي",
};

interface ExpenseListItemProps {
  expense: Expense;
  centerName: string;
  categoryName: string;
  currency?: string;
  canApprove?: boolean;
  canVoid?: boolean;
}

export function ExpenseListItem({
  expense,
  centerName,
  categoryName,
  canApprove,
  canVoid,
}: ExpenseListItemProps) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);

  function handleApprove() {
    startTransition(async () => {
      try {
        await approveExpenseAction(expense.id);
        toast.success("تم اعتماد المصروف");
      } catch {
        toast.error("تعذر اعتماد المصروف");
      }
    });
  }

  function handleVoid() {
    startTransition(async () => {
      try {
        await voidExpenseAction(expense.id, "سُجل كمصروف بالخطأ");
        toast.success("تم إلغاء المصروف وعكس أثره بالكامل");
        setVoidConfirmOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر إلغاء المصروف");
      }
    });
  }

  const createdLabel = new Date(expense.created_at).toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <>
    <MobileEntityCard
      title={expense.title}
      subtitle={`${centerName} · ${categoryName}`}
      badge={
        <StatusPill
          label={STATUS_LABELS[expense.status] ?? expense.status}
          variant={
            expense.status === "approved"
              ? "success"
              : expense.status === "voided"
                ? "danger"
                : "warning"
          }
        />
      }
      fields={[
        { label: "المبلغ", value: formatCurrency(expense.amount) },
        { label: "التاريخ", value: createdLabel },
        {
          label: "المصدر",
          value: SOURCE_LABELS[expense.expense_source] ?? expense.expense_source,
        },
        { label: "الدفع", value: t(expense.payment_method) },
        ...(expense.inventory_item_id && expense.quantity
          ? [
              {
                label: "الكمية",
                value: `${expense.quantity} × ${expense.unit_cost ?? 0}`,
              },
            ]
          : []),
      ]}
      footer={
        expense.status !== "voided" && (canApprove || canVoid) ? (
          <CompactActions className="w-full justify-end">
            {expense.status === "pending" && canApprove ? (
              <CompactAction
                label="اعتماد"
                icon={Check}
                variant="default"
                disabled={pending}
                onClick={handleApprove}
              />
            ) : null}
            {canVoid ? (
              <CompactAction
                label="إلغاء وعكس"
                icon={Ban}
                variant="destructive"
                disabled={pending}
                onClick={() => setVoidConfirmOpen(true)}
              />
            ) : null}
          </CompactActions>
        ) : undefined
      }
    />
      <ConfirmActionDialog
        open={voidConfirmOpen}
        onOpenChange={setVoidConfirmOpen}
        title="إلغاء المصروف وعكسه؟"
        description={`هيفضل «${expense.title}» ظاهر كسجل ملغي، وهيتعكس قيمة ${formatCurrency(expense.amount)} من القيد والخزينة بالكامل إن وُجدت.`}
        confirmLabel="إلغاء وعكس"
        destructive
        onConfirm={handleVoid}
      />
    </>
  );
}
