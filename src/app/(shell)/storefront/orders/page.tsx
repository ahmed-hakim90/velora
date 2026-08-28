import { AccessDenied } from "@/components/Velora/access-denied";
import { PageHeader } from "@/components/Velora/page-header";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import { StorefrontAdminSubnav } from "@/modules/storefront/components/storefront-admin-subnav";
import { StorefrontOrdersPage } from "@/modules/storefront/components/storefront-orders-page";
import { listStorefrontOrders } from "@/modules/storefront/services/storefront-order-admin.service";

export default async function StorefrontOrdersPageRoute() {
  const access = await requirePageStoreId("/storefront/orders");
  if (!access.ok)
    return (
      <AccessDenied
        title={access.denial.title}
        description={access.denial.description}
      />
    );
  const orders = await listStorefrontOrders(access.storeId);
  return (
    <div dir="rtl" className="space-y-5">
      <PageHeader
        title="طلبات المتجر"
        description="من التأكيد والتجهيز حتى الشحن والتسليم والمرتجعات."
      />
      <StorefrontAdminSubnav active="/storefront/orders" />
      <StorefrontOrdersPage orders={orders} />
    </div>
  );
}
