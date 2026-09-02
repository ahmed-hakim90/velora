"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CircleHelp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StandardModalContent } from "@/components/Velora/standard-modal";
import { cn } from "@/lib/utils";

export type ConfirmIntent = "delete" | "danger" | "confirm";

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pendingLabel?: string;
  destructive?: boolean;
  intent?: ConfirmIntent;
  onConfirm: () => Promise<void> | void;
}

function resolveIntent(
  intent: ConfirmIntent | undefined,
  destructive: boolean,
  title: string,
  confirmLabel: string,
): ConfirmIntent {
  if (intent) return intent;
  if (destructive && /حذف|delete/i.test(`${title} ${confirmLabel}`))
    return "delete";
  if (destructive) return "danger";
  return "confirm";
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  pendingLabel,
  destructive = false,
  intent,
  onConfirm,
}: ConfirmActionDialogProps) {
  const [pending, setPending] = useState(false);
  const resolvedIntent = resolveIntent(
    intent,
    destructive,
    title,
    confirmLabel,
  );
  const isDelete = resolvedIntent === "delete";
  const isDanger = resolvedIntent !== "confirm";
  const Icon = isDelete ? Trash2 : isDanger ? AlertTriangle : CircleHelp;
  const busyLabel =
    pendingLabel ?? (isDelete ? "جارٍ الحذف..." : "جارٍ التنفيذ...");

  useEffect(() => {
    if (!open) setPending(false);
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (pending && !next) return;
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Keep dialog open; caller shows toast/error.
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <StandardModalContent
        size="sm"
        title={title}
        description={description}
        showCloseButton={false}
        busy={pending}
        overlayClassName="bg-[var(--mds-color-bg-overlay)] supports-backdrop-filter:backdrop-blur-sm"
        className={cn("shadow-xl", isDanger && "ring-destructive/25")}
        headerClassName="items-center pe-0 text-center [&_[data-slot=dialog-title]]:text-xl [&_[data-slot=dialog-title]]:leading-snug [&_[data-slot=dialog-title]]:font-semibold [&_[data-slot=dialog-description]]:max-w-sm [&_[data-slot=dialog-description]]:leading-6"
        bodyClassName={cn(
          "flex flex-col items-center text-center",
          isDanger && "rounded-xl bg-destructive/5 p-4",
        )}
        footerClassName="sm:flex-row-reverse"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-lg"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              <span dir="auto">{cancelLabel}</span>
            </Button>
            <Button
              type="button"
              variant={isDanger ? "destructive" : "default"}
              className={cn(
                "h-11 rounded-lg font-semibold",
                isDanger &&
                  "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:text-white dark:hover:bg-destructive/90",
              )}
              onClick={handleConfirm}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : isDelete ? (
                <Trash2 className="size-4" aria-hidden />
              ) : null}
              <span dir="auto">{pending ? busyLabel : confirmLabel}</span>
            </Button>
          </>
        }
      >
        <div
          className={cn(
            "flex size-14 items-center justify-center rounded-2xl ring-1",
            isDanger
              ? "bg-destructive/10 text-destructive ring-destructive/20"
              : "bg-primary/10 text-primary ring-primary/15",
          )}
          aria-hidden
        >
          <Icon className="size-7" strokeWidth={2} />
        </div>
        {isDelete ? (
          <p className="text-xs font-medium text-destructive" dir="auto">
            لا يمكن التراجع عن هذا الإجراء
          </p>
        ) : null}
      </StandardModalContent>
    </Dialog>
  );
}
