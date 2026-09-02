import type { ReactNode } from "react";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const SIZE_CLASS: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

type StandardModalContentProps = {
  size?: "sm" | "md" | "lg" | "xl";
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  showCloseButton?: boolean;
  overlayClassName?: string;
  busy?: boolean;
};

export function StandardModalContent({
  size = "md",
  title,
  description,
  children,
  footer,
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
  showCloseButton = true,
  overlayClassName,
  busy = false,
}: StandardModalContentProps) {
  return (
    <DialogContent
      aria-busy={busy || undefined}
      showCloseButton={showCloseButton}
      overlayClassName={overlayClassName}
      className={cn(
        "max-h-[90dvh] overflow-y-auto",
        SIZE_CLASS[size],
        className,
      )}
    >
      <DialogHeader className={cn("gap-1", headerClassName)}>
        <DialogTitle dir="auto">{title}</DialogTitle>
        {description ? (
          <DialogDescription dir="auto">{description}</DialogDescription>
        ) : null}
      </DialogHeader>
      <div className={cn("space-y-4", bodyClassName)}>{children}</div>
      {footer ? (
        <DialogFooter className={footerClassName}>{footer}</DialogFooter>
      ) : null}
    </DialogContent>
  );
}
