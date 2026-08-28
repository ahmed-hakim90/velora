"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/modules/auth/actions/logout.action";
import { useTranslation } from "@/lib/i18n/use-translation";

/** Full account sign-out (used on PIN / gate screens). */
export function PosLogoutButton() {
  const { t } = useTranslation();
  return (
    <form action={logoutAction}>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="h-11 min-w-11 rounded-full px-3 max-[390px]:px-2.5"
        aria-label={t("Sign out")}
      >
        <LogOut className="size-4" />
        <span className="max-[390px]:sr-only">{t("Sign out")}</span>
      </Button>
    </form>
  );
}
