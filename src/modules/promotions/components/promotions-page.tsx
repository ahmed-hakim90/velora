"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Pencil, Power, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/Velora/page-header";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { KpiCard } from "@/components/Velora/kpi-card";
import { OperationalCard } from "@/components/Velora/operational-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { StandardModalContent } from "@/components/Velora/standard-modal";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useConfirmationDialog } from "@/components/Velora/confirmation-dialog";
import type { PromotionRule, PromotionRuleType, PromotionScopeType } from "@/lib/types";
import {
  deletePromotionAction,
  togglePromotionAction,
  upsertPromotionAction,
} from "@/modules/promotions/actions/promotion.actions";
import { useTranslation } from "@/lib/i18n/use-translation";

const RULE_TYPE_LABELS: Record<PromotionRuleType, string> = {
  percent_off_item: "Percent off product / category",
  fixed_off_item: "Fixed discount on product",
  scheduled_sale_price: "Scheduled sale price",
  cart_percent: "Percent off invoice",
  cart_fixed: "Fixed discount on invoice",
  bogo: "Buy and get",
  qty_threshold: "Quantity discount",
};

type CatalogOption = { id: string; name: string; category_id?: string };

interface PromotionsPageProps {
  rules: PromotionRule[];
  categories: CatalogOption[];
  products: CatalogOption[];
}

type FormState = {
  id?: string;
  name: string;
  isActive: boolean;
  ruleType: PromotionRuleType;
  priority: string;
  startsAt: string;
  endsAt: string;
  couponCode: string;
  stackableWithCart: boolean;
  minSubtotal: string;
  scopeType: PromotionScopeType;
  scopeIds: string[];
  saleRetail: boolean;
  saleWholesale: boolean;
  usageLimitTotal: string;
  percent: string;
  amount: string;
  salePrice: string;
  buyQty: string;
  getQty: string;
  getPercent: string;
  minQty: string;
};

const emptyForm = (): FormState => ({
  name: "",
  isActive: true,
  ruleType: "percent_off_item",
  priority: "0",
  startsAt: "",
  endsAt: "",
  couponCode: "",
  stackableWithCart: false,
  minSubtotal: "0",
  scopeType: "all",
  scopeIds: [],
  saleRetail: true,
  saleWholesale: true,
  usageLimitTotal: "",
  percent: "10",
  amount: "10",
  salePrice: "",
  buyQty: "2",
  getQty: "1",
  getPercent: "100",
  minQty: "5",
});

function ruleToForm(rule: PromotionRule): FormState {
  return {
    id: rule.id,
    name: rule.name,
    isActive: rule.is_active,
    ruleType: rule.rule_type,
    priority: String(rule.priority),
    startsAt: rule.starts_at ? rule.starts_at.slice(0, 16) : "",
    endsAt: rule.ends_at ? rule.ends_at.slice(0, 16) : "",
    couponCode: rule.coupon_code ?? "",
    stackableWithCart: rule.stackable_with_cart,
    minSubtotal: String(rule.min_subtotal ?? 0),
    scopeType: rule.scope_type,
    scopeIds: rule.scope_ids,
    saleRetail: rule.sale_modes.includes("retail"),
    saleWholesale: rule.sale_modes.includes("wholesale"),
    usageLimitTotal: rule.usage_limit_total != null ? String(rule.usage_limit_total) : "",
    percent: String(rule.config.percent ?? 10),
    amount: String(rule.config.amount ?? 10),
    salePrice: String(rule.config.sale_price ?? ""),
    buyQty: String(rule.config.buy_qty ?? 2),
    getQty: String(rule.config.get_qty ?? 1),
    getPercent: String(rule.config.get_percent ?? 100),
    minQty: String(rule.config.min_qty ?? 5),
  };
}

function buildConfig(form: FormState): Record<string, number | undefined> {
  switch (form.ruleType) {
    case "percent_off_item":
    case "cart_percent":
      return { percent: parseFloat(form.percent) || 0 };
    case "fixed_off_item":
    case "cart_fixed":
      return { amount: parseFloat(form.amount) || 0 };
    case "scheduled_sale_price":
      return { sale_price: parseFloat(form.salePrice) || 0 };
    case "bogo":
      return {
        buy_qty: parseFloat(form.buyQty) || 0,
        get_qty: parseFloat(form.getQty) || 0,
        get_percent: parseFloat(form.getPercent) || 100,
      };
    case "qty_threshold":
      return {
        min_qty: parseFloat(form.minQty) || 0,
        percent: form.percent ? parseFloat(form.percent) : undefined,
        amount: form.amount && !form.percent ? parseFloat(form.amount) : undefined,
      };
    default:
      return {};
  }
}

export function PromotionsPage({ rules, categories, products }: PromotionsPageProps) {
  const { t, language } = useTranslation();
  const { requestConfirmation, confirmationDialog } = useConfirmationDialog();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.coupon_code ?? "").toLowerCase().includes(q) ||
        t(RULE_TYPE_LABELS[r.rule_type]).toLowerCase().includes(q)
    );
  }, [rules, query, t]);

  const activeCount = useMemo(
    () => rules.filter((r) => r.is_active).length,
    [rules]
  );
  const totalUsage = useMemo(
    () => rules.reduce((sum, r) => sum + (r.usage_count ?? 0), 0),
    [rules]
  );

  const openCreate = () => {
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (rule: PromotionRule) => {
    setForm(ruleToForm(rule));
    setOpen(true);
  };

  const save = () => {
    startTransition(async () => {
      try {
        const saleModes: ("retail" | "wholesale")[] = [];
        if (form.saleRetail) saleModes.push("retail");
        if (form.saleWholesale) saleModes.push("wholesale");
        if (saleModes.length === 0) throw new Error(t("Select at least one sale mode"));

        await upsertPromotionAction({
          id: form.id,
          name: form.name,
          isActive: form.isActive,
          ruleType: form.ruleType,
          priority: parseInt(form.priority, 10) || 0,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          couponCode: form.couponCode || null,
          stackableWithCart: form.stackableWithCart,
          minSubtotal: parseFloat(form.minSubtotal) || 0,
          scopeType: form.scopeType,
          scopeIds: form.scopeIds,
          saleModes,
          config: buildConfig(form),
          usageLimitTotal: form.usageLimitTotal ? parseInt(form.usageLimitTotal, 10) : null,
        });
        toast.success(form.id ? t("Promotion updated") : t("Promotion created"));
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? t(e.message) : t("Could not save promotion"));
      }
    });
  };

  const toggle = (rule: PromotionRule) => {
    startTransition(async () => {
      try {
        await togglePromotionAction(rule.id, !rule.is_active);
        toast.success(rule.is_active ? t("Promotion disabled") : t("Promotion enabled"));
      } catch (e) {
        toast.error(e instanceof Error ? t(e.message) : t("Update failed"));
      }
    });
  };

  const remove = async (rule: PromotionRule) => {
    if (
      !(await requestConfirmation(`${t("Delete promotion")} “${rule.name}”?`, {
        title: t("Delete promotion"),
        confirmLabel: t("Delete"),
        destructive: true,
      }))
    ) return;
    startTransition(async () => {
      try {
        await deletePromotionAction(rule.id);
        toast.success(t("Promotion deleted"));
      } catch (e) {
        toast.error(e instanceof Error ? t(e.message) : t("Delete failed"));
      }
    });
  };

  const scopeOptions = form.scopeType === "category" ? categories : products;
  const showItemScope =
    form.ruleType === "percent_off_item" ||
    form.ruleType === "fixed_off_item" ||
    form.ruleType === "scheduled_sale_price" ||
    form.ruleType === "bogo" ||
    form.ruleType === "qty_threshold";
  const showCartFields =
    form.ruleType === "cart_percent" || form.ruleType === "cart_fixed";

  return (
    <div className="flex flex-col gap-3" dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title="Promotions"
        description="Automatic discounts and coupons for POS, online menu, and wholesale invoices"
        action={
          <CompactAction
            label={t("New promotion")}
            icon={Plus}
            variant="default"
            alwaysLabeled
            onClick={openCreate}
          />
        }
      />

      <div className="grid grid-cols-2 gap-[var(--mds-space-3)] sm:gap-[var(--mds-space-4)] lg:grid-cols-3">
        <KpiCard
          label={t("Total promotions")}
          value={String(rules.length)}
          icon={<Tag className="size-5" />}
        />
        <KpiCard label={t("Active")} value={String(activeCount)} />
        <KpiCard
          label={t("Usage count")}
          value={String(totalUsage)}
          change={t("Usage counter, not calculated revenue impact")}
          trend="neutral"
        />
      </div>

      <OperationalCard title={t("Promotions list")}>
        <div className="mb-4">
          <Input
            placeholder={t("Search by name or code…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("Search promotions")}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyStateBlock
            title={t("No promotions")}
            description={t("Create a percentage, fixed, coupon, or buy-and-get promotion.")}
            action={
              <CompactAction
                label={t("New promotion")}
                icon={Plus}
                variant="default"
                alwaysLabeled
                onClick={openCreate}
              />
            }
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{rule.name}</span>
                    <Badge variant={rule.is_active ? "default" : "secondary"}>
                      {rule.is_active ? t("Active") : t("Disabled")}
                    </Badge>
                    <Badge variant="outline">{t(RULE_TYPE_LABELS[rule.rule_type])}</Badge>
                    {rule.coupon_code ? (
                      <Badge variant="outline">{t("Code")}: {rule.coupon_code}</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("Priority")} {rule.priority}
                    {rule.starts_at || rule.ends_at
                      ? ` · ${t("From")} ${rule.starts_at ? new Date(rule.starts_at).toLocaleString(language === "ar" ? "ar-EG" : "en-US") : "—"} ${t("To")} ${rule.ends_at ? new Date(rule.ends_at).toLocaleString(language === "ar" ? "ar-EG" : "en-US") : "—"}`
                      : ""}
                    {rule.usage_limit_total != null
                      ? ` · ${t("Usage")} ${rule.usage_count}/${rule.usage_limit_total}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CompactActions>
                    <CompactAction
                      label={t("Edit")}
                      icon={Pencil}
                      disabled={pending}
                      onClick={() => openEdit(rule)}
                    />
                    <CompactAction
                      label={rule.is_active ? t("Disable") : t("Enable")}
                      icon={Power}
                      disabled={pending}
                      onClick={() => toggle(rule)}
                    />
                    <CompactAction
                      label={t("Delete")}
                      icon={Trash2}
                      variant="ghost"
                      disabled={pending}
                      onClick={() => remove(rule)}
                    />
                  </CompactActions>
                </div>
              </li>
            ))}
          </ul>
        )}
      </OperationalCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <StandardModalContent
          size="lg"
          title={form.id ? t("Edit promotion") : t("New promotion")}
          description={t("Set type, scope, and schedule. Final calculations run on the server.")}
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                {t("Cancel")}
              </Button>
              <Button onClick={save} disabled={pending}>
                {t("Save")}
              </Button>
            </>
          }
        >
        <div className="grid max-h-[min(70dvh,calc(100dvh-12rem))] gap-4 overflow-y-auto pe-1">
          <div className="grid gap-2">
            <Label htmlFor="promo-name">{t("Name")}</Label>
            <Input
              id="promo-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t("Promotion type")}</Label>
            <Select
              value={form.ruleType}
              onValueChange={(v) => setForm({ ...form, ruleType: v as PromotionRuleType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RULE_TYPE_LABELS) as PromotionRuleType[]).map((ruleType) => (
                  <SelectItem key={ruleType} value={ruleType}>
                    {t(RULE_TYPE_LABELS[ruleType])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(form.ruleType === "percent_off_item" ||
            form.ruleType === "cart_percent" ||
            form.ruleType === "qty_threshold") && (
            <div className="grid gap-2">
              <Label htmlFor="promo-pct">{t("Discount percent")}</Label>
              <Input
                id="promo-pct"
                type="number"
                min={0}
                max={100}
                value={form.percent}
                onChange={(e) => setForm({ ...form, percent: e.target.value })}
              />
            </div>
          )}

          {(form.ruleType === "fixed_off_item" ||
            form.ruleType === "cart_fixed" ||
            form.ruleType === "qty_threshold") && (
            <div className="grid gap-2">
              <Label htmlFor="promo-amt">{t("Discount amount")}</Label>
              <Input
                id="promo-amt"
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
          )}

          {form.ruleType === "scheduled_sale_price" && (
            <div className="grid gap-2">
              <Label htmlFor="promo-sale">{t("Sale price")}</Label>
              <Input
                id="promo-sale"
                type="number"
                min={0}
                value={form.salePrice}
                onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
              />
            </div>
          )}

          {form.ruleType === "bogo" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>{t("Buy")}</Label>
                <Input
                  type="number"
                  value={form.buyQty}
                  onChange={(e) => setForm({ ...form, buyQty: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("Get")}</Label>
                <Input
                  type="number"
                  value={form.getQty}
                  onChange={(e) => setForm({ ...form, getQty: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("Discount percent")}</Label>
                <Input
                  type="number"
                  value={form.getPercent}
                  onChange={(e) => setForm({ ...form, getPercent: e.target.value })}
                />
              </div>
            </div>
          )}

          {form.ruleType === "qty_threshold" && (
            <div className="grid gap-2">
              <Label>{t("Minimum quantity")}</Label>
              <Input
                type="number"
                value={form.minQty}
                onChange={(e) => setForm({ ...form, minQty: e.target.value })}
              />
            </div>
          )}

          {showCartFields && (
            <div className="grid gap-2">
              <Label>{t("Minimum subtotal")}</Label>
              <Input
                type="number"
                value={form.minSubtotal}
                onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })}
              />
            </div>
          )}

          {showItemScope && (
            <>
              <div className="grid gap-2">
                <Label>{t("Scope")}</Label>
                <Select
                  value={form.scopeType}
                  onValueChange={(v) =>
                    setForm({ ...form, scopeType: v as PromotionScopeType, scopeIds: [] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("All items")}</SelectItem>
                    <SelectItem value="product">{t("Selected products")}</SelectItem>
                    <SelectItem value="category">{t("Selected categories")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.scopeType !== "all" && (
                <div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border p-2">
                  {scopeOptions.map((opt) => {
                    const checked = form.scopeIds.includes(opt.id);
                    return (
                      <label key={opt.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = v === true
                              ? [...form.scopeIds, opt.id]
                              : form.scopeIds.filter((id) => id !== opt.id);
                            setForm({ ...form, scopeIds: next });
                          }}
                        />
                        {opt.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>{t("From")}</Label>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("To")}</Label>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="promo-code">{t("Coupon code (optional)")}</Label>
            <Input
              id="promo-code"
              value={form.couponCode}
              onChange={(e) => setForm({ ...form, couponCode: e.target.value })}
              placeholder={t("Example: SAVE10")}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>{t("Priority")}</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("Coupon usage limit")}</Label>
              <Input
                type="number"
                value={form.usageLimitTotal}
                onChange={(e) => setForm({ ...form, usageLimitTotal: e.target.value })}
                placeholder={t("No limit")}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.saleRetail}
                onCheckedChange={(v) => setForm({ ...form, saleRetail: v === true })}
              />
              {t("Retail")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.saleWholesale}
                onCheckedChange={(v) => setForm({ ...form, saleWholesale: v === true })}
              />
              {t("Wholesale")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.stackableWithCart}
                onCheckedChange={(v) => setForm({ ...form, stackableWithCart: v === true })}
              />
              {t("Allow stacking with another discount")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v === true })}
              />
              {t("Active")}
            </label>
          </div>
        </div>
        </StandardModalContent>
      </Dialog>
      {confirmationDialog}
    </div>
  );
}
