import { getPurchasesData } from "@/modules/purchases/actions/purchase.actions";
import { PurchasesPage } from "@/modules/purchases/components/purchases-page";

export default async function PurchaseReturnsRoute() {
  const data = await getPurchasesData("purchase_return");
  return (
    <PurchasesPage
      {...data}
      documentKind="purchase_return"
      basePath="/inventory/purchase-returns"
      title="Purchase returns"
      description="Create a return from a received invoice, then post it to update stock and supplier balance"
      createLabel="Purchase return"
      allowCreate={false}
    />
  );
}
