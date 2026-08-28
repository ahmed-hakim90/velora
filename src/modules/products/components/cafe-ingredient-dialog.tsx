"use client";

import { useState, useTransition } from "react";
import type { Category, MeasurementUnit, Product } from "@/lib/types";
import { MEASUREMENT_UNITS } from "@/lib/constants";
import { formatUnit } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StandardModalContent } from "@/components/Velora/standard-modal";
import {
  createCafeIngredientAction,
  updateCafeIngredientAction,
} from "@/modules/products/actions/product.actions";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/use-translation";

type CafeIngredientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  ingredient?: Product | null;
  onSaved?: () => void;
};

export function CafeIngredientDialog({
  open,
  onOpenChange,
  categories,
  ingredient,
  onSaved,
}: CafeIngredientDialogProps) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(ingredient);
  const [form, setForm] = useState(() => ({
    name: ingredient?.name ?? "",
    category_id: ingredient?.category_id ?? "",
    unit: ingredient?.unit ?? ("piece" as MeasurementUnit),
    unit_cost: ingredient ? String(ingredient.last_unit_cost ?? 0) : "",
  }));

  function reset() {
    setForm({ name: "", category_id: "", unit: "piece", unit_cost: "" });
  }

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error(t("Ingredient name is required."));
      return;
    }
    if (!form.category_id) {
      toast.error(t("Choose a category first."));
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          name,
          category_id: form.category_id,
          unit: form.unit,
          unit_cost: Number(form.unit_cost) || 0,
        };
        if (ingredient) {
          await updateCafeIngredientAction(ingredient.id, payload);
          toast.success(t("Ingredient updated."));
        } else {
          await createCafeIngredientAction(payload);
          toast.success(t("Ingredient added."));
        }
        reset();
        onOpenChange(false);
        onSaved?.();
      } catch (error) {
        toast.error(error instanceof Error ? t(error.message) : t("Could not save ingredient."));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <StandardModalContent
        size="md"
        title={isEdit ? t("Edit ingredient") : t("New ingredient")}
        description={
          isEdit
            ? t("Update the category, unit, and unit cost.")
            : t("Add a reusable ingredient.")
        }
      >
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="ingredient_name">{t("Ingredient name")}</Label>
            <Input
              id="ingredient_name"
              value={form.name}
              placeholder={t("Milk, sugar, espresso…")}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t("Category")}</Label>
            <Select
              value={form.category_id}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, category_id: value ?? "" }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Choose ingredient category")}>
                  {(value) =>
                    categories.find((category) => category.id === value)?.name ?? null
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id} label={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("Unit")}</Label>
              <Select
                value={form.unit}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    unit: (value ?? "piece") as MeasurementUnit,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {(value) => (value ? formatUnit(value as MeasurementUnit) : null)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MEASUREMENT_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit} label={formatUnit(unit)}>
                      {formatUnit(unit)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ingredient_cost">{t("Unit cost")}</Label>
              <Input
                id="ingredient_cost"
                type="number"
                min={0}
                step="0.01"
                value={form.unit_cost}
                placeholder="0.00"
                onChange={(event) =>
                  setForm((current) => ({ ...current, unit_cost: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2 px-0 pb-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("Cancel")}
            </Button>
            <Button type="button" disabled={pending} onClick={handleSave}>
              {pending ? t("Saving…") : isEdit ? t("Save ingredient") : t("Add ingredient")}
            </Button>
          </DialogFooter>
        </div>
      </StandardModalContent>
    </Dialog>
  );
}
