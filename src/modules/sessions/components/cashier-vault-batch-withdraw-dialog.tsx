"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle } from "lucide-react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StandardModalContent } from "@/components/Velora/standard-modal";
import { formatCurrency } from "@/lib/format";
import { batchWithdrawCashierVaultsAction } from "@/modules/sessions/actions/session.actions";
import { listTreasuryOptionsAction } from "@/modules/treasury/actions/treasury.actions";
import type { CashierVaultSummary } from "@/modules/sessions/services/cashier-vault.service";
import { roundMoney } from "@/lib/money";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TreasurySummary } from "@/modules/treasury/lib/treasury-view";

type EditableVaultRow = {
  cashierId: string;
  cashierName: string;
  balance: number;
  nextOpeningFloat: number;
  maxWithdraw: number;
};

function buildEditableRows(rows: CashierVaultSummary[]): EditableVaultRow[] {
  return rows
    .map((row) => {
      const nextOpeningFloat = roundMoney(
        Math.min(row.pendingOpeningFloat, row.balance),
      );
      const maxWithdraw = roundMoney(row.balance - nextOpeningFloat);
      return {
        cashierId: row.cashierId,
        cashierName: row.cashierName,
        balance: row.balance,
        nextOpeningFloat,
        maxWithdraw,
      };
    })
    .filter((row) => row.maxWithdraw > 1e-9);
}

function defaultAmounts(rows: EditableVaultRow[]): Record<string, string> {
  return Object.fromEntries(
    rows.map((row) => [row.cashierId, String(row.maxWithdraw)]),
  );
}

interface CashierVaultBatchWithdrawDialogProps {
  storeId: string;
  storeName: string;
  rows: CashierVaultSummary[];
}

export function CashierVaultBatchWithdrawDialog({
  storeId,
  storeName,
  rows,
}: CashierVaultBatchWithdrawDialogProps) {
  const editableRows = useMemo(() => buildEditableRows(rows), [rows]);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [destinations, setDestinations] = useState<TreasurySummary[]>([]);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [destinationError, setDestinationError] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    defaultAmounts(editableRows),
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    setDestinationLoading(true);
    setDestinationError("");
    void listTreasuryOptionsAction()
      .then((rows) => {
        const allowed = rows.filter(
          (t) => t.kind === "hq" || t.store_id === storeId,
        );
        setDestinations(allowed);
        if (allowed.length === 0) {
          setDestinationId("");
          setDestinationError("لا توجد خزينة متاحة لاستلام التوريد.");
          return;
        }
        const storeTreasury = allowed.find(
          (t) => t.kind === "store" && t.store_id === storeId,
        );
        setDestinationId(storeTreasury?.id ?? allowed[0]?.id ?? "");
      })
      .catch(() => {
        setDestinations([]);
        setDestinationId("");
        setDestinationError(
          "تعذر تحميل الخزائن. اقفل النافذة وحاول مرة تانية.",
        );
      })
      .finally(() => setDestinationLoading(false));
  }, [open, storeId]);

  const summary = useMemo(() => {
    let total = 0;
    let activeCount = 0;
    let hasInvalid = false;

    for (const row of editableRows) {
      const raw = amounts[row.cashierId] ?? "";
      const value = parseFloat(raw);
      const amount = Number.isFinite(value) ? roundMoney(value) : NaN;

      if (!raw.trim() || amount === 0) continue;
      if (
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > row.maxWithdraw + 1e-9
      ) {
        hasInvalid = true;
        continue;
      }
      total = roundMoney(total + amount);
      activeCount += 1;
    }

    const floatKept = roundMoney(
      editableRows.reduce((sum, row) => sum + row.nextOpeningFloat, 0),
    );

    return { total, activeCount, hasInvalid, floatKept };
  }, [amounts, editableRows]);

  if (editableRows.length === 0) return null;

  function openDialog() {
    setNotes("");
    setAmounts(defaultAmounts(editableRows));
    setOpen(true);
  }

  function setAmount(cashierId: string, value: string) {
    setAmounts((prev) => ({ ...prev, [cashierId]: value }));
  }

  function fillMax() {
    setAmounts(defaultAmounts(editableRows));
  }

  function clearAmounts() {
    setAmounts(
      Object.fromEntries(editableRows.map((row) => [row.cashierId, ""])),
    );
  }

  function handleSubmit() {
    if (summary.hasInvalid) {
      toast.error("راجع مبالغ التوريد — يوجد مبلغ أكبر من المتاح أو غير صالح");
      return;
    }
    if (summary.activeCount === 0 || summary.total <= 1e-9) {
      toast.error("حدد مبلغ توريد أكبر من صفر لكاشير واحد على الأقل");
      return;
    }

    const items = editableRows
      .map((row) => {
        const amount = roundMoney(
          parseFloat(amounts[row.cashierId] || "0") || 0,
        );
        return { cashierId: row.cashierId, withdrawAmount: amount };
      })
      .filter((item) => item.withdrawAmount > 1e-9);

    startTransition(async () => {
      try {
        const response = await batchWithdrawCashierVaultsAction({
          storeId,
          notes: notes.trim() || undefined,
          items,
          destinationTreasuryId: destinationId || null,
        });
        if (response.status === "error") {
          toast.error(response.message);
          return;
        }
        const result = response.result;

        if (result.failed === 0) {
          toast.success(
            `تم توريد ${formatCurrency(result.withdrawnTotal)} من ${result.succeeded} أمانة`,
          );
        } else if (result.succeeded === 0) {
          toast.error("تعذر التوريد من كل خزائن الكاشير");
        } else {
          toast.warning(
            `تم توريد ${formatCurrency(result.withdrawnTotal)} من ${result.succeeded} خزينة — تعذر ${result.failed}`,
          );
        }

        setOpen(false);
        setNotes("");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "تعذر التوريد من الخزائن",
        );
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="rounded-xl"
        onClick={openDialog}
      >
        توريد للخزينة
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <StandardModalContent
          size="md"
          title="توريد من خزائن الكاشير"
          description={`فرع ${storeName} — حدد المبلغ ووجهة استلام النقدية`}
          busy={pending}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                disabled={
                  pending ||
                  destinationLoading ||
                  Boolean(destinationError) ||
                  summary.hasInvalid ||
                  summary.activeCount === 0 ||
                  summary.total <= 1e-9
                }
                onClick={handleSubmit}
              >
                {pending
                  ? "جاري التوريد…"
                  : `تأكيد توريد ${formatCurrency(summary.total)}`}
              </Button>
            </>
          }
        >
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={fillMax}
              disabled={pending}
            >
              تعبئة بالحد الأقصى
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-xl"
              onClick={clearAmounts}
              disabled={pending}
            >
              تفريغ المبالغ
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">الكاشير</th>
                  <th className="px-3 py-2 text-start font-medium">
                    مبلغ التوريد
                  </th>
                  <th className="px-3 py-2 text-start font-medium">
                    الحد الأقصى
                  </th>
                  <th className="px-3 py-2 text-start font-medium">
                    يبقى للوردية
                  </th>
                </tr>
              </thead>
              <tbody>
                {editableRows.map((row) => {
                  const raw = amounts[row.cashierId] ?? "";
                  const value = parseFloat(raw);
                  const amount = Number.isFinite(value)
                    ? roundMoney(value)
                    : NaN;
                  const invalid =
                    raw.trim() !== "" &&
                    (!Number.isFinite(amount) ||
                      amount < 0 ||
                      amount > row.maxWithdraw + 1e-9);

                  return (
                    <tr
                      key={row.cashierId}
                      className="border-t border-border/60"
                    >
                      <td className="px-3 py-2 font-medium align-middle">
                        {row.cashierName}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <Input
                          id={`vault-batch-withdraw-${row.cashierId}`}
                          type="number"
                          min={0}
                          max={row.maxWithdraw}
                          step="0.01"
                          inputMode="decimal"
                          value={raw}
                          aria-label={`مبلغ توريد ${row.cashierName}`}
                          onChange={(e) =>
                            setAmount(row.cashierId, e.target.value)
                          }
                          className={
                            invalid
                              ? "h-9 rounded-xl border-destructive"
                              : "h-9 rounded-xl"
                          }
                          aria-invalid={invalid}
                          disabled={pending}
                        />
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground align-middle">
                        {formatCurrency(row.maxWithdraw)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground align-middle">
                        {formatCurrency(row.nextOpeningFloat)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {summary.hasInvalid ? (
            <p
              className="flex items-center gap-1.5 text-xs text-destructive"
              role="alert"
            >
              <AlertCircle className="size-3.5 shrink-0" />
              راجع المبالغ المحددة؛ يوجد مبلغ أكبر من الحد المتاح أو غير صالح.
            </p>
          ) : null}

          <dl className="space-y-1 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">إجمالي التوريد</dt>
              <dd className="tabular-nums font-medium">
                {formatCurrency(summary.total)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">محجوز لبداية الورديات</dt>
              <dd className="tabular-nums">
                {formatCurrency(summary.floatKept)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">خزائن عليها توريد</dt>
              <dd className="tabular-nums">{summary.activeCount}</dd>
            </div>
          </dl>

          <div className="space-y-2">
            <Label>إلى خزينة</Label>
            <Select
              value={destinationId}
              onValueChange={(v) => setDestinationId(v ?? "")}
              disabled={
                pending || destinationLoading || Boolean(destinationError)
              }
            >
              <SelectTrigger
                className="rounded-xl"
                aria-label="الخزينة المستلمة"
              >
                <SelectValue>
                  {() =>
                    destinationLoading
                      ? "جاري تحميل الخزائن…"
                      : (destinations.find(
                          (treasury) => treasury.id === destinationId,
                        )?.label ?? "اختار الخزينة")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {destinations.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {destinationError ? (
              <p
                className="flex items-center gap-1.5 text-xs text-destructive"
                role="alert"
              >
                <AlertCircle className="size-3.5 shrink-0" />
                {destinationError}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="vault-batch-notes">ملاحظات (اختياري)</Label>
            <Textarea
              id="vault-batch-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl"
              rows={2}
              placeholder="مثال: توريد لخزينة الفرع"
              disabled={pending}
            />
          </div>
        </StandardModalContent>
      </Dialog>
    </>
  );
}
