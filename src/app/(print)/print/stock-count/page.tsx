import { AccessDenied } from "@/components/Velora/access-denied";
import { requirePageAuth, runPageAuth } from "@/lib/auth/page-guard";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import { getCountSheetPageData } from "@/modules/stock-count/actions/count.actions";
import { StockCountPrintView } from "@/modules/stock-count/components/stock-count-print-view";

function filterSummary(sheet: {
  storeName: string;
  warehouseName: string;
  categoryName: string | null;
  productName: string | null;
}): string {
  const parts = [`Branch: ${sheet.storeName}`, `Warehouse: ${sheet.warehouseName}`];
  if (sheet.categoryName) parts.push(`Category: ${sheet.categoryName}`);
  if (sheet.productName) parts.push(`Product: ${sheet.productName}`);
  return parts.join(" · ");
}

export default async function PrintStockCountSheetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const auth = await requirePageAuth("/print/stock-count");
  if (!auth.ok) {
    return <AccessDenied title={auth.denial.title} description={auth.denial.description} />;
  }

  const params = await searchParams;
  if (!params.warehouseId) {
    return (
      <AccessDenied
        title="Stock Count Sheet"
        description="Choose a warehouse before printing."
      />
    );
  }

  const dataResult = await runPageAuth(
    () =>
      getCountSheetPageData({
        storeId: params.storeId,
        warehouseId: params.warehouseId,
        categoryId: params.categoryId,
        productId: params.productId,
      }),
    "/print/stock-count"
  );
  if (!dataResult.ok) {
    return (
      <AccessDenied
        title={dataResult.denial.title}
        description={dataResult.denial.description}
      />
    );
  }
  const data = dataResult.data;
  const branding = await getReportBranding(data.sheet.storeId);

  return (
    <StockCountPrintView
      title="Stock Count Sheet"
      subtitle="Enter the counted quantity in the blank column."
      filterSummary={filterSummary(data.sheet)}
      groups={data.sheet.groups}
      lines={data.sheet.lines}
      truncated={data.sheet.truncated}
      blankCounted
      branding={branding}
      userName={data.generatedBy}
    />
  );
}
