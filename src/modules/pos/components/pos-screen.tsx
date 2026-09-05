"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Archive,
  Banknote,
  CircleStop,
  CircleUserRound,
  Clock3,
  ClipboardList,
  History,
  ImageIcon,
  ImageOff,
  Loader2,
  Menu,
  Plus,
  ReceiptText,
  ScanBarcode,
  Search,
  ShoppingCart,
  Truck,
  Wallet,
  X,
} from "lucide-react";

const POS_PRODUCT_IMAGES_PREF_KEY = "velora:pos:product-images:v1";
import {
  backgroundMutationKey,
  useBackgroundMutation,
} from "@/hooks/use-background-mutation";
import { useOperatorShortcuts } from "@/hooks/use-operator-shortcuts";
import { useBackgroundMutationStore } from "@/stores/background-mutation-store";
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { holdCurrentPosCart } from "@/modules/pos/lib/hold-current-cart";
import { CategoryRail } from "@/modules/pos/components/category-rail";
import { CartPanel } from "@/modules/pos/components/cart-panel";
import { ProductTile } from "@/modules/pos/components/product-tile";
import { VariantPickerDialog } from "@/modules/pos/components/variant-picker-dialog";
import { PosModifierPicker } from "@/modules/pos/components/pos-modifier-picker";
import {
  openCashDrawerHook,
  triggerReceiptPrint,
} from "@/modules/pos/components/receipt-print";
import { openCashDrawerAction } from "@/modules/pos/actions/cash-drawer.action";
import type { CheckoutFlowResult } from "@/modules/pos/services/pos-checkout-flow.service";
import type {
  POSProduct,
  POSVariant,
} from "@/modules/pos/services/catalog.service";
import {
  buildWhatsAppReceiptUrl,
  type ReceiptPayload,
} from "@/modules/pos/services/receipt-format.service";
import { printReceiptViaUsb } from "@/modules/pos/services/receipt-usb-printer.service";
import { findPosProductByBarcode } from "@/modules/pos/utils/barcode-lookup";
import {
  playPosErrorSound,
  playPosNewOrderSound,
  playPosScanSound,
  playPosSuccessSound,
  unlockPosAudio,
} from "@/modules/pos/lib/pos-sounds";
import type {
  Category,
  CostCenter,
  ExpenseCategory,
  PromotionRule,
} from "@/lib/types";
import type {
  CartLine,
  Customer,
  PaymentMethod,
  PaymentSplit,
} from "@/lib/types";
import type { FeatureFlag, SalesMode } from "@/lib/constants";
import type { ReportBranding } from "@/modules/reports/core/report-context";
import { usePosStore, type HeldCart } from "@/stores/pos-store";
import { computePosCartTotals } from "@/modules/pos/lib/cart-totals";
import { previewPosPromotions } from "@/modules/pos/lib/pos-promo-preview";
import type { PromotionRuleInput } from "@/modules/promotions/lib/evaluate-promotions";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { PosPinSwitch } from "@/modules/pos/components/pos-pin-switch";
import type { PosReadinessState } from "@/lib/auth/pos-readiness-copy";
import { POS_READINESS_COPY } from "@/lib/auth/pos-readiness-copy";
import { ExpenseWizard } from "@/modules/expenses/components/expense-wizard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/format";
import { requiresManagerDiscountOverride } from "@/modules/pos/lib/requires-manager-discount-override";
import { WeightAmountModal } from "@/modules/pos/components/weight-amount-modal";
import { PosDeviceGate } from "@/modules/pos/components/pos-device-gate";
import { PosStoreGate } from "@/modules/pos/components/pos-store-gate";
import { PosCashierPinGate } from "@/modules/pos/components/pos-cashier-pin-gate";
import { PosPinLoginGate } from "@/modules/pos/components/pos-pin-login-gate";
import { PosAccessDenied } from "@/modules/pos/components/pos-access-denied";
import { PosCloseSessionDialog } from "@/modules/pos/components/pos-close-session-dialog";
import { ManagerOverrideDialog } from "@/modules/pos/components/manager-override-dialog";
import { PosCreditCheckoutDialog } from "@/modules/pos/components/pos-credit-checkout-dialog";
import type { CreditCheckoutConfirm } from "@/modules/pos/components/pos-credit-checkout-dialog";
import { PosCollectFlowDialog } from "@/modules/pos/components/pos-collect-flow-dialog";
import { PosSupplierPayDialog } from "@/modules/pos/components/pos-supplier-pay-dialog";
import { PosReceiptSuccessDialog } from "@/modules/pos/components/pos-receipt-success-dialog";
import { PosSessionOrdersDialog } from "@/modules/pos/components/pos-session-orders-dialog";
import { PosHeldCartsBar } from "@/modules/pos/components/pos-held-carts-bar";
import { QuickOpenSessionButton } from "@/modules/sessions/components/quick-open-session-button";
import type { SessionReconciliation } from "@/modules/sessions/services/reconciliation.service";
import type { CashierSession, Expense, Store } from "@/lib/types";
import { OnlineOrdersPageClient } from "@/modules/online-orders/components/online-orders-page";
import type {
  OnlineOrderWithItems,
  StaffOnlineProductOption,
} from "@/modules/online-orders/services/online-order.service";
import { roundMoney } from "@/lib/money";

let modifierLineSeq = 0;

function toStaffOnlineProductOptions(
  products: POSProduct[],
): StaffOnlineProductOption[] {
  return products
    .filter(
      (product) =>
        product.product_type === "finished" &&
        product.inventory_product_type === "finished_product" &&
        (product.sale_price ?? product.base_price) > 0,
    )
    .map((product) => ({
      id: product.id,
      name: product.name,
      price: roundMoney(product.sale_price ?? product.base_price),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        price: roundMoney(variant.price),
      })),
    }));
}

async function postPosCheckout(input: {
  cart: CartLine[];
  customer: Customer | null;
  paymentMethod: PaymentMethod;
  payments: PaymentSplit[];
  salesMode: SalesMode;
  discount: number;
  couponCode?: string | null;
  loyaltyPoints?: number;
  override?: {
    discount?: boolean;
    expiredSession?: boolean;
    reason?: string;
    pin?: string;
  };
}): Promise<CheckoutFlowResult> {
  const started = performance.now();
  const res = await fetch("/api/pos/checkout", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as CheckoutFlowResult | { error?: string };
  const elapsedMs = Math.round(performance.now() - started);
  if (!data || typeof data !== "object" || !("success" in data)) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "Could not complete sale";
    console.info(`[pos-checkout] ${elapsedMs}ms`, message);
    return { success: false, error: message };
  }
  console.info(
    `[pos-checkout] ${elapsedMs}ms`,
    data.success ? data.orderNumber : data.error,
  );
  return data;
}

async function postPosCustomerPayment(input: {
  customerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const res = await fetch("/api/pos/customer-payment", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { success?: boolean; error?: string };
  if (!res.ok || !data.success) {
    return {
      success: false,
      error: data.error || "Could not record collection",
    };
  }
  return { success: true };
}

interface PosScreenProps {
  categories: Category[];
  initialProducts: POSProduct[];
  hasActiveSession: boolean;
  enabledPaymentMethods: PaymentMethod[];
  readinessState: PosReadinessState;
  sessionId?: string | null;
  cashierId?: string | null;
  storeId?: string;
  costCenters?: CostCenter[];
  expenseCategories?: ExpenseCategory[];
  canAddSessionExpense?: boolean;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
  canManagerOverride?: boolean;
  requireManagerOverrideForExpiredSale?: boolean;
  scaleEnabled?: boolean;
  scaleSettings?: Record<string, unknown> | null;
  canCollectPayment?: boolean;
  canPaySupplier?: boolean;
  managerDiscountOverrideAmount?: number | null;
  currentUserName?: string | null;
  loyaltyRedemptionRate?: number | null;
  minimumLoyaltyRedeemPoints?: number;
  promotionRules?: PromotionRule[];
  receiptBranding: ReportBranding;
  onlineOrders?: OnlineOrderWithItems[];
  onlineOrderProducts?: StaffOnlineProductOption[];
  stores?: Store[];
  activeSession?: CashierSession | null;
  sessionReconciliation?: SessionReconciliation | null;
  sessionExpenses?: Expense[];
  cashierName?: string | null;
  costCenterMap?: Record<string, string>;
  expenseCategoryMap?: Record<string, string>;
  /** Locked next-shift float from cashier vault (POS open cannot edit). */
  pendingOpeningFloat?: number;
  /** Load catalog/online via API to keep RSC remounts light. */
  loadCatalogClient?: boolean;
  /** When false, POS skips variant picker (supermarket). Default true. */
  enableVariants?: boolean;
  /** Restaurant / food-service: offer modifier picker when catalog has groups. */
  enableModifiers?: boolean;
  /** Org activity allows scale / weight sale flow. */
  enableWeightSales?: boolean;
  /** Org activity allows amount-based (price input) sale on weight items. */
  enablePriceByAmount?: boolean;
  /** Server-persisted holds for this store+device (survives refresh). */
  initialHeldCarts?: HeldCart[];
  /** Canonical cashier URL for this branch, e.g. `/nutalla/pos`. */
  posPath?: string;
  storeSlug?: string;
  storeLabel?: string | null;
}

export function PosScreen({
  categories: categoriesProp,
  initialProducts,
  hasActiveSession,
  enabledPaymentMethods,
  readinessState,
  sessionId,
  cashierId,
  storeId,
  costCenters = [],
  expenseCategories = [],
  canAddSessionExpense = false,
  featureFlags = {},
  canManagerOverride = false,
  requireManagerOverrideForExpiredSale = true,
  scaleEnabled = false,
  scaleSettings = null,
  canCollectPayment = false,
  canPaySupplier = false,
  managerDiscountOverrideAmount = null,
  currentUserName = null,
  loyaltyRedemptionRate = null,
  minimumLoyaltyRedeemPoints = 0,
  promotionRules = [],
  receiptBranding,
  onlineOrders: onlineOrdersProp = [],
  onlineOrderProducts: onlineOrderProductsProp = [],
  stores = [],
  activeSession = null,
  sessionReconciliation = null,
  sessionExpenses = [],
  cashierName = null,
  costCenterMap,
  expenseCategoryMap,
  pendingOpeningFloat = 0,
  loadCatalogClient = false,
  enableVariants = true,
  enableModifiers = false,
  enableWeightSales = false,
  enablePriceByAmount = false,
  initialHeldCarts = [],
  posPath = "/pos",
  storeSlug,
  storeLabel = null,
}: PosScreenProps) {
  const { t, language } = useTranslation();
  const locale = language === "ar" ? "ar-EG" : "en-EG";
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [creditOpen, setCreditOpen] = useState(false);
  const [attachExpanded, setAttachExpanded] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [mobileExpenseOpen, setMobileExpenseOpen] = useState(false);
  const [mobileHeldCartsOpen, setMobileHeldCartsOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [onlineOrdersOpen, setOnlineOrdersOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [supplierPayOpen, setSupplierPayOpen] = useState(false);
  const [closeSessionTargetId, setCloseSessionTargetId] = useState<
    string | null
  >(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showProductImages, setShowProductImages] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const restoreScannerFocusRef = useRef(false);
  const [pickerProduct, setPickerProduct] = useState<POSProduct | null>(null);
  const [modifierProduct, setModifierProduct] = useState<POSProduct | null>(
    null,
  );
  const [pendingModifierVariant, setPendingModifierVariant] =
    useState<POSVariant | null>(null);
  const [lastReceipt, setLastReceipt] = useState<ReceiptPayload | null>(null);
  const [draftReceipt, setDraftReceipt] = useState<ReceiptPayload | null>(null);
  const [sessionOrdersOpen, setSessionOrdersOpen] = useState(false);
  const [sessionOrdersRefreshKey, setSessionOrdersRefreshKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const { run: runBackground } = useBackgroundMutation();
  const checkoutMutationKey = backgroundMutationKey(
    "pos",
    "checkout",
    sessionId ?? storeId ?? "no-session",
  );
  const checkoutSaving = useBackgroundMutationStore(
    (s) => s.mutations[checkoutMutationKey]?.status === "pending",
  );
  const [catalogCategories, setCatalogCategories] =
    useState<Category[]>(categoriesProp);
  const [catalogProducts, setCatalogProducts] =
    useState<POSProduct[]>(initialProducts);
  const [liveOnlineOrders, setLiveOnlineOrders] =
    useState<OnlineOrderWithItems[]>(onlineOrdersProp);
  const seenOnlineOrderIds = useRef(
    new Set(onlineOrdersProp.map((order) => order.id)),
  );
  const onlineOrdersSeeded = useRef(
    onlineOrdersProp.length > 0 || !loadCatalogClient,
  );
  const [catalogLoading, setCatalogLoading] = useState(loadCatalogClient);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoadAttempt, setCatalogLoadAttempt] = useState(0);
  const catalogHasLoadedRef = useRef(!loadCatalogClient);
  const lastCatalogRefreshAtRef = useRef(0);
  const addItem = usePosStore((s) => s.addItem);
  const clearCart = usePosStore((s) => s.clearCart);
  const undoLast = usePosStore((s) => s.undoLast);
  const setHeldCarts = usePosStore((s) => s.setHeldCarts);
  const cart = usePosStore((s) => s.cart);
  const heldCartCount = usePosStore((s) => s.heldCarts.length);
  const customer = usePosStore((s) => s.customer);
  const paymentMethod = usePosStore((s) => s.paymentMethod);
  const setPaymentMethod = usePosStore((s) => s.setPaymentMethod);
  const discountAmount = usePosStore((s) => s.discountAmount);
  const couponCode = usePosStore((s) => s.couponCode);
  const loyaltyRedemption = usePosStore((s) => s.loyaltyRedemption);
  const salesMode = usePosStore((s) => s.salesMode);
  const [weightProduct, setWeightProduct] = useState<POSProduct | null>(null);
  const [overrideDialog, setOverrideDialog] = useState<{
    kind: "checkout" | "cash_drawer";
    title: string;
    defaultReason: string;
    payments?: PaymentSplit[];
    accountCollection?: number;
  } | null>(null);

  const categories = catalogCategories;
  const initialProductsLive = catalogProducts;
  const onlineOrders = liveOnlineOrders;
  const onlineOrderProducts = useMemo(
    () =>
      onlineOrderProductsProp.length > 0
        ? onlineOrderProductsProp
        : toStaffOnlineProductOptions(catalogProducts),
    [onlineOrderProductsProp, catalogProducts],
  );

  useEffect(() => {
    if (
      !restoreScannerFocusRef.current ||
      pickerProduct ||
      modifierProduct ||
      weightProduct
    ) {
      return;
    }

    restoreScannerFocusRef.current = false;
    const frame = window.requestAnimationFrame(() =>
      searchInputRef.current?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [modifierProduct, pickerProduct, weightProduct]);

  useEffect(() => {
    setHeldCarts(initialHeldCarts);
    unlockPosAudio();
    // Hydrate once from server props for this device load.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount hydrate
  }, []);

  useEffect(() => {
    setShowProductImages(
      window.localStorage.getItem(POS_PRODUCT_IMAGES_PREF_KEY) === "true",
    );
  }, []);

  function toggleProductImages() {
    setShowProductImages((current) => {
      const next = !current;
      window.localStorage.setItem(POS_PRODUCT_IMAGES_PREF_KEY, String(next));
      return next;
    });
  }

  useEffect(() => {
    function focusProductSearch(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          Boolean(target.closest("input, textarea, select")))
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"]')) return;

      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }

    window.addEventListener("keydown", focusProductSearch);
    return () => window.removeEventListener("keydown", focusProductSearch);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let controller: AbortController | null = null;

    async function pollOnlineOrders() {
      if (cancelled || inFlight || document.visibilityState !== "visible")
        return;
      inFlight = true;
      controller = new AbortController();
      try {
        const ordersRes = await fetch("/api/pos/online-orders", {
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!ordersRes.ok) return;
        const ordersJson = (await ordersRes.json()) as {
          orders?: OnlineOrderWithItems[];
        };
        const next = ordersJson.orders ?? [];
        if (cancelled) return;
        const hasNew = next.some(
          (order) => !seenOnlineOrderIds.current.has(order.id),
        );
        seenOnlineOrderIds.current = new Set(next.map((order) => order.id));
        setLiveOnlineOrders(next);
        if (onlineOrdersSeeded.current && hasNew) {
          playPosNewOrderSound();
          toast.message(t("New online order"));
        }
        onlineOrdersSeeded.current = true;
      } catch {
        // Keep last known board; next poll retries.
      } finally {
        inFlight = false;
        controller = null;
      }
    }

    void pollOnlineOrders();
    const id = window.setInterval(pollOnlineOrders, 30_000);
    document.addEventListener("visibilitychange", pollOnlineOrders);
    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", pollOnlineOrders);
    };
  }, [t]);

  useEffect(() => {
    if (!loadCatalogClient) return;
    let cancelled = false;
    const controller = new AbortController();
    const isBlockingLoad = !catalogHasLoadedRef.current;

    async function loadCatalog() {
      lastCatalogRefreshAtRef.current = Date.now();
      if (isBlockingLoad) {
        setCatalogLoading(true);
        setCatalogError(null);
      }
      try {
        const catalogRes = await fetch("/api/pos/catalog", {
          credentials: "same-origin",
          signal: controller.signal,
        });
        const catalogJson = (await catalogRes.json()) as {
          categories?: Category[];
          products?: POSProduct[];
          error?: string;
        };
        if (!catalogRes.ok) {
          throw new Error(catalogJson.error || "Could not load products");
        }
        if (!cancelled) {
          setCatalogCategories(catalogJson.categories ?? []);
          setCatalogProducts(catalogJson.products ?? []);
          setCatalogError(null);
          catalogHasLoadedRef.current = true;
          lastCatalogRefreshAtRef.current = Date.now();
        }
      } catch (error) {
        if (!cancelled && !controller.signal.aborted && isBlockingLoad) {
          setCatalogError(
            t(
              error instanceof Error
                ? error.message
                : "Could not load products",
            ),
          );
        }
      } finally {
        if (!cancelled && isBlockingLoad) setCatalogLoading(false);
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [catalogLoadAttempt, loadCatalogClient, storeId, t]);

  useEffect(() => {
    if (!loadCatalogClient) return;

    function refreshCatalogWhenVisible() {
      if (
        document.visibilityState !== "visible" ||
        Date.now() - lastCatalogRefreshAtRef.current < 60_000
      ) {
        return;
      }

      // Reserve this refresh window immediately so focus + visibility events
      // cannot start duplicate requests together.
      lastCatalogRefreshAtRef.current = Date.now();
      setCatalogLoadAttempt((attempt) => attempt + 1);
    }

    window.addEventListener("focus", refreshCatalogWhenVisible);
    document.addEventListener("visibilitychange", refreshCatalogWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshCatalogWhenVisible);
      document.removeEventListener(
        "visibilitychange",
        refreshCatalogWhenVisible,
      );
    };
  }, [loadCatalogClient]);

  useEffect(() => {
    if (
      categoryId &&
      !categories.some((category) => category.id === categoryId)
    ) {
      setCategoryId(null);
    }
  }, [categories, categoryId]);

  const barcodeEnabled = featureFlags.barcode_scanner !== false;
  const receiptEnabled = featureFlags.receipt_printing !== false;
  const cashierMustCloseExpiredSession =
    readinessState === "session_expired" && !canManagerOverride;
  const managerCanContinueExpiredSession =
    readinessState === "session_expired" && canManagerOverride;
  const checkoutBlocked =
    readinessState !== "ready" &&
    readinessState !== "session_warning" &&
    !managerCanContinueExpiredSession;
  const cashDrawerEnabled = featureFlags.cash_drawer === true;
  const discountsEnabled = featureFlags.customer_discounts === true;
  const promotionsEnabled = featureFlags.promotions === true;
  /** Off = allow selling when stock is zero/negative (matches checkout RPC). */
  const allowNegativeStock = featureFlags.prevent_negative_stock !== true;
  const promoRuleInputs = useMemo<PromotionRuleInput[]>(
    () =>
      promotionRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        is_active: rule.is_active,
        rule_type: rule.rule_type,
        priority: rule.priority,
        starts_at: rule.starts_at,
        ends_at: rule.ends_at,
        store_ids: rule.store_ids,
        sale_modes: rule.sale_modes,
        coupon_code: rule.coupon_code,
        stackable_with_cart: rule.stackable_with_cart,
        min_subtotal: rule.min_subtotal,
        scope_type: rule.scope_type,
        scope_ids: rule.scope_ids,
        config: rule.config,
        usage_limit_total: rule.usage_limit_total,
        usage_count: rule.usage_count,
      })),
    [promotionRules],
  );
  const promoPreview = useMemo(() => {
    if (!promotionsEnabled || promoRuleInputs.length === 0 || cart.length === 0)
      return null;
    return previewPosPromotions({
      rules: promoRuleInputs,
      cart,
      storeId,
      saleMode: salesMode,
      couponCode,
    });
  }, [
    promotionsEnabled,
    promoRuleInputs,
    cart,
    storeId,
    salesMode,
    couponCode,
  ]);
  const cartTotals = useMemo(
    () =>
      computePosCartTotals({
        cart,
        discountAmount,
        loyaltyAmount: loyaltyRedemption?.amount ?? 0,
        promoPreview,
      }),
    [cart, discountAmount, loyaltyRedemption?.amount, promoPreview],
  );
  const {
    promoCartDiscount,
    promoItemDiscount: promoItemSavings,
    promoAdjustedSubtotal,
    payableBeforeLoyalty: cartTotal,
    payableTotal: cartPayableTotal,
  } = cartTotals;
  const promoLabels = useMemo(
    () =>
      promoPreview?.applications
        ?.map((app) => app.rule_name?.trim())
        .filter((name): name is string => Boolean(name)) ?? [],
    [promoPreview],
  );
  const loyaltyEnabled = featureFlags.loyalty !== false;
  const cartItemCount = cart.reduce((total, line) => total + line.quantity, 0);
  const cartQuantitiesByProduct = useMemo(() => {
    const quantities = new Map<string, number>();
    for (const line of cart) {
      quantities.set(
        line.productId,
        (quantities.get(line.productId) ?? 0) + line.quantity,
      );
    }
    return quantities;
  }, [cart]);
  const noPaymentMethods = enabledPaymentMethods.length === 0;
  const checkoutBlockedReason = checkoutSaving
    ? "Saving previous invoice…"
    : pending
      ? "Completing sale…"
      : readinessState === "session_expired"
        ? cashierMustCloseExpiredSession
          ? "Session expired — close the session"
          : requireManagerOverrideForExpiredSale
            ? "Session expired — manager PIN required"
            : null
        : readinessState === "no_session"
          ? "Open a cashier session first"
          : checkoutBlocked
            ? (POS_READINESS_COPY[readinessState]?.title ?? "POS is not ready")
            : noPaymentMethods
              ? "No payment method is enabled"
              : null;
  const payLocked =
    checkoutBlocked || pending || checkoutSaving || noPaymentMethods;

  function cartCheckout(method?: PaymentMethod) {
    if (!method) return;
    if (cashierMustCloseExpiredSession) {
      if (activeSession) setCloseSessionTargetId(activeSession.id);
      return;
    }
    setPaymentMethod(method);
    if (method === "credit") {
      setCreditOpen(true);
      return;
    }
    const total = cartPayableTotal;
    handleComplete([{ method, amount: total }]);
  }

  useOperatorShortcuts({
    enabled: !checkoutBlocked,
    onSave: () => {
      if (payLocked || cart.length === 0) return;
      if (paymentMethod === "credit" && !customer) {
        playPosErrorSound();
        toast.error(t("Attach a customer first for an on-account sale"));
        setAttachExpanded(true);
        return;
      }
      cartCheckout(paymentMethod);
    },
    onDelete: () => {
      if (cart.length === 0) return;
      setClearConfirmOpen(true);
    },
    onUndo: () => {
      if (!undoLast()) {
        toast.message(t("Nothing to undo"));
      }
    },
    onHold: () => {
      if (cart.length === 0) {
        toast.message(t("Cart is empty — nothing to hold"));
        return;
      }
      holdCurrentPosCart();
    },
    onCustomer: () => {
      setAttachExpanded(true);
      setCartOpen(true);
    },
    onDiscount: () => {
      if (!discountsEnabled) {
        toast.message(t("Discounts are not enabled in settings"));
        return;
      }
      setDiscountOpen(true);
      setCartOpen(true);
    },
  });

  const activeOnlineOrdersCount = onlineOrders.filter(
    (order) => order.status !== "cancelled" && order.status !== "invoiced",
  ).length;

  const productSearchIndex = useMemo(
    () =>
      new Map(
        initialProductsLive.map((product) => [
          product.id,
          [
            product.name,
            product.categoryName,
            product.sku,
            product.barcode,
            formatCurrency(product.base_price),
            ...product.variants.flatMap((variant) => [
              variant.name,
              variant.sku,
              variant.barcode,
              formatCurrency(variant.price),
            ]),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
        ]),
      ),
    [initialProductsLive],
  );

  const products = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const categoryProducts = categoryId
      ? initialProductsLive.filter((p) => p.category_id === categoryId)
      : initialProductsLive;

    if (!normalizedSearch) return categoryProducts;

    return categoryProducts.filter((product) =>
      productSearchIndex.get(product.id)?.includes(normalizedSearch),
    );
  }, [categoryId, initialProductsLive, productSearchIndex, searchTerm]);

  /** When variants exist, checkout SQL requires a variant_id — even if UI variants are off. */
  function resolveCheckoutVariant(
    product: POSProduct,
    preferred: POSVariant | null = null,
  ): POSVariant | null {
    if (!product.hasVariants || product.variants.length === 0) return null;
    if (preferred) return preferred;
    return product.variants[0] ?? null;
  }

  function addToCart(
    product: POSProduct,
    variant: POSVariant | null,
    modifiers: { name: string; price: number }[] = [],
  ) {
    const resolved = resolveCheckoutVariant(product, variant);
    const name =
      enableVariants && resolved
        ? `${product.name} — ${resolved.name}`
        : product.name;
    const unitPrice = resolved ? resolved.price : product.base_price;
    addItem({
      productId: product.id,
      variantId: resolved?.id ?? null,
      name,
      quantity: 1,
      unitPrice,
      categoryId: product.category_id ?? null,
      modifiers,
      imageUrl: resolved?.imageUrl ?? product.image_url,
      id:
        modifiers.length > 0
          ? `line-${product.id}-${resolved?.id ?? "base"}-m${++modifierLineSeq}`
          : undefined,
    });
    playPosScanSound();
  }

  function handleAdd(product: POSProduct) {
    const useWeightFlow =
      (enableWeightSales && product.supports_weight_sale) ||
      (enablePriceByAmount && product.supports_amount_sale);
    if (useWeightFlow) {
      setWeightProduct(product);
      return;
    }
    if (enableVariants && product.hasVariants && product.variants.length > 0) {
      setPickerProduct(product);
      return;
    }
    if (enableModifiers) {
      setPendingModifierVariant(null);
      setModifierProduct(product);
      return;
    }
    addToCart(product, null);
  }

  function handleBarcodeSubmit(raw: string) {
    const trimmed = raw.trim();
    const match = barcodeEnabled
      ? findPosProductByBarcode(initialProductsLive, trimmed)
      : null;

    if (!match && products.length !== 1) {
      const message = t(
        products.length > 1
          ? "Narrow the search to one product, or scan an exact barcode."
          : "Product not found",
      );
      playPosErrorSound();
      setSearchError(message);
      toast.error(message);
      window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
      return;
    }

    const { product, variant } = match ?? {
      product: products[0]!,
      variant: null,
    };
    setSearchError(null);
    const useWeightFlow =
      (enableWeightSales && product.supports_weight_sale) ||
      (enablePriceByAmount && product.supports_amount_sale);
    if (useWeightFlow) {
      restoreScannerFocusRef.current = true;
      setWeightProduct(product);
      setSearchTerm("");
      return;
    }
    if (enableVariants && product.hasVariants && !variant) {
      restoreScannerFocusRef.current = true;
      setPickerProduct(product);
      setSearchTerm("");
      return;
    }
    if (enableModifiers) {
      restoreScannerFocusRef.current = true;
      setPendingModifierVariant(variant);
      setModifierProduct(product);
      setSearchTerm("");
      return;
    }
    addToCart(product, variant);
    setSearchTerm("");
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function clearCatalogFilters() {
    setSearchTerm("");
    setSearchError(null);
    setCategoryId(null);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function runCheckout(
    payments: PaymentSplit[],
    overrideReason?: string,
    accountCollection = 0,
    overridePin?: string,
  ) {
    if (checkoutSaving) {
      toast.message(t("The previous invoice is still saving. Wait a moment."));
      return;
    }

    const checkoutPaymentMethod = payments[0]?.method ?? paymentMethod;
    const needsDiscountOverride = requiresManagerDiscountOverride(
      discountAmount,
      managerDiscountOverrideAmount,
    );
    const sessionExpired = managerCanContinueExpiredSession;
    const state = usePosStore.getState();
    const receiptCart = [...state.cart];
    const receiptCustomer = state.customer
      ? { name: state.customer.name, phone: state.customer.phone }
      : null;
    const attachedCustomer = state.customer;
    const collectionMethod =
      payments.find((payment) => payment.method !== "credit")?.method ?? "cash";
    const redemptionAmount = state.loyaltyRedemption?.amount ?? 0;
    const receiptDiscount =
      state.discountAmount +
      redemptionAmount +
      promoCartDiscount +
      promoItemSavings;
    const receiptTotal = cartPayableTotal;
    const checkoutCart = [...state.cart];
    const checkoutCustomer = state.customer;
    const checkoutDiscount = state.discountAmount;
    const checkoutCoupon = state.couponCode;
    const checkoutLoyaltyPoints = state.loyaltyRedemption?.points;
    const checkoutSalesMode = state.salesMode;

    if (checkoutCart.length === 0) {
      playPosErrorSound();
      toast.error(t("Cart is empty"));
      return;
    }

    setOverrideDialog(null);
    setCreditOpen(false);
    clearCart({ undoable: false });

    runBackground({
      key: checkoutMutationKey,
      label: t("Saving sale…"),
      execute: async () => {
        const result = await postPosCheckout({
          cart: checkoutCart,
          customer: checkoutCustomer,
          paymentMethod: checkoutPaymentMethod,
          payments,
          salesMode: checkoutSalesMode,
          discount: checkoutDiscount,
          couponCode: promotionsEnabled ? checkoutCoupon || null : null,
          loyaltyPoints: checkoutLoyaltyPoints,
          override:
            needsDiscountOverride || sessionExpired
              ? {
                  discount: needsDiscountOverride || undefined,
                  expiredSession: sessionExpired || undefined,
                  reason: overrideReason,
                  pin: overridePin,
                }
              : undefined,
        });
        if (!result.success) {
          throw new Error(result.error);
        }
        if (!result.orderNumber) {
          throw new Error(t("Could not complete sale"));
        }
        return result;
      },
      successMessage: (result) =>
        `${t("Order completed")} ${result.orderNumber}`,
      onSuccess: (result) => {
        setSessionOrdersRefreshKey((key) => key + 1);
        // Inventory changed during checkout. Refresh stock in the background
        // without blocking the cashier from starting the next sale.
        if (loadCatalogClient) {
          lastCatalogRefreshAtRef.current = Date.now();
          setCatalogLoadAttempt((attempt) => attempt + 1);
        }
        if (
          cashDrawerEnabled &&
          payments.some((payment) => payment.method === "cash")
        ) {
          openCashDrawerHook();
        }
        if (receiptEnabled) {
          setLastReceipt({
            orderId: result.order.id,
            orderNumber: result.orderNumber,
            createdAt: new Date().toISOString(),
            paymentMethod: checkoutPaymentMethod,
            payments,
            lines: receiptCart,
            discount: receiptDiscount,
            total: receiptTotal,
            customer: receiptCustomer,
            branding: receiptBranding,
          });
        }
        playPosSuccessSound();
        if (result.loyaltyRedeemWarning) {
          toast.error(result.loyaltyRedeemWarning);
        }

        if (
          accountCollection > 0.001 &&
          attachedCustomer &&
          collectionMethod !== "credit"
        ) {
          void postPosCustomerPayment({
            customerId: attachedCustomer.id,
            amount: accountCollection,
            paymentMethod: collectionMethod,
            reference: result.orderNumber,
            notes: `${t("Collection with invoice")} ${result.orderNumber}`,
          }).then((collected) => {
            if (!collected.success) {
              playPosErrorSound();
              toast.error(
                `${t("Sale completed, but balance collection failed")}: ${t(collected.error)}`,
              );
              return;
            }
            toast.success(
              `${t("Collected")} ${formatCurrency(accountCollection)} ${t("from customer account with the invoice")}`,
            );
          });
        }
      },
      onError: (message) => {
        playPosErrorSound();
        const failedHold: HeldCart = {
          id: `temp-hold-${crypto.randomUUID()}`,
          name: t("Failed invoice — tap to restore"),
          cart: checkoutCart,
          customer: checkoutCustomer,
          discountAmount: checkoutDiscount,
          couponCode: checkoutCoupon,
          salesMode: checkoutSalesMode,
          createdAt: new Date().toISOString(),
          failedCheckout: true,
          failureMessage: message,
        };
        usePosStore.getState().parkFailedCheckoutHold(failedHold);
      },
    });
  }

  function handleCreditConfirm({
    payments,
    accountCollection,
  }: CreditCheckoutConfirm) {
    handleComplete(payments, accountCollection);
  }

  function handleComplete(payments: PaymentSplit[], accountCollection = 0) {
    if (cashierMustCloseExpiredSession) {
      if (activeSession) setCloseSessionTargetId(activeSession.id);
      toast.error(t("Session expired — close the session"));
      return;
    }
    if (payments.some((payment) => payment.method === "credit") && !customer) {
      playPosErrorSound();
      toast.error(t("Select a customer for credit sale"));
      return;
    }
    const needsDiscountOverride = requiresManagerDiscountOverride(
      discountAmount,
      managerDiscountOverrideAmount,
    );
    const needsExpiredSessionOverride =
      readinessState === "session_expired" &&
      canManagerOverride &&
      requireManagerOverrideForExpiredSale;
    if (needsDiscountOverride || needsExpiredSessionOverride) {
      const both = needsDiscountOverride && needsExpiredSessionOverride;
      setOverrideDialog({
        kind: "checkout",
        title: both
          ? t("Approve discounted sale after session expiry")
          : needsExpiredSessionOverride
            ? t("Approve sale after session expiry")
            : t("Manager discount approval"),
        defaultReason: both
          ? t("Approved discounted sale after session expiry")
          : needsExpiredSessionOverride
            ? t("Approved sale after session expiry")
            : t("Discount approved"),
        payments,
        accountCollection,
      });
      return;
    }
    runCheckout(payments, undefined, accountCollection);
  }

  if (readinessState === "login_required") {
    if (!storeSlug) {
      return <PosAccessDenied state="login_required" />;
    }
    return <PosPinLoginGate storeSlug={storeSlug} storeName={storeLabel} />;
  }

  if (readinessState === "no_device" || readinessState === "device_inactive") {
    return <PosDeviceGate />;
  }

  if (readinessState === "cashier_required") {
    return <PosCashierPinGate currentUserName={currentUserName} />;
  }

  if (
    readinessState === "store_required" ||
    readinessState === "store_mismatch"
  ) {
    return (
      <PosStoreGate
        stores={stores}
        activeStoreId={storeId}
        readinessState={readinessState}
        title={
          readinessState === "store_mismatch" ? "Change store" : "Choose store"
        }
        description={
          readinessState === "store_mismatch"
            ? "The active store is different. Choose the correct store to continue."
            : "Choose the store where you will use the POS."
        }
      />
    );
  }

  if (readinessState === "access_denied" || readinessState === "role_denied") {
    return <PosAccessDenied state={readinessState} />;
  }

  function handleOpenCashDrawer() {
    setOverrideDialog({
      kind: "cash_drawer",
      title: t("Open cash drawer"),
      defaultReason: t("Open cash drawer manually"),
    });
  }

  function confirmCashDrawer(reason: string, pin: string) {
    startTransition(async () => {
      try {
        await openCashDrawerAction({ reason, pin });
        openCashDrawerHook();
        setOverrideDialog(null);
        toast.success(t("Cash drawer opened"));
      } catch (error) {
        toast.error(
          t(
            error instanceof Error
              ? error.message
              : "Could not open cash drawer",
          ),
        );
      }
    });
  }

  async function handleUsbPrintReceipt(
    receipt: ReceiptPayload | null = lastReceipt,
  ) {
    if (!receipt) {
      throw new Error(t("Could not print receipt"));
    }
    await printReceiptViaUsb(receipt);
  }

  function handleBrowserPrintReceipt(
    receipt: ReceiptPayload | null = lastReceipt,
  ) {
    if (!receipt) {
      throw new Error(t("Could not print receipt"));
    }
    if (
      typeof document !== "undefined" &&
      !document.getElementById("Velora-receipt")
    ) {
      throw new Error(t("Could not print receipt — receipt is not ready"));
    }
    setTimeout(() => triggerReceiptPrint(), 50);
  }

  function sendWhatsAppReceipt(
    receipt: ReceiptPayload | null,
    phoneOverride?: string,
  ) {
    if (!receipt) throw new Error(t("Could not open WhatsApp"));
    const url = buildWhatsAppReceiptUrl(receipt, phoneOverride);
    if (!url) {
      throw new Error(t("Customer phone number is not valid for WhatsApp"));
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleSendWhatsAppReceipt(phoneOverride?: string) {
    sendWhatsAppReceipt(lastReceipt, phoneOverride);
  }

  function openDraftReceipt() {
    if (cart.length === 0) return;
    const draftNotice = `${t("Draft receipt")} — ${t("Not saved yet")}`;
    setDraftReceipt({
      orderNumber: t("Draft"),
      createdAt: new Date().toISOString(),
      paymentMethod,
      payments: [{ method: paymentMethod, amount: cartPayableTotal }],
      lines: [...cart],
      discount:
        discountAmount +
        (loyaltyRedemption?.amount ?? 0) +
        promoCartDiscount +
        promoItemSavings,
      total: cartPayableTotal,
      customer: customer
        ? { name: customer.name, phone: customer.phone }
        : null,
      branding: {
        ...receiptBranding,
        receiptHeader: [draftNotice, receiptBranding.receiptHeader]
          .filter(Boolean)
          .join("\n"),
      },
    });
  }

  return (
    <>
      <div className="print:hidden flex h-dvh max-h-dvh flex-col gap-2 overflow-hidden bg-background px-2 pb-2 text-foreground max-[390px]:gap-1.5 max-[390px]:px-1.5 max-[390px]:pb-1.5 max-sm:pt-[env(safe-area-inset-top)] sm:gap-3 sm:px-3 sm:pb-3 lg:gap-4 lg:px-4 lg:pb-4">
        <div className="flex shrink-0 flex-col gap-1.5 max-[390px]:gap-1 max-sm:hidden sm:gap-2">
          <div
            className="-mx-2 flex min-h-12 min-w-0 items-center gap-1 border-b border-border/70 bg-card/95 px-2 pb-1 pt-[max(0.25rem,env(safe-area-inset-top))] max-[390px]:-mx-1.5 max-[390px]:px-1.5 sm:-mx-3 sm:px-3 lg:-mx-4 lg:px-4"
            data-testid="pos-topbar"
          >
            {currentUserName ? (
              <span
                className="flex h-10 min-w-0 max-w-36 shrink items-center gap-1.5 rounded-lg bg-muted/60 px-2 text-xs font-semibold text-foreground"
                title={currentUserName}
              >
                <CircleUserRound
                  className="size-4 shrink-0 text-primary"
                  aria-hidden
                />
                <span className="truncate max-[390px]:sr-only">
                  {currentUserName}
                </span>
              </span>
            ) : null}

            {currentUserName ? (
              <span
                className="mx-0.5 h-6 w-px shrink-0 bg-border/70"
                aria-hidden
              />
            ) : null}

            {hasActiveSession ? (
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  className="size-11 shrink-0 rounded-lg border-indigo-200 bg-indigo-50 px-0 text-indigo-900 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
                  onClick={() => setSessionOrdersOpen(true)}
                  aria-label={t("Session invoices")}
                  title={t("Session invoices")}
                >
                  <History className="size-4 shrink-0" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="relative size-11 shrink-0 rounded-lg border-sky-200 bg-sky-50 px-0 text-sky-900 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200 dark:hover:bg-sky-500/20"
                  onClick={() => setOnlineOrdersOpen(true)}
                  aria-label={t("Online orders")}
                  title={t("Online orders")}
                >
                  <ClipboardList className="size-4 shrink-0" />
                  {activeOnlineOrdersCount > 0 ? (
                    <span className="absolute -end-1 -top-1 rounded-full bg-sky-700 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums dark:bg-sky-400 dark:text-sky-950">
                      {activeOnlineOrdersCount}
                    </span>
                  ) : null}
                </Button>
                {canCollectPayment ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="size-11 shrink-0 rounded-lg border-emerald-200 bg-emerald-50 px-0 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                    onClick={() => setCollectOpen(true)}
                    aria-label={t("Collect from customer")}
                    title={t("Collect from customer")}
                  >
                    <Banknote className="size-4 shrink-0" />
                  </Button>
                ) : null}
                {canPaySupplier ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="size-11 shrink-0 rounded-lg border-amber-200 bg-amber-50 px-0 text-amber-900 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
                    onClick={() => setSupplierPayOpen(true)}
                    aria-label={t("Pay supplier")}
                    title={t("Pay supplier")}
                  >
                    <Truck className="size-4 shrink-0" />
                  </Button>
                ) : null}
                {canAddSessionExpense && storeId && cashierId && sessionId ? (
                  <div className="shrink-0">
                    <ExpenseWizard
                      storeId={storeId}
                      sessionId={sessionId}
                      userId={cashierId}
                      costCenters={costCenters}
                      categories={expenseCategories}
                      sessionMode
                      trigger={
                        <Button
                          variant="outline"
                          size="sm"
                          className="size-11 rounded-lg border-rose-200 bg-rose-50 px-0 text-rose-900 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20"
                          aria-label={t("Session expense")}
                          title={t("Session expense")}
                        >
                          <Wallet className="size-4 shrink-0" />
                        </Button>
                      }
                    />
                  </div>
                ) : null}
                {cashDrawerEnabled ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="size-11 shrink-0 rounded-lg border-violet-200 bg-violet-50 px-0 text-violet-900 hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200 dark:hover:bg-violet-500/20"
                    disabled={pending}
                    onClick={handleOpenCashDrawer}
                    aria-label={t("Open drawer")}
                    title={t("Open drawer")}
                  >
                    <Archive className="size-4 shrink-0" />
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="min-w-0 flex-1" />
            )}

            {cart.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="size-11 shrink-0 rounded-lg border-cyan-200 bg-cyan-50 px-0 text-cyan-900 hover:bg-cyan-100 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                onClick={openDraftReceipt}
                aria-label={t("Draft receipt")}
                title={t("Draft receipt")}
              >
                <ReceiptText className="size-4 shrink-0" />
              </Button>
            ) : null}

            <Button
              type="button"
              variant={showProductImages ? "secondary" : "ghost"}
              size="sm"
              className="size-11 shrink-0 rounded-lg px-0"
              aria-label={
                showProductImages
                  ? t("Hide product images")
                  : t("Show product images")
              }
              aria-pressed={showProductImages}
              title={
                showProductImages
                  ? t("Hide product images")
                  : t("Show product images")
              }
              onClick={toggleProductImages}
            >
              {showProductImages ? (
                <ImageOff className="size-4" aria-hidden />
              ) : (
                <ImageIcon className="size-4" aria-hidden />
              )}
            </Button>

            <div className="flex shrink-0 items-center gap-1">
              {checkoutSaving ? (
                <span
                  className="inline-flex size-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary"
                  role="status"
                  aria-live="polite"
                  aria-label={t("Saving invoice…")}
                >
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                </span>
              ) : null}
              {hasActiveSession ? <PosHeldCartsBar /> : null}
              {(readinessState === "ready" ||
                readinessState === "session_warning" ||
                readinessState === "session_expired") &&
              hasActiveSession &&
              activeSession &&
              sessionReconciliation ? (
                <div title={t("Close session")}>
                  <PosCloseSessionDialog
                    key={activeSession.id}
                    open={closeSessionTargetId === activeSession.id}
                    onOpenChange={(nextOpen) =>
                      setCloseSessionTargetId(
                        nextOpen ? activeSession.id : null,
                      )
                    }
                    session={activeSession}
                    reconciliation={sessionReconciliation}
                    sessionExpenses={sessionExpenses}
                    cashierName={cashierName ?? t("Cashier")}
                    costCenterMap={costCenterMap}
                    categoryMap={expenseCategoryMap}
                    triggerSize="icon"
                    triggerClassName="size-11 rounded-lg"
                    triggerChildren={
                      <>
                        <CircleStop className="size-4" aria-hidden />
                        <span className="sr-only">{t("Close session")}</span>
                      </>
                    }
                  />
                </div>
              ) : null}
              <div
                className="[&_button]:size-11 [&_button]:rounded-lg [&_button]:px-0 [&_span]:sr-only"
                title={t("Lock screen")}
              >
                <PosPinSwitch returnTo={posPath} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 gap-2 max-[390px]:gap-1.5 sm:gap-3 lg:gap-4">
          <section className="flex min-w-0 flex-1 flex-col gap-2 max-[390px]:gap-1.5 sm:gap-3">
            <CategoryRail
              categories={categories}
              selectedId={categoryId}
              onSelect={setCategoryId}
            />
            <form
              className="flex flex-wrap gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (searchTerm.trim()) handleBarcodeSubmit(searchTerm);
              }}
            >
              <div className="relative min-w-0 flex-1">
                {barcodeEnabled ? (
                  <ScanBarcode
                    className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-primary md:start-4 md:size-6"
                    aria-hidden
                  />
                ) : (
                  <Search
                    className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground md:start-4 md:size-5"
                    aria-hidden
                  />
                )}
                <Input
                  ref={searchInputRef}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSearchError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && searchTerm) {
                      event.preventDefault();
                      setSearchTerm("");
                      setSearchError(null);
                    }
                  }}
                  placeholder={t(
                    barcodeEnabled
                      ? "Search or scan barcode…"
                      : "Search products…",
                  )}
                  aria-label={t(
                    barcodeEnabled
                      ? "Search or scan barcode"
                      : "Search products",
                  )}
                  aria-describedby={
                    [
                      barcodeEnabled ? "pos-barcode-hint" : null,
                      searchError ? "pos-search-error" : null,
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  aria-invalid={Boolean(searchError)}
                  aria-keyshortcuts="/ Escape"
                  className="h-11 rounded-xl bg-card ps-11 pe-11 text-base shadow-none ring-1 ring-border/50 focus-visible:ring-2 aria-invalid:ring-destructive/70 sm:pe-24 md:h-14 md:rounded-2xl md:ps-13 md:pe-36 md:text-lg"
                  autoComplete="off"
                  enterKeyHint="search"
                  inputMode="search"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setSearchError(null);
                      searchInputRef.current?.focus();
                    }}
                    className="absolute end-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 md:size-14 md:rounded-2xl"
                    aria-label={t("Clear search")}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                ) : barcodeEnabled ? (
                  <span className="pointer-events-none absolute end-3 top-1/2 hidden -translate-y-1/2 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary sm:flex md:end-4 md:px-3 md:py-2 md:text-xs">
                    <span
                      className="size-1.5 rounded-full bg-emerald-500"
                      aria-hidden
                    />
                    {t("Scanner ready")}
                  </span>
                ) : null}
                {barcodeEnabled ? (
                  <span id="pos-barcode-hint" className="sr-only">
                    {t(
                      "Scan barcode or type a product name, then press Enter to add",
                    )}
                  </span>
                ) : null}
              </div>
              <Button
                type="submit"
                variant="outline"
                className="hidden h-11 shrink-0 rounded-xl px-4 sm:inline-flex md:h-14 md:rounded-2xl md:px-5 md:text-base"
                aria-label={t("Add from search")}
              >
                <Plus className="size-4" aria-hidden />
                {t("Add")}
              </Button>
              {searchError ? (
                <p
                  id="pos-search-error"
                  className="basis-full px-1 text-xs font-medium text-destructive"
                  role="alert"
                >
                  {searchError}
                </p>
              ) : null}
            </form>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-xl bg-muted/45 p-1.5 ring-1 ring-border/70 sm:p-2 lg:p-2.5">
              {catalogLoading ? (
                <div
                  className="grid grid-cols-2 gap-1.5 min-[350px]:grid-cols-3 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] sm:gap-2 lg:grid-cols-[repeat(auto-fit,minmax(118px,1fr))]"
                  role="status"
                  aria-live="polite"
                  aria-label={t("Loading products…")}
                >
                  {Array.from({ length: 15 }, (_, index) => (
                    <div
                      key={index}
                      className="flex min-h-[84px] flex-col gap-2 rounded-xl bg-card p-2 ring-1 ring-border/60 sm:min-h-[96px] sm:rounded-[14px]"
                      aria-hidden
                    >
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="mt-auto h-3 w-1/3 self-end rounded-full" />
                    </div>
                  ))}
                  <span className="sr-only">{t("Loading products…")}</span>
                </div>
              ) : catalogError ? (
                <EmptyStateBlock
                  title={t("Could not load products")}
                  description={catalogError}
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-11 rounded-xl px-4"
                      onClick={() =>
                        setCatalogLoadAttempt((attempt) => attempt + 1)
                      }
                    >
                      {t("Try again")}
                    </Button>
                  }
                  className="flex min-h-32 flex-col items-center justify-center border-border/70 bg-card/80 p-3 py-5 sm:min-h-40 sm:py-7"
                />
              ) : products.length === 0 ? (
                <EmptyStateBlock
                  title={t(searchTerm.trim() ? "No results" : "No products")}
                  description={
                    searchTerm.trim()
                      ? t("Try a different name or barcode.")
                      : categoryId
                        ? t("No products in this category.")
                        : t("Add products to the catalog to start selling.")
                  }
                  action={
                    searchTerm.trim() || categoryId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-11 rounded-xl px-4"
                        onClick={clearCatalogFilters}
                      >
                        {t(
                          searchTerm.trim() && categoryId
                            ? "Clear filters"
                            : categoryId
                              ? "Show all products"
                              : "Clear search",
                        )}
                      </Button>
                    ) : undefined
                  }
                  className="flex min-h-32 flex-col items-center justify-center border-border/70 bg-card/80 p-3 py-5 sm:min-h-40 sm:py-7"
                />
              ) : (
                <div className="grid grid-cols-2 gap-1.5 min-[350px]:grid-cols-3 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] sm:gap-2 lg:grid-cols-[repeat(auto-fit,minmax(118px,1fr))]">
                  {products.map((product) => (
                    <ProductTile
                      key={product.id}
                      product={product}
                      showImage={showProductImages}
                      showVariants={enableVariants}
                      allowNegativeStock={allowNegativeStock}
                      quantityInCart={
                        cartQuantitiesByProduct.get(product.id) ?? 0
                      }
                      onAdd={() => handleAdd(product)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="hidden min-h-0 w-[min(340px,40vw)] shrink-0 flex-col md:flex lg:w-[min(380px,34vw)]">
            <CartPanel
              onCheckout={cartCheckout}
              checkoutDisabled={payLocked || cart.length === 0}
              checkoutBlockedReason={
                checkoutBlockedReason ? t(checkoutBlockedReason) : null
              }
              discountsEnabled={discountsEnabled}
              promoCartDiscount={promoCartDiscount}
              promoItemSavings={promoItemSavings}
              promoAdjustedSubtotal={promoAdjustedSubtotal}
              promoLabels={promoLabels}
              loyaltyEnabled={loyaltyEnabled}
              enabledPaymentMethods={enabledPaymentMethods}
              loyaltyRedemptionRate={loyaltyRedemptionRate}
              minimumLoyaltyRedeemPoints={minimumLoyaltyRedeemPoints}
              attachExpanded={attachExpanded}
              onAttachExpandedChange={setAttachExpanded}
              discountOpen={discountOpen}
              onDiscountOpenChange={setDiscountOpen}
              onRequestClearCart={() => setClearConfirmOpen(true)}
            />
            {checkoutBlocked ? (
              <div className="mt-2.5 space-y-2.5 rounded-2xl border border-amber-500/25 bg-amber-50/80 p-3.5 text-center dark:bg-amber-500/10">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  {checkoutBlockedReason ? t(checkoutBlockedReason) : null}
                </p>
                {readinessState === "no_session" ? (
                  <QuickOpenSessionButton
                    className="w-full"
                    label="Start selling"
                    pendingOpeningFloat={pendingOpeningFloat}
                  />
                ) : readinessState === "session_expired" && activeSession ? (
                  <Button
                    type="button"
                    className="h-11 w-full rounded-xl"
                    onClick={() => setCloseSessionTargetId(activeSession.id)}
                  >
                    <CircleStop className="size-4" aria-hidden />
                    {t("Close session")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </aside>

          <Sheet open={mobileActionsOpen} onOpenChange={setMobileActionsOpen}>
            <SheetContent
              side={language === "ar" ? "right" : "left"}
              className="w-[min(88vw,22rem)] gap-0 p-0 sm:hidden"
            >
              <SheetHeader className="border-b border-border/70 px-4 py-4 text-start">
                <SheetTitle>{t("Cashier actions")}</SheetTitle>
                <SheetDescription className="flex items-center gap-2">
                  <CircleUserRound
                    className="size-4 text-primary"
                    aria-hidden
                  />
                  <span className="truncate">
                    {currentUserName ?? cashierName ?? t("Cashier")}
                  </span>
                </SheetDescription>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {hasActiveSession ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full justify-start gap-3 rounded-xl border-indigo-200 bg-indigo-50 px-3 text-indigo-900 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
                      onClick={() => {
                        setMobileActionsOpen(false);
                        setSessionOrdersOpen(true);
                      }}
                    >
                      <History className="size-4" aria-hidden />
                      {t("Session invoices")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full justify-start gap-3 rounded-xl border-sky-200 bg-sky-50 px-3 text-sky-900 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200 dark:hover:bg-sky-500/20"
                      onClick={() => {
                        setMobileActionsOpen(false);
                        setOnlineOrdersOpen(true);
                      }}
                    >
                      <ClipboardList className="size-4" aria-hidden />
                      <span className="flex-1 text-start">
                        {t("Online orders")}
                      </span>
                      {activeOnlineOrdersCount > 0 ? (
                        <span className="rounded-full bg-sky-700 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums dark:bg-sky-400 dark:text-sky-950">
                          {activeOnlineOrdersCount}
                        </span>
                      ) : null}
                    </Button>
                    {canCollectPayment ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full justify-start gap-3 rounded-xl border-emerald-200 bg-emerald-50 px-3 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                        onClick={() => {
                          setMobileActionsOpen(false);
                          setCollectOpen(true);
                        }}
                      >
                        <Banknote className="size-4" aria-hidden />
                        {t("Collect from customer")}
                      </Button>
                    ) : null}
                    {canPaySupplier ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full justify-start gap-3 rounded-xl border-amber-200 bg-amber-50 px-3 text-amber-900 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
                        onClick={() => {
                          setMobileActionsOpen(false);
                          setSupplierPayOpen(true);
                        }}
                      >
                        <Truck className="size-4" aria-hidden />
                        {t("Pay supplier")}
                      </Button>
                    ) : null}
                    {canAddSessionExpense &&
                    storeId &&
                    cashierId &&
                    sessionId ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full justify-start gap-3 rounded-xl border-rose-200 bg-rose-50 px-3 text-rose-900 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20"
                        onClick={() => {
                          setMobileActionsOpen(false);
                          setMobileExpenseOpen(true);
                        }}
                      >
                        <Wallet className="size-4" aria-hidden />
                        {t("Session expense")}
                      </Button>
                    ) : null}
                    {cashDrawerEnabled ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full justify-start gap-3 rounded-xl border-violet-200 bg-violet-50 px-3 text-violet-900 hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200 dark:hover:bg-violet-500/20"
                        disabled={pending}
                        onClick={() => {
                          setMobileActionsOpen(false);
                          handleOpenCashDrawer();
                        }}
                      >
                        <Archive className="size-4" aria-hidden />
                        {t("Open drawer")}
                      </Button>
                    ) : null}
                    {heldCartCount > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full justify-start gap-3 rounded-xl border-orange-200 bg-orange-50 px-3 text-orange-950 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200 dark:hover:bg-orange-500/20"
                        onClick={() => {
                          setMobileActionsOpen(false);
                          setMobileHeldCartsOpen(true);
                        }}
                      >
                        <Clock3 className="size-4" aria-hidden />
                        <span className="flex-1 text-start">
                          {t("Held invoices")}
                        </span>
                        <span className="rounded-full bg-orange-700 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums dark:bg-orange-400 dark:text-orange-950">
                          {heldCartCount}
                        </span>
                      </Button>
                    ) : null}
                  </>
                ) : null}

                {cart.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full justify-start gap-3 rounded-xl border-cyan-200 bg-cyan-50 px-3 text-cyan-900 hover:bg-cyan-100 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                    onClick={() => {
                      setMobileActionsOpen(false);
                      openDraftReceipt();
                    }}
                  >
                    <ReceiptText className="size-4" aria-hidden />
                    {t("Draft receipt")}
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full justify-start gap-3 rounded-xl px-3"
                  aria-pressed={showProductImages}
                  onClick={() => {
                    toggleProductImages();
                    setMobileActionsOpen(false);
                  }}
                >
                  {showProductImages ? (
                    <ImageOff className="size-4" aria-hidden />
                  ) : (
                    <ImageIcon className="size-4" aria-hidden />
                  )}
                  {showProductImages ? t("Without images") : t("With images")}
                </Button>

                {(readinessState === "ready" ||
                  readinessState === "session_warning" ||
                  readinessState === "session_expired") &&
                hasActiveSession &&
                activeSession &&
                sessionReconciliation ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full justify-start gap-3 rounded-xl px-3"
                    onClick={() => {
                      setMobileActionsOpen(false);
                      setCloseSessionTargetId(activeSession.id);
                    }}
                  >
                    <CircleStop className="size-4" aria-hidden />
                    {t("Close session")}
                  </Button>
                ) : null}

                <div className="mt-auto [&_button]:h-12 [&_button]:w-full [&_button]:justify-start [&_button]:gap-3 [&_button]:rounded-xl [&_button]:border [&_button]:bg-muted/35 [&_button]:px-3">
                  <PosPinSwitch returnTo={posPath} menuItem />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {mobileExpenseOpen &&
          canAddSessionExpense &&
          storeId &&
          cashierId &&
          sessionId ? (
            <ExpenseWizard
              storeId={storeId}
              sessionId={sessionId}
              userId={cashierId}
              costCenters={costCenters}
              categories={expenseCategories}
              sessionMode
              defaultOpen
              onOpenChange={setMobileExpenseOpen}
            />
          ) : null}

          <PosHeldCartsBar
            hideTrigger
            open={mobileHeldCartsOpen}
            onOpenChange={setMobileHeldCartsOpen}
          />

          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetContent
              side="bottom"
              showCloseButton
              className="flex h-[min(94dvh,100%)] max-h-[min(94dvh,100%)] flex-col gap-0 overflow-hidden rounded-t-2xl border-t p-0 max-[390px]:h-[min(96dvh,100%)] max-[390px]:max-h-[min(96dvh,100%)] data-[side=bottom]:h-[min(94dvh,100%)] data-[side=bottom]:max-[390px]:h-[min(96dvh,100%)]"
            >
              <div className="flex justify-center pb-0.5 pt-1.5" aria-hidden>
                <span className="h-1 w-9 rounded-full bg-muted-foreground/35" />
              </div>
              <SheetHeader className="flex shrink-0 flex-row items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5 pe-14 text-start">
                <SheetTitle className="min-w-0 truncate text-sm font-semibold">
                  {t("Cart")}
                  {cartItemCount > 0 ? (
                    <span className="ms-1.5 text-xs font-medium text-muted-foreground">
                      · {cartItemCount}{" "}
                      {t(cartItemCount === 1 ? "item" : "items")}
                    </span>
                  ) : null}
                </SheetTitle>
                <SheetDescription className="shrink-0 text-xs font-bold tabular-nums text-foreground">
                  {cartTotal === 0
                    ? t("Add items to continue")
                    : `${t("Total")} ${formatCurrency(cartTotal, "EGP", locale)}`}
                </SheetDescription>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <CartPanel
                  onCheckout={(method) => {
                    setCartOpen(false);
                    cartCheckout(method);
                  }}
                  checkoutDisabled={payLocked || cart.length === 0}
                  checkoutBlockedReason={
                    checkoutBlockedReason ? t(checkoutBlockedReason) : null
                  }
                  discountsEnabled={discountsEnabled}
                  promoCartDiscount={promoCartDiscount}
                  promoItemSavings={promoItemSavings}
                  promoAdjustedSubtotal={promoAdjustedSubtotal}
                  promoLabels={promoLabels}
                  loyaltyEnabled={loyaltyEnabled}
                  enabledPaymentMethods={enabledPaymentMethods}
                  loyaltyRedemptionRate={loyaltyRedemptionRate}
                  minimumLoyaltyRedeemPoints={minimumLoyaltyRedeemPoints}
                  attachExpanded={attachExpanded}
                  onAttachExpandedChange={setAttachExpanded}
                  discountOpen={discountOpen}
                  onDiscountOpenChange={setDiscountOpen}
                  onRequestClearCart={() => setClearConfirmOpen(true)}
                />
                {checkoutBlocked ? (
                  <div className="space-y-2 border-t border-border/60 p-2.5 text-center">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                      {checkoutBlockedReason ? t(checkoutBlockedReason) : null}
                    </p>
                    {readinessState === "no_session" ? (
                      <QuickOpenSessionButton
                        className="w-full"
                        label={t("Start selling now")}
                        pendingOpeningFloat={pendingOpeningFloat}
                      />
                    ) : readinessState === "session_expired" &&
                      activeSession ? (
                      <Button
                        type="button"
                        className="h-11 w-full rounded-xl"
                        onClick={() => {
                          setCartOpen(false);
                          setCloseSessionTargetId(activeSession.id);
                        }}
                      >
                        <CircleStop className="size-4" aria-hidden />
                        {t("Close session")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>

          <PosCreditCheckoutDialog
            open={creditOpen}
            onOpenChange={setCreditOpen}
            total={cartPayableTotal}
            customer={customer}
            enabledMethods={enabledPaymentMethods}
            loading={checkoutSaving}
            onConfirm={handleCreditConfirm}
          />

          <VariantPickerDialog
            open={Boolean(pickerProduct)}
            product={pickerProduct}
            allowNegativeStock={allowNegativeStock}
            onClose={() => setPickerProduct(null)}
            onSelect={(product, variant) => {
              if (enableModifiers) {
                setPendingModifierVariant(variant);
                setPickerProduct(null);
                setModifierProduct(product);
                return;
              }
              addToCart(product, variant);
            }}
          />
          <PosModifierPicker
            open={Boolean(modifierProduct)}
            productId={modifierProduct?.id ?? ""}
            productName={modifierProduct?.name ?? ""}
            currency={receiptBranding.currency ?? "EGP"}
            onClose={() => {
              setModifierProduct(null);
              setPendingModifierVariant(null);
            }}
            onConfirm={(modifiers) => {
              if (!modifierProduct) return;
              addToCart(modifierProduct, pendingModifierVariant, modifiers);
              setModifierProduct(null);
              setPendingModifierVariant(null);
            }}
          />
          <Dialog open={onlineOrdersOpen} onOpenChange={setOnlineOrdersOpen}>
            <DialogContent className="max-h-[min(94dvh,100%)] w-[calc(100%-0.75rem)] max-w-[min(980px,calc(100%-0.75rem))] overflow-hidden p-0 max-sm:rounded-2xl sm:max-w-[min(980px,calc(100%-1rem))]">
              <DialogHeader className="border-b border-border/70 px-3 py-3 sm:px-4">
                <DialogTitle className="flex items-center gap-2 pe-8 text-base sm:text-lg">
                  <ClipboardList className="size-5 text-primary" />
                  {t("Online Orders")}
                  {activeOnlineOrdersCount > 0 ? (
                    <span className="rounded-full bg-sky-700 px-2 py-0.5 text-xs font-bold text-white tabular-nums dark:bg-sky-400 dark:text-sky-950">
                      {activeOnlineOrdersCount}
                    </span>
                  ) : null}
                </DialogTitle>
              </DialogHeader>
              <div className="max-h-[calc(94dvh-56px)] overflow-y-auto overscroll-y-contain p-2">
                <OnlineOrdersPageClient
                  orders={onlineOrders}
                  products={onlineOrderProducts}
                  compact
                  enabledPaymentMethods={enabledPaymentMethods}
                  receiptBranding={receiptBranding}
                />
              </div>
            </DialogContent>
          </Dialog>
          {canCollectPayment ? (
            <PosCollectFlowDialog
              open={collectOpen}
              onOpenChange={setCollectOpen}
            />
          ) : null}
          {canPaySupplier ? (
            <PosSupplierPayDialog
              open={supplierPayOpen}
              onOpenChange={setSupplierPayOpen}
              storeId={storeId}
            />
          ) : null}
          <WeightAmountModal
            open={Boolean(weightProduct)}
            onOpenChange={(open) => {
              if (!open) setWeightProduct(null);
            }}
            product={weightProduct}
            scaleEnabled={scaleEnabled}
            scaleSettings={scaleSettings}
            onConfirm={({
              quantity,
              unitPrice,
              saleInputMode,
              enteredAmount,
            }) => {
              if (!weightProduct) return;
              const resolved = resolveCheckoutVariant(weightProduct);
              addItem({
                productId: weightProduct.id,
                variantId: resolved?.id ?? null,
                name: weightProduct.name,
                quantity,
                unitPrice:
                  unitPrice > 0
                    ? unitPrice
                    : (resolved?.price ?? weightProduct.base_price),
                categoryId: weightProduct.category_id ?? null,
                modifiers: [],
                imageUrl: weightProduct.image_url,
                saleUnit: weightProduct.sale_unit,
                saleInputMode,
                enteredAmount,
              });
              playPosScanSound();
              setWeightProduct(null);
            }}
          />
        </div>

        <div className="flex shrink-0 gap-2 pb-[max(0rem,calc(env(safe-area-inset-bottom)-0.5rem))] md:hidden">
          <Button
            type="button"
            className="flex h-12 min-w-0 flex-1 items-center justify-between gap-2.5 rounded-xl px-2.5 py-1 text-sm shadow-md transition active:scale-[0.99] sm:h-13 sm:px-3"
            onClick={() => setCartOpen(true)}
            aria-label={
              cartItemCount > 0
                ? `${t("Open cart")}, ${cartItemCount} ${t("items")}, ${t("Total")} ${formatCurrency(cartTotal, "EGP", locale)}`
                : t("Open cart")
            }
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15 sm:size-10">
                <ShoppingCart className="size-4.5" />
                {cartItemCount > 0 ? (
                  <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1 text-[11px] font-bold text-primary tabular-nums">
                    {cartItemCount > 99 ? "99+" : cartItemCount}
                  </span>
                ) : null}
              </span>
              <span className="min-w-0 text-start">
                <span className="block truncate text-sm font-semibold leading-tight">
                  {cartItemCount === 0
                    ? t("Cart is empty")
                    : `${cartItemCount} ${t(cartItemCount === 1 ? "item" : "items")}`}
                </span>
                <span className="block text-xs font-medium text-primary-foreground/80">
                  {t(cartItemCount === 0 ? "Tap to continue" : "Tap to pay")}
                </span>
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="text-lg font-bold tabular-nums leading-none">
                {cartTotal === 0 ? "—" : formatCurrency(cartTotal)}
              </span>
              {cartItemCount > 0 ? (
                <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[11px] font-bold tracking-wide text-primary-foreground">
                  {t("Pay")}
                </span>
              ) : null}
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 shrink-0 rounded-xl sm:hidden"
            onClick={() => setMobileActionsOpen(true)}
            aria-label={t("Cashier actions")}
            title={t("Cashier actions")}
          >
            <Menu className="size-5" aria-hidden />
          </Button>
        </div>
      </div>
      {lastReceipt && receiptEnabled ? (
        <PosReceiptSuccessDialog
          open={Boolean(lastReceipt)}
          receipt={lastReceipt}
          onOpenChange={(open) => {
            if (!open) setLastReceipt(null);
          }}
          onUsbPrint={handleUsbPrintReceipt}
          onBrowserPrint={handleBrowserPrintReceipt}
          onWhatsApp={handleSendWhatsAppReceipt}
        />
      ) : null}
      {draftReceipt ? (
        <PosReceiptSuccessDialog
          mode="draft"
          open={Boolean(draftReceipt)}
          receipt={draftReceipt}
          onOpenChange={(open) => {
            if (!open) setDraftReceipt(null);
          }}
          onUsbPrint={() => handleUsbPrintReceipt(draftReceipt)}
          onBrowserPrint={() => handleBrowserPrintReceipt(draftReceipt)}
          onWhatsApp={(phoneOverride) =>
            sendWhatsAppReceipt(draftReceipt, phoneOverride)
          }
        />
      ) : null}
      {hasActiveSession ? (
        <PosSessionOrdersDialog
          open={sessionOrdersOpen}
          onOpenChange={setSessionOrdersOpen}
          branding={receiptBranding}
          refreshKey={sessionOrdersRefreshKey}
          onUsbPrint={handleUsbPrintReceipt}
          onBrowserPrint={handleBrowserPrintReceipt}
          onWhatsApp={sendWhatsAppReceipt}
        />
      ) : null}
      <ConfirmActionDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title={t("Clear cart?")}
        description={t(
          "All items in the current sale will be removed. Held carts are not affected.",
        )}
        confirmLabel={t("Clear cart")}
        destructive
        onConfirm={() => {
          clearCart();
          setDiscountOpen(false);
        }}
      />
      <ManagerOverrideDialog
        open={Boolean(overrideDialog)}
        onOpenChange={(open) => {
          if (!open) setOverrideDialog(null);
        }}
        title={overrideDialog?.title ?? t("Manager approval")}
        defaultReason={overrideDialog?.defaultReason ?? ""}
        onConfirm={(reason, pin) => {
          if (!overrideDialog) return;
          if (overrideDialog.kind === "cash_drawer") {
            if (pending) return;
            confirmCashDrawer(reason, pin);
            return;
          }
          if (checkoutSaving) return;
          if (overrideDialog.payments) {
            runCheckout(
              overrideDialog.payments,
              reason,
              overrideDialog.accountCollection ?? 0,
              pin,
            );
          }
        }}
      />
    </>
  );
}
