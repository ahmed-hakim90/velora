"use client";

import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import { PoweredByHakimo } from "@/components/layout/powered-by-hakimo";

export function AppFooter() {
  const pathname = usePathname();
  const isOnlineMenu = pathname === "/menu" || pathname.startsWith("/menu/");
  const isStorefront = pathname === "/store" || pathname.startsWith("/store/");
  // Shell/POS/print lock to the viewport — a root footer would force page scroll.
  const isAppChrome =
    pathname === "/pos" ||
    pathname.startsWith("/pos/") ||
    pathname.startsWith("/print") ||
    (!isOnlineMenu &&
      !isStorefront &&
      !pathname.startsWith("/login") &&
      !pathname.startsWith("/forgot-password") &&
      !pathname.startsWith("/reset-password") &&
      !pathname.startsWith("/onboarding") &&
      !pathname.startsWith("/device"));

  if (isAppChrome) {
    return null;
  }

  // The ordering surface already reserves the fixed cart bar + safe area.
  // Adding a root spacer here would double the mobile bottom inset.
  if (isOnlineMenu || isStorefront) {
    return null;
  }

  const year = new Date().getFullYear();

  return (
    <footer
      className="shrink-0 border-t border-border/60 bg-background/80 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-center backdrop-blur-xl md:px-6 md:pb-3"
    >
      <div className="mx-auto flex max-w-lg flex-col items-center gap-1.5">
        <p className="text-xs text-muted-foreground">
          © {year} {APP_NAME}
          <span className="mx-1.5 text-border" aria-hidden>
            ·
          </span>
          جميع الحقوق محفوظة
        </p>
        <PoweredByHakimo />
      </div>
    </footer>
  );
}
