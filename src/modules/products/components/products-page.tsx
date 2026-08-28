"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileSpreadsheet,
  LayoutGrid,
  List,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Tags,
} from "lucide-react";
import type { Product, ProductVariant } from "@/lib/types";
import {
  DEFAULT_BUSINESS_ACTIVITY_SETTINGS,
  DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY,
  type BusinessActivitySettings,
  type ProductTemplateSettings,
} from "@/lib/constants";
import {
  isFoodServiceActivity,
  usesCafeMenuCatalog,
} from "@/lib/business-activity-flags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OperationalCard } from "@/components/Velora/operational-card";
import { PageHeader } from "@/components/Velora/page-header";
import { ProductGrid, type ProductGridItem } from "./product-grid";
import { ProductTable } from "./product-table";
import { CategoryList } from "./category-list";
import { CafeMenuItemDialog } from "./cafe-menu-item-dialog";
import { CafeIngredientDialog } from "./cafe-ingredient-dialog";
import { ProductFormDialog } from "./product-form-dialog";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { ImportProductsDialog } from "@/modules/imports-exports/components/import-products-dialog";
import {
  bulkDisableMenuInventoryTrackingAction,
  bulkSetInventoryTrackingAction,
  deleteProductAction,
} from "../actions/product.actions";
import { toast } from "sonner";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { cn } from "@/lib/utils";
import { useConfirmationDialog } from "@/components/Velora/confirmation-dialog";
import { useTranslation } from "@/lib/i18n/use-translation";

type CatalogView = "menu" | "ingredients";
type LayoutView = "grid" | "table";

interface ProductsPageProps {
  initialProducts: (ProductGridItem & { hasRecipe?: boolean })[];
  categories: ProductGridItem["category"][];
  ingredients: Product[];
  currency: string;
  recipesEnabled?: boolean;
  businessActivity?: BusinessActivitySettings;
  productTemplates?: ProductTemplateSettings;
  availableStockByProductId?: Record<string, number>;
  availableStockByVariantId?: Record<string, number>;
}

export function ProductsPage({
  initialProducts,
  categories,
  ingredients,
  currency,
  recipesEnabled = false,
  businessActivity = DEFAULT_BUSINESS_ACTIVITY_SETTINGS,
  productTemplates = DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY.cafe,
  availableStockByProductId = {},
  availableStockByVariantId = {},
}: ProductsPageProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { requestConfirmation, confirmationDialog } = useConfirmationDialog();
  const useCafeCatalog = usesCafeMenuCatalog(businessActivity);
  const useMenuCopy = isFoodServiceActivity(businessActivity.activity_type);
  const showShelfColumns = !useMenuCopy;
  const showIngredientsCatalog = recipesEnabled;
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(() => {
    const requested = searchParams.get("category");
    return requested && categories.some((category) => category?.id === requested) ? requested : null;
  });
  const [view, setView] = useState<CatalogView>(() => showIngredientsCatalog && searchParams.get("catalog") === "ingredients" ? "ingredients" : "menu");
  const [layout, setLayout] = useState<LayoutView>(() => searchParams.get("view") === "grid" ? "grid" : "table");
  const [cafeDialogOpen, setCafeDialogOpen] = useState(false);
  const [retailDialogOpen, setRetailDialogOpen] = useState(false);
  const [ingredientDialogOpen, setIngredientDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editingVariants, setEditingVariants] = useState<ProductVariant[]>([]);
  const [editingIngredient, setEditingIngredient] = useState<Product | null>(null);
const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mobileVisibleCount, setMobileVisibleCount] = useState(12);
  const [pending, startTransition] = useTransition();

  function updateUrl(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => value && value !== "table" && value !== "menu" ? params.set(key, value) : params.delete(key));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/products?${query}` : "/products");
  }

  const categoryList = categories.filter((c): c is NonNullable<typeof c> => c !== null);

  const existingSkus = useMemo(
    () => initialProducts.map(({ product }) => product.sku),
    [initialProducts]
  );

  const menuItems = useMemo(
    () => initialProducts.filter(({ product }) => product.product_type !== "ingredient"),
    [initialProducts]
  );

  const ingredientItems = useMemo(
    () => initialProducts.filter(({ product }) => product.product_type === "ingredient"),
    [initialProducts]
  );

  const visibleSource =
    showIngredientsCatalog && view === "ingredients" ? ingredientItems : menuItems;

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const { product } of visibleSource) {
      map[product.category_id] = (map[product.category_id] ?? 0) + 1;
    }
    return map;
  }, [visibleSource]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleSource.filter(({ product }) => {
      if (categoryId && product.category_id !== categoryId) return false;
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q) ||
        product.barcode.includes(q)
      );
    });
  }, [visibleSource, categoryId, search]);

  const mobileItems = filtered.slice(0, mobileVisibleCount);

  useEffect(() => {
    setMobileVisibleCount(12);
  }, [search, categoryId, view]);

  const activeCount = menuItems.filter((p) => p.product.is_active).length;
  const popularCount = menuItems.filter((p) => p.product.is_popular).length;

  function openCreate() {
    setEditing(null);
    setEditingVariants([]);
    if (useCafeCatalog) {
      setCafeDialogOpen(true);
      return;
    }
    setRetailDialogOpen(true);
  }

  function openCreateIngredient() {
    setEditingIngredient(null);
    setIngredientDialogOpen(true);
  }

  function openEdit(item: ProductGridItem) {
    setEditing(item.product);
    setEditingVariants(item.variants ?? []);
    if (useCafeCatalog) {
      setCafeDialogOpen(true);
      return;
    }
    setRetailDialogOpen(true);
  }

  function openEditIngredient(item: ProductGridItem) {
    setEditingIngredient(item.product);
    setIngredientDialogOpen(true);
  }

  async function handleDelete(product: Product) {
    if (
      !(await requestConfirmation(`${t("Delete")} ${product.name}?`, {
        title: t("Delete product"),
        confirmLabel: t("Delete"),
        destructive: true,
      }))
    ) return;
    startTransition(async () => {
      const result = await deleteProductAction(product.id);
      if (result.ok) {
        toast.success(t("Product deleted."));
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleBulkDisableTracking() {
    if (
      !(await requestConfirmation(
        useMenuCopy
          ? t("All menu items will be activated with inventory tracking off. Ingredients are not affected. Continue?")
          : t("All sales products will be activated with inventory tracking off. Continue?")
      ))
    ) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkDisableMenuInventoryTrackingAction();
        toast.success(
          useMenuCopy
            ? `${t("Updated")} ${result.count} ${t("menu items")}`
            : `${t("Updated")} ${result.count} ${t("products")}`
        );
        setSelectedIds([]);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? t(error.message) : t("Could not update products."));
      }
    });
  }

  async function handleBulkTracking(trackInventory: boolean, scope: "selection" | "category") {
    if (scope === "category" && !categoryId) {
      toast.error(t("Choose a category first."));
      return;
    }
    if (scope === "selection" && selectedIds.length === 0) {
      toast.error(t("Select products from the table first."));
      return;
    }

    const categoryName =
      categoryList.find((category) => category.id === categoryId)?.name ?? t("Category");
    const confirmMessage =
      scope === "category"
        ? trackInventory
          ? `${t("Enable inventory tracking for all products in")} “${categoryName}”?`
          : `${t("Disable inventory tracking for all products in")} “${categoryName}”?`
        : trackInventory
          ? `${t("Enable inventory tracking for")} ${selectedIds.length} ${t("products")}?`
          : `${t("Disable inventory tracking for")} ${selectedIds.length} ${t("products")}?`;

    if (!(await requestConfirmation(confirmMessage))) return;

    startTransition(async () => {
      try {
        const result = await bulkSetInventoryTrackingAction(
          scope === "category"
            ? { trackInventory, categoryId }
            : { trackInventory, productIds: selectedIds }
        );
        toast.success(
          trackInventory
            ? `${t("Inventory tracking enabled for")} ${result.count} ${t("products")}`
            : `${t("Inventory tracking disabled for")} ${result.count} ${t("products")}`
        );
        setSelectedIds([]);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? t(error.message) : t("Could not update inventory tracking."));
      }
    });
  }

  const inventoryToolbar =
    layout === "table" && (selectedIds.length > 0 || Boolean(categoryId)) ? (
      <div className="flex flex-wrap items-center gap-2">
        {selectedIds.length > 0 ? (
          <>
            <span className="text-xs text-muted-foreground">{selectedIds.length} {t("selected")}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => handleBulkTracking(true, "selection")}
            >
              {t("Enable tracking")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => handleBulkTracking(false, "selection")}
            >
              {t("Disable tracking")}
            </Button>
          </>
        ) : null}
        {categoryId ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => handleBulkTracking(true, "category")}
            >
              {t("Enable category tracking")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => handleBulkTracking(false, "category")}
            >
              {t("Disable category tracking")}
            </Button>
          </>
        ) : null}
      </div>
    ) : null;

  const emptyAction =
    showIngredientsCatalog && view === "ingredients" ? (
      <Button type="button" onClick={openCreateIngredient}>
        <Plus className="size-4" />
        {t("New ingredient")}
      </Button>
    ) : (
      <Button type="button" onClick={openCreate}>
        <Plus className="size-4" />
        {useMenuCopy ? t("New menu item") : t("New product")}
      </Button>
    );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        breadcrumb={<span>{t("Inventory")} · {t("Products")}</span>}
        title="Products"
        description={
          useMenuCopy
            ? t("Manage menu items, prices, and categories for POS.")
            : t("Manage sales products, barcodes, purchase prices, and sale prices.")
        }
        action={
          <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
            <Button
              type="button"
              onClick={openCreate}
              className="min-w-0 flex-1 shadow-[var(--mds-elevation-1)] sm:flex-initial"
            >
              <Plus className="size-4" />
              {useMenuCopy ? t("New menu item") : t("New product")}
            </Button>
            <div className="hidden items-center gap-2 sm:flex">
              {showIngredientsCatalog ? (
                <Button type="button" variant="outline" onClick={openCreateIngredient}>
                  <Plus className="size-4" />
                  {t("New ingredient")}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(true)}>
                <Tags className="size-4" />
                {t("Categories")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
                <FileSpreadsheet className="size-4" />
                {t("Import / Export")}
              </Button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11 shrink-0 sm:size-9"
                    aria-label={t("More")}
                  />
                }
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                {showIngredientsCatalog ? (
                  <DropdownMenuItem onClick={openCreateIngredient} className="sm:hidden">
                    <Plus className="size-4" />
                    {t("New ingredient")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onClick={() => setCategoryDialogOpen(true)}
                  className="sm:hidden"
                >
                  <Tags className="size-4" />
                  {t("Categories")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportOpen(true)} className="sm:hidden">
                  <FileSpreadsheet className="size-4" />
                  {t("Import / Export")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={pending}
                  onClick={handleBulkDisableTracking}
                >
                  <Package className="size-4" />
                  {t("Reset product inventory tracking")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className={`grid grid-cols-2 gap-[var(--mds-space-3)] ${showIngredientsCatalog ? "lg:grid-cols-3" : ""}`}>
        <OperationalCard
          title={useMenuCopy ? t("Active menu items") : t("Active products")}
          value={String(activeCount)}
          subtitle={`${t("Out of")} ${menuItems.length} ${useMenuCopy ? t("menu item records") : t("product records")}`}
        />
        <OperationalCard
          title={t("Popular in POS")}
          value={String(popularCount)}
          subtitle={t("Shown first in POS")}
          accent="var(--mds-color-feedback-info)"
        />
        {showIngredientsCatalog ? (
          <OperationalCard
            className="col-span-2 lg:col-span-1"
            title={t("Ingredients")}
            value={String(ingredientItems.length)}
            subtitle={t("For recipes and inventory")}
            accent="var(--mds-color-feedback-success)"
          />
        ) : null}
      </div>

      <div className="grid gap-[var(--mds-space-4)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <CategoryList
          categories={categoryList}
          selectedId={categoryId}
          counts={counts}
          onSelect={(id) => {
            setCategoryId(id);
            setSelectedIds([]);
            updateUrl({ category: id });
          }}
        />

        <div className="flex min-w-0 flex-col gap-[var(--mds-space-4)]">
          <div className="flex flex-col gap-[var(--mds-space-3)] rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-3)] shadow-[var(--mds-elevation-1)] sm:flex-row sm:items-center sm:justify-between">
            {showIngredientsCatalog ? (
              <div
                className="inline-flex rounded-[var(--mds-radius-md)] bg-muted/60 p-1"
                role="tablist"
                aria-label={t("Catalog type")}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "menu"}
                  className={cn(
                    "rounded-[var(--mds-radius-sm)] px-3 py-1.5 text-sm transition-colors",
                    view === "menu"
                      ? "bg-card font-semibold text-foreground shadow-[var(--mds-elevation-1)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => {
                    setView("menu");
                    setCategoryId(null);
                    setSelectedIds([]);
                    updateUrl({ catalog: "menu", category: null });
                  }}
                >
                  {t("Menu items")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "ingredients"}
                  className={cn(
                    "rounded-[var(--mds-radius-sm)] px-3 py-1.5 text-sm transition-colors",
                    view === "ingredients"
                      ? "bg-card font-semibold text-foreground shadow-[var(--mds-elevation-1)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => {
                    setView("ingredients");
                    setCategoryId(null);
                    setSelectedIds([]);
                    updateUrl({ catalog: "ingredients", category: null });
                  }}
                >
                  {t("Ingredients")}
                </button>
              </div>
            ) : (
              <p className="text-sm font-medium text-foreground">
                {useMenuCopy ? t("Menu items") : t("Sales products")}
              </p>
            )}

            <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-lg sm:justify-end">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 border-border/70 bg-background pe-3 ps-9"
                  placeholder={
                    showIngredientsCatalog && view === "ingredients"
                      ? t("Search ingredients by name or code…")
                      : t("Search by name, code, or barcode…")
                  }
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); updateUrl({ q: e.target.value }); }}
                  aria-label={t("Search products")}
                />
              </div>
              <div
                className="hidden shrink-0 rounded-[var(--mds-radius-md)] bg-muted/60 p-1 lg:inline-flex"
                role="group"
                aria-label={t("View layout")}
              >
                <button
                  type="button"
                  className={cn(
                    "rounded-[var(--mds-radius-sm)] p-2 transition-colors",
                    layout === "table"
                      ? "bg-card text-foreground shadow-[var(--mds-elevation-1)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={layout === "table"}
                  aria-label={t("Table view")}
                  onClick={() => { setLayout("table"); updateUrl({ view: "table" }); }}
                >
                  <List className="size-4" />
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-[var(--mds-radius-sm)] p-2 transition-colors",
                    layout === "grid"
                      ? "bg-card text-foreground shadow-[var(--mds-elevation-1)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={layout === "grid"}
                  aria-label={t("Card view")}
                  onClick={() => { setLayout("grid"); updateUrl({ view: "grid" }); }}
                >
                  <LayoutGrid className="size-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {t("Showing")} {filtered.length} {t("of")} {visibleSource.length}
              {categoryId ? ` · ${t("Category selected")}` : ""}
              <span className="hidden lg:inline">
                {layout === "table"
                  ? ` · ${t("Edit price, status, and inventory tracking from the table")}`
                  : ""}
              </span>
            </span>
            {pending ? <span>{t("Updating…")}</span> : null}
          </div>

          {/* Mobile: always cards. Desktop: honor layout toggle. */}
          <div className="lg:hidden">
            <ProductGrid
              items={mobileItems}
              currency={currency}
              priceMode={
                showIngredientsCatalog && view === "ingredients" ? "cost" : "sale"
              }
              availableStockByProductId={availableStockByProductId}
              availableStockByVariantId={availableStockByVariantId}
              onEdit={
                showIngredientsCatalog && view === "ingredients"
                  ? openEditIngredient
                  : openEdit
              }
              onDelete={handleDelete}
              emptyAction={emptyAction}
            />
            {mobileVisibleCount < filtered.length ? (
              <div className="mt-4 flex flex-col items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={() => setMobileVisibleCount((count) => count + 12)}
                >
                  {t("Show more")}
                </Button>
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {t("Now showing")} {Math.min(mobileVisibleCount, filtered.length)} {t("of")} {filtered.length}
                </p>
              </div>
            ) : null}
          </div>
          <div className="hidden lg:block">
            {layout === "table" ? (
              <ProductTable
                items={filtered}
                currency={currency}
                supermarketColumns={showShelfColumns}
                priceMode={
                  showIngredientsCatalog && view === "ingredients" ? "cost" : "sale"
                }
                availableStockByProductId={availableStockByProductId}
                availableStockByVariantId={availableStockByVariantId}
                selectedIds={selectedIds}
                onSelectedIdsChange={setSelectedIds}
                toolbar={inventoryToolbar}
                onEdit={
                  showIngredientsCatalog && view === "ingredients"
                    ? openEditIngredient
                    : openEdit
                }
                onDelete={handleDelete}
                emptyAction={emptyAction}
              />
            ) : (
              <ProductGrid
                items={filtered}
                currency={currency}
                priceMode={
                  showIngredientsCatalog && view === "ingredients" ? "cost" : "sale"
                }
                availableStockByProductId={availableStockByProductId}
                availableStockByVariantId={availableStockByVariantId}
                onEdit={
                  showIngredientsCatalog && view === "ingredients"
                    ? openEditIngredient
                    : openEdit
                }
                onDelete={handleDelete}
                emptyAction={emptyAction}
              />
            )}
          </div>
        </div>
      </div>

      {useCafeCatalog ? (
        <CafeMenuItemDialog
          open={cafeDialogOpen}
          onOpenChange={setCafeDialogOpen}
          categories={categoryList}
          ingredients={ingredients}
          product={editing}
          initialVariants={editingVariants}
          recipesEnabled={recipesEnabled}
          currency={currency}
          existingSkus={existingSkus}
          onSaved={() => router.refresh()}
        />
      ) : (
        <ProductFormDialog
          open={retailDialogOpen}
          onOpenChange={setRetailDialogOpen}
          categories={categoryList}
          product={editing}
          recipesEnabled={recipesEnabled}
          productTemplates={productTemplates}
          businessActivitySettings={businessActivity}
          currency={currency}
          existingSkus={existingSkus}
          onSaved={() => router.refresh()}
        />
      )}

      {showIngredientsCatalog ? (
        <CafeIngredientDialog
          key={editingIngredient?.id ?? "new-ingredient"}
          open={ingredientDialogOpen}
          onOpenChange={(nextOpen) => {
            setIngredientDialogOpen(nextOpen);
            if (!nextOpen) setEditingIngredient(null);
          }}
          categories={categoryList}
          ingredient={editingIngredient}
          onSaved={() => router.refresh()}
        />
      ) : null}

      <CategoryManagerDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        categories={categoryList}
        counts={counts}
        onSaved={() => router.refresh()}
      />

      <ImportProductsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => router.refresh()}
        activityType={businessActivity.activity_type}
      />
      {confirmationDialog}
    </div>
  );
}
