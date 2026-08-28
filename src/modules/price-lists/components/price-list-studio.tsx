"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Download,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Printer,
  Send,
  Share2,
} from "lucide-react";
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
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { formatCurrency } from "@/lib/format";
import { sanitizeDecimalInput } from "@/lib/digits";
import type { Product } from "@/lib/types";
import type { PriceListStudioData } from "@/modules/price-lists/actions/price-list.actions";
import {
  buildRowsFromProducts,
  reapplyMargin,
  resolveOfferDisplayPrices,
  suggestSaleFromCost,
  type PriceListRow,
} from "@/modules/price-lists/lib/build-price-list-rows";
import {
  computePosterHeight,
  DEFAULT_PRICE_LIST_THEME,
  getPriceListFormat,
  PRICE_LIST_FORMATS,
  type PriceListFormatId,
  type PriceListPrintPayload,
} from "@/modules/price-lists/lib/formats";
import {
  downloadDataUrl,
  exportPosterBlob,
  exportPosterJpeg,
  exportPosterPng,
  shareTextUrls,
} from "@/modules/price-lists/lib/export-poster";
import { savePriceListPrintPayload } from "@/modules/price-lists/lib/print-payload";
import { PriceListPoster } from "@/modules/price-lists/components/price-list-poster";
import { useTranslation } from "@/lib/i18n/use-translation";

function nextSuggestedSale(row: PriceListRow, marginPercent: number): number {
  if (row.catalogSalePrice > 0) return row.catalogSalePrice;
  return suggestSaleFromCost(row.packCost, marginPercent);
}

type PriceListStudioProps = {
  initial: PriceListStudioData;
};

function buildPosterRows(
  rows: PriceListRow[],
  discountPercent: number,
  showBeforeAfter: boolean
): PriceListPrintPayload["rows"] {
  return rows.map((row) => {
    const { displayPrice, oldPrice } = resolveOfferDisplayPrices({
      salePrice: row.salePrice,
      catalogSalePrice: row.catalogSalePrice,
      compareAtPrice: row.compareAtPrice,
      discountPercent,
      showBeforeAfter,
    });
    return {
      id: row.id,
      name: row.name,
      imageUrl: row.imageUrl,
      weightLine: row.weightLine,
      packUnitLabel: row.packUnitLabel,
      salePrice: row.salePrice,
      displayPrice,
      oldPrice,
    };
  });
}

export function PriceListStudio({ initial }: PriceListStudioProps) {
  const { t } = useTranslation();
  const posterRef = useRef<HTMLDivElement>(null);
  const [exporting, startExport] = useTransition();
  const [rows, setRows] = useState<PriceListRow[]>(initial.rows);
  const [manualIds, setManualIds] = useState<Set<string>>(() => new Set());
  const [marginPercent, setMarginPercent] = useState(String(initial.defaultMarginPercent));
  const [discountPercent, setDiscountPercent] = useState("0");
  const [listTitle, setListTitle] = useState(initial.branding.orgName || t("Price list"));
  const [sectionTitle, setSectionTitle] = useState(t("Sale prices"));
  const [footerText, setFooterText] = useState(t("Prices are valid while stock lasts"));
  const [showLogo, setShowLogo] = useState(true);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const [showUnitLine, setShowUnitLine] = useState(true);
  const [background, setBackground] = useState<string>(DEFAULT_PRICE_LIST_THEME.background);
  const [accent, setAccent] = useState<string>(DEFAULT_PRICE_LIST_THEME.accent);
  const [formatId, setFormatId] = useState<PriceListFormatId>("instagram");
  const [productQuery, setProductQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initial.rows.map((r) => r.productId))
  );

  const format = getPriceListFormat(formatId);
  const discount = parseFloat(discountPercent) || 0;
  const posterRows = useMemo(
    () => buildPosterRows(rows, discount, showBeforeAfter),
    [rows, discount, showBeforeAfter]
  );

  const applyMargin = useCallback(
    (raw: string) => {
      setMarginPercent(raw);
      const m = parseFloat(raw);
      if (!Number.isFinite(m)) return;
      setRows((prev) => reapplyMargin(prev, m, manualIds));
    },
    [manualIds]
  );

  useEffect(() => {
    const m = parseFloat(marginPercent) || 5;
    const selected = initial.catalog.filter((p) => selectedIds.has(p.id));
    const fromCatalog = buildRowsFromProducts({ products: selected, marginPercent: m });
    setRows((prev) => {
      const prevByProduct = new Map(prev.map((r) => [r.productId, r]));
      return fromCatalog.map((catalogRow) => {
        const existing = prevByProduct.get(catalogRow.productId);
        if (!existing) return catalogRow;
        const suggestedSalePrice = nextSuggestedSale(
          {
            ...existing,
            catalogSalePrice: catalogRow.catalogSalePrice || existing.catalogSalePrice,
          },
          m
        );
        return {
          ...existing,
          catalogSalePrice: catalogRow.catalogSalePrice || existing.catalogSalePrice,
          suggestedSalePrice,
          salePrice: manualIds.has(existing.id) ? existing.salePrice : suggestedSalePrice,
        };
      });
    });
    // Rebuild when selection changes only; margin edits go through applyMargin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, initial.catalog]);

  const filteredCatalog = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return initial.catalog.slice(0, 40);
    return initial.catalog
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [initial.catalog, productQuery]);

  const toggleProduct = (product: Product) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(product.id)) next.delete(product.id);
      else next.add(product.id);
      return next;
    });
  };

  const updateSalePrice = (rowId: string, raw: string) => {
    const cleaned = sanitizeDecimalInput(raw);
    const value = parseFloat(cleaned);
    setManualIds((prev) => new Set(prev).add(rowId));
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? { ...row, salePrice: Number.isFinite(value) ? value : row.salePrice }
          : row
      )
    );
  };

  const updateCompareAtPrice = (rowId: string, raw: string) => {
    const cleaned = sanitizeDecimalInput(raw);
    if (!cleaned) {
      setRows((prev) =>
        prev.map((row) => (row.id === rowId ? { ...row, compareAtPrice: null } : row))
      );
      return;
    }
    const value = parseFloat(cleaned);
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? { ...row, compareAtPrice: Number.isFinite(value) ? value : row.compareAtPrice }
          : row
      )
    );
  };

  const buildPrintPayload = (): PriceListPrintPayload => ({
    listTitle,
    sectionTitle,
    footerText,
    showLogo,
    showOldPrice: showBeforeAfter,
    showUnitLine,
    discountPercent: discount,
    background,
    accent,
    orgName: initial.branding.orgName,
    orgLogoUrl: initial.branding.orgLogoUrl,
    currency: initial.branding.currency,
    rows: posterRows,
  });

  const runExport = (kind: "png" | "jpg") => {
    const node = posterRef.current;
    if (!node) {
      toast.error(t("Preview is not ready"));
      return;
    }
    startExport(async () => {
      try {
        const dataUrl =
          kind === "png"
            ? await exportPosterPng(node, format)
            : await exportPosterJpeg(node, format);
        const stamp = new Date().toISOString().slice(0, 10);
        downloadDataUrl(dataUrl, `price-list-${format.id}-${stamp}.${kind === "png" ? "png" : "jpg"}`);
        toast.success(kind === "png" ? t("PNG downloaded") : t("JPG downloaded"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("Export failed"));
      }
    });
  };

  const openPrintPdf = () => {
    if (posterRows.length === 0) {
      toast.error(t("Select products before printing"));
      return;
    }
    try {
      savePriceListPrintPayload(buildPrintPayload());
      // Keep opener so the print tab can fall back if storage is blocked.
      const printWindow = window.open("/print/price-list", "_blank");
      if (!printWindow) {
        toast.error(t("The browser blocked the popup. Allow popups and try again."));
      }
    } catch {
      toast.error(t("Could not open the print page"));
    }
  };

  const shareNative = () => {
    const node = posterRef.current;
    if (!node) return;
    startExport(async () => {
      try {
        const blob = await exportPosterBlob(node, format, "image/png");
        if (!blob) throw new Error(t("Could not create the image"));
        const file = new File([blob], `price-list-${format.id}.png`, { type: "image/png" });
        const text = `${listTitle}\n${sectionTitle}\n${footerText}`;
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: listTitle, text });
          return;
        }
        if (navigator.share) {
          await navigator.share({ title: listTitle, text });
          return;
        }
        downloadDataUrl(URL.createObjectURL(blob), file.name);
        toast.message(t("Image saved. Share it from your device."));
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        toast.error(e instanceof Error ? e.message : t("Sharing failed"));
      }
    });
  };

  const shareLinks = shareTextUrls(
    `${listTitle} — ${sectionTitle}\n${rows
      .map((r) => {
        const offer = resolveOfferDisplayPrices({
          salePrice: r.salePrice,
          catalogSalePrice: r.catalogSalePrice,
          compareAtPrice: r.compareAtPrice,
          discountPercent: discount,
          showBeforeAfter,
        });
        const priceText =
          showBeforeAfter && offer.oldPrice != null
            ? `${t("Was")} ${formatCurrency(offer.oldPrice, initial.branding.currency)} ← ${t("Now")} ${formatCurrency(offer.displayPrice, initial.branding.currency)}`
            : formatCurrency(offer.displayPrice, initial.branding.currency);
        return `${r.name}: ${priceText}${r.packUnitLabel ? ` / ${r.packUnitLabel}` : ""}`;
      })
      .join("\n")}\n${footerText}`
  );

  const posterHeight = useMemo(
    () =>
      computePosterHeight({
        width: format.width,
        minHeight: format.height,
        rowCount: posterRows.length,
        showLogo,
      }),
    [format.width, format.height, posterRows.length, showLogo]
  );
  const previewScale = Math.min(1, 360 / format.width);

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Product price list"
        description={
          initial.invoiceNumber
            ? `${t("From invoice")} ${initial.invoiceNumber} — ${t("The shown price is the saved sale price and can be edited.")}`
            : "Select products, edit sale prices, then export or print"
        }
        action={
          <Link href="/inventory/purchases">
            <Button variant="outline" className="min-h-11">
              {t("Back to purchases")}
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <div className="space-y-4">
          <OperationalCard accent="var(--mds-color-action-primary)">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="listTitle">{t("List name")}</Label>
                <Input
                  id="listTitle"
                  value={listTitle}
                  onChange={(e) => setListTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sectionTitle">{t("Section title")}</Label>
                <Input
                  id="sectionTitle"
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                  placeholder={t("Frozen food · Sauces · Mozzarella")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="margin">{t("Suggested margin % when no sale price exists")}</Label>
                <Input
                  id="margin"
                  inputMode="decimal"
                  value={marginPercent}
                  onChange={(e) => applyMargin(sanitizeDecimalInput(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="discount">{t("Offer discount %")}</Label>
                <Input
                  id="discount"
                  inputMode="decimal"
                  value={discountPercent}
                  onChange={(e) => {
                    const next = sanitizeDecimalInput(e.target.value);
                    setDiscountPercent(next);
                    if ((parseFloat(next) || 0) > 0) setShowBeforeAfter(true);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bg">{t("Background color")}</Label>
                <Input
                  id="bg"
                  type="color"
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                  className="h-11 cursor-pointer p-1"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accent">{t("Brand color")}</Label>
                <Input
                  id="accent"
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-11 cursor-pointer p-1"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="footer">{t("Footer text")}</Label>
                <Input
                  id="footer"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={showLogo} onCheckedChange={(v) => setShowLogo(v === true)} />
                {t("Show logo")}
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="flex items-center gap-2">
                  <Checkbox
                    checked={showBeforeAfter}
                    onCheckedChange={(v) => {
                      const on = v === true;
                      setShowBeforeAfter(on);
                      if (on) {
                        setRows((prev) =>
                          prev.map((row) =>
                            row.compareAtPrice == null && row.salePrice > 0
                              ? { ...row, compareAtPrice: row.salePrice }
                              : row
                          )
                        );
                      }
                    }}
                  />
                  {t("Show before and after prices")}
                </span>
                <span className="ps-7 text-xs text-muted-foreground">
                  {t("The crossed price is before, and the clear price is after. Use a discount or edit it manually.")}
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Checkbox
                  checked={showUnitLine}
                  onCheckedChange={(v) => setShowUnitLine(v === true)}
                />
                {t("Show unit below product name")}
              </label>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("Export size")}</Label>
                <Select
                  value={formatId}
                  onValueChange={(v) =>
                    setFormatId((v ?? "instagram") as PriceListFormatId)
                  }
                >
                  <SelectTrigger className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_LIST_FORMATS.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {t(f.label)} ({f.width}×{f.height})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </OperationalCard>

          <OperationalCard>
            <div className="mb-3 space-y-1.5">
              <Label htmlFor="productQuery">{t("Select products from the catalog")}</Label>
              <Input
                id="productQuery"
                placeholder={t("Search by name or barcode…")}
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
              />
            </div>
            <div className="grid max-h-56 gap-1 overflow-y-auto">
              {filteredCatalog.map((product) => {
                const checked = selectedIds.has(product.id);
                return (
                  <label
                    key={product.id}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleProduct(product)}
                    />
                    <span className="flex-1 truncate text-sm">{product.name}</span>
                  </label>
                );
              })}
            </div>
          </OperationalCard>

          <OperationalCard>
            <h3 className="mb-3 font-semibold">{t("List products")} ({rows.length})</h3>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("Select products from the catalog above.")}</p>
            ) : (
              <div className="grid gap-2">
                {rows.map((row) => {
                  const offer = resolveOfferDisplayPrices({
                    salePrice: row.salePrice,
                    catalogSalePrice: row.catalogSalePrice,
                    compareAtPrice: row.compareAtPrice,
                    discountPercent: discount,
                    showBeforeAfter,
                  });
                  return (
                    <div
                      key={row.id}
                      className="grid grid-cols-1 gap-2 rounded-2xl border border-border/60 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("Cost")} {row.packUnitLabel}:{" "}
                          {formatCurrency(row.packCost, initial.branding.currency)}
                          {row.weightLine ? ` · ${row.weightLine}` : ""}
                          {!row.hasPacking ? ` · ${t("No purchase packaging")}` : ""}
                        </p>
                      </div>
                      {showBeforeAfter ? (
                        <div className="min-w-0 space-y-1">
                          <Label className="text-xs text-muted-foreground">{t("Before price")}</Label>
                          <Input
                            className="min-h-11 w-full tabular-nums sm:min-h-10 sm:w-28"
                            inputMode="decimal"
                            placeholder={
                              discount > 0
                                ? String(row.salePrice)
                                : row.catalogSalePrice > 0
                                  ? String(row.catalogSalePrice)
                                  : ""
                            }
                            value={
                              row.compareAtPrice != null ? String(row.compareAtPrice) : ""
                            }
                            onChange={(e) =>
                              updateCompareAtPrice(
                                row.id,
                                sanitizeDecimalInput(e.target.value)
                              )
                            }
                          />
                        </div>
                      ) : null}
                      <div className="min-w-0 space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {showBeforeAfter
                            ? discount > 0
                              ? t("Price before discount")
                              : t("After price")
                            : t("Sale price")}
                        </Label>
                        <Input
                          className="min-h-11 w-full tabular-nums sm:min-h-10 sm:w-28"
                          inputMode="decimal"
                          value={String(row.salePrice)}
                          onChange={(e) =>
                            updateSalePrice(row.id, sanitizeDecimalInput(e.target.value))
                          }
                        />
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-muted-foreground sm:pb-2 sm:text-end">
                        {showBeforeAfter && offer.oldPrice != null ? (
                          <>
                            <span className="line-through opacity-70">
                              {formatCurrency(offer.oldPrice, initial.branding.currency)}
                            </span>
                            {" → "}
                            {formatCurrency(offer.displayPrice, initial.branding.currency)}
                          </>
                        ) : (
                          <>
                            {t("In the list")}:{" "}
                            {formatCurrency(offer.displayPrice, initial.branding.currency)}
                          </>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </OperationalCard>

          <OperationalCard>
            <h3 className="mb-3 font-semibold">{t("Export and share")}</h3>
            <CompactActions className="justify-start">
              <CompactAction
                label="PNG"
                icon={exporting ? Loader2 : Download}
                variant="default"
                disabled={exporting || rows.length === 0}
                onClick={() => runExport("png")}
                className={exporting ? "[&_svg]:animate-spin" : undefined}
              />
              <CompactAction
                label="JPG"
                icon={ImageIcon}
                disabled={exporting || rows.length === 0}
                onClick={() => runExport("jpg")}
              />
              <CompactAction
                label={t("PDF / Print")}
                icon={Printer}
                disabled={rows.length === 0}
                onClick={openPrintPdf}
              />
              <CompactAction
                label={t("Share")}
                icon={Share2}
                disabled={exporting || rows.length === 0}
                onClick={shareNative}
              />
              <CompactAction
                label={t("WhatsApp")}
                icon={MessageCircle}
                href={shareLinks.whatsapp}
              />
              <CompactAction
                label={t("Telegram")}
                icon={Send}
                href={shareLinks.telegram}
              />
              <CompactAction
                label={t("Facebook")}
                icon={Share2}
                href={shareLinks.facebook}
              />
            </CompactActions>
          </OperationalCard>
        </div>

        <div className="xl:sticky xl:top-4 xl:self-start">
          <OperationalCard>
            <p className="mb-3 text-sm text-muted-foreground">
              {t("Preview")} {t(format.label)} — {t("all selected products")} ({posterRows.length}) {t("are shown in the image")}
            </p>
            <div className="max-h-[min(80dvh,920px)] overflow-x-hidden overflow-y-auto rounded-2xl bg-muted/40 p-3">
              {/*
                Preview stage is LTR for scale math only. Poster keeps its own RTL.
                Outer size = scaled pixels; overflow hidden clips unscaled layout width
                so Instagram (1080) never creates a horizontal scrollbar.
              */}
              <div
                dir="ltr"
                className="relative mx-auto overflow-hidden"
                style={{
                  width: format.width * previewScale,
                  height: posterHeight * previewScale,
                }}
              >
                <div
                  className="absolute top-0 left-0"
                  style={{
                    width: format.width,
                    height: posterHeight,
                    transform: `scale(${previewScale})`,
                    transformOrigin: "top left",
                  }}
                >
                  <div ref={posterRef}>
                    <PriceListPoster
                      width={format.width}
                      height={posterHeight}
                      orgName={initial.branding.orgName}
                      orgLogoUrl={initial.branding.orgLogoUrl}
                      showLogo={showLogo}
                      listTitle={listTitle}
                      sectionTitle={sectionTitle}
                      footerText={footerText}
                      background={background}
                      accent={accent}
                      rows={posterRows}
                      showOldPrice={showBeforeAfter}
                      showUnitLine={showUnitLine}
                    />
                  </div>
                </div>
              </div>
            </div>
          </OperationalCard>
        </div>
      </div>
    </div>
  );
}
