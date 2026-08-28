"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorStateBlock } from "@/components/Velora/state-blocks";
import { useTranslation } from "@/lib/i18n/use-translation";

export default function PrintError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    console.error("[print]", error.digest ?? error.message, error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-4 p-6">
      <ErrorStateBlock
        title={t("Could not load the print page")}
        description={t("Try again. If the problem continues, send the reference number to support.")}
      />
      {error.digest ? (
        <p className="text-xs text-muted-foreground" dir="ltr">
          ref: {error.digest}
        </p>
      ) : null}
      <Button onClick={() => unstable_retry()}>{t("Try again")}</Button>
    </div>
  );
}
