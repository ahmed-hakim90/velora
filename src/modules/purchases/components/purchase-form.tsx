"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Plus, Tags, Trash2, X, Save, PackageCheck, FileText, Receipt, Undo2, Send, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  backgroundMutationKey,
  useBackgroundMutation,
} from "@/hooks/use-background-mutation";
import { useOperatorShortcuts } from "@/hooks/use-operator-shortcuts";
import { useUndoStack } from "@/hooks/use-undo-stack";
import { OPERATOR_SHORTCUTS } from "@/lib/keyboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { OperatorShortcutHint } from "@/components/Velora/operator-shortcut-hint";
import { OperationalCard } from "@/components/Velora/operational-card";
import {
  DocumentHeaderGrid,
  DocumentLineComposer,
  DocumentLinesSection,
} from "@/components/Velora/commercial-document-form";
import { EmptyStateBlock, LoadingStateBlock } from "@/components/Velora/state-blocks";
import { DocumentPrintPreviewModal } from "@/components/print/document-print-preview-modal";
import { CreateContainerInline } from "@/modules/purchases/components/containers-page";
import { formatCurrency } from "@/lib/format";
import { lineTotalAfterDiscount } from "@/lib/line-discount";
import { sanitizeDecimalInput } from "@/lib/digits";
import { PAYMENT_METHODS } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n/use-translation";
import { calculateExpiryDate } from "@/lib/inventory/expiry";
import { selectLabelById } from "@/lib/select-label";
import {
  convertPurchaseEntryToBase,
  formatUnit,
  productHasPurchasePacking,
  productPurchaseFactor,
  suggestedPurchaseEntryUnitCost,
} from "@/lib/units";
import { ProductSearchCombobox } from "@/modules/products/components/product-search-combobox";
import { matchProducts } from "@/modules/products/lib/match-products";
import type {
  MeasurementUnit,
  PaymentMethod,
  Product,
  PurchaseInvoice,
  PurchaseInvoiceLine,
  Supplier,
  Warehouse,
} from "@/lib/types";
import {
  addPurchaseLineAction,
  convertPurchaseDocumentAction,
  createPurchaseAction,
  deleteDraftPurchaseAction,
  getPurchaseDetailAction,
  importPurchaseOrdersIntoInvoiceAction,
  listImportablePurchaseOrdersAction,
  postPurchaseReturnAction,
  previewPurchaseConvertAction,
  receivePurchaseAction,
  removePurchaseLineAction,
  transitionPurchaseDocumentAction,
  updateDraftPurchaseAction,
  updatePurchaseLineAction,
  voidPurchaseAction,
} from "@/modules/purchases/actions/purchase.actions";
import {
  buildWhatsAppDocumentUrl,
  formatCommercialDocumentForWhatsApp,
} from "@/modules/pos/services/receipt-format.service";
import { COMMERCIAL_DOCUMENT_KIND_LABELS } from "@/modules/print-engine/lib/print-engine-settings";
import { EXTRA_COST_INVOICE_HINT } from "@/modules/purchases/lib/landed-cost-split";
import type {
  ImportablePurchaseOrder,
  PurchaseWithLines,
} from "@/modules/purchases/services/purchase.service";

function withLineTotals(
  lines: PurchaseInvoiceLine[],
  extraCost: number
): Pick<PurchaseWithLines, "lines" | "subtotal" | "extra_cost" | "total"> {
  const subtotal = Number(lines.reduce((s, l) => s + l.line_total, 0).toFixed(2));
  const extra = Math.max(0, extraCost);
  return {
    lines,
    subtotal,
    extra_cost: extra,
    total: Number((subtotal + extra).toFixed(2)),
  };
}

const LOCAL_DRAFT_PREFIX = "local-";

function isLocalDraftId(id: string) {
  return id.startsWith(LOCAL_DRAFT_PREFIX);
}

function buildLocalPurchaseDraft(input: {
  documentKind: NonNullable<PurchaseInvoice["document_kind"]>;
  supplierId: string;
  warehouseId: string;
  suppliers: Supplier[];
  warehouses: Warehouse[];
  documentDate: string;
  extraCost?: number;
}): PurchaseWithLines {
  const supplier = input.suppliers.find((s) => s.id === input.supplierId);
  const warehouse = input.warehouses.find((w) => w.id === input.warehouseId);
  const extra = Math.max(0, input.extraCost ?? 0);
  const now = new Date().toISOString();
  return {
    id: `${LOCAL_DRAFT_PREFIX}${crypto.randomUUID()}`,
    store_id: "",
    warehouse_id: input.warehouseId,
    supplier_id: input.supplierId || null,
    invoice_number: "New draft",
    status: "draft",
    document_kind: input.documentKind,
    source_document_id: null,
    document_notes: "",
    subtotal: 0,
    extra_cost: extra,
    tax: 0,
    total: extra,
    document_date: input.documentDate,
    received_at: null,
    cancelled_at: null,
    created_by: "",
    created_at: now,
    lines: [],
    supplierName: supplier?.name ?? (input.supplierId ? "" : "No supplier"),
    warehouseName: warehouse?.name ?? "",
    supplierAddress: supplier?.address ?? null,
    supplierTaxId: supplier?.tax_id ?? null,
    supplierContact: supplier?.contact_info ?? null,
  };
}

/** Controlled draft field — avoids Base UI warning when line.qty/cost updates after blur. */
function DraftDecimalInput({
  value,
  emptyFallback,
  className,
  onCommit,
}: {
  value: number;
  emptyFallback: number;
  className?: string;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(() => String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      className={className}
      value={draft}
      onChange={(e) => setDraft(sanitizeDecimalInput(e.target.value))}
      onBlur={() => {
        const raw = sanitizeDecimalInput(draft);
        const next = parseFloat(raw) || emptyFallback;
        setDraft(String(next));
        if (next !== value) onCommit(next);
      }}
    />
  );
}

interface PurchaseFormProps {
  suppliers: Supplier[];
  products: Product[];
  warehouses: Warehouse[];
  currency: string;
  initialInvoiceId?: string;
  documentKind?: NonNullable<PurchaseInvoice["document_kind"]>;
  canManagePrintEngine?: boolean;
  /** Manual feature: containers + document FX. Never activity-driven. */
  importsEnabled?: boolean;
  onComplete: () => void;
}

export function PurchaseForm({
  suppliers,
  products,
  warehouses,
  currency,
  initialInvoiceId,
  documentKind = "purchase_invoice",
  importsEnabled = false,
  onComplete,
}: PurchaseFormProps) {
  const { t, language } = useTranslation();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(!!initialInvoiceId);
  const defaultWarehouseId =
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? "";
  const defaultSupplierId = suppliers[0]?.id ?? "";
  const [invoice, setInvoice] = useState<PurchaseWithLines | null>(() => {
    if (initialInvoiceId) return null;
    if (!defaultWarehouseId) return null;
    if (documentKind !== "purchase_request" && !defaultSupplierId) return null;
    return buildLocalPurchaseDraft({
      documentKind,
      supplierId: defaultSupplierId,
      warehouseId: defaultWarehouseId,
      suppliers,
      warehouses,
      documentDate: new Date().toISOString().slice(0, 10),
    });
  });
  const [supplierId, setSupplierId] = useState(defaultSupplierId);
  const { run: runBackground } = useBackgroundMutation();
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [documentDate, setDocumentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [extraCost, setExtraCost] = useState("");
  const [docCurrency, setDocCurrency] = useState(currency);
  const [fxRate, setFxRate] = useState("1");
  const [documentNotes, setDocumentNotes] = useState("");
  const [poContainers, setPoContainers] = useState<
    import("@/modules/purchases/services/purchase-container.service").ContainerWithLines[]
  >([]);
  const [containersLoaded, setContainersLoaded] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [lineDiscount, setLineDiscount] = useState("");
  const [entryUnit, setEntryUnit] = useState<MeasurementUnit>("piece");
  const [batchNumber, setBatchNumber] = useState("");
  const [productionDate, setProductionDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [confirmReceive, setConfirmReceive] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertRows, setConvertRows] = useState<
    Array<{ sourceLineId: string; productId: string; remaining: number; qty: string }>
  >([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importableOrders, setImportableOrders] = useState<ImportablePurchaseOrder[]>([]);
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [printPreview, setPrintPreview] = useState<{
    href: string;
    title: string;
  } | null>(null);
  const [amountPaidNow, setAmountPaidNow] = useState("0");
  const [receivePaymentMethod, setReceivePaymentMethod] =
    useState<PaymentMethod>("cash");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const snapshotRef = useRef<PurchaseWithLines | null>(null);
  const invoiceRef = useRef<PurchaseWithLines | null>(null);
  const persistPromiseRef = useRef<Promise<PurchaseWithLines | null> | null>(null);
  const isUndoingRef = useRef(false);
  const cancelledTempIdsRef = useRef(new Set<string>());
  const removeLineRef = useRef<(lineId: string) => void>(() => {});
  const updateLineRef = useRef<
    (
      lineId: string,
      qty: number,
      cost: number,
      nextBatchNumber?: string | null,
      nextProductionDate?: string | null,
      nextExpiryDate?: string | null
    ) => void
  >(() => {});
  const addLineForUndoRef = useRef<
    (
      productId: string,
      qty: number,
      cost: number,
      lineEntryUnit: MeasurementUnit,
      lineBatchNumber?: string | null,
      lineProductionDate?: string | null,
      lineExpiryDate?: string | null
    ) => void
  >(() => {});
  const { push: pushUndo, undo: undoLast, clear: clearUndo } = useUndoStack();

  useEffect(() => {
    invoiceRef.current = invoice;
  }, [invoice]);

  const currentInvoiceId = invoice?.id;

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const selectProduct = useCallback((product: Product) => {
    setSelectedProductId(product.id);
    setUnitCost("");
    const base = product.base_unit ?? product.unit;
    setEntryUnit(productHasPurchasePacking(product) ? product.cost_unit : base);
    setBarcode(product.name);
    setHighlightIndex(0);
    setQuantity((prev) => (prev.trim() ? prev : "1"));
    setTimeout(() => {
      qtyRef.current?.focus();
      qtyRef.current?.select();
    }, 50);
  }, []);

  const selectedProduct = selectedProductId ? productMap.get(selectedProductId) : undefined;
  const selectedHasPacking = selectedProduct ? productHasPurchasePacking(selectedProduct) : false;
  const selectedBaseUnit = selectedProduct
    ? (selectedProduct.base_unit ?? selectedProduct.unit)
    : "piece";
  const selectedPurchaseUnit = selectedProduct?.cost_unit ?? selectedBaseUnit;
  const selectedFactor = selectedProduct ? productPurchaseFactor(selectedProduct) : 1;
  const suggestedEntryCost = selectedProduct
    ? suggestedPurchaseEntryUnitCost(selectedProduct, entryUnit)
    : 0;
  const parsedQuantity = parseFloat(quantity);
  const parsedUnitCost = parseFloat(unitCost);
  const entryPreview =
    selectedProduct && selectedHasPacking && parsedQuantity > 0
      ? convertPurchaseEntryToBase({
          quantity: parsedQuantity,
          unitCost:
            Number.isFinite(parsedUnitCost) && parsedUnitCost >= 0
              ? parsedUnitCost
              : suggestedEntryCost,
          entryUnit,
          baseUnit: selectedBaseUnit,
          purchaseUnit: selectedPurchaseUnit,
          unitsPerPurchaseUnit: selectedFactor,
        })
      : null;
  const calculatedExpiryDate = calculateExpiryDate(
    productionDate || null,
    selectedProduct?.shelf_life_value ?? 0,
    selectedProduct?.shelf_life_unit ?? "days"
  );

  const resetLineInputs = () => {
    setBarcode("");
    setQuantity("1");
    setUnitCost("");
    setLineDiscount("");
    setEntryUnit("piece");
    setBatchNumber("");
    setProductionDate("");
    setExpiryDate("");
    setSelectedProductId("");
    setHighlightIndex(0);
    setTimeout(() => productSearchRef.current?.focus(), 50);
  };

  useEffect(() => {
    if (!initialInvoiceId) return;
    setLoading(true);
    startTransition(async () => {
      const result = await getPurchaseDetailAction(initialInvoiceId);
      setLoading(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setInvoice(result.data);
      setSupplierId(result.data.supplier_id ?? "");
      setWarehouseId(result.data.warehouse_id);
      setInvoiceNumber(result.data.invoice_number);
      setDocumentDate(
        result.data.document_date ?? result.data.created_at.slice(0, 10)
      );
      setExtraCost(
        result.data.extra_cost > 0 ? String(result.data.extra_cost) : ""
      );
      setDocCurrency(result.data.currency ?? currency);
      setFxRate(String(result.data.fx_rate ?? 1));
      setDocumentNotes(result.data.document_notes ?? "");
      setTimeout(() => productSearchRef.current?.focus(), 100);
    });
  }, [initialInvoiceId, currency]);

  useEffect(() => {
    if (
      !importsEnabled ||
      documentKind !== "purchase_order" ||
      !currentInvoiceId ||
      isLocalDraftId(currentInvoiceId)
    ) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const { listContainersAction } = await import(
        "@/modules/purchases/actions/purchase-import.actions"
      );
      const result = await listContainersAction({ purchaseOrderId: currentInvoiceId });
      if (cancelled) return;
      if (result.ok) {
        setPoContainers(result.data);
        setContainersLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [importsEnabled, documentKind, currentInvoiceId]);

  useEffect(() => {
    if (initialInvoiceId || !currentInvoiceId || !isLocalDraftId(currentInvoiceId)) return;
    setTimeout(() => productSearchRef.current?.focus(), 50);
  }, [initialInvoiceId, currentInvoiceId]);

  const ensurePersistedDraft = useCallback(async (): Promise<PurchaseWithLines | null> => {
    const current = invoiceRef.current;
    if (!current) return null;
    if (!isLocalDraftId(current.id)) return current;

    const nextWarehouseId = warehouseId || current.warehouse_id;
    const nextSupplierId = supplierId || current.supplier_id || "";
    if (!nextWarehouseId) {
      toast.error(t("Choose a warehouse"));
      return null;
    }
    if (documentKind !== "purchase_request" && !nextSupplierId) {
      toast.error(t("Choose a supplier"));
      return null;
    }

    if (persistPromiseRef.current) return persistPromiseRef.current;

    persistPromiseRef.current = (async () => {
      const result = await createPurchaseAction({
        supplierId: nextSupplierId || null,
        warehouseId: nextWarehouseId,
        extraCost: parseFloat(extraCost) || current.extra_cost || 0,
        documentDate: documentDate || current.document_date,
        documentKind,
        ...(importsEnabled
          ? {
              currency: docCurrency,
              fxRate: parseFloat(fxRate) || 1,
            }
          : {}),
      });
      if (!result.ok) {
        toast.error(result.error);
        return null;
      }
      const supplier = suppliers.find((s) => s.id === nextSupplierId);
      const persisted: PurchaseWithLines = {
        ...result.data,
        lines: [],
        supplierName: supplier?.name ?? (nextSupplierId ? "" : "No supplier"),
        warehouseName: warehouses.find((w) => w.id === nextWarehouseId)?.name ?? "",
        supplierAddress: supplier?.address ?? null,
        supplierTaxId: supplier?.tax_id ?? null,
        supplierContact: supplier?.contact_info ?? null,
      };
      setInvoiceNumber(persisted.invoice_number);
      setInvoice(persisted);
      invoiceRef.current = persisted;
      return persisted;
    })().finally(() => {
      persistPromiseRef.current = null;
    });

    return persistPromiseRef.current;
  }, [
    warehouseId,
    supplierId,
    documentKind,
    extraCost,
    documentDate,
    suppliers,
    warehouses,
    importsEnabled,
    docCurrency,
    fxRate,
    t,
  ]);

  const addLine = useCallback(
    (
      productId: string,
      qty: number,
      cost: number,
      lineEntryUnit: MeasurementUnit,
      lineBatchNumber?: string | null,
      lineProductionDate?: string | null,
      lineExpiryDate?: string | null,
      discountAmount = 0
    ) => {
      void (async () => {
        let inv = invoiceRef.current;
        if (!inv || qty <= 0 || cost < 0) return;

        if (isLocalDraftId(inv.id)) {
          const persisted = await ensurePersistedDraft();
          if (!persisted) return;
          inv = persisted;
        }

        const product = productMap.get(productId);
        if (!product) return;

        const baseUnit = product.base_unit ?? product.unit;
        const purchaseUnit = product.cost_unit ?? baseUnit;
        const factor = productPurchaseFactor(product);
        const converted = convertPurchaseEntryToBase({
          quantity: qty,
          unitCost: cost,
          entryUnit: lineEntryUnit,
          baseUnit,
          purchaseUnit,
          unitsPerPurchaseUnit: factor,
        });

        snapshotRef.current = inv;
        const existing = inv.lines.find(
          (l) => l.product_id === productId && l.variant_id == null
        );

        let nextLines: PurchaseInvoiceLine[];
        let optimisticId: string;

        if (existing) {
          const mergedQty = existing.quantity + converted.quantity;
          const blendedCost =
            mergedQty > 0
              ? Number(
                  (
                    (existing.quantity * existing.unit_cost +
                      converted.quantity * converted.unitCost) /
                    mergedQty
                  ).toFixed(4)
                )
              : converted.unitCost;
          optimisticId = existing.id;
          nextLines = inv.lines.map((l) =>
            l.id === existing.id
              ? {
                  ...l,
                  quantity: mergedQty,
                  unit_cost: blendedCost,
                  discount_amount: Number(((existing.discount_amount ?? 0) + Math.max(0, discountAmount)).toFixed(2)),
                  line_total: lineTotalAfterDiscount(
                    mergedQty,
                    blendedCost,
                    (existing.discount_amount ?? 0) + Math.max(0, discountAmount)
                  ),
                  batch_number: lineBatchNumber ?? null,
                  production_date: lineProductionDate ?? null,
                  expiry_date: lineExpiryDate ?? null,
                }
              : l
          );
        } else {
          optimisticId = `temp-${crypto.randomUUID()}`;
          nextLines = [
            ...inv.lines,
            {
              id: optimisticId,
              invoice_id: inv.id,
              product_id: productId,
              variant_id: null,
              quantity: converted.quantity,
              unit_cost: converted.unitCost,
              discount_amount: Math.max(0, discountAmount),
              line_total: lineTotalAfterDiscount(
                converted.quantity,
                converted.unitCost,
                Math.max(0, discountAmount)
              ),
              landed_unit_cost: null,
              landed_line_total: null,
              batch_number: lineBatchNumber ?? null,
              production_date: lineProductionDate ?? null,
              expiry_date: lineExpiryDate ?? null,
            },
          ];
        }

        setInvoice({
          ...inv,
          ...withLineTotals(nextLines, inv.extra_cost),
        });
        resetLineInputs();
        toast.success(`${t("Added")} ${product.name}`);

        if (!isUndoingRef.current) {
          const priorQty = existing?.quantity ?? 0;
          const priorCost = existing?.unit_cost ?? 0;
          const merged = Boolean(existing);
          pushUndo({
            undo: () => {
              const current = invoiceRef.current;
              if (!current) return;
              const line = current.lines.find(
                (l) => l.product_id === productId && l.variant_id == null
              );
              if (!line) return;
              isUndoingRef.current = true;
              if (!merged || priorQty <= 0) {
                removeLineRef.current?.(line.id);
              } else {
                updateLineRef.current?.(line.id, priorQty, priorCost);
              }
              isUndoingRef.current = false;
            },
          });
        }

        const rate = parseFloat(fxRate) || 1;
        const foreign =
          importsEnabled && docCurrency !== currency
            ? cost
            : null;
        const unitCostBase =
          foreign != null ? Number((foreign * rate).toFixed(4)) : cost;
        const result = await addPurchaseLineAction({
          invoiceId: inv.id,
          productId,
          quantity: qty,
          unitCost: unitCostBase,
          foreignUnitCost: foreign,
          entryUnit: lineEntryUnit,
          batchNumber: lineBatchNumber ?? null,
          productionDate: lineProductionDate ?? null,
          expiryDate: lineExpiryDate ?? null,
        });
        if (!result.ok) {
          if (snapshotRef.current) setInvoice(snapshotRef.current);
          toast.error(result.error);
          return;
        }
        if (cancelledTempIdsRef.current.has(optimisticId)) {
          cancelledTempIdsRef.current.delete(optimisticId);
          if (!result.data.id.startsWith("temp-")) {
            void removePurchaseLineAction(result.data.id);
          }
          return;
        }
        setInvoice((prev) => {
          if (!prev) return prev;
          const others = prev.lines.filter(
            (l) =>
              !(
                l.product_id === result.data.product_id &&
                (l.variant_id ?? null) === (result.data.variant_id ?? null)
              )
          );
          return {
            ...prev,
            ...withLineTotals([...others, result.data], prev.extra_cost),
          };
        });
      })();
    },
    [ensurePersistedDraft, productMap, pushUndo, importsEnabled, docCurrency, currency, fxRate, t]
  );

  const lookupBarcode = (code: string) => {
    const normalized = code.trim().toLowerCase();
    if (!normalized) return undefined;
    return products.find(
      (p) =>
        p.barcode?.toLowerCase() === normalized || p.sku?.toLowerCase() === normalized
    );
  };


  const allowZeroUnitCost =
    documentKind === "purchase_order" || documentKind === "purchase_request";
  const parsedLineDiscount = parseFloat(lineDiscount);
  const resolveAddUnitCost = (product: Product) => {
    if (unitCost.trim() === "") {
      return allowZeroUnitCost ? 0 : suggestedPurchaseEntryUnitCost(product, entryUnit);
    }
    if (Number.isFinite(parsedUnitCost) && parsedUnitCost >= 0) return parsedUnitCost;
    return allowZeroUnitCost ? 0 : suggestedPurchaseEntryUnitCost(product, entryUnit);
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = lookupBarcode(barcode);

    if (found) {
      if (selectedProductId === found.id) {
        addLine(
          found.id,
          Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1,
          resolveAddUnitCost(found),
          entryUnit,
          batchNumber || null,
          productionDate || null,
          expiryDate || calculatedExpiryDate || null,
          Number.isFinite(parsedLineDiscount) && parsedLineDiscount > 0 ? parsedLineDiscount : 0
        );
        return;
      }
      selectProduct(found);
      return;
    }

    if (selectedProductId) {
      const product = productMap.get(selectedProductId);
      if (!product) {
        toast.error(t("Product not found"));
        return;
      }
      addLine(
        selectedProductId,
        Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1,
        resolveAddUnitCost(product),
        entryUnit,
        batchNumber || null,
        productionDate || null,
        expiryDate || calculatedExpiryDate || null,
        Number.isFinite(parsedLineDiscount) && parsedLineDiscount > 0 ? parsedLineDiscount : 0
      );
      return;
    }

    const searchMatches = matchProducts(products, barcode);
    if (searchMatches.length === 1) {
      selectProduct(searchMatches[0]!);
      return;
    }
    if (searchMatches.length > 1) {
      selectProduct(searchMatches[Math.min(highlightIndex, searchMatches.length - 1)]!);
      return;
    }
    toast.error(t("Product not found"));
  };

  const handleReceive = () => {
    if (!invoice) return;
    const paid = parseFloat(amountPaidNow) || 0;
    if (paid < 0) {
      toast.error(t("Payment amount must be zero or more"));
      return;
    }
    if (paid > invoice.total) {
      toast.error(t("Payment amount cannot exceed invoice total"));
      return;
    }

    const invoiceId = invoice.id;
    const invoiceTotal = invoice.total;
    const paymentMethod = paid > 0 ? receivePaymentMethod : undefined;
    const mutationKey = backgroundMutationKey("purchase", "receive", invoiceId);

    setConfirmReceive(false);
    onComplete();

    runBackground({
      key: mutationKey,
      label: t("Receiving purchase invoice…"),
      execute: async () => {
        const result = await receivePurchaseAction(invoiceId, {
          amountPaid: paid,
          paymentMethod,
        });
        if (!result.ok) throw new Error(result.error);
        return result.data;
      },
      successMessage: (data) => {
        const remaining = Number((invoiceTotal - data.amountPaid).toFixed(2));
        return data.amountPaid > 0
          ? `${t("Received")} — ${t("Paid")} ${formatCurrency(data.amountPaid, currency)}، ${t("Remaining")} ${formatCurrency(remaining, currency)}`
          : t("Finalized. Inventory updated.");
      },
      onSuccess: (data) => {
        toast.message(t("You can create a price list from this invoice"), {
          action: {
            label: t("Price list"),
            onClick: () => {
              router.push(`/inventory/purchases/price-list?invoice=${data.id}`);
            },
          },
        });
        router.refresh();
      },
    });
  };

  const receiveRemaining = invoice
    ? Number((invoice.total - (parseFloat(amountPaidNow) || 0)).toFixed(2))
    : 0;

  const commitHeader = useCallback(() => {
    if (!invoice) return;
    const kind = invoice.document_kind ?? documentKind;
    const prOpen =
      kind === "purchase_request" &&
      (invoice.status === "draft" ||
        invoice.status === "submitted" ||
        invoice.status === "approved");
    if (invoice.status !== "draft" && !prOpen) return;
    const nextExtra = parseFloat(extraCost) || 0;
    const supplier = suppliers.find((s) => s.id === supplierId);
    const invoiceNumberTrimmed = invoiceNumber.trim();
    const notesTrimmed = documentNotes.trim();
    const warehouse = warehouses.find((w) => w.id === warehouseId);
    snapshotRef.current = invoice;

    if (isLocalDraftId(invoice.id)) {
      setInvoice({
        ...invoice,
        supplier_id: supplierId || null,
        warehouse_id: warehouseId || invoice.warehouse_id,
        invoice_number: invoiceNumberTrimmed || invoice.invoice_number,
        document_date: documentDate,
        document_notes: notesTrimmed,
        ...withLineTotals(invoice.lines, nextExtra),
        supplierName: supplier?.name ?? (supplierId ? invoice.supplierName : "No supplier"),
        warehouseName: warehouse?.name ?? invoice.warehouseName,
        supplierAddress: supplier?.address ?? null,
        supplierTaxId: supplier?.tax_id ?? null,
        supplierContact: supplier?.contact_info ?? null,
      });
      return;
    }

    setInvoice({
      ...invoice,
      supplier_id: supplierId || null,
      invoice_number: invoiceNumberTrimmed,
      document_date: documentDate,
      document_notes: notesTrimmed,
      ...withLineTotals(invoice.lines, nextExtra),
      supplierName: supplier?.name ?? (supplierId ? invoice.supplierName : "No supplier"),
    });

    void (async () => {
      const result = await updateDraftPurchaseAction({
        invoiceId: invoice.id,
        supplierId: supplierId || null,
        ...(invoice.status === "draft"
          ? {
              invoiceNumber: invoiceNumberTrimmed,
              extraCost: nextExtra,
              documentDate,
              documentNotes: notesTrimmed,
              ...(importsEnabled
                ? {
                    currency: docCurrency,
                    fxRate: parseFloat(fxRate) || 1,
                  }
                : {}),
            }
          : {}),
      });
      if (!result.ok) {
        if (snapshotRef.current) setInvoice(snapshotRef.current);
        toast.error(result.error);
        return;
      }
      setInvoice((prev) =>
        prev
          ? {
              ...prev,
              ...result.data,
              ...withLineTotals(prev.lines, nextExtra),
              supplierName: supplier?.name ?? prev.supplierName,
            }
          : prev
      );
    })();
  }, [
    invoice,
    extraCost,
    suppliers,
    supplierId,
    warehouseId,
    warehouses,
    invoiceNumber,
    documentDate,
    documentNotes,
    documentKind,
    importsEnabled,
    docCurrency,
    fxRate,
  ]);

  const updateLine = (
    lineId: string,
    qty: number,
    cost: number,
    nextBatchNumber?: string | null,
    nextProductionDate?: string | null,
    nextExpiryDate?: string | null,
    nextDiscountAmount?: number
  ) => {
    if (!invoice || qty <= 0 || cost < 0) return;
    if (lineId.startsWith("temp-")) return;

    const existing = invoice.lines.find((l) => l.id === lineId);
    const discountAmount = Math.max(
      0,
      nextDiscountAmount !== undefined
        ? nextDiscountAmount
        : (existing?.discount_amount ?? 0)
    );

    snapshotRef.current = invoice;
    const nextLines = invoice.lines.map((l) =>
      l.id === lineId
        ? {
            ...l,
            quantity: qty,
            unit_cost: cost,
            discount_amount: discountAmount,
            line_total: lineTotalAfterDiscount(qty, cost, discountAmount),
            batch_number: nextBatchNumber ?? null,
            production_date: nextProductionDate ?? null,
            expiry_date: nextExpiryDate ?? null,
          }
        : l
    );
    setInvoice({ ...invoice, ...withLineTotals(nextLines, invoice.extra_cost) });

    void (async () => {
      const result = await updatePurchaseLineAction({
        lineId,
        quantity: qty,
        unitCost: cost,
        discountAmount,
        batchNumber: nextBatchNumber ?? null,
        productionDate: nextProductionDate ?? null,
        expiryDate: nextExpiryDate ?? null,
      });
      if (!result.ok) {
        if (snapshotRef.current) setInvoice(snapshotRef.current);
        toast.error(result.error);
        return;
      }
      setInvoice((prev) => {
        if (!prev) return prev;
        const lines = prev.lines.map((l) => (l.id === lineId ? result.data : l));
        return { ...prev, ...withLineTotals(lines, prev.extra_cost) };
      });
    })();
  };

  const removeLine = (lineId: string) => {
    if (!invoice) return;
    const removed = invoice.lines.find((l) => l.id === lineId);
    snapshotRef.current = invoice;
    const nextLines = invoice.lines.filter((l) => l.id !== lineId);
    setInvoice({ ...invoice, ...withLineTotals(nextLines, invoice.extra_cost) });

    if (!isUndoingRef.current && removed) {
      const product = productMap.get(removed.product_id);
      const baseUnit = product?.base_unit ?? product?.unit ?? "piece";
      pushUndo({
        undo: () => {
          isUndoingRef.current = true;
          addLineForUndoRef.current(
            removed.product_id,
            removed.quantity,
            removed.unit_cost,
            baseUnit,
            removed.batch_number,
            removed.production_date,
            removed.expiry_date
          );
          isUndoingRef.current = false;
        },
      });
    }

    if (lineId.startsWith("temp-")) {
      cancelledTempIdsRef.current.add(lineId);
      return;
    }

    void (async () => {
      const result = await removePurchaseLineAction(lineId);
      if (!result.ok) {
        if (snapshotRef.current) setInvoice(snapshotRef.current);
        toast.error(result.error);
      }
    })();
  };

  useEffect(() => {
    removeLineRef.current = removeLine;
    updateLineRef.current = updateLine;
    addLineForUndoRef.current = addLine;
  });

  useOperatorShortcuts({
    enabled: invoice?.status === "draft",
    onSave: () => {
      if (!invoice || invoice.status !== "draft") return;
      void (async () => {
        if (isLocalDraftId(invoice.id)) {
          if (invoice.lines.length === 0) {
            onComplete();
            return;
          }
          const persisted = await ensurePersistedDraft();
          if (!persisted) return;
        }
        toast.success(t("Draft saved. Continue later from the list."));
        onComplete();
      })();
    },
    onDelete: () => {
      if (!invoice || invoice.status !== "draft" || invoice.lines.length === 0) return;
      const last = invoice.lines[invoice.lines.length - 1];
      if (last) removeLine(last.id);
    },
    onUndo: () => {
      if (!undoLast()) toast.message(t("Nothing to undo"));
    },
  });

  const handleDeleteDraft = async () => {
    if (!invoice) return;
    if (isLocalDraftId(invoice.id)) {
      clearUndo();
      onComplete();
      return;
    }
    const result = await deleteDraftPurchaseAction(invoice.id);
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    clearUndo();
    toast.success(t("Purchase invoice deleted"));
    onComplete();
  };

  const handleVoid = async () => {
    if (!invoice) return;
    const result = await voidPurchaseAction(invoice.id);
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    setInvoice(result.data);
    setSupplierId(result.data.supplier_id ?? "");
    setWarehouseId(result.data.warehouse_id);
    setInvoiceNumber(result.data.invoice_number);
    setExtraCost(
      result.data.extra_cost > 0 ? String(result.data.extra_cost) : ""
    );
    toast.success(t("Receipt reversed. The document is a draft again."));
  };

  if (loading && !invoice) {
    return <LoadingStateBlock label={t("Loading purchase invoice…")} />;
  }

  const subtotal = invoice?.lines.reduce((s, l) => s + l.line_total, 0) ?? 0;
  const isDraft = invoice?.status === "draft";
  const isReceived = invoice?.status === "received";
  const kind = invoice?.document_kind ?? documentKind;
  const isPurchaseInvoice = kind === "purchase_invoice";
  const isPurchaseRequest = kind === "purchase_request";
  const isPurchaseOrder = kind === "purchase_order";
  const isPurchaseReturn = kind === "purchase_return";
  const canEditSupplier =
    isDraft ||
    (isPurchaseRequest &&
      (invoice?.status === "submitted" || invoice?.status === "approved"));
  const kindTitle =
    COMMERCIAL_DOCUMENT_KIND_LABELS[
      (kind ?? "purchase_invoice") as keyof typeof COMMERCIAL_DOCUMENT_KIND_LABELS
    ] ?? "Purchase document";
  const statusLabels: Record<string, string> = {
    draft: "Draft",
    received: "Received",
    cancelled: "Cancelled",
    submitted: "Submitted",
    approved: "Approved",
    rejected: "Rejected",
    sent: "Sent",
    partial_invoiced: "Partially invoiced",
    invoiced: "Invoiced",
    posted: "Posted",
  };

  const openImportPurchaseOrders = async () => {
    if (!invoice || !isDraft || !isPurchaseInvoice) return;
    let target = invoice;
    if (isLocalDraftId(target.id)) {
      const persisted = await ensurePersistedDraft();
      if (!persisted) return;
      target = persisted;
    }
    setImportLoading(true);
    setImportOpen(true);
    setSelectedImportIds([]);
    const result = await listImportablePurchaseOrdersAction({
      supplierId: target.supplier_id,
      warehouseId: target.warehouse_id,
    });
    setImportLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      setImportOpen(false);
      return;
    }
    setImportableOrders(result.data);
  };

  const zeroCostLineCount =
    invoice?.lines.filter((line) => line.unit_cost === 0).length ?? 0;

  if (!invoice) {
    return (
      <EmptyStateBlock
        title={t("No warehouse or supplier is ready")}
        description={
          documentKind === "purchase_request"
            ? t("Check warehouses in store settings.")
            : t("Add a supplier and warehouse before creating an invoice.")
        }
        action={
          <CompactAction label={t("Back")} icon={X} onClick={onComplete} />
        }
      />
    );
  }

  const isLocalDraft = isLocalDraftId(invoice.id);

  const renderLineEditor = (line: PurchaseInvoiceLine) => {
    const lineProduct = productMap.get(line.product_id);
    const unit = lineProduct ? formatUnit(lineProduct.base_unit ?? lineProduct.unit) : "";
    const packHint =
      lineProduct && productHasPurchasePacking(lineProduct)
        ? ` · ${productPurchaseFactor(lineProduct)}/${formatUnit(lineProduct.cost_unit)}`
        : "";

    return (
      <div
        key={line.id}
        className="rounded-xl border border-border/60 bg-card p-3 shadow-sm"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium leading-snug">{lineProduct?.name ?? line.product_id}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {unit}
              {packHint}
            </p>
          </div>
          {isDraft ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 text-destructive"
              onClick={() => removeLine(line.id)}
              aria-label={t("Delete line")}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{t("Quantity")}</Label>
            {isDraft ? (
              <DraftDecimalInput
                className="min-h-11"
                value={line.quantity}
                emptyFallback={1}
                onCommit={(qty) =>
                                  updateLine(
                                    line.id,
                                    qty,
                                    line.unit_cost,
                                    line.batch_number ?? null,
                                    line.production_date ?? null,
                                    line.expiry_date ?? null,
                                    line.discount_amount ?? 0
                                  )
                }
              />
            ) : (
              <p className="min-h-11 content-center text-sm">
                {line.quantity}
                {unit ? ` ${unit}` : ""}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("Cost")}</Label>
            {isDraft ? (
              <DraftDecimalInput
                className="min-h-11"
                value={line.unit_cost}
                emptyFallback={0}
                onCommit={(cost) =>
                  updateLine(
                    line.id,
                    line.quantity,
                    cost,
                    line.batch_number ?? null,
                    line.production_date ?? null,
                    line.expiry_date ?? null,
                    line.discount_amount ?? 0
                  )
                }
              />
            ) : (
              <p className="min-h-11 content-center text-sm">
                {formatCurrency(line.unit_cost, currency)}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("Line discount")}</Label>
            {isDraft ? (
              <DraftDecimalInput
                className="min-h-11"
                value={line.discount_amount ?? 0}
                emptyFallback={0}
                onCommit={(discount) =>
                  updateLine(
                    line.id,
                    line.quantity,
                    line.unit_cost,
                    line.batch_number ?? null,
                    line.production_date ?? null,
                    line.expiry_date ?? null,
                    discount
                  )
                }
              />
            ) : (
              <p className="min-h-11 content-center text-sm">
                {formatCurrency(line.discount_amount ?? 0, currency)}
              </p>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("Total")}</span>
          <span className="font-semibold">
            {formatCurrency(line.landed_line_total ?? line.line_total, currency)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 pb-16 lg:pb-12">
      <OperationalCard
        accent="var(--mds-color-action-primary)"
        title={`${t(kindTitle)} ${t(invoice.invoice_number)}`}
        description={
          isDraft
            ? isLocalDraft
              ? t("Choose the supplier and warehouse. The draft saves when you add an item or save.")
              : t("Draft — all invoice details are shown here")
            : `${t("Status")}: ${t(statusLabels[invoice.status] ?? invoice.status)}`
        }
      >
        <div className="flex flex-col gap-3">
          {isDraft ? (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground sm:text-sm">
              {t("Draft saved. Inventory has not been updated yet.")}
            </p>
          ) : null}

          <DocumentHeaderGrid className="lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t("Supplier")}{isPurchaseRequest ? ` ${t("(optional before conversion)")}` : ""}</Label>
              {canEditSupplier ? (
                <Select
                  value={supplierId || (isPurchaseRequest ? "__none__" : "")}
                  onValueChange={(v) => {
                    setSupplierId(!v || v === "__none__" ? "" : v);
                    window.setTimeout(() => commitHeader(), 0);
                  }}
                >
                  <SelectTrigger className="min-h-11 w-full">
                    <SelectValue>
                      {(value) =>
                        value === "__none__" || !value
                          ? t("No supplier")
                          : selectLabelById(suppliers, value, (s) => s.name)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {isPurchaseRequest ? (
                      <SelectItem value="__none__" label={t("No supplier")}>
                        {t("No supplier")}
                      </SelectItem>
                    ) : null}
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id} label={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="min-h-11 content-center text-sm font-medium">
                  {t(invoice.supplierName || "No supplier")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t("Warehouse")}</Label>
              {isDraft && isLocalDraft ? (
                <Select
                  value={warehouseId}
                  onValueChange={(v) => {
                    const next = v ?? "";
                    setWarehouseId(next);
                    const warehouse = warehouses.find((w) => w.id === next);
                    setInvoice((prev) =>
                      prev
                        ? {
                            ...prev,
                            warehouse_id: next,
                            warehouseName: warehouse?.name ?? prev.warehouseName,
                          }
                        : prev
                    );
                  }}
                >
                  <SelectTrigger className="min-h-11 w-full">
                    <SelectValue>
                      {(value) => selectLabelById(warehouses, value, (w) => w.name)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id} label={w.name}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : isDraft ? (
                <Select value={warehouseId} disabled>
                  <SelectTrigger className="min-h-11 w-full">
                    <SelectValue>
                      {(value) => selectLabelById(warehouses, value, (w) => w.name)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id} label={w.name}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="min-h-11 content-center text-sm font-medium">
                  {invoice.warehouseName}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t("Invoice number")}</Label>
              {isDraft ? (
                <Input
                  className="min-h-11"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  onBlur={commitHeader}
                />
              ) : (
                <p className="min-h-11 content-center text-sm font-medium tabular-nums">
                  {invoice.invoice_number}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t("Invoice date")}</Label>
              {isDraft ? (
                <Input
                  className="min-h-11"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  onBlur={commitHeader}
                />
              ) : (
                <p className="min-h-11 content-center text-sm font-medium tabular-nums">
                  {invoice.document_date}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t("Additional cost")}</Label>
              {isDraft ? (
                <Input
                  className="min-h-11"
                  type="text"
                  inputMode="decimal"
                  value={extraCost}
                  onChange={(e) => setExtraCost(sanitizeDecimalInput(e.target.value))}
                  onBlur={commitHeader}
                  placeholder="0"
                />
              ) : (
                <p className="min-h-11 content-center text-sm font-medium tabular-nums">
                  {formatCurrency(invoice.extra_cost, currency)}
                </p>
              )}
              {importsEnabled ? (
                <p className="text-xs text-muted-foreground">{EXTRA_COST_INVOICE_HINT}</p>
              ) : null}
            </div>
            {importsEnabled ? (
              <>
                <div className="space-y-1.5">
                  <Label>{t("Document currency")}</Label>
                  {isDraft ? (
                    <Select
                      value={docCurrency}
                      onValueChange={(v) => {
                        setDocCurrency(v ?? currency);
                        setTimeout(() => commitHeader(), 0);
                      }}
                    >
                      <SelectTrigger className="min-h-11 w-full">
                        <SelectValue>{() => docCurrency}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {["EGP", "USD", "EUR"].map((code) => (
                          <SelectItem key={code} value={code} label={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="min-h-11 content-center text-sm font-medium">{docCurrency}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("Exchange rate")} → {currency}</Label>
                  {isDraft ? (
                    <Input
                      className="min-h-11"
                      type="text"
                      inputMode="decimal"
                      value={fxRate}
                      onChange={(e) => setFxRate(sanitizeDecimalInput(e.target.value))}
                      onBlur={commitHeader}
                      disabled={docCurrency === currency}
                    />
                  ) : (
                    <p className="min-h-11 content-center text-sm font-medium tabular-nums">
                      {fxRate}
                    </p>
                  )}
                </div>
              </>
            ) : null}
            <div className="space-y-1.5">
              <Label>{t("Total")} ({currency})</Label>
              <p className="min-h-11 content-center text-base font-semibold tabular-nums">
                {formatCurrency(invoice.total || subtotal, currency)}
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("Document notes")}</Label>
              {isDraft ? (
                <Textarea
                  className="min-h-16"
                  value={documentNotes}
                  onChange={(e) => setDocumentNotes(e.target.value)}
                  onBlur={commitHeader}
                />
              ) : (
                <p className="min-h-11 content-center whitespace-pre-wrap text-sm">
                  {invoice.document_notes || "—"}
                </p>
              )}
            </div>
          </DocumentHeaderGrid>

          {isDraft && isPurchaseInvoice && zeroCostLineCount > 0 ? (
            <p className="rounded-[var(--mds-radius-lg)] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              {zeroCostLineCount} {t("lines have no cost. Set invoice prices before receiving.")}
            </p>
          ) : null}

          {isDraft ? (
            <DocumentLineComposer
              hint={t("Scan a barcode or search for a product, then enter quantity and cost")}
            >
            <form
              onSubmit={handleBarcodeSubmit}
              className={
                selectedHasPacking
                  ? "grid grid-cols-1 gap-3 sm:grid-cols-[minmax(14rem,1fr)_7rem_5.5rem_6.5rem_5.5rem_auto] sm:items-end"
                  : "grid grid-cols-1 gap-3 sm:grid-cols-[minmax(14rem,1fr)_5.5rem_6.5rem_5.5rem_auto] sm:items-end"
              }
            >
              <ProductSearchCombobox
                products={products}
                value={barcode}
                onChange={(value) => {
                  setBarcode(value);
                  setHighlightIndex(0);
                  if (selectedProductId) {
                    const selected = productMap.get(selectedProductId);
                    if (selected && value !== selected.name) {
                      setSelectedProductId("");
                    }
                  }
                }}
                onSelect={selectProduct}
                onHighlightChange={setHighlightIndex}
                selectedProductId={selectedProductId}
                currency={currency}
                inputRef={productSearchRef}
                className="min-h-11"
              />
              {selectedHasPacking ? (
                <div>
                  <Label className="mb-1.5 text-xs text-muted-foreground">{t("Unit")}</Label>
                  <Select
                    value={entryUnit}
                    onValueChange={(v) =>
                      setEntryUnit((v as MeasurementUnit) ?? selectedBaseUnit)
                    }
                  >
                    <SelectTrigger className="min-h-11 w-full">
                      <SelectValue>{() => formatUnit(entryUnit)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={selectedBaseUnit} label={formatUnit(selectedBaseUnit)}>
                        {formatUnit(selectedBaseUnit)}
                      </SelectItem>
                      <SelectItem
                        value={selectedPurchaseUnit}
                        label={formatUnit(selectedPurchaseUnit)}
                      >
                        {formatUnit(selectedPurchaseUnit)} ({selectedFactor}{" "}
                        {formatUnit(selectedBaseUnit)})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div>
                <Label
                  htmlFor="purchase-line-quantity"
                  className="mb-1.5 text-xs text-muted-foreground"
                >
                  {t("Quantity")}
                  {selectedProduct
                    ? ` (${formatUnit(selectedHasPacking ? entryUnit : selectedBaseUnit)})`
                    : ""}
                </Label>
                <Input
                  id="purchase-line-quantity"
                  ref={qtyRef}
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  className="min-h-11 tabular-nums"
                  value={quantity}
                  onChange={(e) => setQuantity(sanitizeDecimalInput(e.target.value))}
                  placeholder="1"
                />
              </div>
              <div>
                <Label
                  htmlFor="purchase-line-cost"
                  className="mb-1.5 text-xs text-muted-foreground"
                >
                  {allowZeroUnitCost ? t("Cost (optional)") : t("Cost")}
                  {importsEnabled && docCurrency !== currency
                    ? ` (${docCurrency})`
                    : ""}
                  {selectedProduct
                    ? ` / ${formatUnit(selectedHasPacking ? entryUnit : selectedBaseUnit)}`
                    : ""}
                </Label>
                <Input
                  id="purchase-line-cost"
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  className="min-h-11 tabular-nums"
                  value={unitCost}
                  onChange={(e) => setUnitCost(sanitizeDecimalInput(e.target.value))}
                  placeholder={
                    allowZeroUnitCost
                      ? t("No price")
                      : suggestedEntryCost > 0
                        ? String(suggestedEntryCost)
                        : t("Last cost")
                  }
                />
              </div>
              <div>
                <Label
                  htmlFor="purchase-line-discount"
                  className="mb-1.5 text-xs text-muted-foreground"
                >
                  {t("Line discount")}
                </Label>
                <Input
                  id="purchase-line-discount"
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  className="min-h-11 tabular-nums"
                  value={lineDiscount}
                  onChange={(e) => setLineDiscount(sanitizeDecimalInput(e.target.value))}
                  placeholder="0"
                />
              </div>
              <div className="flex items-end">
                <CompactAction
                  label={t("Add")}
                  icon={Plus}
                  variant="default"
                  type="submit"
                  disabled={!selectedProductId && !barcode.trim()}
                />
              </div>
            </form>
            {entryPreview ? (
              <p className="text-xs text-muted-foreground">
                {t("Inventory conversion")}: {entryPreview.quantity} {formatUnit(selectedBaseUnit)} ×{" "}
                {formatCurrency(entryPreview.unitCost, currency)} ={" "}
                {formatCurrency(entryPreview.lineTotal, currency)}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>{t("Batch number")}</Label>
                <Input
                  className="min-h-11"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder={t("Optional")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Production date")}</Label>
                <Input
                  className="min-h-11"
                  type="date"
                  value={productionDate}
                  onChange={(e) => setProductionDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Expiry date")}</Label>
                <Input
                  className="min-h-11"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Calculated expiry")}</Label>
                <Input
                  className="min-h-11"
                  value={calculatedExpiryDate ?? "-"}
                  readOnly
                />
              </div>
            </div>
            </DocumentLineComposer>
          ) : null}

          <DocumentLinesSection
            count={invoice.lines.length}
            total={invoice.lines.length > 0 ? formatCurrency(invoice.total || subtotal, currency) : null}
          >

            {invoice.lines.length === 0 ? (
              <EmptyStateBlock
                title={t("No items on this invoice")}
                description={
                  isDraft
                    ? t("Scan a barcode or choose a product above to add a line.")
                    : t("This invoice has no lines.")
                }
              />
            ) : (
              <>
                <div className="grid gap-3 md:hidden">
                  {invoice.lines.map((line) => renderLineEditor(line))}
                </div>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Product")}</TableHead>
                        <TableHead className="text-right">{t("Quantity")}</TableHead>
                        <TableHead className="text-right">{t("Unit cost")}</TableHead>
                        <TableHead className="text-right">{t("Discount")}</TableHead>
                        {!isDraft && <TableHead className="text-right">{t("After additional costs")}</TableHead>}
                        <TableHead className="text-right">{t("Total")}</TableHead>
                        {isDraft && <TableHead />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.lines.map((line) => {
                        const lineProduct = productMap.get(line.product_id);
                        const unit = lineProduct
                          ? formatUnit(lineProduct.base_unit ?? lineProduct.unit)
                          : "";
                        return (
                          <TableRow key={line.id}>
                            <TableCell>{lineProduct?.name ?? line.product_id}</TableCell>
                            <TableCell className="text-right">
                              {isDraft ? (
                                <DraftDecimalInput
                                  className="ml-auto w-24"
                                  value={line.quantity}
                                  emptyFallback={1}
                                  onCommit={(qty) =>
                                    updateLine(
                                      line.id,
                                      qty,
                                      line.unit_cost,
                                      line.batch_number ?? null,
                                      line.production_date ?? null,
                                      line.expiry_date ?? null,
                                      line.discount_amount ?? 0
                                    )
                                  }
                                />
                              ) : (
                                <span>
                                  {line.quantity}
                                  {unit ? ` ${unit}` : ""}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isDraft ? (
                                <DraftDecimalInput
                                  className="ml-auto w-28"
                                  value={line.unit_cost}
                                  emptyFallback={0}
                                  onCommit={(cost) =>
                                    updateLine(
                                      line.id,
                                      line.quantity,
                                      cost,
                                      line.batch_number ?? null,
                                      line.production_date ?? null,
                                      line.expiry_date ?? null,
                                      line.discount_amount ?? 0
                                    )
                                  }
                                />
                              ) : (
                                formatCurrency(line.unit_cost, currency)
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isDraft ? (
                                <DraftDecimalInput
                                  className="ml-auto w-24"
                                  value={line.discount_amount ?? 0}
                                  emptyFallback={0}
                                  onCommit={(discount) =>
                                    updateLine(
                                      line.id,
                                      line.quantity,
                                      line.unit_cost,
                                      line.batch_number ?? null,
                                      line.production_date ?? null,
                                      line.expiry_date ?? null,
                                      discount
                                    )
                                  }
                                />
                              ) : (
                                formatCurrency(line.discount_amount ?? 0, currency)
                              )}
                            </TableCell>
                            {!isDraft && (
                              <TableCell className="text-right">
                                {formatCurrency(line.landed_unit_cost ?? line.unit_cost, currency)}
                              </TableCell>
                            )}
                            <TableCell className="text-right font-medium">
                              {formatCurrency(line.landed_line_total ?? line.line_total, currency)}
                            </TableCell>
                            {isDraft && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => removeLine(line.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </DocumentLinesSection>

          {importsEnabled &&
          documentKind === "purchase_order" &&
          invoice &&
          !isLocalDraftId(invoice.id) ? (
            <div className="space-y-3 border-t border-border/60 pt-4">
              <h3 className="text-sm font-semibold">{t("Containers")}</h3>
              {containersLoaded && poContainers.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {poContainers.map((c) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <span className="tabular-nums">{c.container_number}</span>
                      <span className="text-muted-foreground">{c.status}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("No containers on this order yet")}
                </p>
              )}
              <CreateContainerInline
                purchaseOrderId={invoice.id}
                lines={invoice.lines.map((line) => {
                  const used = poContainers
                    .filter((c) => c.status !== "cancelled")
                    .flatMap((c) => c.lines)
                    .filter((l) => l.source_line_id === line.id)
                    .reduce((s, l) => s + l.quantity, 0);
                  return {
                    sourceLineId: line.id,
                    productName: productMap.get(line.product_id)?.name ?? line.product_id,
                    remaining: Math.max(0, line.quantity - used),
                  };
                })}
                onCreated={(container) =>
                  setPoContainers((prev) => [container, ...prev])
                }
              />
            </div>
          ) : null}
        </div>
      </OperationalCard>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-border/60 bg-background/95 px-3 py-2.5 backdrop-blur-xl lg:bottom-0 lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:ps-64 lg:pt-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="min-w-0 shrink">
            <p className="text-xs text-muted-foreground sm:text-sm">{invoice.lines.length} {t("lines")}</p>
            <p className="truncate text-lg font-semibold tabular-nums sm:text-2xl">
              {formatCurrency(invoice.total || subtotal, currency)}
            </p>
            {isDraft ? <OperatorShortcutHint className="mt-0.5" /> : null}
          </div>
          <CompactActions>
            <CompactAction
              label={
                invoice.status === "cancelled"
                  ? t("Back")
                  : isDraft
                    ? t("Save draft")
                    : t("Close")
              }
              icon={isDraft ? Save : X}
              shortcut={isDraft ? OPERATOR_SHORTCUTS.save : undefined}
              onClick={() => {
                if (!isDraft) {
                  onComplete();
                  return;
                }
                void (async () => {
                  if (isLocalDraft) {
                    if (invoice.lines.length === 0) {
                      onComplete();
                      return;
                    }
                    const persisted = await ensurePersistedDraft();
                    if (!persisted) return;
                  }
                  toast.success(t("Draft saved. Continue later from the list."));
                  onComplete();
                })();
              }}
            />
            {isDraft ? (
              <>
                <CompactAction
                  label={t("Delete")}
                  icon={Trash2}
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                />
                {isPurchaseInvoice ? (
                <>
                <CompactAction
                  label={t("Import purchase order")}
                  icon={FileText}
                  disabled={pending}
                  onClick={() => {
                    void openImportPurchaseOrders();
                  }}
                />
                <CompactAction
                  label={t("Finalize and update inventory")}
                  icon={PackageCheck}
                  variant="default"
                  disabled={invoice.lines.length === 0}
                  onClick={() => {
                    setAmountPaidNow("0");
                    setReceivePaymentMethod("cash");
                    setConfirmReceive(true);
                  }}
                />
                </>
                ) : null}
                {isPurchaseRequest ? (
                <CompactAction
                  label={t("Submit request")}
                  icon={Send}
                  variant="default"
                  disabled={invoice.lines.length === 0}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await transitionPurchaseDocumentAction({
                        invoiceId: invoice.id,
                        from: "draft",
                        to: "submitted",
                      });
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      setInvoice(result.data);
                      toast.success(t("Purchase request submitted"));
                    });
                  }}
                />
                ) : null}
                {isPurchaseOrder ? (
                <CompactAction
                  label={t("Send purchase order")}
                  icon={Send}
                  variant="default"
                  disabled={invoice.lines.length === 0 || !invoice.supplier_id}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await transitionPurchaseDocumentAction({
                        invoiceId: invoice.id,
                        from: "draft",
                        to: "sent",
                      });
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      setInvoice(result.data);
                      toast.success(t("Purchase order sent"));
                    });
                  }}
                />
                ) : null}
                {isPurchaseReturn ? (
                <CompactAction
                  label={t("Post return")}
                  icon={PackageCheck}
                  variant="default"
                  disabled={invoice.lines.length === 0}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await postPurchaseReturnAction(invoice.id);
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      setInvoice(result.data);
                      toast.success(t("Return posted. Inventory and supplier balance were updated."));
                    });
                  }}
                />
                ) : null}
              </>
            ) : null}
            {isPurchaseRequest && invoice.status === "submitted" ? (
              <>
                <CompactAction
                  label={t("Approve")}
                  icon={PackageCheck}
                  variant="default"
                  onClick={() => {
                    startTransition(async () => {
                      const result = await transitionPurchaseDocumentAction({
                        invoiceId: invoice.id,
                        from: "submitted",
                        to: "approved",
                      });
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      setInvoice(result.data);
                      toast.success(t("Request approved"));
                    });
                  }}
                />
                <CompactAction
                  label={t("Reject")}
                  icon={Trash2}
                  variant="destructive"
                  onClick={() => {
                    startTransition(async () => {
                      const result = await transitionPurchaseDocumentAction({
                        invoiceId: invoice.id,
                        from: "submitted",
                        to: "rejected",
                      });
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      setInvoice(result.data);
                      toast.success(t("Request rejected"));
                    });
                  }}
                />
              </>
            ) : null}
            {isPurchaseRequest && invoice.status === "approved" ? (
              <CompactAction
                label={t("Convert to purchase order")}
                icon={FileText}
                variant="default"
                disabled={!invoice.supplier_id}
                onClick={() => {
                  startTransition(async () => {
                    const result = await convertPurchaseDocumentAction({
                      sourceId: invoice.id,
                      targetKind: "purchase_order",
                      fromStatus: "approved",
                      lockStatus: "invoiced",
                    });
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success(t("Purchase order created from request"));
                    router.push(`/inventory/purchase-orders?invoice=${result.data.id}`);
                  });
                }}
              />
            ) : null}
            {isPurchaseOrder &&
            (invoice.status === "sent" || invoice.status === "partial_invoiced") ? (
              <CompactAction
                label={t("Partial receipt / purchase invoice")}
                icon={FileText}
                variant="default"
                onClick={() => {
                  startTransition(async () => {
                    const result = await previewPurchaseConvertAction(invoice.id);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    setConvertRows(
                      result.data
                        .filter((row) => row.remaining > 0)
                        .map((row) => ({
                          sourceLineId: row.sourceLineId,
                          productId: row.productId,
                          remaining: row.remaining,
                          qty: String(row.remaining),
                        }))
                    );
                    setConvertOpen(true);
                  });
                }}
              />
            ) : null}
            {invoice.lines.length > 0 ? (
              <>
                <CompactAction
                  label={t("Print A4")}
                  icon={FileText}
                  onClick={() =>
                    setPrintPreview({
                      href: `/print/purchases/${invoice.id}?embed=1&lang=${language}`,
                      title:
                        COMMERCIAL_DOCUMENT_KIND_LABELS[
                          kind === "purchase_request" ||
                          kind === "purchase_order" ||
                          kind === "purchase_invoice" ||
                          kind === "purchase_return"
                            ? kind
                            : "purchase_invoice"
                        ],
                    })
                  }
                />
                {isPurchaseOrder || isPurchaseRequest ? (
                  <CompactAction
                    label={t("Print without prices")}
                    icon={FileText}
                    onClick={() =>
                      setPrintPreview({
                        href: `/print/purchases/${invoice.id}?embed=1&hidePrices=1&lang=${language}`,
                        title: `${t(kindTitle)} ${t("without prices")}`,
                      })
                    }
                  />
                ) : null}
                {isPurchaseInvoice ? (
                <CompactAction
                  label={t("Receipt")}
                  icon={Receipt}
                  className="border-primary text-primary"
                  onClick={() =>
                    setPrintPreview({
                      href: `/print/purchases/${invoice.id}/receipt?embed=1&lang=${language}`,
                      title: isDraft ? t("Draft purchase receipt") : t("Purchase receipt"),
                    })
                  }
                />
                ) : null}
                <CompactAction
                  label={t("WhatsApp")}
                  icon={MessageCircle}
                  disabled={!invoice.supplierContact}
                  onClick={() => {
                    const url = buildWhatsAppDocumentUrl(
                      invoice.supplierContact,
                      formatCommercialDocumentForWhatsApp({
                        title:
                          COMMERCIAL_DOCUMENT_KIND_LABELS[
                            kind === "purchase_request" ||
                            kind === "purchase_order" ||
                            kind === "purchase_invoice" ||
                            kind === "purchase_return"
                              ? kind
                              : "purchase_invoice"
                          ],
                        number: invoice.invoice_number,
                        partyName: invoice.supplierName,
                        total: invoice.total,
                        currency,
                        lines: invoice.lines.map((line) => ({
                          name: products.find((p) => p.id === line.product_id)?.name ?? t("Item"),
                          quantity: line.quantity,
                          lineTotal: line.line_total,
                        })),
                      })
                    );
                    if (!url) {
                      toast.error(t("Supplier phone number is not valid for WhatsApp"));
                      return;
                    }
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                />
              </>
            ) : null}
            {isReceived && isPurchaseInvoice ? (
              <>
                <CompactAction
                  label={t("Purchase return")}
                  icon={Undo2}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await convertPurchaseDocumentAction({
                        sourceId: invoice.id,
                        targetKind: "purchase_return",
                        fromStatus: "received",
                      });
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success(t("Purchase return created from invoice"));
                      router.push(`/inventory/purchase-returns?invoice=${result.data.id}`);
                    });
                  }}
                />
                <CompactAction
                  label={t("Create sales price list")}
                  icon={Tags}
                  variant="default"
                  href={`/inventory/purchases/price-list?invoice=${invoice.id}`}
                />
                <CompactAction
                  label={t("Reverse receipt")}
                  icon={Undo2}
                  onClick={() => setConfirmVoid(true)}
                />
              </>
            ) : null}
          </CompactActions>
        </div>
      </div>

      <DocumentPrintPreviewModal
        open={Boolean(printPreview)}
        onOpenChange={(open) => {
          if (!open) setPrintPreview(null);
        }}
        href={printPreview?.href ?? null}
        title={printPreview?.title}
      />

      <ConfirmActionDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("Delete purchase draft?")}
        description={t("The invoice and its lines will be deleted permanently. Inventory has not been updated.")}
        confirmLabel={t("Delete")}
        destructive
        onConfirm={handleDeleteDraft}
      />

      <Dialog open={confirmReceive} onOpenChange={setConfirmReceive}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Finalize and update inventory?")}</DialogTitle>
            <DialogDescription>
              {t("The invoice will be confirmed and inventory will receive")} {invoice?.lines.length ?? 0} {t("lines")}.
              {t("Total")} {invoice ? formatCurrency(invoice.total, currency) : "—"}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>{t("Paid now (optional)")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amountPaidNow}
                onChange={(e) => setAmountPaidNow(sanitizeDecimalInput(e.target.value))}
              />
            </div>
            <div className="rounded-[var(--mds-radius-lg)] bg-muted/50 px-3 py-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">{t("Invoice total")}</span>
                <span className="tabular-nums font-medium">
                  {invoice ? formatCurrency(invoice.total, currency) : "—"}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-2">
                <span className="text-muted-foreground">{t("Remaining to supplier")}</span>
                <span className="tabular-nums font-medium">
                  {formatCurrency(Math.max(0, receiveRemaining), currency)}
                </span>
              </div>
            </div>
            {(parseFloat(amountPaidNow) || 0) > 0 ? (
              <div className="space-y-2">
                <Label>{t("Payment method")}</Label>
                <Select
                  value={receivePaymentMethod}
                  onValueChange={(v) => setReceivePaymentMethod(v as PaymentMethod)}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value) => (value ? t(String(value)) : null)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.filter((m) => m !== "credit").map((m) => (
                      <SelectItem key={m} value={m} label={t(m)}>
                        {t(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReceive(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleReceive}>{t("Confirm and update inventory")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={confirmVoid}
        onOpenChange={setConfirmVoid}
        title={t("Reverse receipt?")}
        description={t("Inventory quantities will be reversed and the invoice will return to draft. Owner or manager access is required.")}
        confirmLabel={t("Reverse to draft")}
        destructive
        onConfirm={handleVoid}
      />

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Partial receipt from purchase order")}</DialogTitle>
            <DialogDescription>
              {t("Choose the quantity to convert to a purchase invoice. The remainder stays on the order.")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[50dvh] gap-3 overflow-y-auto">
            {convertRows.map((row) => (
              <div key={row.sourceLineId} className="grid grid-cols-[1fr_7rem] items-end gap-2">
                <div className="space-y-1">
                  <Label>
                    {products.find((p) => p.id === row.productId)?.name ?? t("Item")}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t("Remaining")} {row.remaining}</p>
                </div>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={row.qty}
                  onChange={(e) => {
                    const next = sanitizeDecimalInput(e.target.value);
                    setConvertRows((current) =>
                      current.map((line) =>
                        line.sourceLineId === row.sourceLineId ? { ...line, qty: next } : line
                      )
                    );
                  }}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConvertOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button
              type="button"
              disabled={pending || convertRows.length === 0}
              onClick={() => {
                if (!invoice) return;
                const lines = convertRows
                  .map((row) => ({
                    sourceLineId: row.sourceLineId,
                    quantity: Number(row.qty) || 0,
                  }))
                  .filter((row) => row.quantity > 0);
                if (lines.length === 0) {
                  toast.error(t("Choose at least one quantity"));
                  return;
                }
                startTransition(async () => {
                  const result = await convertPurchaseDocumentAction({
                    sourceId: invoice.id,
                    targetKind: "purchase_invoice",
                    fromStatus: invoice.status,
                    lockStatus: "partial_invoiced",
                    lines,
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  setConvertOpen(false);
                  toast.success(t("Purchase invoice created from purchase order"));
                  router.push(`/inventory/purchases?invoice=${result.data.id}`);
                });
              }}
            >
              {t("Create purchase invoice")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) {
            setImportableOrders([]);
            setSelectedImportIds([]);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Import purchase orders")}</DialogTitle>
            <DialogDescription>
              {t("Choose sent or partially invoiced orders for the same supplier and warehouse.")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[50dvh] gap-2 overflow-y-auto">
            {importLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("Loading…")}</p>
            ) : importableOrders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("No purchase orders available to import")}
              </p>
            ) : (
              importableOrders.map((order) => {
                const selected = selectedImportIds.includes(order.id);
                return (
                  <button
                    key={order.id}
                    type="button"
                    className={`rounded-[var(--mds-radius-lg)] border px-3 py-2 text-start transition-colors ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border/60 hover:bg-muted/40"
                    }`}
                    onClick={() => {
                      setSelectedImportIds((current) =>
                        selected
                          ? current.filter((id) => id !== order.id)
                          : [...current, order.id]
                      );
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{order.invoice_number}</span>
                      <span className="text-xs text-muted-foreground">
                        {t(statusLabels[order.status] ?? order.status)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {order.remainingLines} {t("remaining lines")} · {t("Quantity")} {order.remainingQty}
                      {order.supplierName ? ` · ${order.supplierName}` : ""}
                    </p>
                  </button>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button
              type="button"
              disabled={pending || importLoading || selectedImportIds.length === 0}
              onClick={() => {
                if (!invoice) return;
                startTransition(async () => {
                  let targetId = invoice.id;
                  if (isLocalDraftId(targetId)) {
                    const persisted = await ensurePersistedDraft();
                    if (!persisted) return;
                    targetId = persisted.id;
                  }
                  const result = await importPurchaseOrdersIntoInvoiceAction({
                    invoiceId: targetId,
                    sourceIds: selectedImportIds,
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  setInvoice(result.data);
                  setImportOpen(false);
                  toast.success(t("Purchase order lines imported. Adjust prices if needed."));
                });
              }}
            >
              {t("Import lines")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
