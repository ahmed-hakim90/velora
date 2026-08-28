"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  ClipboardList,
  Clock,
  Heart,
  Package,
  Rocket,
  ShoppingCart,
  Warehouse,
} from "lucide-react";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { useTranslation } from "@/lib/i18n/use-translation";

const SETUP_STEPS = [
  {
    title: "Add branches and warehouses",
    body: "Review each branch warehouse. A main warehouse is created automatically, and you can add more when needed.",
    href: "/inventory/warehouses",
    linkLabel: "Manage warehouses",
    icon: Warehouse,
  },
  {
    title: "Add products and categories",
    body: "Create categories and products with prices and barcodes. You can also import an Excel file from Products.",
    href: "/products",
    linkLabel: "Products",
    icon: Package,
  },
  {
    title: "Enable loyalty",
    body: "Set how customers earn and redeem points. Points are calculated automatically with every invoice.",
    href: "/customers/loyalty",
    linkLabel: "Loyalty settings",
    icon: Heart,
  },
] as const;

const DAILY_STEPS = [
  {
    step: "1",
    title: "Open a shift",
    body: "Open a new cashier shift and enter the opening cash in the drawer.",
  },
  {
    step: "2",
    title: "Sell from POS",
    body: "Open the branch POS, enter the cashier PIN, select or scan products, then collect payment.",
  },
  {
    step: "3",
    title: "Redeem loyalty points",
    body: "Available points appear during payment. Enter an amount or use all points to apply the discount.",
  },
  {
    step: "4",
    title: "Close the shift",
    body: "Count the actual cash and close the shift. The system records any variance automatically.",
  },
] as const;

const INVENTORY_TIPS = [
  {
    icon: Warehouse,
    title: "Default warehouse",
    body: "POS sales deduct stock from the branch default warehouse automatically. You can change it from Warehouses.",
  },
  {
    icon: ArrowLeftRight,
    title: "Transfers",
    body: "Move stock between branches and warehouses and track sending and receiving status.",
  },
  {
    icon: ClipboardList,
    title: "Stock count",
    body: "Run regular stock counts. The system compares actual and recorded quantities and shows the variance.",
  },
] as const;

export function GuidePage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader
        title="User Guide"
        description="Set up your store and run daily operations with Velora."
      />

      <OperationalCard
        title={t("First-time setup")}
        description={t("Get ready to sell in a few steps.")}
        className="mb-3"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {SETUP_STEPS.map(({ title, body, href, linkLabel, icon: Icon }, index) => (
            <div key={href} className="flex gap-3 rounded-2xl border border-border/60 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold">
                  {index + 1}. {t(title)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{t(body)}</p>
                <Link
                  href={href}
                  className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                >
                  {t(linkLabel)} ←
                </Link>
              </div>
            </div>
          ))}
        </div>
      </OperationalCard>

      <OperationalCard
        title={t("Daily POS workflow")}
        description={t("From opening the shift to closing it.")}
        className="mb-3"
      >
        <ol className="grid gap-3 lg:grid-cols-4">
          {DAILY_STEPS.map(({ step, title, body }) => (
            <li key={step} className="rounded-2xl bg-muted/50 p-4">
              <p className="mb-1 flex items-center gap-2 font-semibold">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
                  {step}
                </span>
                {t(title)}
              </p>
              <p className="text-sm text-muted-foreground">{t(body)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/sessions"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Clock className="size-4" />
            {t("Cashier Sessions")}
          </Link>
          <Link
            href="/pos"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <ShoppingCart className="size-4" />
            {t("POS")}
          </Link>
        </div>
      </OperationalCard>

      <OperationalCard
        title={t("Inventory management")}
        description={t("How stock moves through the system.")}
        className="mb-3"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {INVENTORY_TIPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border/60 p-4">
              <p className="mb-1 flex items-center gap-2 font-semibold">
                <Icon className="size-4 text-primary" />
                {t(title)}
              </p>
              <p className="text-sm text-muted-foreground">{t(body)}</p>
            </div>
          ))}
        </div>
      </OperationalCard>

      <OperationalCard
        title={t("Customer loyalty")}
        description={t("Reward returning customers automatically.")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="mb-1 flex items-center gap-2 font-semibold">
              <Rocket className="size-4 text-primary" />
              {t("Earning points")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("Attach the customer to the invoice. Points are calculated automatically after discounts using your loyalty settings.")}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="mb-1 flex items-center gap-2 font-semibold">
              <Heart className="size-4 text-primary" />
              {t("Redeeming points")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("The customer point balance appears during payment. Enter the points or use them all to apply the discount instantly.")}
            </p>
          </div>
        </div>
        <Link
          href="/customers/loyalty"
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          {t("Loyalty settings")} ←
        </Link>
      </OperationalCard>
    </>
  );
}
