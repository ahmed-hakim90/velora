"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search, Star, UserPlus, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PosCustomerSearchResult } from "@/modules/pos/actions/customer-attach.action";
import { usePosStore } from "@/stores/pos-store";
import { useTranslation } from "@/lib/i18n/use-translation";
import { formatCurrency } from "@/lib/format";
import { firstGrapheme } from "@/lib/first-grapheme";
import { validatePosCustomerDraft } from "@/modules/pos/lib/customer-input-validation";

const SEARCH_DEBOUNCE_MS = 250;

function splitQueryHint(query: string): { name: string; phone: string } {
  const trimmed = query.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 3 && digits.length >= trimmed.replace(/\s+/g, "").length * 0.6) {
    return { name: "", phone: trimmed };
  }
  return { name: trimmed, phone: "" };
}

async function searchCustomersApi(query: string): Promise<PosCustomerSearchResult[]> {
  const res = await fetch(`/api/pos/customers?q=${encodeURIComponent(query)}`, {
    method: "GET",
    credentials: "same-origin",
  });
  const data = (await res.json()) as {
    customers?: PosCustomerSearchResult[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || "Could not search customers");
  }
  return data.customers ?? [];
}

async function createCustomerApi(input: {
  name: string;
  phone: string;
}): Promise<PosCustomerSearchResult> {
  const res = await fetch("/api/pos/customers", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as {
    customer?: PosCustomerSearchResult;
    error?: string;
  };
  if (!res.ok || !data.customer) {
    throw new Error(data.error || "Could not add customer");
  }
  return data.customer;
}

async function fetchLoyaltyBalanceApi(customerId: string): Promise<number> {
  const res = await fetch(`/api/pos/customers/${customerId}/loyalty`, {
    method: "GET",
    credentials: "same-origin",
  });
  const data = (await res.json()) as { balance?: number; error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Could not load loyalty points");
  }
  return data.balance ?? 0;
}

export function CustomerAttach({
  loyaltyEnabled = false,
  expanded: expandedProp,
  onExpandedChange,
}: {
  loyaltyEnabled?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const { t } = useTranslation();
  const customer = usePosStore((s) => s.customer);
  const loyaltyBalance = usePosStore((s) => s.customerLoyaltyBalance);
  const setCustomer = usePosStore((s) => s.setCustomer);
  const setCustomerLoyaltyBalance = usePosStore((s) => s.setCustomerLoyaltyBalance);
  const [phone, setPhone] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createErrors, setCreateErrors] = useState<{ name?: string; phone?: string; form?: string }>({});
  const [expandedInternal, setExpandedInternal] = useState(false);
  const [results, setResults] = useState<PosCustomerSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const searchSeqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const controlled = expandedProp !== undefined;
  const expanded = controlled ? expandedProp : expandedInternal;
  const hasSearchQuery = phone.trim().length >= 3;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function setExpanded(next: boolean) {
    if (!next) {
      setPhone("");
      setResults([]);
      setSearchError(null);
      setSearching(false);
      setCreateOpen(false);
      setCreateName("");
      setCreatePhone("");
      setCreateErrors({});
      searchSeqRef.current += 1;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
    if (!controlled) setExpandedInternal(next);
    onExpandedChange?.(next);
  }

  function attachCustomer(c: PosCustomerSearchResult) {
    setCustomer(c);
    setExpanded(false);
    setPhone("");
    setResults([]);
    if (c.account_balance > 0) {
      toast.info(`${c.name}: ${t("Due")} ${formatCurrency(c.account_balance)}`);
    }
    if (!loyaltyEnabled) {
      setCustomerLoyaltyBalance(null);
      setLoyaltyLoading(false);
      return;
    }

    if (typeof c.loyalty_balance === "number") {
      setCustomerLoyaltyBalance(c.loyalty_balance);
      setLoyaltyLoading(false);
      if (c.loyalty_balance > 0) {
        toast.info(`${c.name}: ${c.loyalty_balance} ${t("points available")}`);
      }
      return;
    }

    setLoyaltyLoading(true);
    setCustomerLoyaltyBalance(null);
    startTransition(async () => {
      try {
        const balance = await fetchLoyaltyBalanceApi(c.id);
        setCustomerLoyaltyBalance(balance);
        if (balance > 0) {
          toast.info(`${c.name}: ${balance} ${t("points available")}`);
        }
      } catch {
        setCustomerLoyaltyBalance(0);
      } finally {
        setLoyaltyLoading(false);
      }
    });
  }

  function handlePhoneChange(value: string) {
    const query = value.trim();
    setPhone(value);
    setSearchError(null);
    setResults([]);
    const seq = ++searchSeqRef.current;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 3) {
      setSearching(false);
      return;
    }
    setSearching(true);

    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const found = await searchCustomersApi(query);
          if (seq !== searchSeqRef.current) return;
          setResults(found);
          setSearchError(null);
        } catch (error) {
          if (seq !== searchSeqRef.current) return;
          setResults([]);
          const message = t(error instanceof Error ? error.message : "Could not search customers");
          setSearchError(message);
        } finally {
          if (seq === searchSeqRef.current) setSearching(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);
  }

  function openCreateForm() {
    searchSeqRef.current += 1;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearching(false);
    const hint = splitQueryHint(phone);
    setCreateName(hint.name || t("Guest"));
    setCreatePhone(hint.phone);
    setCreateErrors({});
    setCreateOpen(true);
  }

  function handleCreate() {
    const name = createName.trim();
    const phoneValue = createPhone.trim();
    const validation = validatePosCustomerDraft(name, phoneValue);
    const nextErrors: typeof createErrors = {
      name:
        validation.name === "required"
          ? t("Enter customer name")
          : validation.name === "too_short"
            ? t("Customer name must be at least two characters")
            : undefined,
      phone:
        validation.phone === "required"
          ? t("Enter phone number")
          : validation.phone === "invalid"
            ? t("Enter a valid phone number")
            : undefined,
    };
    if (nextErrors.name || nextErrors.phone) {
      setCreateErrors(nextErrors);
      return;
    }
    setCreateErrors({});
    startTransition(async () => {
      try {
        const created = await createCustomerApi({
          name,
          phone: phoneValue,
        });
        toast.success(`${t("Added")} ${created.name}`);
        attachCustomer(created);
      } catch (error) {
        setCreateErrors({ form: t(error instanceof Error ? error.message : "Could not add customer") });
      }
    });
  }

  if (!customer && !expanded) {
    return (
      <div className="border-b px-2 py-1 sm:px-3 sm:py-1.5">
        <button
          type="button"
          className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-2.5 py-1.5 text-start transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          onClick={() => setExpanded(true)}
          aria-label={t("Add customer to invoice")}
          aria-keyshortcuts="F6"
          title={`${t("Add customer")} (F6)`}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <UserRound className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{t("Add customer")}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {t("Search by name or phone · required for credit sales")}
            </p>
          </div>
          <UserPlus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="border-b px-2 py-1 sm:px-3 sm:py-1.5">
      {customer ? (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-0.5 sm:py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-semibold text-primary">
            {customer.name.trim() ? firstGrapheme(customer.name) : <UserRound className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{customer.name}</p>
            <div className="mt-0.5 flex min-w-0 items-center gap-1 overflow-hidden">
              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground" dir="ltr">
                {customer.phone}
              </p>
              {customer.account_balance > 0 ? (
                <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                  {t("Due")} {formatCurrency(customer.account_balance)}
                </span>
              ) : null}
              {loyaltyEnabled && loyaltyLoading ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Star className="size-3 animate-pulse" />
                  {t("Loading points…")}
                </span>
              ) : null}
              {loyaltyEnabled && !loyaltyLoading && loyaltyBalance !== null ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                  <Star className="size-3" />
                  {loyaltyBalance} {t("points")}
                </span>
              ) : null}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-11 shrink-0 rounded-lg"
            aria-label={t("Remove customer")}
            onClick={() => {
              setCustomer(null);
              setLoyaltyLoading(false);
            }}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ) : createOpen ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-1.5 min-[360px]:grid-cols-2">
            <div className="min-w-0">
              <Input
                placeholder={t("Customer name")}
                aria-label={t("Customer name")}
                value={createName}
                onChange={(e) => {
                  setCreateName(e.target.value);
                  if (createErrors.name || createErrors.form) setCreateErrors((current) => ({ ...current, name: undefined, form: undefined }));
                }}
                className="h-11 rounded-lg px-2.5 text-sm"
                aria-invalid={Boolean(createErrors.name)}
                aria-describedby={createErrors.name ? "pos-create-customer-name-error" : undefined}
                autoFocus
              />
              {createErrors.name ? <p id="pos-create-customer-name-error" className="mt-1 text-xs text-destructive" role="alert">{createErrors.name}</p> : null}
            </div>
            <div className="min-w-0">
              <Input
                placeholder={t("Phone number")}
                aria-label={t("Phone number")}
                value={createPhone}
                onChange={(e) => {
                  setCreatePhone(e.target.value);
                  if (createErrors.phone || createErrors.form) setCreateErrors((current) => ({ ...current, phone: undefined, form: undefined }));
                }}
                className="h-11 rounded-lg px-2.5 text-start text-sm"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                aria-invalid={Boolean(createErrors.phone)}
                aria-describedby={createErrors.phone ? "pos-create-customer-phone-error" : undefined}
              />
              {createErrors.phone ? <p id="pos-create-customer-phone-error" className="mt-1 text-xs text-destructive" role="alert">{createErrors.phone}</p> : null}
            </div>
          </div>
          {createErrors.form ? <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-2.5 py-2 text-xs text-destructive" role="alert">{createErrors.form}</p> : null}
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-11 flex-1 rounded-lg text-xs"
              onClick={() => setCreateOpen(false)}
              disabled={pending}
            >
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              className="h-11 flex-1 rounded-lg text-xs"
              onClick={handleCreate}
              disabled={pending}
            >
              <UserPlus className="size-3.5" />
              {t("Save and attach")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("Name or phone number")}
              aria-label={t("Search customers")}
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="h-11 rounded-xl ps-8 pe-11 aria-invalid:ring-destructive/70"
              aria-invalid={Boolean(searchError)}
              aria-describedby={searchError ? "pos-customer-search-error" : undefined}
              autoFocus
            />
            {phone ? (
              <button
                type="button"
                className="absolute end-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                onClick={() => handlePhoneChange("")}
                aria-label={t("Clear search")}
              >
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
          {searching && hasSearchQuery && !searchError && results.length === 0 ? (
            <p className="px-1 py-2 text-center text-xs text-muted-foreground" role="status">
              {t("Searching…")}
            </p>
          ) : searchError ? (
            <div
              id="pos-customer-search-error"
              className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-destructive/25 bg-destructive/5 py-0.5 ps-2.5 pe-0.5"
              role="alert"
            >
              <p className="min-w-0 truncate text-xs text-destructive">{searchError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 shrink-0 rounded-lg text-xs"
                onClick={() => handlePhoneChange(phone)}
              >
                {t("Try again")}
              </Button>
            </div>
          ) : results.length > 0 ? (
            <ul className="max-h-[min(32dvh,11rem)] space-y-1 overflow-y-auto overscroll-y-contain">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-border/70 bg-background px-2 py-1 text-start transition-colors hover:bg-muted/60 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    onClick={() => attachCustomer(c)}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-foreground">
                      {firstGrapheme(c.name, "؟")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground" dir="ltr">
                        {c.phone}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {c.account_balance > 0 ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                          {formatCurrency(c.account_balance)}
                        </span>
                      ) : null}
                      {loyaltyEnabled && typeof c.loyalty_balance === "number" && c.loyalty_balance > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          <Star className="size-3" />
                          {c.loyalty_balance}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : hasSearchQuery ? (
            <p className="px-1 py-2 text-center text-xs text-muted-foreground">
              {t("No results")}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-11 flex-1 rounded-xl"
              onClick={() => setExpanded(false)}
            >
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              className="h-11 flex-1 rounded-xl"
              onClick={openCreateForm}
            >
              <UserPlus className="size-3.5" />
              {t("New guest")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
