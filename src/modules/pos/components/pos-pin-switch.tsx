"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/modules/auth/actions/logout.action";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";

interface PosPinSwitchProps {
  /** Where to land after lock — usually `/{slug}/pos`. */
  returnTo?: string;
  menuItem?: boolean;
}

/** Locks POS by signing out — next person unlocks with PIN on the slug URL. */
export function PosPinSwitch({ returnTo = "/pos", menuItem = false }: PosPinSwitchProps) {
  const { t } = useTranslation();
  return (
    <form action={logoutAction} className={menuItem ? "w-full" : undefined}>
      <input type="hidden" name="next" value={returnTo} />
      <Button
        type="submit"
        variant={menuItem ? "ghost" : "outline"}
        size="sm"
        className={cn(
          "h-11 min-w-11",
          menuItem
            ? "w-full justify-start rounded-md px-2 text-sm font-normal"
            : "rounded-full px-3 max-[390px]:px-2.5"
        )}
        aria-label={t("Lock screen")}
      >
        <Lock className="size-4" />
        <span className={menuItem ? undefined : "max-[390px]:sr-only"}>{t("Lock")}</span>
      </Button>
    </form>
  );
}
