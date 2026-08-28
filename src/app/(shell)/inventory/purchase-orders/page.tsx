import { getPurchasesData } from "@/modules/purchases/actions/purchase.actions";
import { PurchasesPage } from "@/modules/purchases/components/purchases-page";

export default async function PurchaseOrdersRoute() {
  const data = await getPurchasesData("purchase_order");
  return (
    <PurchasesPage
      {...data}
      documentKind="purchase_order"
      basePath="/inventory/purchase-orders"
      title="Purchase orders"
      description="Draft → Send → Partial receipt with multiple purchase invoices"
      createLabel="New purchase order"
    />
  );
}
