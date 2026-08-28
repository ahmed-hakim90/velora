"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { BookOpen, Landmark, Plus, Power, ScrollText, Sparkles, BarChart3, FileSpreadsheet, Scale, Wallet, Upload, Layers } from "lucide-react";
import { PageHeader } from "@/components/Velora/page-header";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { KpiCard } from "@/components/Velora/kpi-card";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { OperationalCard } from "@/components/Velora/operational-card";
import { ResponsiveListLayout } from "@/components/Velora/responsive-list-layout";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { Badge } from "@/components/ui/badge";
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
import { Dialog } from "@/components/ui/dialog";
import { StandardModalContent } from "@/components/Velora/standard-modal";
import type { GlAccountType } from "@/lib/types";
import {
  createGlAccountAction,
  deactivateGlAccountAction,
  updateGlAccountAction,
} from "@/modules/accounting/actions/gl-account.actions";
import { AccountingSubnav } from "@/modules/accounting/components/accounting-subnav";
import { useTranslation } from "@/lib/i18n/use-translation";
import { CoaImportDialog } from "@/modules/accounting/components/coa-import-dialog";
import { ModuleAnalyticsQuickLinks } from "@/modules/reports/components/module-analytics-quick-links";
import type { AccountingOverview } from "@/modules/accounting/services/accounting-overview.service";
import type { GlAccountTreeNode } from "@/modules/accounting/services/gl-account.service";

const TYPE_LABELS: Record<GlAccountType, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expense",
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  sale: "Sale",
  expense: "Expense",
  purchase: "Purchase",
  customer_payment: "Customer payment",
  supplier_payment: "Supplier payment",
  refund: "Refund / reversal",
  adjustment: "Adjustment",
  waste: "Waste",
  customs_certificate: "Customs certificate",
};

interface ChartOfAccountsPageProps {
  accounts: GlAccountTreeNode[];
  flat: GlAccountTreeNode[];
  overview: AccountingOverview;
  canManage: boolean;
}

export function ChartOfAccountsPage({
  accounts,
  flat,
  overview,
  canManage,
}: ChartOfAccountsPageProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | GlAccountType>("all");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    account_type: "expense" as GlAccountType,
    parent_id: "",
    is_postable: true,
  });

  const typeCounts = useMemo(() => {
    const counts: Record<GlAccountType, number> = {
      asset: 0,
      liability: 0,
      equity: 0,
      revenue: 0,
      expense: 0,
    };
    for (const a of flat) {
      if (a.is_active) counts[a.account_type] += 1;
    }
    return counts;
  }, [flat]);

  const visible = useMemo(() => {
    const q = query.trim();
    return flat.filter((a) => {
      if (typeFilter !== "all" && a.account_type !== typeFilter) return false;
      if (!q) return true;
      return (
        a.code.includes(q) ||
        a.name.includes(q) ||
        (a.system_key ?? "").includes(q)
      );
    });
  }, [flat, query, typeFilter]);

  const resetForm = () =>
    setForm({
      code: "",
      name: "",
      account_type: "expense",
      parent_id: "",
      is_postable: true,
    });

  const onCreate = () => {
    startTransition(async () => {
      const result = await createGlAccountAction({
        code: form.code,
        name: form.name,
        account_type: form.account_type,
        parent_id: form.parent_id || null,
        is_postable: form.is_postable,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("Account added"));
      setOpen(false);
      resetForm();
      router.refresh();
    });
  };

  const onToggleActive = (account: GlAccountTreeNode) => {
    startTransition(async () => {
      const result = account.is_active
        ? await deactivateGlAccountAction(account.id)
        : await updateGlAccountAction(account.id, { is_active: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(account.is_active ? t("Account disabled") : t("Account enabled"));
      router.refresh();
    });
  };

  const onTogglePostable = (account: GlAccountTreeNode) => {
    startTransition(async () => {
      const result = await updateGlAccountAction(account.id, {
        is_postable: !account.is_postable,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        account.is_postable ? t("Account is now a summary account") : t("Account is now postable")
      );
      router.refresh();
    });
  };

  return (
    <>
      <PageHeader
        breadcrumb={
          <span>
            <Link href="/accounting" className="text-primary hover:underline">
              {t("Accounting")}
            </Link>
            <span className="mx-1 text-muted-foreground">/</span>
            {t("Chart of accounts")}
          </span>
        }
        title={t("Chart of accounts")}
        description={t("Account tree used for journal entries and automatic posting.")}
        action={
          canManage ? (
            <CompactActions>
              <CompactAction
                label={t("Import tree")}
                icon={Upload}
                onClick={() => setImportOpen(true)}
              />
              <CompactAction
                label={t("New account")}
                icon={Plus}
                variant="default"
                alwaysLabeled
                onClick={() => setOpen(true)}
              />
            </CompactActions>
          ) : undefined
        }
      />

      <div className="mb-3">
        <AccountingSubnav />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label={t("Active accounts")}
          value={String(overview.accountCount)}
          change={`${overview.postableCount} ${t("postable")}`}
          trend="neutral"
          icon={<Landmark className="size-5" />}
        />
        <KpiCard
          label={t("Posted entries")}
          value={String(overview.postedCount)}
          change={`${overview.autoPostedCount} ${t("automatic")}`}
          trend="up"
          icon={<ScrollText className="size-5" />}
        />
        <KpiCard
          label={t("Drafts")}
          value={String(overview.draftCount)}
          change={overview.draftCount > 0 ? t("Need posting") : t("Nothing pending")}
          trend={overview.draftCount > 0 ? "down" : "neutral"}
          icon={<BookOpen className="size-5" />}
        />
        <KpiCard
          label={t("Voided")}
          value={String(overview.voidCount)}
          change={t("From the latest 200 entries")}
          trend="neutral"
          icon={<Sparkles className="size-5" />}
        />
      </div>

      <div className="mb-4">
        <ModuleAnalyticsQuickLinks
          title={t("Financial reports")}
          description={t("Ledgers are the source of truth. Use these links for details and reports.")}
          links={[
            {
              href: "/accounting/income-statement",
              label: t("Income statement"),
              description: t("Period profit from the ledger"),
              icon: FileSpreadsheet,
            },
            {
              href: "/accounting/trial-balance",
              label: t("Trial balance"),
              description: t("Account balances"),
              icon: Scale,
            },
            {
              href: "/accounting/balance-sheet",
              label: t("Balance sheet"),
              description: t("Financial position"),
              icon: Landmark,
            },
            {
              href: "/reports/pnl",
              label: t("Operational P&L"),
              description: t("Quick estimate from reports"),
              icon: BarChart3,
            },
            {
              href: "/expenses",
              label: t("Expenses"),
              description: t("Record and approve"),
              icon: Wallet,
            },
            {
              href: "/reports/expenses",
              label: t("Expense report"),
              description: t("Summary + Excel"),
              icon: BookOpen,
            },
          ]}
        />
      </div>

      <OperationalCard
        title={t("Accounts")}
        description={`${visible.length} ${t("of")} ${flat.length} · ${t("Assets")} ${typeCounts.asset} · ${t("Liabilities")} ${typeCounts.liability} · ${t("Equity")} ${typeCounts.equity} · ${t("Revenue")} ${typeCounts.revenue} · ${t("Expense")} ${typeCounts.expense}`}
      >
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="coa-search">{t("Search")}</Label>
            <Input
              id="coa-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Account code or name")}
              className="mt-1"
            />
          </div>
          <div>
            <Label>{t("Type")}</Label>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                if (!v) return;
                setTypeFilter(v as "all" | GlAccountType);
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All types")}</SelectItem>
                {(Object.keys(TYPE_LABELS) as GlAccountType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(TYPE_LABELS[type])} ({typeCounts[type]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {accounts.length === 0 ? (
          <EmptyStateBlock
            title={t("No accounts")}
            description={t("The default chart of accounts will be created automatically.")}
          />
        ) : visible.length === 0 ? (
          <EmptyStateBlock
            title={t("No results")}
            description={t("Change the search or type filter.")}
          />
        ) : (
          <ResponsiveListLayout
            mobile={visible.map((account) => (
              <MobileEntityCard
                key={account.id}
                title={account.code}
                subtitle={
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span>{account.name}</span>
                    {account.is_system ? (
                      <Badge variant="secondary">{t("System")}</Badge>
                    ) : null}
                    {!account.is_postable ? (
                      <Badge variant="outline">{t("Summary")}</Badge>
                    ) : null}
                  </span>
                }
                badge={
                  <Badge variant="outline">
                    {t(TYPE_LABELS[account.account_type])}
                  </Badge>
                }
                fields={[
                  {
                    label: t("Status"),
                    value: account.is_active ? (
                      <span className="text-emerald-700 dark:text-emerald-400">{t("Active")}</span>
                    ) : (
                      <span className="text-muted-foreground">{t("Disabled")}</span>
                    ),
                  },
                ]}
                footer={
                  <CompactActions className="w-full justify-end">
                    {account.is_postable ? (
                      <CompactAction
                        label={t("Ledger")}
                        icon={BookOpen}
                        href={`/accounting/ledger?accountId=${account.id}`}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("No ledger")}</span>
                    )}
                    {canManage && !account.is_system ? (
                      <>
                        <CompactAction
                          label={account.is_postable ? t("Summary") : t("Postable")}
                          icon={Layers}
                          variant="ghost"
                          disabled={pending}
                          onClick={() => onTogglePostable(account)}
                        />
                        <CompactAction
                          label={account.is_active ? t("Disable") : t("Enable")}
                          icon={Power}
                          variant="ghost"
                          disabled={pending}
                          onClick={() => onToggleActive(account)}
                        />
                      </>
                    ) : null}
                  </CompactActions>
                }
              />
            ))}
            desktop={
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">{t("Code")}</th>
                      <th className="px-3 py-2 text-start font-medium">{t("Name")}</th>
                      <th className="px-3 py-2 text-start font-medium">{t("Type")}</th>
                      <th className="px-3 py-2 text-start font-medium">{t("Status")}</th>
                      <th className="px-3 py-2 text-start font-medium">{t("Ledger")}</th>
                      {canManage ? (
                        <th className="px-3 py-2 text-start font-medium">{t("Action")}</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((account) => (
                      <tr key={account.id} className="border-t">
                        <td
                          className="px-3 py-2 font-mono tabular-nums"
                          style={{ paddingInlineStart: `${12 + account.depth * 16}px` }}
                        >
                          {account.code}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{account.name}</span>
                            {account.is_system ? (
                              <Badge variant="secondary">{t("System")}</Badge>
                            ) : null}
                            {!account.is_postable ? (
                              <Badge variant="outline">{t("Summary")}</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline">
                            {t(TYPE_LABELS[account.account_type])}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {account.is_active ? (
                            <span className="text-emerald-700 dark:text-emerald-400">{t("Active")}</span>
                          ) : (
                            <span className="text-muted-foreground">{t("Disabled")}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {account.is_postable ? (
                            <Link
                              href={`/accounting/ledger?accountId=${account.id}`}
                              className="text-sm text-primary underline-offset-2 hover:underline"
                            >
                              {t("Ledger")}
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        {canManage ? (
                          <td className="px-3 py-2">
                            {!account.is_system ? (
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={pending}
                                  onClick={() => onTogglePostable(account)}
                                >
                                  {account.is_postable ? t("Summary") : t("Postable")}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={pending}
                                  onClick={() => onToggleActive(account)}
                                >
                                  {account.is_active ? t("Disable") : t("Enable")}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          />
        )}
      </OperationalCard>

      {overview.recentPosted.length > 0 ? (
        <OperationalCard
          title={t("Latest posted entries")}
          description={t("From sales, expenses, and manual entries")}
          className="mt-4"
        >
          <ResponsiveListLayout
            mobile={overview.recentPosted.map((entry) => (
              <MobileEntityCard
                key={entry.id}
                href="/accounting/journals"
                title={entry.entry_number}
                subtitle={entry.memo || "—"}
                fields={[
                  { label: t("Date"), value: entry.entry_date },
                  {
                    label: t("Source"),
                    value: t(SOURCE_LABELS[entry.source] ?? entry.source),
                  },
                ]}
                trailingHint={`${t("Open entries")} ←`}
              />
            ))}
            desktop={
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">{t("Number")}</th>
                      <th className="px-3 py-2 text-start font-medium">{t("Date")}</th>
                      <th className="px-3 py-2 text-start font-medium">{t("Memo")}</th>
                      <th className="px-3 py-2 text-start font-medium">{t("Source")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentPosted.map((entry) => (
                      <tr key={entry.id} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">
                          <Link
                            href="/accounting/journals"
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {entry.entry_number}
                          </Link>
                        </td>
                        <td className="px-3 py-2 tabular-nums">{entry.entry_date}</td>
                        <td className="px-3 py-2">{entry.memo || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {t(SOURCE_LABELS[entry.source] ?? entry.source)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          />
        </OperationalCard>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) resetForm();
          setOpen(v);
        }}
      >
        <StandardModalContent
          size="sm"
          title={t("New account")}
          description={t("Add an account under the current chart. System accounts are protected.")}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                {t("Cancel")}
              </Button>
              <Button
                type="button"
                className="h-11 rounded-xl font-semibold"
                disabled={pending}
                onClick={onCreate}
              >
                {t("Save")}
              </Button>
            </>
          }
        >
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coa-code">{t("Code")}</Label>
              <Input
                id="coa-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coa-name">{t("Name")}</Label>
              <Input
                id="coa-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Type")}</Label>
              <Select
                value={form.account_type}
                onValueChange={(v) => {
                  if (!v) return;
                  setForm((f) => ({ ...f, account_type: v as GlAccountType }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as GlAccountType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(TYPE_LABELS[type])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Parent account (optional)")}</Label>
              <Select
                value={form.parent_id || "__none__"}
                onValueChange={(v) => {
                  if (v == null) return;
                  setForm((f) => ({
                    ...f,
                    parent_id: v === "__none__" ? "" : v,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("No parent")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("No parent")}</SelectItem>
                  {flat
                    .filter((a) => a.account_type === form.account_type)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={form.is_postable}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, is_postable: v === true }))
                }
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">{t("Postable")}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t("Turn off for a summary account that cannot receive entries")}
                </span>
              </span>
            </label>
          </div>
        </StandardModalContent>
      </Dialog>

      <CoaImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => router.refresh()}
      />
    </>
  );
}
