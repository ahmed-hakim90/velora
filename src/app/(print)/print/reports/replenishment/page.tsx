import { getReplenishmentReportPageData } from "@/modules/reports/actions/replenishment-report.actions";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { LocalizedText } from "@/components/Velora/localized-text";

export default async function PrintReplenishmentReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getReplenishmentReportPageData(params);
  const r = data.report;

  return (
    <PrintableDocument
      branding={data.context}
      title="Replenishment Plan"
      dateRange={r.monthLabel}
      generatedBy={data.context.generatedBy}
      generatedAt={data.context.generatedAt}
      filterSummary={`${r.coverageMonths} coverage months · ${r.orderCount} orders`}
    >
      <table className="mb-6 w-full text-sm">
        <tbody>
          <tr className="border-b">
            <td className="py-2 font-medium"><LocalizedText text="Base month" /></td>
            <td className="py-2 text-end">{r.monthLabel}</td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-medium"><LocalizedText text="Coverage" /></td>
            <td className="py-2 text-end">{r.coverageMonths} <LocalizedText text="months" /></td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-medium"><LocalizedText text="Items to buy" /></td>
            <td className="py-2 text-end">{r.summary.needBuyCount}</td>
          </tr>
        </tbody>
      </table>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-start"><LocalizedText text="Product" /></th>
            <th className="py-2 text-end"><LocalizedText text="Usage" /></th>
            <th className="py-2 text-end"><LocalizedText text="Required" /></th>
            <th className="py-2 text-end"><LocalizedText text="On hand" /></th>
            <th className="py-2 text-end"><LocalizedText text="Buy" /></th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row) => (
            <tr key={row.productId} className="border-b">
              <td className="py-2">{row.productName}</td>
              <td className="py-2 text-end tabular-nums">{row.monthUsage}</td>
              <td className="py-2 text-end tabular-nums">{row.requiredQty}</td>
              <td className="py-2 text-end tabular-nums">{row.onHand}</td>
              <td className="py-2 text-end tabular-nums font-medium">
                {row.suggestedBuy}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintableDocument>
  );
}
