"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateStorefrontThemeCatalogAction } from "../actions/platform.actions";
import type { StorefrontThemeCatalog } from "@/modules/storefront/core/theme-commerce";
import { getStorefrontTheme } from "@/modules/storefront/core/theme-registry";

export function PlatformStorefrontThemesConsole({ initialCatalog }: { initialCatalog: StorefrontThemeCatalog }) {
  const theme = getStorefrontTheme("nelaab");
  const [price, setPrice] = useState(String(initialCatalog.nelaab.priceEgp));
  const [notes, setNotes] = useState(initialCatalog.nelaab.notes);
  const [pending, startTransition] = useTransition();
  return <div className="flex flex-col gap-3">
    <PageHeader title="ثيمات المتاجر" description="كتالوج مستقل عن ثيمات المنيو. الأسعار للفوترة والتفعيل اليدوي." />
    <OperationalCard title="كتالوج الـStorefront">
      <div className="grid gap-4 rounded-xl border border-border/60 p-4 md:grid-cols-[1fr_180px_1fr]">
        <div><div className="flex items-center gap-3"><span className="flex h-8 w-14 overflow-hidden rounded-lg border" aria-hidden><i className="w-1/2" style={{ background: theme.manifest.preview.background }} /><i className="w-1/4" style={{ background: theme.manifest.preview.primary }} /><i className="w-1/4" style={{ background: theme.manifest.preview.accent }} /></span><div><p className="font-bold">{theme.manifest.nameAr}</p><p className="text-xs text-muted-foreground" dir="ltr">nelaab · v{theme.manifest.version}</p></div></div><p className="mt-2 text-sm text-muted-foreground">{theme.manifest.descriptionAr}</p></div>
        <label><Label>السعر (ج.م)</Label><Input className="mt-2" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} disabled={pending} /></label>
        <label><Label>ملاحظات</Label><Input className="mt-2" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={pending} /></label>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">الثيم الافتراضي متاح دائمًا كمسار استعادة آمن.</p><Button disabled={pending} onClick={() => startTransition(async () => { const result = await updateStorefrontThemeCatalogAction({ priceEgp: Number(price), globallyAvailable: true, notes }); if (result.ok) { setPrice(String(result.data.nelaab.priceEgp)); setNotes(result.data.nelaab.notes); toast.success("تم حفظ كتالوج المتجر"); } else toast.error(result.error); })}>حفظ</Button></div>
    </OperationalCard>
  </div>;
}
