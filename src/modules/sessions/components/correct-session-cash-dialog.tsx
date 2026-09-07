"use client";

import { useState, useTransition } from "react";
import { PencilLine } from "lucide-react";
import { toast } from "sonner";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { StandardModalContent } from "@/components/Velora/standard-modal";
import { formatCurrency } from "@/lib/format";
import type { CashierSession } from "@/lib/types";
import { correctClosedSessionCashAction } from "@/modules/sessions/actions/session.actions";

interface CorrectSessionCashDialogProps {
  session: CashierSession;
}

export function CorrectSessionCashDialog({ session }: CorrectSessionCashDialogProps) {
  const [open, setOpen] = useState(false);
  const [actualCash, setActualCash] = useState(String(session.actual_cash ?? ""));
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const parsedCash = Number(actualCash);
  const isValid = actualCash.trim() !== "" && Number.isFinite(parsedCash) && parsedCash >= 0;

  function handleSubmit() {
    if (!isValid || !reason.trim()) return;
    startTransition(async () => {
      try {
        const result = await correctClosedSessionCashAction({
          sessionId: session.id,
          actualCash: parsedCash,
          reason,
        });
        if (result.status === "error") {
          toast.error(result.message);
          return;
        }
        if (result.accountingPending) {
          toast.warning("تم تصحيح الوردية والخزينة، لكن القيد المحاسبي محتاج مراجعة");
        } else {
          toast.success("تم تصحيح مبلغ الإقفال والخزينة");
        }
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر تصحيح مبلغ الإقفال");
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <PencilLine className="size-4" />
        تصحيح مبلغ الإقفال
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <StandardModalContent
          size="sm"
          title="تصحيح مبلغ إقفال الوردية"
          footer={
            <>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                إلغاء
              </Button>
              <Button type="button" disabled={pending || !isValid || !reason.trim()} onClick={handleSubmit}>
                {pending ? "جاري التصحيح…" : "حفظ التصحيح"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">المبلغ المسجل</span>
                <strong className="tabular-nums">{formatCurrency(session.actual_cash ?? 0)}</strong>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                الحفظ هيحدّث فرق الوردية ورصيد خزينة الكاشير والقيد المحاسبي.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`correct-actual-${session.id}`}>المبلغ الفعلي الصحيح</Label>
              <Input
                id={`correct-actual-${session.id}`}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={actualCash}
                onChange={(event) => setActualCash(event.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`correct-reason-${session.id}`}>سبب التصحيح (مطلوب)</Label>
              <Textarea
                id={`correct-reason-${session.id}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                className="rounded-xl"
                placeholder="مثال: تم إدخال 500 بدل 550 بالخطأ"
              />
            </div>
          </div>
        </StandardModalContent>
      </Dialog>
    </>
  );
}
