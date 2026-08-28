"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Product, ProductVariant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  createVariantAction,
  deleteVariantAction,
  listVariantsAction,
  updateVariantAction,
} from "@/modules/products/actions/variant.actions";
import { RecipeEditor } from "./recipe-editor";

interface VariantEditorProps {
  product: Product;
  currency: string;
  recipesEnabled?: boolean;
  initialVariants?: ProductVariant[];
}

export function VariantEditor({
  product,
  currency,
  recipesEnabled = false,
  initialVariants = [],
}: VariantEditorProps) {
  const { t } = useTranslation();
  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants);
  const [loading, setLoading] = useState(initialVariants.length === 0);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    sku: "",
    barcode: "",
    price: "",
    image_url: "",
    variant_kind: "standard" as ProductVariant["variant_kind"],
    quantity_value: "",
    quantity_unit: "kg" as NonNullable<ProductVariant["quantity_unit"]>,
    price_mode: "calculate_from_unit_price" as NonNullable<ProductVariant["price_mode"]>,
    fixed_price: "",
  });
  const snapshotRef = useRef<ProductVariant[] | null>(null);
  const cancelledTempIdsRef = useRef(new Set<string>());

  function nextVariantSku() {
    const base = product.sku || product.name.replace(/\s+/g, "-").toUpperCase();
    return `${base}-${variants.length + 1}`;
  }

  useEffect(() => {
    let cancelled = false;
    void listVariantsAction(product.id)
      .then((rows) => {
        if (!cancelled) setVariants(rows);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : t("Could not load product variants")
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product.id, t]);

  function handleCreate() {
    const price = Number(draft.price) || 0;
    if (!draft.name.trim() || price <= 0) {
      toast.error(t("Name and price are required"));
      return;
    }
    const sku = draft.sku.trim() || nextVariantSku();
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: ProductVariant = {
      id: tempId,
      product_id: product.id,
      name: draft.name.trim(),
      sku,
      barcode: draft.barcode.trim() || sku,
      price_delta: 0,
      price,
      image_url: draft.image_url.trim() || null,
      is_active: true,
      variant_kind: draft.variant_kind,
      quantity_value: draft.quantity_value ? Number(draft.quantity_value) : null,
      quantity_unit: draft.quantity_unit,
      price_mode: "fixed_price",
      fixed_price: price,
    };

    snapshotRef.current = variants;
    setVariants((prev) => [...prev, optimistic]);
    setDraft({
      name: "",
      sku: "",
      barcode: "",
      price: "",
      image_url: "",
      variant_kind: "standard",
      quantity_value: "",
      quantity_unit: "kg",
      price_mode: "fixed_price",
      fixed_price: "",
    });
    setAddOpen(false);

    void (async () => {
      try {
        const created = await createVariantAction(product.id, {
          name: optimistic.name,
          sku: optimistic.sku,
          barcode: optimistic.barcode,
          price_delta: 0,
          price,
          image_url: optimistic.image_url,
          is_active: true,
          variant_kind: optimistic.variant_kind,
          quantity_value: optimistic.quantity_value,
          quantity_unit: optimistic.quantity_unit,
          price_mode: "fixed_price",
          fixed_price: price,
        });
        if (cancelledTempIdsRef.current.has(tempId)) {
          cancelledTempIdsRef.current.delete(tempId);
          try {
            await deleteVariantAction(created.id);
          } catch {
            /* best-effort */
          }
          return;
        }
        setVariants((prev) => {
          const withoutTemp = prev.filter((v) => v.id !== tempId);
          if (withoutTemp.some((v) => v.id === created.id)) return withoutTemp;
          return [...withoutTemp, created];
        });
      } catch {
        if (snapshotRef.current) setVariants(snapshotRef.current);
        toast.error(t("Could not create variant"));
      }
    })();
  }

  function handleUpdate(id: string, patch: Partial<ProductVariant>) {
    if (id.startsWith("temp-")) return;
    snapshotRef.current = variants;
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

    void (async () => {
      try {
        const updated = await updateVariantAction(id, patch);
        setVariants((prev) => prev.map((v) => (v.id === id ? updated : v)));
      } catch {
        if (snapshotRef.current) setVariants(snapshotRef.current);
        toast.error(t("Could not update variant"));
      }
    })();
  }

  function handleDelete(id: string) {
    snapshotRef.current = variants;
    setVariants((prev) => prev.filter((v) => v.id !== id));
    if (id.startsWith("temp-")) {
      cancelledTempIdsRef.current.add(id);
      return;
    }

    void (async () => {
      try {
        await deleteVariantAction(id);
      } catch {
        if (snapshotRef.current) setVariants(snapshotRef.current);
        toast.error(t("Could not delete variant"));
      }
    })();
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("Loading variants…")}</p>;
  }

  return (
    <div className="grid gap-4 pt-2">
      <div className="rounded-xl border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{t("Variants and prices")}</p>
            <p className="text-xs text-muted-foreground">{t("Add a variant with its price and barcode.")}</p>
          </div>
          <Button
            type="button"
            variant={addOpen ? "secondary" : "outline"}
            size="sm"
            onClick={() => setAddOpen((current) => !current)}
          >
            <Plus className="size-4" />
            {addOpen ? t("Close") : t("Add variant")}
          </Button>
        </div>

        {addOpen ? (
        <div className="mt-3 grid gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 sm:grid-cols-2 sm:items-end lg:grid-cols-[1fr_1fr_minmax(0,7.5rem)_minmax(0,7.5rem)_minmax(0,9rem)_auto]">
          <div className="grid gap-1">
            <Label className="text-xs">{t("Name")}</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder={t("Small")}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">SKU</Label>
            <Input
              value={draft.sku}
              onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
              placeholder={nextVariantSku()}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t("Barcode")}</Label>
            <Input
              value={draft.barcode}
              onChange={(e) => setDraft((d) => ({ ...d, barcode: e.target.value }))}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t("Price")} ({currency})</Label>
            <Input
              type="number"
              step="0.01"
              value={draft.price}
              onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t("Type")}</Label>
            <select
              className="h-9 rounded-xl border border-input bg-transparent px-3 text-sm"
              value={draft.variant_kind}
              onChange={(e) =>
                setDraft((d) => ({ ...d, variant_kind: e.target.value as ProductVariant["variant_kind"] }))
              }
            >
              <option value="standard">{t("Standard")}</option>
              <option value="weight_portion">{t("Weight / portion")}</option>
            </select>
          </div>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="size-4" /> {t("Save")}
          </Button>
          {draft.variant_kind === "weight_portion" ? (
            <div className="grid gap-2 sm:col-span-full sm:grid-cols-4">
              <div className="grid gap-1">
                <Label className="text-xs">{t("Quantity")}</Label>
                <Input
                  value={draft.quantity_value}
                  onChange={(e) => setDraft((d) => ({ ...d, quantity_value: e.target.value }))}
                  placeholder="0.250"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">{t("Unit")}</Label>
                <select
                  className="h-9 rounded-xl border border-input bg-transparent px-3 text-sm"
                  value={draft.quantity_unit}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      quantity_unit: e.target.value as NonNullable<ProductVariant["quantity_unit"]>,
                    }))
                  }
                >
                  <option value="kg">kg</option>
                  <option value="gram">gram</option>
                </select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">{t("Pricing method")}</Label>
                <select
                  className="h-9 rounded-xl border border-input bg-transparent px-3 text-sm"
                  value={draft.price_mode}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      price_mode: e.target.value as NonNullable<ProductVariant["price_mode"]>,
                    }))
                  }
                >
                  <option value="calculate_from_unit_price">{t("Calculate from unit price")}</option>
                  <option value="fixed_price">{t("Fixed price")}</option>
                </select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">{t("Fixed price")} ({currency})</Label>
                <Input
                  value={draft.fixed_price}
                  onChange={(e) => setDraft((d) => ({ ...d, fixed_price: e.target.value }))}
                  placeholder="50"
                />
              </div>
            </div>
          ) : null}
        </div>
        ) : null}
      </div>

      {variants.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("No variants yet. Products with variants require a selection at the POS.")}
        </p>
      ) : (
        <Tabs defaultValue={variants[0]?.id}>
          <TabsList className="flex h-auto flex-wrap gap-1">
            {variants.map((v) => (
              <TabsTrigger key={v.id} value={v.id} className="text-xs">
                {v.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {variants.map((variant) => (
            <TabsContent key={variant.id} value={variant.id} className="grid gap-4 pt-3">
              <div className="grid gap-2 rounded-xl border border-border/70 p-3 sm:grid-cols-2 sm:items-end lg:grid-cols-[1fr_minmax(0,7.5rem)_1fr_1fr_auto_auto]">
                <div className="grid gap-1">
                  <Label className="text-xs">{t("Name")}</Label>
                  <Input
                    defaultValue={variant.name}
                    key={`name-${variant.id}-${variant.name}`}
                    disabled={variant.id.startsWith("temp-")}
                    onBlur={(e) => {
                      if (e.target.value !== variant.name) {
                        handleUpdate(variant.id, { name: e.target.value });
                      }
                    }}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">{t("Price")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={variant.price ?? ""}
                    key={`price-${variant.id}-${variant.price ?? "empty"}`}
                    disabled={variant.id.startsWith("temp-")}
                    onBlur={(e) => {
                      const price = e.target.value ? Number(e.target.value) : null;
                      if (price !== variant.price) {
                        handleUpdate(variant.id, {
                          price,
                          fixed_price: price,
                          price_mode: price != null ? "fixed_price" : variant.price_mode,
                        });
                      }
                    }}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">SKU</Label>
                  <Input
                    defaultValue={variant.sku}
                    key={`sku-${variant.id}-${variant.sku}`}
                    disabled={variant.id.startsWith("temp-")}
                    onBlur={(e) => {
                      if (e.target.value !== variant.sku) {
                        handleUpdate(variant.id, { sku: e.target.value });
                      }
                    }}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">{t("Barcode")}</Label>
                  <Input
                    defaultValue={variant.barcode}
                    key={`barcode-${variant.id}-${variant.barcode}`}
                    disabled={variant.id.startsWith("temp-")}
                    onBlur={(e) => {
                      if (e.target.value !== variant.barcode) {
                        handleUpdate(variant.id, { barcode: e.target.value });
                      }
                    }}
                  />
                </div>
                <label className="flex h-8 items-center gap-2 text-sm">
                  <Checkbox
                    checked={variant.is_active}
                    disabled={variant.id.startsWith("temp-")}
                    onCheckedChange={(v) => handleUpdate(variant.id, { is_active: Boolean(v) })}
                  />
                  {t("Active")}
                </label>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(variant.id)}
                >
                  <Trash2 className="size-4" /> {t("Delete")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("Sale price")}: {formatCurrency(variant.price ?? product.base_price + variant.price_delta, currency)}
              </p>
              {recipesEnabled && !variant.id.startsWith("temp-") ? (
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-sm font-medium">{t("Recipe")} {variant.name}</p>
                  <RecipeEditor
                    product={product}
                    currency={currency}
                    variantId={variant.id}
                    variantLabel={variant.name}
                    salePrice={variant.price ?? product.base_price + variant.price_delta}
                  />
                </div>
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
