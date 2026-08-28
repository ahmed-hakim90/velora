import { AccessDenied } from "@/components/Velora/access-denied";
import { PageHeader } from "@/components/Velora/page-header";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import { getStore } from "@/lib/repositories/store.repository";
import { StorefrontAdminSubnav } from "@/modules/storefront/components/storefront-admin-subnav";
import { StorefrontSettingsCard } from "@/modules/storefront/components/storefront-settings-card";

export default async function StorefrontSettingsPage() {
  const access = await requirePageStoreId("/storefront/settings");
  if (!access.ok)
    return (
      <AccessDenied
        title={access.denial.title}
        description={access.denial.description}
      />
    );
  const store = await getStore(access.storeId);
  if (!store)
    return (
      <AccessDenied
        title="الفرع غير موجود"
        description="اختر فرعًا متاحًا ثم حاول مرة أخرى."
      />
    );
  return (
    <div dir="rtl" className="space-y-5">
      <PageHeader
        title="إعدادات المتجر والنشر"
        description="الرابط والدومين والثيم وساعات الطلب والتوصيل والنسخة المنشورة."
      />
      <StorefrontAdminSubnav active="/storefront/settings" />
      <StorefrontSettingsCard store={store} />
    </div>
  );
}
