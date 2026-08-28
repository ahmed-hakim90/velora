import Link from "next/link";

const items = [
  { href: "/storefront", label: "نظرة عامة" },
  { href: "/storefront/products", label: "المنتجات" },
  { href: "/storefront/orders", label: "الطلبات" },
  { href: "/storefront/settings", label: "الإعدادات والنشر" },
] as const;

export function StorefrontAdminSubnav({
  active,
}: {
  active: (typeof items)[number]["href"];
}) {
  return (
    <nav
      aria-label="أقسام المتجر"
      className="flex gap-2 overflow-x-auto rounded-2xl border bg-card p-2"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active === item.href ? "page" : undefined}
          className={`inline-flex min-h-10 shrink-0 items-center rounded-xl px-4 text-sm font-bold ${active === item.href ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
