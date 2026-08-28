"use client";

import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  EXPIRY_POLICIES,
  INVENTORY_ROTATION_METHODS,
  INVENTORY_TRACKING_MODES,
  MEASUREMENT_UNITS,
  PRODUCT_TYPES,
  SHELF_LIFE_UNITS,
  type BusinessActivityType,
} from "@/lib/constants";
import {
  EXPIRY_POLICY_LABELS,
  INVENTORY_ROTATION_METHOD_LABELS,
  INVENTORY_TRACKING_MODE_LABELS,
  SHELF_LIFE_UNIT_LABELS,
  labelProductType,
} from "@/lib/labels/inventory";
import { formatUnit, isPurchasePackUnit } from "@/lib/units";
import { selectLabelById } from "@/lib/select-label";
import type { Category, MeasurementUnit } from "@/lib/types";
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import { FormField } from "@/components/Velora/form-field";
import { getVisibleAdvancedSettingsForProduct } from "@/modules/products/lib/advanced-settings-visibility";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  getFirstProductFormErrorStep,
  getProductFormFieldsForStep,
} from "@/modules/products/lib/product-form-steps";
import type { ProductFormValues } from "@/modules/products/components/product-form-dialog";

type Props = {
  form: UseFormReturn<ProductFormValues>;
  categories: Category[];
  isEdit: boolean;
  currency: string;
  activityType: BusinessActivityType;
  enablePriceByAmount?: boolean;
  enableWeightSales?: boolean;
  enableWholesaleSales?: boolean;
  onSubmit: (values: ProductFormValues) => void | Promise<void>;
  onCancel: () => void;
  onImageFileChange?: (file: File | null) => void;
  onApplyActivityTemplate?: (
    productType: ProductFormValues["product_type"],
    salesUnitType?: ProductFormValues["sales_unit_type"],
  ) => void;
};

const STEP_TITLES = [
  "Basic details",
  "Product type",
  "Pricing",
  "Inventory",
] as const;
const SUPERMARKET_STEP_TITLES = [
  "Basic details",
  "Sales method",
  "Prices",
  "Review",
] as const;

const PRODUCT_TYPE_CHOICES: Array<{
  id: ProductFormValues["product_type"];
  label: string;
  hint: string;
  salesUnitType?: ProductFormValues["sales_unit_type"];
}> = [
  { id: "finished_product", label: "Direct-sale product", hint: "Ready to sell" },
  { id: "finished", label: "Weighted product", hint: "Priced by weight or quantity" },
  { id: "ingredient", label: "Ingredient", hint: "Used in recipes" },
  {
    id: "packaging_material",
    label: "Packaging material",
    hint: "Cups, spoons, boxes, and bags",
  },
  { id: "service", label: "Service", hint: "A service with no inventory" },
];

/** Supermarket: keep only the two everyday choices; rare types stay in advanced. */
const SUPERMARKET_PRODUCT_TYPE_CHOICES: Array<{
  id: ProductFormValues["product_type"];
  label: string;
  hint: string;
  salesUnitType: ProductFormValues["sales_unit_type"];
}> = [
  {
    id: "finished_product",
    label: "By piece",
    hint: "Water, groceries, canned goods…",
    salesUnitType: "piece",
  },
  {
    id: "finished_product",
    label: "By kilogram",
    hint: "Vegetables, cheese, meat…",
    salesUnitType: "weight",
  },
];

function supermarketSellLabel(
  salesUnitType: ProductFormValues["sales_unit_type"],
): string {
  return salesUnitType === "weight" ? "By kilogram" : "By piece";
}

const SUPERMARKET_PIECE_PURCHASE_UNITS: Array<{
  id: MeasurementUnit;
  label: string;
  hint: string;
  isLoose: boolean;
}> = [
  {
    id: "piece",
    label: "By piece",
    hint: "Buy and sell by piece",
    isLoose: true,
  },
  {
    id: "carton",
    label: "By carton",
    hint: "A carton containing pieces",
    isLoose: false,
  },
  {
    id: "pack",
    label: "By pack",
    hint: "A pack containing pieces",
    isLoose: false,
  },
  {
    id: "box",
    label: "By box",
    hint: "A box containing pieces",
    isLoose: false,
  },
];

const SUPERMARKET_WEIGHT_PURCHASE_UNITS: Array<{
  id: MeasurementUnit;
  label: string;
  hint: string;
  isLoose: boolean;
}> = [
  { id: "kg", label: "By kilogram", hint: "Buy and sell by weight", isLoose: true },
  {
    id: "carton",
    label: "By carton",
    hint: "A carton with a fixed weight",
    isLoose: false,
  },
  { id: "pack", label: "By pack", hint: "A pack with a fixed weight", isLoose: false },
  { id: "box", label: "By box", hint: "A box with a fixed weight", isLoose: false },
  {
    id: "bag",
    label: "By bag",
    hint: "A bag with a fixed weight",
    isLoose: false,
  },
];

export function GuidedProductDetailsForm({
  form,
  categories,
  isEdit,
  currency,
  activityType,
  enablePriceByAmount = false,
  enableWeightSales = false,
  enableWholesaleSales = false,
  onSubmit,
  onCancel,
  onImageFileChange,
  onApplyActivityTemplate,
}: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [reapplyDialogOpen, setReapplyDialogOpen] = useState(false);
  const [pendingTemplateReapply, setPendingTemplateReapply] = useState<{
    productType: ProductFormValues["product_type"];
    salesUnitType?: ProductFormValues["sales_unit_type"];
  } | null>(null);
  const values = form.watch();
  const errors = form.formState.errors;
  const visibleAdvancedSettings = getVisibleAdvancedSettingsForProduct(
    activityType,
    values.product_type,
    values.sales_unit_type,
  );
  const showInventoryTracking =
    visibleAdvancedSettings.has("inventory_tracking");
  const showBatchTracking = visibleAdvancedSettings.has("batch_tracking");
  const showExpiryTracking = visibleAdvancedSettings.has("expiry_tracking");
  const showFefo = visibleAdvancedSettings.has("fefo");
  const showFractionalQuantity = visibleAdvancedSettings.has(
    "fractional_quantity",
  );
  const showPriceByAmount = enablePriceByAmount;
  const isSupermarket = activityType === "supermarket";
  const stepTitles = isSupermarket ? SUPERMARKET_STEP_TITLES : STEP_TITLES;
  const productTypeChoices = isSupermarket
    ? SUPERMARKET_PRODUCT_TYPE_CHOICES.filter(
        (choice) => enableWeightSales || choice.salesUnitType !== "weight",
      )
    : PRODUCT_TYPE_CHOICES.filter((choice) => {
        if (enableWeightSales) return true;
        if (choice.salesUnitType === "weight") return false;
        return choice.id !== "finished";
      });
  const showWholesale = enableWholesaleSales;
  const showSerialNumber = false;
  const baseUnit = values.base_unit ?? values.unit;
  const isWeightSell = values.sales_unit_type === "weight";
  const showSupermarketPurchasePacking =
    isSupermarket &&
    (values.sales_unit_type === "piece" || isWeightSell) &&
    (values.product_type === "finished_product" ||
      values.product_type === "finished");
  const purchasePackUnit =
    showSupermarketPurchasePacking &&
    values.cost_unit !== baseUnit &&
    isPurchasePackUnit(values.cost_unit)
      ? values.cost_unit
      : null;
  const supermarketPurchaseUnits = isWeightSell
    ? SUPERMARKET_WEIGHT_PURCHASE_UNITS
    : SUPERMARKET_PIECE_PURCHASE_UNITS;
  const salesUnitChoices = [
    { id: "piece" as const, label: "Direct-sale product" },
    ...(enableWeightSales
      ? [{ id: "weight" as const, label: "Weighted product" }]
      : []),
    { id: "volume" as const, label: "Ingredient" },
    { id: "pack" as const, label: "Packaging material" },
  ];

  /** Only fields the activity template overwrites — not name/prices/purchase packing. */
  const TEMPLATE_OWNED_FIELDS = new Set<keyof ProductFormValues>([
    "unit",
    "base_unit",
    "sale_unit",
    "inventory_tracking_mode",
    "inventory_rotation_method",
    "expiry_policy",
    "expiry_tracking_enabled",
    "shelf_life_value",
    "shelf_life_unit",
    "allow_fractional_quantity",
    "allow_price_input",
    "track_inventory",
    "wholesale_enabled",
  ]);

  const shouldConfirmTemplateReapply = () => {
    if (!onApplyActivityTemplate) return false;
    // Supermarket path: silent defaults; never interrupt with "template" jargon.
    if (isSupermarket) return false;
    const dirty = form.formState.dirtyFields as Partial<
      Record<keyof ProductFormValues, boolean>
    >;
    return [...TEMPLATE_OWNED_FIELDS].some((field) => dirty[field]);
  };

  const requestTemplateReapply = (
    productType: ProductFormValues["product_type"],
    salesUnitType?: ProductFormValues["sales_unit_type"],
  ) => {
    if (!onApplyActivityTemplate) return;
    if (shouldConfirmTemplateReapply()) {
      setPendingTemplateReapply({ productType, salesUnitType });
      setReapplyDialogOpen(true);
      return;
    }
    onApplyActivityTemplate(productType, salesUnitType);
  };

  const trackingModes = INVENTORY_TRACKING_MODES.filter((mode) => {
    if (mode === "batch" && !showBatchTracking) return false;
    if (
      mode === "batch_and_expiry" &&
      !(showBatchTracking && showExpiryTracking)
    )
      return false;
    if (mode === "serial_number" && !showSerialNumber) return false;
    return true;
  });

  const rotationMethods = INVENTORY_ROTATION_METHODS.filter((method) => {
    if (method === "FEFO" && !showFefo) return false;
    return true;
  });

  const validateStep = async (targetStep: number) => {
    const fields = getProductFormFieldsForStep(targetStep);
    if (fields.length === 0) return true;
    return form.trigger(fields);
  };

  const goToStep = async (target: number) => {
    if (target <= step) {
      setStep(target);
      return;
    }
    const isValid = await validateStep(step);
    if (!isValid) return;
    setStep(target);
  };

  const handleFormSubmit = form.handleSubmit(onSubmit, (fieldErrors) => {
    const errorStep = getFirstProductFormErrorStep(fieldErrors);
    if (errorStep !== undefined) setStep(errorStep);
    const firstField = Object.keys(fieldErrors)[0] as
      keyof ProductFormValues | undefined;
    if (firstField) void form.setFocus(firstField);
  });

  return (
    <form onSubmit={handleFormSubmit} className="flex flex-col gap-5">
      <nav aria-label={t("Product setup steps")} className="flex gap-1.5">
        {stepTitles.map((title, idx) => {
          const active = step === idx + 1;
          return (
            <button
              key={title}
              type="button"
              aria-current={active ? "step" : undefined}
              className={`min-w-0 flex-1 rounded-xl px-2 py-2.5 text-center transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/80 text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => {
                void goToStep(idx + 1);
              }}
            >
              <span className="block text-[10px] font-medium tabular-nums opacity-80">
                {idx + 1}
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-medium leading-tight sm:text-xs">
                {t(title)}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="min-h-[14rem] space-y-4">
        {step === 1 ? (
          <div className="space-y-4">
            <FormField
              id="name"
              label={t("Product name")}
              error={errors.name?.message ? t(errors.name.message) : undefined}
            >
              <Input
                id="name"
                aria-invalid={!!errors.name}
                {...form.register("name")}
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                id="category_id"
                label={t("Category")}
                error={errors.category_id?.message ? t(errors.category_id.message) : undefined}
              >
                <Select
                  value={values.category_id}
                  onValueChange={(v) =>
                    form.setValue("category_id", v ?? "", {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger aria-invalid={!!errors.category_id}>
                    <SelectValue placeholder={t("Select category")}>
                      {(value) =>
                        selectLabelById(categories, value, (c) => c.name)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id} label={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                id="product_code"
                label={
                  isSupermarket ? t("Barcode") : t("Product code / barcode")
                }
                hint={isEdit ? undefined : t("Generated automatically")}
              >
                <Input
                  id="product_code"
                  readOnly
                  value={values.sku || "—"}
                  className="bg-muted/50"
                />
              </FormField>
            </div>
            <FormField
              id="image_upload"
              label={t("Product image")}
              hint={t("Upload an image or enter a direct image link.")}
              error={errors.image_url?.message}
            >
              <div className="grid gap-2">
                <Input
                  id="image_upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) =>
                    onImageFileChange?.(e.target.files?.[0] ?? null)
                  }
                />
                <Input
                  id="image_url"
                  aria-invalid={!!errors.image_url}
                  value={values.image_url ?? ""}
                  onChange={(e) =>
                    form.setValue("image_url", e.target.value || null)
                  }
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </FormField>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <FormField
              id="product_type"
              label={
                isSupermarket ? t("How do you sell it?") : t("Product type")
              }
              error={errors.product_type?.message}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {productTypeChoices.map((item) => {
                  const salesUnitType =
                    item.salesUnitType ?? values.sales_unit_type;
                  const selected =
                    values.product_type === item.id &&
                    (!isSupermarket ||
                      values.sales_unit_type === salesUnitType);
                  return (
                    <button
                      key={`${item.id}-${item.salesUnitType ?? item.id}`}
                      type="button"
                      className={`rounded-xl border p-3 text-left ${selected ? "border-primary bg-primary/10" : "border-border/60"} ${errors.product_type ? "border-destructive ring-3 ring-destructive/20" : ""}`}
                      onClick={() => {
                        const unchanged =
                          values.product_type === item.id &&
                          (!isSupermarket ||
                            values.sales_unit_type === salesUnitType);
                        if (unchanged) return;

                        form.setValue("product_type", item.id, {
                          shouldValidate: true,
                        });
                        if (isSupermarket && item.salesUnitType) {
                          form.setValue("sales_unit_type", item.salesUnitType, {
                            shouldValidate: true,
                          });
                          // Reset purchase packing when sell mode changes (piece ↔ weight).
                          form.setValue(
                            "cost_unit",
                            item.salesUnitType === "weight" ? "kg" : "piece",
                            { shouldValidate: true },
                          );
                          form.setValue("units_per_purchase_unit", 1, {
                            shouldValidate: true,
                          });
                          requestTemplateReapply(item.id, item.salesUnitType);
                        } else {
                          requestTemplateReapply(
                            item.id,
                            values.sales_unit_type,
                          );
                        }
                      }}
                    >
                      <div className="text-sm font-medium">{t(item.label)}</div>
                      <div className="text-xs text-muted-foreground">
                        {t(item.hint)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </FormField>
            {!isSupermarket ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  id="sales_unit_type"
                  label={t("Sales method")}
                  error={errors.sales_unit_type?.message}
                >
                  <Select
                    value={values.sales_unit_type}
                    onValueChange={(v) => {
                      const nextSales = (v ??
                        "piece") as ProductFormValues["sales_unit_type"];
                      form.setValue("sales_unit_type", nextSales, {
                        shouldValidate: true,
                      });
                      requestTemplateReapply(values.product_type, nextSales);
                    }}
                  >
                    <SelectTrigger aria-invalid={!!errors.sales_unit_type}>
                      <SelectValue>
                        {(value) =>
                          t(
                            salesUnitChoices.find((u) => u.id === value)
                              ?.label ?? "",
                          ) || null
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {salesUnitChoices.map((u) => (
                        <SelectItem key={u.id} value={u.id} label={t(u.label)}>
                          {t(u.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField id="sale_unit" label={t("Inventory unit")}>
                  <Select
                    value={values.sale_unit}
                    onValueChange={(v) =>
                      form.setValue(
                        "sale_unit",
                        (v ?? "piece") as ProductFormValues["sale_unit"],
                        { shouldValidate: true },
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(value) =>
                          value
                            ? formatUnit(
                                value as ProductFormValues["sale_unit"],
                              )
                            : null
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {MEASUREMENT_UNITS.map((u) => (
                        <SelectItem key={u} value={u} label={formatUnit(u)}>
                          {formatUnit(u)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            ) : null}
            {showSupermarketPurchasePacking ? (
              <div className="space-y-3 rounded-xl border border-border/60 p-3">
                <div className="text-sm font-medium">
                  {t("How do you buy it from the supplier?")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isWeightSell
                    ? t(
                        "Sell by kilogram. Buy by kilogram or in a carton, pack, or bag with a fixed weight.",
                      )
                    : t(
                        "Sell by piece. Buy by piece or in a carton, pack, or box.",
                      )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {supermarketPurchaseUnits.map((option) => {
                    const selected = option.isLoose
                      ? !purchasePackUnit
                      : values.cost_unit === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`rounded-xl border p-3 text-right ${selected ? "border-primary bg-primary/10" : "border-border/60"}`}
                        onClick={() => {
                          if (option.isLoose) {
                            form.setValue(
                              "cost_unit",
                              isWeightSell ? "kg" : baseUnit,
                              { shouldValidate: true },
                            );
                            form.setValue("units_per_purchase_unit", 1, {
                              shouldValidate: true,
                            });
                            return;
                          }
                          form.setValue("cost_unit", option.id, {
                            shouldValidate: true,
                          });
                          const currentFactor = Number(
                            values.units_per_purchase_unit,
                          );
                          const nextFactor = isWeightSell
                            ? currentFactor > 0 && currentFactor !== 1
                              ? currentFactor
                              : 2.5
                            : Math.max(2, currentFactor || 24);
                          form.setValue("units_per_purchase_unit", nextFactor, {
                            shouldValidate: true,
                          });
                        }}
                      >
                        <div className="text-sm font-medium">
                          {t(option.label)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t(option.hint)}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {purchasePackUnit ? (
                  <FormField
                    id="units_per_purchase_unit"
                    label={
                      `${t("How many")} ${t(isWeightSell ? "kilograms" : "pieces")} ${t("per")} ${formatUnit(purchasePackUnit)}?`
                    }
                    hint={
                      isWeightSell ? t("Example: 2.5 or 1.5") : t("Example: 24")
                    }
                    error={errors.units_per_purchase_unit?.message}
                  >
                    <Input
                      id="units_per_purchase_unit"
                      type="number"
                      min={isWeightSell ? 0.01 : 2}
                      step={isWeightSell ? 0.01 : 1}
                      aria-invalid={!!errors.units_per_purchase_unit}
                      {...form.register("units_per_purchase_unit", {
                        valueAsNumber: true,
                      })}
                    />
                  </FormField>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            {isSupermarket ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  id="last_unit_cost"
                  label={
                    isWeightSell
                      ? t("Purchase price / kg")
                      : t("Purchase price / piece")
                  }
                  hint={
                    purchasePackUnit
                      ? isWeightSell
                        ? `${t("Cost per kilogram, not per")} ${formatUnit(purchasePackUnit)}`
                        : `${t("Cost per piece, not per")} ${formatUnit(purchasePackUnit)}`
                      : undefined
                  }
                  error={errors.last_unit_cost?.message}
                >
                  <Input
                    id="last_unit_cost"
                    type="number"
                    step="0.01"
                    min="0"
                    aria-invalid={!!errors.last_unit_cost}
                    {...form.register("last_unit_cost", {
                      valueAsNumber: true,
                    })}
                  />
                </FormField>
                <FormField
                  id="base_price"
                  label={
                    values.sales_unit_type === "weight"
                      ? t("Sale price / kg")
                      : t("Sale price / piece")
                  }
                  error={errors.base_price?.message}
                >
                  <Input
                    id="base_price"
                    type="number"
                    step="0.01"
                    min="0"
                    aria-invalid={!!errors.base_price}
                    {...form.register("base_price", { valueAsNumber: true })}
                  />
                </FormField>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  id="base_price"
                  label={t("Cost price")}
                  error={errors.base_price?.message}
                >
                  <Input
                    id="base_price"
                    type="number"
                    step="0.01"
                    aria-invalid={!!errors.base_price}
                    {...form.register("base_price", { valueAsNumber: true })}
                  />
                </FormField>
                <FormField
                  id="sale_price"
                  label={t("Sale price")}
                  error={errors.sale_price?.message}
                >
                  <Input
                    id="sale_price"
                    type="number"
                    step="0.01"
                    aria-invalid={!!errors.sale_price}
                    value={values.sale_price ?? ""}
                    onChange={(e) =>
                      form.setValue(
                        "sale_price",
                        e.target.value === "" ? null : Number(e.target.value),
                        { shouldValidate: true },
                      )
                    }
                  />
                </FormField>
              </div>
            )}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 p-3 text-sm">
              <div className="font-medium">
                {values.name || t("Unnamed product")}
              </div>
              <div className="text-muted-foreground">
                {isSupermarket ? (
                  <>
                    {t(supermarketSellLabel(values.sales_unit_type))}
                    {purchasePackUnit
                      ? ` · ${t("Buy by")} ${formatUnit(purchasePackUnit)} ${t("with")} ${values.units_per_purchase_unit} ${t(isWeightSell ? "kg" : "pieces")}`
                      : isWeightSell
                        ? ` · ${t("Buy by kilogram")}`
                        : ` · ${t("Buy by piece")}`}
                    {" · "}
                    {t("Purchase")} {values.last_unit_cost} · {t("Sale")}{" "}
                    {values.base_price} {currency}
                  </>
                ) : (
                  <>
                    {t("Type")} {t(labelProductType(values.product_type))} |{" "}
                    {t("Cost")} {values.base_price} {currency}
                  </>
                )}
              </div>
            </div>
            <FormField id="description" label={t("Description")}>
              <Textarea
                id="description"
                rows={3}
                {...form.register("description")}
              />
            </FormField>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={values.is_active}
                  onCheckedChange={(v) =>
                    form.setValue("is_active", Boolean(v))
                  }
                />
                {t("Active")}
              </label>
              {(values.product_type === "finished" ||
                values.product_type === "finished_product") && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={values.show_on_online_menu}
                    onCheckedChange={(v) =>
                      form.setValue("show_on_online_menu", v === true)
                    }
                  />
                  {t("Show in")}{" "}
                  {isSupermarket ? t("Online sales") : t("Online menu")}
                </label>
              )}
              {showInventoryTracking ? (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={values.track_inventory}
                      onCheckedChange={(v) =>
                        form.setValue("track_inventory", Boolean(v))
                      }
                    />
                    {t("Track inventory")}
                  </label>
                  {showExpiryTracking ? (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={values.expiry_tracking_enabled}
                        onCheckedChange={(v) =>
                          form.setValue("expiry_tracking_enabled", v === true)
                        }
                      />
                      {t("Track expiry")}
                    </label>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border/60 px-3 py-2.5">
        <button
          type="button"
          className="flex w-full items-center justify-between text-start text-sm font-medium"
          onClick={() => setAdvancedOpen((current) => !current)}
        >
          <span>{t("Advanced settings")}</span>
          {advancedOpen ? (
            <ChevronDown className="size-4 shrink-0" />
          ) : (
            <ChevronRight className="size-4 shrink-0" />
          )}
        </button>
        {advancedOpen ? (
          <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
            {showInventoryTracking ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t("Tracking method")}</Label>
                  <Select
                    value={values.inventory_tracking_mode}
                    onValueChange={(v) =>
                      form.setValue(
                        "inventory_tracking_mode",
                        (v ??
                          "standard") as ProductFormValues["inventory_tracking_mode"],
                        { shouldValidate: true },
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(value) =>
                          value
                            ? t(
                                INVENTORY_TRACKING_MODE_LABELS[
                                  value as ProductFormValues["inventory_tracking_mode"]
                                ],
                              )
                            : null
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {trackingModes.map((mode) => (
                        <SelectItem
                          key={mode}
                          value={mode}
                          label={t(INVENTORY_TRACKING_MODE_LABELS[mode])}
                        >
                          {t(INVENTORY_TRACKING_MODE_LABELS[mode])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t("Stock issue order")}</Label>
                  <Select
                    value={values.inventory_rotation_method}
                    onValueChange={(v) =>
                      form.setValue(
                        "inventory_rotation_method",
                        (v ??
                          "FIFO") as ProductFormValues["inventory_rotation_method"],
                        { shouldValidate: true },
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(value) =>
                          value
                            ? t(
                                INVENTORY_ROTATION_METHOD_LABELS[
                                  value as ProductFormValues["inventory_rotation_method"]
                                ],
                              )
                            : null
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {rotationMethods.map((method) => (
                        <SelectItem
                          key={method}
                          value={method}
                          label={t(INVENTORY_ROTATION_METHOD_LABELS[method])}
                        >
                          {t(INVENTORY_ROTATION_METHOD_LABELS[method])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
            {showExpiryTracking ? (
              <>
                <label className="flex items-center gap-2 rounded-xl border p-3">
                  <Checkbox
                    checked={values.expiry_tracking_enabled}
                    onCheckedChange={(v) =>
                      form.setValue("expiry_tracking_enabled", v === true)
                    }
                  />
                  <span className="text-sm">{t("Track expiry date")}</span>
                </label>
                {values.expiry_tracking_enabled ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>{t("Shelf life")}</Label>
                      <Input
                        type="number"
                        min={0}
                        {...form.register("shelf_life_value", {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("Duration unit")}</Label>
                      <Select
                        value={values.shelf_life_unit ?? "days"}
                        onValueChange={(v) =>
                          form.setValue(
                            "shelf_life_unit",
                            (v ??
                              "days") as ProductFormValues["shelf_life_unit"],
                            { shouldValidate: true },
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {(value) =>
                              value
                                ? t(
                                    SHELF_LIFE_UNIT_LABELS[
                                      value as ProductFormValues["shelf_life_unit"]
                                    ],
                                  )
                                : null
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {SHELF_LIFE_UNITS.map((unit) => (
                            <SelectItem
                              key={unit}
                              value={unit}
                              label={t(SHELF_LIFE_UNIT_LABELS[unit])}
                            >
                              {t(SHELF_LIFE_UNIT_LABELS[unit])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-2">
                  <Label>{t("When expired")}</Label>
                  <Select
                    value={values.expiry_policy}
                    onValueChange={(v) =>
                      form.setValue(
                        "expiry_policy",
                        (v ??
                          "block_sale") as ProductFormValues["expiry_policy"],
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(value) =>
                          value
                            ? t(
                                EXPIRY_POLICY_LABELS[
                                  value as ProductFormValues["expiry_policy"]
                                ],
                              )
                            : null
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRY_POLICIES.map((policy) => (
                        <SelectItem
                          key={policy}
                          value={policy}
                          label={t(EXPIRY_POLICY_LABELS[policy])}
                        >
                          {t(EXPIRY_POLICY_LABELS[policy])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            {showFractionalQuantity ? (
              <label className="flex items-center gap-2 rounded-xl border p-2">
                <Checkbox
                  checked={values.allow_fractional_quantity}
                  onCheckedChange={(v) =>
                    form.setValue("allow_fractional_quantity", v === true)
                  }
                />
                <span className="text-xs">
                  {t("Allow fractional sales, such as half a kilogram")}
                </span>
              </label>
            ) : null}
            {showPriceByAmount || showWholesale || showSerialNumber ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {showPriceByAmount || showSerialNumber ? (
                  <label className="flex items-center gap-2 rounded-xl border p-2">
                    <Checkbox
                      checked={values.allow_price_input}
                      onCheckedChange={(v) =>
                        form.setValue("allow_price_input", v === true)
                      }
                    />
                    <span className="text-xs">
                      {showPriceByAmount && showSerialNumber
                        ? t("Serial number / price by amount")
                        : showPriceByAmount
                          ? t("Sell by amount, not weight only")
                          : t("Serial number")}
                    </span>
                  </label>
                ) : null}
                {showWholesale ? (
                  <label className="flex items-center gap-2 rounded-xl border p-2">
                    <Checkbox
                      checked={values.wholesale_enabled}
                      onCheckedChange={(v) =>
                        form.setValue("wholesale_enabled", v === true)
                      }
                    />
                    <span className="text-xs">
                      {t(
                        "Wholesale — price is set in the Wholesale Prices tab",
                      )}
                    </span>
                  </label>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>
                  {isSupermarket
                    ? t("Other type (packaging / service)")
                    : t("Product type (advanced)")}
                </Label>
                <Select
                  value={values.product_type}
                  onValueChange={(v) => {
                    const nextType = (v ??
                      "finished_product") as ProductFormValues["product_type"];
                    form.setValue("product_type", nextType, {
                      shouldValidate: true,
                    });
                    requestTemplateReapply(nextType, values.sales_unit_type);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value) =>
                        value
                          ? t(
                              labelProductType(
                                value as ProductFormValues["product_type"],
                              ),
                            )
                          : null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(isSupermarket
                      ? PRODUCT_TYPES.filter(
                          (t) => t !== "ingredient" && t !== "raw_material",
                        )
                      : PRODUCT_TYPES
                    ).map((productType) => (
                      <SelectItem
                        key={productType}
                        value={productType}
                        label={t(labelProductType(productType))}
                      >
                        {t(labelProductType(productType))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>
                  {isSupermarket
                    ? t("Storage unit")
                    : t("Base unit (advanced)")}
                </Label>
                <Select
                  value={values.base_unit}
                  onValueChange={(v) =>
                    form.setValue(
                      "base_unit",
                      (v ?? "piece") as ProductFormValues["base_unit"],
                      { shouldValidate: true },
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value) =>
                        value
                          ? formatUnit(value as ProductFormValues["base_unit"])
                          : null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {MEASUREMENT_UNITS.map((u) => (
                      <SelectItem key={u} value={u} label={formatUnit(u)}>
                        {formatUnit(u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isSupermarket ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t("Sales unit")}</Label>
                  <Select
                    value={values.sale_unit}
                    onValueChange={(v) =>
                      form.setValue(
                        "sale_unit",
                        (v ?? "piece") as ProductFormValues["sale_unit"],
                        { shouldValidate: true },
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(value) =>
                          value
                            ? formatUnit(
                                value as ProductFormValues["sale_unit"],
                              )
                            : null
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {MEASUREMENT_UNITS.map((u) => (
                        <SelectItem key={u} value={u} label={formatUnit(u)}>
                          {formatUnit(u)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t("Purchase unit")}</Label>
                  <Select
                    value={values.cost_unit}
                    onValueChange={(v) => {
                      const next = (v ??
                        "piece") as ProductFormValues["cost_unit"];
                      form.setValue("cost_unit", next, {
                        shouldValidate: true,
                      });
                      if (next === baseUnit) {
                        form.setValue("units_per_purchase_unit", 1, {
                          shouldValidate: true,
                        });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(value) =>
                          value
                            ? formatUnit(
                                value as ProductFormValues["cost_unit"],
                              )
                            : null
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        ["piece", "carton", "pack", "box", "bag", "kg"] as const
                      ).map((u) => (
                        <SelectItem key={u} value={u} label={formatUnit(u)}>
                          {formatUnit(u)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("Cancel")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={step === 1}
          onClick={() => setStep((current) => Math.max(1, current - 1))}
        >
          {t("Back")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={step === 4}
          onClick={() => {
            void goToStep(Math.min(4, step + 1));
          }}
        >
          {t("Next")}
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {isEdit ? t("Save changes") : t("Create product")}
        </Button>
      </div>
      <ConfirmActionDialog
        open={reapplyDialogOpen}
        onOpenChange={setReapplyDialogOpen}
        title={t("Change product type?")}
        description={t(
          "Some inventory and expiry settings will reset to the new type defaults. Name and prices will not change.",
        )}
        confirmLabel={t("Continue")}
        onConfirm={() => {
          if (!pendingTemplateReapply) return;
          onApplyActivityTemplate?.(
            pendingTemplateReapply.productType,
            pendingTemplateReapply.salesUnitType,
          );
          setPendingTemplateReapply(null);
        }}
      />
    </form>
  );
}
