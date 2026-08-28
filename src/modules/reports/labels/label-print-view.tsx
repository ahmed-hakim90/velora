"use client";

import { useEffect, useState } from "react";
import { LabelDocument } from "@/modules/reports/labels/label-document";
import { loadLabelPrintJob } from "@/modules/reports/labels/print-payload";
import { AutoPrintShell } from "@/components/print/auto-print-shell";
import type { LabelPrintJob } from "@/modules/reports/labels/print-job";
import { useTranslation } from "@/lib/i18n/use-translation";

export function LabelPrintView() {
  const { language } = useTranslation();
  const [job, setJob] = useState<LabelPrintJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadLabelPrintJob();
    if (!loaded || loaded.items.length === 0) {
      setError("No labels are ready. Go back to Barcode Labels and select Print preview again.");
      return;
    }
    setJob(loaded);
  }, []);

  const isA4 = job?.settings.preset === "a4_labels";
  const pageSize = isA4
    ? "A4"
    : job
      ? `${job.settings.labelWidthMm}mm ${job.settings.labelHeightMm}mm`
      : "A4";

  return (
    <>
      <style>{`
        @page {
          size: ${pageSize};
          margin: ${isA4 ? "8mm" : "0"};
        }
        @media print {
          html, body { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
        }
        @media screen {
          body { background: #e7e5e4; }
          .print-stage { min-height: 100vh; padding: 24px; }
        }
      `}</style>
      <AutoPrintShell
        loading={!job && !error}
        error={error}
        backHref="/labels"
        backLabel="Back to Barcode Labels"
      >
        {job ? <div dir={language === "ar" ? "rtl" : "ltr"}><LabelDocument job={job} /></div> : null}
      </AutoPrintShell>
    </>
  );
}
