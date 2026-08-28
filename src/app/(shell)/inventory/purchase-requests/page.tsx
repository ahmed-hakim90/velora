import { getPurchasesData } from "@/modules/purchases/actions/purchase.actions";
import { PurchasesPage } from "@/modules/purchases/components/purchases-page";

export default async function PurchaseRequestsRoute() {
  const data = await getPurchasesData("purchase_request");
  return (
    <PurchasesPage
      {...data}
      documentKind="purchase_request"
      basePath="/inventory/purchase-requests"
      title="Purchase requests"
      description="Draft → Submit → Approve → Convert to purchase order"
      createLabel="New purchase request"
    />
  );
}
