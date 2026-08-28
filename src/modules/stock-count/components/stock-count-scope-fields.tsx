"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selectLabelById } from "@/lib/select-label";
import { ProductSearchCombobox } from "@/modules/products/components/product-search-combobox";
import type { Category, Product, Warehouse } from "@/lib/types";
import { useTranslation } from "@/lib/i18n/use-translation";

export interface StockCountScopeValue {
  warehouseId: string;
  categoryId: string;
  productId: string;
  productQuery: string;
}

interface StockCountScopeFieldsProps {
  idPrefix: string;
  warehouses: Warehouse[];
  categories: Category[];
  products: Product[];
  value: StockCountScopeValue;
  onChange: (next: StockCountScopeValue) => void;
}

export function StockCountScopeFields({
  idPrefix,
  warehouses,
  categories,
  products,
  value,
  onChange,
}: StockCountScopeFieldsProps) {
  const { t } = useTranslation();
  const trackedProducts = products.filter((product) => {
    if (!product.track_inventory) return false;
    if (value.categoryId !== "all" && product.category_id !== value.categoryId) {
      return false;
    }
    return true;
  });

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-warehouse`}>{t("Warehouse")}</Label>
        <Select
          value={value.warehouseId}
          onValueChange={(warehouseId) =>
            onChange({ ...value, warehouseId: warehouseId ?? "" })
          }
        >
          <SelectTrigger id={`${idPrefix}-warehouse`} className="h-11">
            <SelectValue placeholder={t("Warehouse")}>
              {(selected) => selectLabelById(warehouses, selected, (w) => w.name)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {warehouses.map((warehouse) => (
              <SelectItem key={warehouse.id} value={warehouse.id} label={warehouse.name}>
                {warehouse.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-category`}>{t("Product category")}</Label>
        <Select
          value={value.categoryId}
          onValueChange={(categoryId) =>
            onChange({
              ...value,
              categoryId: categoryId ?? "all",
              productId: "",
              productQuery: "",
            })
          }
        >
          <SelectTrigger id={`${idPrefix}-category`} className="h-11">
            <SelectValue placeholder={t("All categories")}>
              {(selected) =>
                selected === "all"
                  ? t("All categories")
                  : selectLabelById(categories, selected, (c) => c.name)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" label={t("All categories")}>
              {t("All categories")}
            </SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id} label={category.name}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <ProductSearchCombobox
          products={trackedProducts}
          value={value.productQuery}
          onChange={(productQuery) => onChange({ ...value, productQuery })}
          selectedProductId={value.productId || undefined}
          onSelect={(product) =>
            onChange({
              ...value,
              productId: product.id,
              productQuery: product.name,
            })
          }
          label={t("One product (optional)")}
          placeholder={t("Leave empty for all products, or search for one")}
        />
        {value.productId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() =>
              onChange({ ...value, productId: "", productQuery: "" })
            }
          >
            {t("Clear product selection")}
          </Button>
        ) : null}
      </div>
    </>
  );
}
