import { AccessDenied } from "@/components/Velora/access-denied";
import { PageHeader } from "@/components/Velora/page-header";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import { getOrganization } from "@/lib/repositories/organization.repository";
import { StorefrontAdminSubnav } from "@/modules/storefront/components/storefront-admin-subnav";
import { StorefrontProductManager } from "@/modules/storefront/components/storefront-product-manager";
import { listStorefrontProductAdminItems } from "@/modules/storefront/services/storefront-product-admin.service";

export default async function StorefrontProductsPage() {
  const access = await requirePageStoreId("/storefront/products");
  if (!access.ok)
    return (
      <AccessDenied
        title={access.denial.title}
        description={access.denial.description}
      />
    );
  const [organization, products] = await Promise.all([
    getOrganization(),
    listStorefrontProductAdminItems(access.storeId),
  ]);
  return (
    <div dir="rtl" className="space-y-5">
      <PageHeader
        title="منتجات المتجر"
        description="بيانات العرض والصور والمواصفات وأسعار قناة المتجر مع بقاء المنتج والمخزون موحدَين."
      />
      <StorefrontAdminSubnav active="/storefront/products" />
      <StorefrontProductManager
        storeId={access.storeId}
        currency={organization.currency}
        products={products}
      />
    </div>
  );
}
