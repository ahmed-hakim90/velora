"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  Barcode,
  Check,
  ClipboardCheck,
  ClipboardList,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { DataTableShell } from "@/components/Velora/data-table-shell";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { ResponsiveListLayout } from "@/components/Velora/responsive-list-layout";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { OperationalCard } from "@/components/Velora/operational-card";
import { StatusPill } from "@/components/Velora/status-pill";
import { formatUnit } from "@/lib/units";
import { selectLabelById } from "@/lib/select-label";
import { cn } from "@/lib/utils";
import type { Category, Product } from "@/lib/types";
import type { StockCountWithLines } from "@/modules/stock-count/services/count.service";
import {
  approveCountAction,
  postCountAction,
  rejectCountApprovalAction,
  submitCountForApprovalAction,
  submitCountLinesAction,
} from "@/modules/stock-count/actions/count.actions";
import {
  findProductByCode,
  productMatchesQuery,
} from "@/modules/products/lib/match-products";
import { clampCountedQty, nextCountedQty } from "@/modules/stock-count/lib/counted-qty";
import { playPosErrorSound, playPosScanSound, unlockPosAudio } from "@/modules/pos/lib/pos-sounds";
import { useTranslation } from "@/lib/i18n/use-translation";

interface StockCountWizardProps {
  count: StockCountWithLines;
  products: Product[];
  categories: Category[];
  canApprove: boolean;
  trackedProductCount?: number;
  barcodeScannerEnabled?: boolean;
  onComplete: () => void;
}

function varianceList(
  count: StockCountWithLines,
  counts: Record<string, number>,
  productMap: Map<string, Product>
) {
  return count.lines.map((line) => ({
    ...line,
    counted: counts[line.product_id] ?? line.counted_qty,
    variance: (counts[line.product_id] ?? line.counted_qty) - line.expected_qty,
    name: productMap.get(line.product_id)?.name,
  }));
}

export function StockCountWizard({
  count,
  products,
  categories,
  canApprove,
  trackedProductCount = 0,
  barcodeScannerEnabled = true,
  onComplete,
}: StockCountWizardProps) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const initialStep =
    count.status === "pending_approval" || count.status === "approved"
      ? "review"
      : "count";
  const [step, setStep] = useState<"count" | "review">(initialStep);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [scanCode, setScanCode] = useState("");
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(count.lines.map((l) => [l.product_id, l.counted_qty]))
  );
  const scanRef = useRef<HTMLInputElement>(null);
  const countsRef = useRef(counts);
  const savedRef = useRef(counts);
  const skipSaveRef = useRef(true);

  useEffect(() => {
    countsRef.current = counts;
  }, [counts]);

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );
  const lineProductIds = useMemo(
    () => new Set(count.lines.map((l) => l.product_id)),
    [count.lines]
  );

  const filteredLines = count.lines.filter((line) => {
    const product = productMap.get(line.product_id);
    if (categoryId !== "all" && product?.category_id !== categoryId) return false;
    if (!product) return search.trim() === "";
    return productMatchesQuery(product, search);
  });

  const variances = varianceList(count, counts, productMap);
  const varianceCount = variances.filter((v) => v.variance !== 0).length;
  const scannedUnits = count.lines.reduce(
    (sum, line) => sum + (counts[line.product_id] ?? line.counted_qty),
    0
  );
  const touchedCount = count.lines.filter((line) => {
    const counted = counts[line.product_id] ?? line.counted_qty;
    return counted !== line.expected_qty;
  }).length;
  const linesLocked =
    count.status === "pending_approval" || count.status === "approved";

  const persistLines = useCallback(
    async (nextCounts: Record<string, number>) => {
      const lines = count.lines
        .map((l) => ({
          productId: l.product_id,
          countedQty: clampCountedQty(nextCounts[l.product_id] ?? l.counted_qty),
        }))
        .filter((line) => line.countedQty !== (savedRef.current[line.productId] ?? 0));
      if (lines.length === 0) {
        setSaveState("saved");
        return;
      }
      setSaveState("saving");
      try {
        await submitCountLinesAction(count.id, lines);
        savedRef.current = { ...nextCounts };
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
        throw e;
      }
    },
    [count.id, count.lines]
  );

  useEffect(() => {
    unlockPosAudio();
  }, []);

  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (linesLocked) return;
    const timer = window.setTimeout(() => {
      void persistLines(countsRef.current).catch(() => {
        toast.error(t("Could not save the count automatically"));
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [counts, linesLocked, persistLines, t]);

  const setCountedQty = useCallback((productId: string, qty: number) => {
    setCounts((prev) => ({
      ...prev,
      [productId]: clampCountedQty(qty),
    }));
  }, []);

  const applyScan = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      const product = findProductByCode(products, code);
      if (!product) {
        playPosErrorSound();
        toast.error(t("Unknown barcode"));
        return;
      }
      if (!lineProductIds.has(product.id)) {
        playPosErrorSound();
        toast.error(
          product.track_inventory
            ? t("This product is not in this count")
            : t("This product does not track inventory. Enable tracking from Products.")
        );
        return;
      }
      setCounts((prev) => ({
        ...prev,
        [product.id]: nextCountedQty(prev[product.id] ?? 0, 1),
      }));
      const nextQty = nextCountedQty(countsRef.current[product.id] ?? 0, 1);
      playPosScanSound();
      toast.success(`${product.name} → ${nextQty}`);
      setLastScannedId(product.id);
      setScanCode("");
      window.requestAnimationFrame(() => {
        document
          .querySelector(`[data-count-product="${product.id}"]`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        scanRef.current?.focus();
      });
    },
    [lineProductIds, products, t]
  );

  useEffect(() => {
    if (!barcodeScannerEnabled || linesLocked || step !== "count") return;
    let buffer = "";
    let lastAt = 0;
    const gapMs = 45;
    const minLen = 4;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target === scanRef.current) return;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || Boolean(target?.isContentEditable)) {
        return;
      }
      const now = Date.now();
      const isBurst = now - lastAt <= gapMs;
      lastAt = now;
      if (!isBurst) buffer = "";

      if (event.key === "Enter") {
        if (buffer.length >= minLen) {
          event.preventDefault();
          applyScan(buffer);
          buffer = "";
        }
        return;
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        buffer += event.key;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyScan, barcodeScannerEnabled, linesLocked, step]);

  const saveCounts = (thenReview: boolean) => {
    startTransition(async () => {
      try {
        await persistLines(countsRef.current);
        if (thenReview) setStep("review");
        toast.success(t("Count saved"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("Could not save"));
      }
    });
  };

  const sendForApproval = () => {
    startTransition(async () => {
      try {
        await persistLines(countsRef.current);
        await submitCountForApprovalAction(count.id);
        toast.success(t("Stock count sent for approval"));
        onComplete();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("Could not send for approval"));
      }
    });
  };

  const approveCount = () => {
    startTransition(async () => {
      try {
        await approveCountAction(count.id);
        toast.success(t("Stock count approved"));
        onComplete();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("Could not approve"));
      }
    });
  };

  const rejectApproval = () => {
    startTransition(async () => {
      try {
        await rejectCountApprovalAction(count.id);
        toast.success(t("Stock count returned for counting"));
        onComplete();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("Could not return the count"));
      }
    });
  };

  const postAdjustments = () => {
    startTransition(async () => {
      try {
        await postCountAction(count.id);
        toast.success(t("Differences posted"));
        onComplete();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("Could not post differences"));
      }
    });
  };

  const openPrint = () => {
    startTransition(async () => {
      try {
        if (!linesLocked) await persistLines(countsRef.current);
        window.open(
          `/print/stock-count/${count.id}`,
          "_blank",
          "noopener,noreferrer"
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("Save the count before printing"));
      }
    });
  };

  if (step === "review" || linesLocked) {
    return (
      <OperationalCard
        title={t("Review differences")}
        description={
          count.status === "pending_approval"
            ? t("Waiting for manager approval before posting")
            : count.status === "approved"
              ? t("Approved and ready to post differences")
              : t("Confirm the count and send it for approval before posting")
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusPill
            label={`${varianceCount} ${t("differences")}`}
            variant={varianceCount > 0 ? "warning" : "success"}
          />
          {count.status === "pending_approval" && (
            <StatusPill label={t("Pending approval")} variant="warning" />
          )}
          {count.status === "approved" && (
            <StatusPill label={t("Approved")} variant="success" />
          )}
        </div>
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {variances
            .filter((v) => v.variance !== 0)
            .map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-2"
              >
                <span>{v.name}</span>
                <span
                  className={
                    v.variance > 0 ? "text-emerald-600" : "text-red-600"
                  }
                >
                  {v.variance > 0 ? "+" : ""}
                  {v.variance}
                </span>
              </li>
            ))}
          {varianceCount === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              {t("All quantities match the expected stock")}
            </p>
          )}
        </ul>
        <div className="mt-6">
          <CompactActions className="justify-start">
          <CompactAction
            label={t("Print")}
            icon={Printer}
            disabled={pending}
            onClick={openPrint}
          />
          {count.status === "in_progress" ? (
            <>
              <CompactAction
                label={t("Back")}
                icon={ArrowLeft}
                disabled={pending}
                onClick={() => setStep("count")}
              />
              <CompactAction
                label={t("Send for approval")}
                icon={Send}
                variant="default"
                disabled={pending}
                onClick={sendForApproval}
              />
            </>
          ) : null}
          {count.status === "pending_approval" && canApprove ? (
            <>
              <CompactAction
                label={t("Return for counting")}
                icon={RotateCcw}
                disabled={pending}
                onClick={rejectApproval}
              />
              <CompactAction
                label={t("Approve stock count")}
                icon={ClipboardCheck}
                variant="default"
                disabled={pending}
                onClick={approveCount}
              />
            </>
          ) : null}
          {count.status === "pending_approval" && !canApprove ? (
            <p className="text-sm text-muted-foreground">
              {t("Waiting for owner or manager approval before posting differences.")}
            </p>
          ) : null}
          {count.status === "approved" ? (
            <>
              {canApprove ? (
                <CompactAction
                  label={t("Return for counting")}
                  icon={RotateCcw}
                  disabled={pending}
                  onClick={rejectApproval}
                />
              ) : null}
              <CompactAction
                label={t("Post differences")}
                icon={Check}
                variant="default"
                disabled={pending}
                onClick={postAdjustments}
              />
            </>
          ) : null}
          </CompactActions>
        </div>
      </OperationalCard>
    );
  }

  const zeroAllVisible = () => {
    setCounts((prev) => {
      const next = { ...prev };
      for (const line of filteredLines) {
        next[line.product_id] = 0;
      }
      return next;
    });
    scanRef.current?.focus();
  };

  const lastScanned = lastScannedId ? productMap.get(lastScannedId) : null;
  const saveLabel =
    saveState === "saving"
      ? t("Saving…")
      : saveState === "saved"
        ? t("Saved")
        : saveState === "error"
          ? t("Save failed")
          : `${touchedCount} ${t("differences")} · ${scannedUnits} ${t("units")}`;

  return (
    <div className="space-y-4 pb-16 lg:pb-12">
      {barcodeScannerEnabled ? (
        <OperationalCard
          title={t("Count with scanner")}
          description={t("Scan a barcode to add one. Reset first when counting from zero.")}
        >
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              applyScan(scanCode);
            }}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="stock-count-scan">{t("Product barcode")}</Label>
              <Input
                ref={scanRef}
                id="stock-count-scan"
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                autoComplete="off"
                autoFocus
                placeholder={t("Scan here to count automatically")}
                aria-label={t("Scan stock count barcode")}
                className="h-12 font-mono text-base"
              />
            </div>
            <Button type="submit" className="h-12 shrink-0 sm:w-auto">
              <Barcode className="size-4" />
              {t("Count +1")}
            </Button>
          </form>
          {lastScanned ? (
            <p className="mt-3 text-sm">
              {t("Last scan")}:{" "}
              <span className="font-medium">{lastScanned.name}</span>
              <span className="ms-2 tabular-nums text-muted-foreground">
                → {counts[lastScanned.id] ?? 0}
              </span>
            </p>
          ) : null}
        </OperationalCard>
      ) : null}

      <DataTableShell
        title={`${t("Count products")} · ${count.lines.length} ${t("items")}`}
        search={search}
        searchPlaceholder={t("Search by name, barcode, or SKU…")}
        onSearchChange={setSearch}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={categoryId} onValueChange={(value) => setCategoryId(value ?? "all")}>
              <SelectTrigger className="h-11 w-[min(100%,12rem)] sm:h-9" aria-label={t("Product category")}>
                <SelectValue placeholder={t("All categories")}>
                  {(value) =>
                    value === "all"
                      ? t("All categories")
                      : selectLabelById(categories, value, (c) => c.name)
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={zeroAllVisible}
              disabled={pending || filteredLines.length === 0}
            >
              {t("Reset visible and count")}
            </Button>
          </div>
        }
      >
        {filteredLines.length === 0 ? (
          <EmptyStateBlock
            title={
              search.trim() || categoryId !== "all"
                ? t("No search results")
                : trackedProductCount === 0
                  ? t("No products track inventory")
                  : t("No products in this count")
            }
            description={
              search.trim() || categoryId !== "all"
                ? t("Try another name or barcode, or change the category.")
                : trackedProductCount === 0
                  ? t("Enable inventory tracking for products, then reload the page.")
                  : t("Reload the page to sync tracked products with this count.")
            }
          />
        ) : (
          <div className="max-h-[50dvh] overflow-y-auto">
            <ResponsiveListLayout
              mobile={filteredLines.map((line) => {
                const product = productMap.get(line.product_id);
                const name = product?.name ?? t("Product");
                const unit = product ? formatUnit(product.unit) : "";
                const counted = counts[line.product_id] ?? line.counted_qty;
                const variance = counted - line.expected_qty;
                return (
                  <div key={line.id} data-count-product={line.product_id}>
                    <MobileEntityCard
                      title={name}
                      subtitle={[unit, product?.barcode || product?.sku]
                        .filter(Boolean)
                        .join(" · ") || undefined}
                      className={cn(
                        lastScannedId === line.product_id && "ring-2 ring-primary"
                      )}
                      fields={[
                        {
                          label: t("Expected"),
                          value: (
                            <span className="tabular-nums">{line.expected_qty}</span>
                          ),
                        },
                        {
                          label: t("Difference"),
                          value: (
                            <span
                              className={
                                variance === 0
                                  ? "tabular-nums text-muted-foreground"
                                  : variance > 0
                                    ? "tabular-nums text-emerald-600"
                                    : "tabular-nums text-red-600"
                              }
                            >
                              {variance > 0 ? "+" : ""}
                              {variance}
                            </span>
                          ),
                        },
                      ]}
                      footer={
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="size-11 shrink-0"
                            aria-label={`${t("Decrease")} ${name}`}
                            disabled={pending || counted <= 0}
                            onClick={() =>
                              setCountedQty(line.product_id, nextCountedQty(counted, -1))
                            }
                          >
                            <Minus className="size-4" />
                          </Button>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            className="h-11 flex-1 text-center tabular-nums"
                            aria-label={`${t("Current count for")} ${name}`}
                            value={counted}
                            onChange={(e) =>
                              setCountedQty(
                                line.product_id,
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="size-11 shrink-0"
                            aria-label={`${t("Increase")} ${name}`}
                            disabled={pending}
                            onClick={() =>
                              setCountedQty(line.product_id, nextCountedQty(counted, 1))
                            }
                          >
                            <Plus className="size-4" />
                          </Button>
                        </div>
                      }
                    />
                  </div>
                );
              })}
              desktop={
                <div className="overflow-x-auto">
                  <Table className="min-w-[720px]">
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-10 text-xs font-semibold text-muted-foreground">
                          {t("Product")}
                        </TableHead>
                        <TableHead className="h-10 text-end text-xs font-semibold text-muted-foreground">
                          {t("Expected stock")}
                        </TableHead>
                        <TableHead className="h-10 text-end text-xs font-semibold text-muted-foreground">
                          {t("Current")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLines.map((line) => {
                        const product = productMap.get(line.product_id);
                        const name = product?.name ?? t("Product");
                        const unit = product ? formatUnit(product.unit) : "";
                        const counted = counts[line.product_id] ?? line.counted_qty;
                        const highlighted = lastScannedId === line.product_id;
                        return (
                          <TableRow
                            key={line.id}
                            data-count-product={line.product_id}
                            className={cn(highlighted && "bg-primary/5")}
                          >
                            <TableCell className="max-w-[280px] font-medium">
                              <span className="truncate block">{name}</span>
                              <span className="text-xs text-muted-foreground">
                                {[unit, product?.barcode || product?.sku]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </TableCell>
                            <TableCell className="text-end tabular-nums text-muted-foreground">
                              {line.expected_qty}
                            </TableCell>
                            <TableCell className="text-end">
                              <div className="ms-auto flex w-[168px] items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="size-9 shrink-0"
                                  aria-label={`${t("Decrease")} ${name}`}
                                  disabled={pending || counted <= 0}
                                  onClick={() =>
                                    setCountedQty(
                                      line.product_id,
                                      nextCountedQty(counted, -1)
                                    )
                                  }
                                >
                                  <Minus className="size-4" />
                                </Button>
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  inputMode="decimal"
                                  className="h-9 w-20 text-center tabular-nums"
                                  aria-label={`${t("Current count for")} ${name}`}
                                  value={counted}
                                  onChange={(e) =>
                                    setCountedQty(
                                      line.product_id,
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="size-9 shrink-0"
                                  aria-label={`${t("Increase")} ${name}`}
                                  disabled={pending}
                                  onClick={() =>
                                    setCountedQty(
                                      line.product_id,
                                      nextCountedQty(counted, 1)
                                    )
                                  }
                                >
                                  <Plus className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              }
            />
          </div>
        )}
      </DataTableShell>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-border/60 bg-background/95 px-3 py-2.5 backdrop-blur-xl lg:bottom-0 lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:ps-64 lg:pt-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm text-muted-foreground">{saveLabel}</p>
          <CompactActions>
            <CompactAction
              label={t("Print")}
              icon={Printer}
              disabled={pending}
              onClick={openPrint}
            />
            <CompactAction
              label={t("Review differences")}
              icon={ClipboardList}
              variant="default"
              disabled={pending}
              alwaysLabeled
              onClick={() => saveCounts(true)}
            />
          </CompactActions>
        </div>
      </div>
    </div>
  );
}
