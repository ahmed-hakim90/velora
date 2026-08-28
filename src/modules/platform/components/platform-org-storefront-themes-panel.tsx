"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { OperationalCard } from "@/components/Velora/operational-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StorefrontThemeCatalog, StorefrontThemeEntitlements } from "@/modules/storefront/core/theme-commerce";
import { getStorefrontTheme } from "@/modules/storefront/core/theme-registry";
import { setOrgStorefrontThemeEntitlementsAction } from "../actions/platform.actions";

export function PlatformOrgStorefrontThemesPanel({ orgId, catalog, initialEntitlements }: { orgId: string; catalog: StorefrontThemeCatalog; initialEntitlements: StorefrontThemeEntitlements }) {
  const theme = getStorefrontTheme("nelaab");
  const [notes, setNotes] = useState(initialEntitlements.notes);
  const [pending, startTransition] = useTransition();
  return <OperationalCard title="ثيمات المتجر للشركة">
    <p className="mb-3 text-sm text-muted-foreground">استحقاقات مستقلة عن المنيو. الثيم الافتراضي مقفول كمسار استعادة، والثيمات القادمة ستظهر هنا تلقائيًا من الكتالوج.</p>
    <div className="flex items-center justify-between rounded-lg border border-border/60 p-3"><span className="flex items-center gap-2"><Checkbox checked disabled /><strong>{theme.manifest.nameAr}</strong><span className="text-xs text-muted-foreground" dir="ltr">nelaab</span></span><span className="text-xs text-muted-foreground">{catalog.nelaab.priceEgp > 0 ? `${catalog.nelaab.priceEgp} ج.م` : "مجاني"} · افتراضي</span></div>
    <label className="mt-3 block"><Label>ملاحظة داخلية</Label><Input className="mt-2" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={pending} /></label>
    <div className="mt-3 flex justify-end"><Button disabled={pending} onClick={() => startTransition(async () => { const result = await setOrgStorefrontThemeEntitlementsAction({ orgId, enabledThemes: ["nelaab"], notes }); if (result.ok) { setNotes(result.data.notes); toast.success("تم تحديث استحقاقات المتجر"); } else toast.error(result.error); })}>حفظ الاستحقاقات</Button></div>
  </OperationalCard>;
}
