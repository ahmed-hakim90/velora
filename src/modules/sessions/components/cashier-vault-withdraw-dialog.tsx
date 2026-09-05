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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StandardModalContent } from "@/components/Velora/standard-modal";
import { formatCurrency } from "@/lib/format";
import { withdrawCashierVaultAction } from "@/modules/sessions/actions/session.actions";
import { listTreasuryOptionsAction } from "@/modules/treasury/actions/treasury.actions";
import type { CashierVaultSummary } from "@/modules/sessions/services/cashier-vault.service";
import type { TreasurySummary } from "@/modules/treasury/lib/treasury-view";

interface CashierVaultWithdrawDialogProps {
  storeId: string;
  row: CashierVaultSummary;
}

export function CashierVaultWithdrawDialog({
  storeId,
  row,
}: CashierVaultWithdrawDialogProps) {
  const [open, setOpen] = useState(false);
  const [withdraw, setWithdraw] = useState("");
  const [nextFloat, setNextFloat] = useState(
    String(row.pendingOpeningFloat || ""),
  );
  const [notes, setNotes] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [destinations, setDestinations] = useState<TreasurySummary[]>([]);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [destinationError, setDestinationError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const withdrawAmount = parseFloat(withdraw) || 0;
  const nextOpeningFloat = parseFloat(nextFloat) || 0;
  const remainder = useMemo(
    () => row.balance - withdrawAmount - nextOpeningFloat,
    [row.balance, withdrawAmount, nextOpeningFloat],
  );

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

  function handleSubmit() {
    if (withdrawAmount < 0 || nextOpeningFloat < 0) {
      toast.error("المبالغ يجب تكون صفر أو أكبر");
      return;
    }
    if (withdrawAmount + nextOpeningFloat > row.balance + 1e-9) {
      toast.error("السحب + رصيد بداية الوردية الجاية أكبر من رصيد الخزينة");
      return;
    }
    startTransition(async () => {
      try {
        const result = await withdrawCashierVaultAction({
          storeId,
          cashierId: row.cashierId,
          withdrawAmount,
          nextOpeningFloat,
          notes: notes.trim() || undefined,
          destinationTreasuryId: destinationId || null,
        });
        if (result.status === "error") {
          toast.error(result.message);
          return;
        }
        toast.success("تم توريد أمانة الكاشير للخزينة");
        setOpen(false);
        setWithdraw("");
        setNotes("");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "تعذر التوريد للخزينة",
        );
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-xl"
        disabled={row.balance <= 1e-9}
        title={row.balance <= 1e-9 ? "لا يوجد رصيد متاح للتوريد" : undefined}
        onClick={() => {
          setWithdraw("");
          setNextFloat(String(row.pendingOpeningFloat || "0"));
          setNotes("");
          setOpen(true);
        }}
      >
        {row.balance <= 1e-9 ? "لا يوجد رصيد" : "توريد"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <StandardModalContent
          size="sm"
          title="توريد من أمانة الكاشير"
          description={`${row.cashierName} · الرصيد الحالي ${formatCurrency(row.balance)}`}
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
                  remainder < -1e-9
                }
                onClick={handleSubmit}
              >
                {pending ? "جاري التوريد…" : "تأكيد التوريد"}
              </Button>
            </>
          }
        >
          <div className="space-y-2">
            <Label htmlFor={`vault-withdraw-${row.cashierId}`}>
              مبلغ التوريد
            </Label>
            <Input
              id={`vault-withdraw-${row.cashierId}`}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={withdraw}
              onChange={(e) => setWithdraw(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`vault-next-${row.cashierId}`}>
              رصيد بداية الوردية الجاية
            </Label>
            <Input
              id={`vault-next-${row.cashierId}`}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={nextFloat}
              onChange={(e) => setNextFloat(e.target.value)}
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              الكاشير مش هيقدر يغيّر المبلغ ده لما يفتح الوردية من نقطة البيع
            </p>
          </div>
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
            <Label htmlFor={`vault-notes-${row.cashierId}`}>ملاحظات</Label>
            <Textarea
              id={`vault-notes-${row.cashierId}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl"
              rows={2}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            المتبقي بعد التوريد:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatCurrency(remainder)}
            </span>
          </p>
          {remainder < -1e-9 ? (
            <p className="text-xs text-destructive" role="alert">
              مبلغ التوريد ورصيد بداية الوردية أكبر من الرصيد المتاح.
            </p>
          ) : null}
        </StandardModalContent>
      </Dialog>
    </>
  );
}
