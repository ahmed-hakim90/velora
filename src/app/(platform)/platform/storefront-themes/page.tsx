import { resolvePlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { getStorefrontThemeCatalog } from "@/modules/platform/services/platform-storefront-themes.service";
import { PlatformStorefrontThemesConsole } from "@/modules/platform/components/platform-storefront-themes-console";

export default async function PlatformStorefrontThemesPage() {
  const admin = await resolvePlatformAdmin();
  if (!admin) return null;
  return <PlatformStorefrontThemesConsole initialCatalog={await getStorefrontThemeCatalog()} />;
}
