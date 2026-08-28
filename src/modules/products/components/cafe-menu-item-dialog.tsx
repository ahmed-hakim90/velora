"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  Category,
  MeasurementUnit,
  Product,
  ProductVariant,
} from "@/lib/types";
import { MEASUREMENT_UNITS } from "@/lib/constants";
import { selectLabelById } from "@/lib/select-label";
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
import { CompactAction } from "@/components/Velora/compact-actions";
import { FormField } from "@/components/Velora/form-field";
import { nextSequentialProductSku } from "@/modules/products/lib/generate-product-sku";
import {
  createCafeIngredientAction,
  saveCafeMenuItemAction,
  uploadProductImageAction,
  type CafeMenuItemInput,
} from "@/modules/products/actions/product.actions";
import { VariantEditor } from "@/modules/products/components/variant-editor";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/use-translation";

type RecipeLineDraft = CafeMenuItemInput["ingredients"][number];
type NewVariantDraft = Omit<
  NonNullable<CafeMenuItemInput["variants"]>[number],
  "price"
> & {
  key: string;
  price: string | number;
};

type CafeMenuItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  ingredients: Product[];
  product?: Product | null;
  initialVariants?: ProductVariant[];
  currency: string;
  recipesEnabled: boolean;
  existingSkus: string[];
  onSaved?: () => void;
};

const emptyLine = (): RecipeLineDraft => ({
  ingredient_product_id: "",
  quantity: 1,
  unit: "piece",
});

const emptyVariant = (index = 1, firstName = "Small"): NewVariantDraft => ({
  key: crypto.randomUUID(),
  name: index === 1 ? firstName : "",
  sku: "",
  barcode: "",
  price: "",
  ingredients: [emptyLine()],
});

export function CafeMenuItemDialog({
  open,
  onOpenChange,
  ...contentProps
}: CafeMenuItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <CafeMenuItemDialogContent
          key={contentProps.product?.id ?? "new"}
          onOpenChange={onOpenChange}
          {...contentProps}
        />
      ) : null}
    </Dialog>
  );
}

function CafeMenuItemDialogContent({
  onOpenChange,
  categories,
  ingredients,
  product,
  initialVariants = [],
  currency,
  recipesEnabled,
  existingSkus,
  onSaved,
}: Omit<CafeMenuItemDialogProps, "open">) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [ingredientPending, startIngredientTransition] = useTransition();
  const isEdit = Boolean(product);
  const initialSku = product?.sku ?? nextSequentialProductSku(existingSkus);
  const [draft, setDraft] = useState(() => ({
    name: product?.name ?? "",
    category_id: product?.category_id ?? categories[0]?.id ?? "",
    sku: initialSku,
    barcode: product?.barcode ?? initialSku,
    image_url: product?.image_url ?? null,
  }));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [availableIngredients, setAvailableIngredients] = useState(ingredients);
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    category_id: "",
    unit: "piece" as MeasurementUnit,
    unit_cost: "",
  });
  const [variantDrafts, setVariantDrafts] = useState<NewVariantDraft[]>([
    emptyVariant(1, t("Small")),
  ]);
  const [expandedVariantKey, setExpandedVariantKey] = useState<string | null>(
    null,
  );

  const ingredientMap = useMemo(
    () =>
      new Map(
        availableIngredients.map((ingredient) => [ingredient.id, ingredient]),
      ),
    [availableIngredients],
  );

  function updateVariant(index: number, patch: Partial<NewVariantDraft>) {
    setVariantDrafts((current) =>
      current.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant,
      ),
    );
  }

  function updateVariantLine(
    variantIndex: number,
    lineIndex: number,
    patch: Partial<RecipeLineDraft>,
  ) {
    setVariantDrafts((current) =>
      current.map((variant, currentVariantIndex) =>
        currentVariantIndex === variantIndex
          ? {
              ...variant,
              ingredients: variant.ingredients.map((line, currentLineIndex) =>
                currentLineIndex === lineIndex ? { ...line, ...patch } : line,
              ),
            }
          : variant,
      ),
    );
  }

  function handleVariantIngredientChange(
    variantIndex: number,
    lineIndex: number,
    ingredientId: string,
  ) {
    const ingredient = ingredientMap.get(ingredientId);
    updateVariantLine(variantIndex, lineIndex, {
      ingredient_product_id: ingredientId,
      unit: ingredient?.unit ?? "piece",
    });
  }

  function addVariantLine(variantIndex: number) {
    setVariantDrafts((current) =>
      current.map((variant, currentVariantIndex) =>
        currentVariantIndex === variantIndex
          ? { ...variant, ingredients: [...variant.ingredients, emptyLine()] }
          : variant,
      ),
    );
  }

  function removeVariantLine(variantIndex: number, lineIndex: number) {
    setVariantDrafts((current) =>
      current.map((variant, currentVariantIndex) =>
        currentVariantIndex === variantIndex
          ? {
              ...variant,
              ingredients:
                variant.ingredients.length > 1
                  ? variant.ingredients.filter(
                      (_, currentLineIndex) => currentLineIndex !== lineIndex,
                    )
                  : variant.ingredients,
            }
          : variant,
      ),
    );
  }

  function handleSave() {
    if (!draft.name.trim() || !draft.category_id) {
      toast.error(t("Name and category are required"));
      return;
    }
    const validVariants = isEdit
      ? []
      : variantDrafts
          .map((variant) => ({
            name: variant.name.trim(),
            sku: variant.sku?.trim() ?? "",
            barcode: variant.barcode?.trim() ?? "",
            price: Number(variant.price) || 0,
            ingredients: variant.ingredients.filter(
              (line) => line.ingredient_product_id && line.quantity > 0,
            ),
          }))
          .filter((variant) => variant.name && variant.price > 0);

    if (!isEdit && validVariants.length === 0) {
      toast.error(t("Add at least one size with a price"));
      return;
    }
    const hasRecipeLines = validVariants.some(
      (variant) => variant.ingredients.length > 0,
    );
    if (!recipesEnabled && hasRecipeLines) {
      toast.error(t("Recipes are disabled"));
      return;
    }

    startTransition(async () => {
      try {
        await saveCafeMenuItemAction({
          productId: product?.id,
          name: draft.name,
          category_id: draft.category_id,
          sku: draft.sku,
          barcode: draft.barcode,
          image_url: draft.image_url,
          ingredients: [],
          variants: validVariants,
        }).then(async (savedProduct) => {
          if (!imageFile) return;
          const formData = new FormData();
          formData.append("image", imageFile);
          await uploadProductImageAction(savedProduct.id, formData);
        });
        toast.success(isEdit ? t("Menu item updated") : t("Menu item created"));
        onOpenChange(false);
        onSaved?.();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("Could not save menu item"),
        );
      }
    });
  }

  function handleCreateIngredient() {
    const name = newIngredient.name.trim();
    if (!name) {
      toast.error(t("Ingredient name is required"));
      return;
    }
    if (!newIngredient.category_id) {
      toast.error(t("Select an ingredient category first"));
      return;
    }

    startIngredientTransition(async () => {
      try {
        const ingredient = await createCafeIngredientAction({
          name,
          category_id: newIngredient.category_id,
          unit: newIngredient.unit,
          unit_cost: Number(newIngredient.unit_cost) || 0,
        });
        setAvailableIngredients((current) => [...current, ingredient]);
        setVariantDrafts((current) => {
          const targetVariantIndex = current.findIndex((variant) =>
            variant.ingredients.some((line) => !line.ingredient_product_id),
          );
          const variantIndex =
            targetVariantIndex === -1 ? 0 : targetVariantIndex;
          return current.map((variant, currentVariantIndex) => {
            if (currentVariantIndex !== variantIndex) return variant;
            const firstEmpty = variant.ingredients.findIndex(
              (line) => !line.ingredient_product_id,
            );
            if (firstEmpty === -1) {
              return {
                ...variant,
                ingredients: [
                  ...variant.ingredients,
                  {
                    ingredient_product_id: ingredient.id,
                    quantity: 1,
                    unit: ingredient.unit,
                  },
                ],
              };
            }
            return {
              ...variant,
              ingredients: variant.ingredients.map((line, lineIndex) =>
                lineIndex === firstEmpty
                  ? {
                      ...line,
                      ingredient_product_id: ingredient.id,
                      unit: ingredient.unit,
                    }
                  : line,
              ),
            };
          });
        });
        setNewIngredient({
          name: "",
          category_id: "",
          unit: "piece",
          unit_cost: "",
        });
        toast.success(t("Ingredient added"));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("Could not add ingredient"),
        );
      }
    });
  }

  return (
    <StandardModalContent
      size="xl"
      title={isEdit ? t("Edit menu item") : t("New menu item")}
      description={
        isEdit
          ? t("Update details, sizes, prices, and optional recipes.")
          : t(
              "Create the item, then add sizes and prices. Ingredients are optional.",
            )
      }
    >
      <div className="grid gap-5">
        {!recipesEnabled ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {t(
              "Recipes are disabled. Enable them before saving menu item ingredients.",
            )}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="menu_item_name" label={t("Item name")}>
                <Input
                  id="menu_item_name"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder={t("Cappuccino")}
                />
              </FormField>
              <FormField id="menu_item_category" label={t("Category")}>
                <Select
                  value={draft.category_id}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      category_id: value ?? "",
                    }))
                  }
                >
                  <SelectTrigger id="menu_item_category">
                    <SelectValue placeholder={t("Select category")}>
                      {(value) =>
                        selectLabelById(
                          categories,
                          value,
                          (category) => category.name,
                        )
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem
                        key={category.id}
                        value={category.id}
                        label={category.name}
                      >
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField
              id="menu_item_image"
              label={t("Item image")}
              hint={t("Upload an image or keep the current link.")}
            >
              <div className="grid gap-2">
                <Input
                  id="menu_item_image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) =>
                    setImageFile(event.target.files?.[0] ?? null)
                  }
                />
                {draft.image_url ? (
                  <Input
                    value={draft.image_url}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        image_url: event.target.value || null,
                      }))
                    }
                    placeholder={t("Current image link")}
                  />
                ) : null}
              </div>
            </FormField>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-sm">
                <p className="font-medium">{t("Pricing by size")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(
                    "The displayed price comes from size prices; no general product price is needed.",
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-sm">
                <p className="font-medium">{t("Automatic setup")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(
                    "SKU, barcode, POS visibility, and inventory deduction are configured automatically.",
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm">
            <p className="font-medium">{t("Set up sizes")}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t(
                "Each size has its own price. Add optional ingredients now or later.",
              )}
            </p>
          </div>
        </div>

        {!isEdit ? (
          <div className="space-y-3">
            <div className="flex flex-row items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">
                  {t("Sizes, prices, and ingredients")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("Each size has its own price. Ingredients are optional.")}
                </p>
              </div>
              <CompactAction
                label={t("Add size")}
                icon={Plus}
                onClick={() =>
                  setVariantDrafts((current) => [
                    ...current,
                    emptyVariant(current.length + 1, t("Small")),
                  ])
                }
              />
            </div>

            <div className="grid gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 sm:grid-cols-2 xl:grid-cols-[1fr_minmax(0,11rem)_minmax(0,8rem)_minmax(0,7.5rem)_auto]">
              <div className="grid gap-1">
                <Label className="text-xs">{t("New ingredient")}</Label>
                <Input
                  value={newIngredient.name}
                  placeholder={t("Milk, sugar, espresso...")}
                  onChange={(event) =>
                    setNewIngredient((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">{t("Category")}</Label>
                <Select
                  value={newIngredient.category_id}
                  onValueChange={(value) =>
                    setNewIngredient((current) => ({
                      ...current,
                      category_id: value ?? "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select category")}>
                      {(value) =>
                        selectLabelById(
                          categories,
                          value,
                          (category) => category.name,
                        )
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem
                        key={category.id}
                        value={category.id}
                        label={category.name}
                      >
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">{t("Unit")}</Label>
                <Select
                  value={newIngredient.unit}
                  onValueChange={(value) =>
                    setNewIngredient((current) => ({
                      ...current,
                      unit: (value ?? "piece") as MeasurementUnit,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value) =>
                        value ? formatUnit(value as MeasurementUnit) : null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {MEASUREMENT_UNITS.map((unit) => (
                      <SelectItem
                        key={unit}
                        value={unit}
                        label={formatUnit(unit)}
                      >
                        {formatUnit(unit)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">{t("Unit cost")}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newIngredient.unit_cost}
                  placeholder="0.00"
                  onChange={(event) =>
                    setNewIngredient((current) => ({
                      ...current,
                      unit_cost: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={ingredientPending || !newIngredient.name.trim()}
                  onClick={handleCreateIngredient}
                >
                  <Plus className="size-4" />
                  {t("Add")}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {variantDrafts.map((variant, variantIndex) => (
                <div
                  key={variant.key}
                  className="space-y-3 rounded-xl border border-border/70 p-3"
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_minmax(0,9rem)_auto]">
                    <div className="grid gap-1">
                      <Label className="text-xs">{t("Size")}</Label>
                      <Input
                        value={variant.name}
                        placeholder={t("Small, medium, large")}
                        onChange={(event) =>
                          updateVariant(variantIndex, {
                            name: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">{t("Price")}</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={variant.price}
                        onChange={(event) =>
                          updateVariant(variantIndex, {
                            price: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("Delete size")}
                        disabled={variantDrafts.length <= 1}
                        onClick={() =>
                          setVariantDrafts((current) =>
                            current.length > 1
                              ? current.filter(
                                  (_, currentIndex) =>
                                    currentIndex !== variantIndex,
                                )
                              : current,
                          )
                        }
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {variant.ingredients.filter(
                          (line) => line.ingredient_product_id,
                        ).length > 0
                          ? `${variant.ingredients.filter((line) => line.ingredient_product_id).length} ${t("ingredients")}`
                          : t("Optional ingredients")}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setExpandedVariantKey((current) =>
                            current === variant.key ? null : variant.key,
                          )
                        }
                      >
                        <Plus className="size-4" />
                        {expandedVariantKey === variant.key
                          ? t("Hide ingredients")
                          : t("Open ingredients")}
                      </Button>
                    </div>
                    {expandedVariantKey === variant.key ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => addVariantLine(variantIndex)}
                      >
                        <Plus className="size-4" />
                        {t("Add ingredient")}
                      </Button>
                    ) : null}
                    {expandedVariantKey === variant.key
                      ? variant.ingredients.map((line, lineIndex) => (
                          <div
                            key={`${variant.key}-${lineIndex}`}
                            className="grid gap-2 rounded-xl border border-border/70 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_minmax(0,7.5rem)_minmax(0,9rem)_auto]"
                          >
                            <div className="grid gap-1">
                              <Label className="text-xs">
                                {t("Ingredient")}
                              </Label>
                              <Select
                                value={line.ingredient_product_id}
                                onValueChange={(value) =>
                                  handleVariantIngredientChange(
                                    variantIndex,
                                    lineIndex,
                                    value ?? "",
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t("Select ingredient")}
                                  >
                                    {(value) =>
                                      selectLabelById(
                                        availableIngredients,
                                        value,
                                        (ingredient) => ingredient.name,
                                      )
                                    }
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {availableIngredients.map((ingredient) => (
                                    <SelectItem
                                      key={ingredient.id}
                                      value={ingredient.id}
                                      label={ingredient.name}
                                    >
                                      {ingredient.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-1">
                              <Label className="text-xs">{t("Quantity")}</Label>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={line.quantity}
                                onChange={(event) =>
                                  updateVariantLine(variantIndex, lineIndex, {
                                    quantity: Number(event.target.value),
                                  })
                                }
                              />
                            </div>
                            <div className="grid gap-1">
                              <Label className="text-xs">{t("Unit")}</Label>
                              <Select
                                value={line.unit}
                                onValueChange={(value) =>
                                  updateVariantLine(variantIndex, lineIndex, {
                                    unit: (value ?? "piece") as MeasurementUnit,
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue>
                                    {(value) =>
                                      value
                                        ? formatUnit(value as MeasurementUnit)
                                        : null
                                    }
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {MEASUREMENT_UNITS.map((unit) => (
                                    <SelectItem
                                      key={unit}
                                      value={unit}
                                      label={formatUnit(unit)}
                                    >
                                      {formatUnit(unit)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={t("Delete ingredient")}
                                disabled={variant.ingredients.length <= 1}
                                onClick={() =>
                                  removeVariantLine(variantIndex, lineIndex)
                                }
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </Button>
                            </div>
                          </div>
                        ))
                      : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {isEdit && product ? (
          <div className="space-y-3 rounded-xl border border-border/70 p-4">
            <div>
              <h3 className="text-sm font-medium">{t("Sizes and prices")}</h3>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Add product sizes such as small, medium, and large, with a price and barcode for each.",
                )}
              </p>
            </div>
            <VariantEditor
              product={product}
              initialVariants={initialVariants}
              currency={currency}
              recipesEnabled={recipesEnabled}
            />
          </div>
        ) : null}

        <DialogFooter className="gap-2 px-0 pb-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("Cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={pending}>
            {pending
              ? t("Saving...")
              : isEdit
                ? t("Save item")
                : t("Create item")}
          </Button>
        </DialogFooter>
      </div>
    </StandardModalContent>
  );
}
