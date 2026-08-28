"use client";

import { useTranslation } from "@/lib/i18n/use-translation";

export function LocalizedText({ text }: { text: string }) {
  const { t } = useTranslation();

  return <span suppressHydrationWarning>{t(text)}</span>;
}
