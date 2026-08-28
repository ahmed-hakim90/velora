import { AccessDenied } from "@/components/Velora/access-denied";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import * as storeRepo from "@/lib/repositories/store.repository";
import { PageHeader } from "@/components/Velora/page-header";
import { MovementTimeline } from "@/modules/inventory/components/movement-timeline";
import { getMovementTimeline } from "@/modules/inventory/services/movement.service";
import { MovementFilters } from "@/modules/inventory/components/movement-filters";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import { MOVEMENT_TYPES } from "@/lib/constants";
import type { MovementType } from "@/lib/types";
import { LocalizedText } from "@/components/Velora/localized-text";

export default async function MovementsPage({ searchParams }: { searchParams: Promise<{ warehouseId?: string; type?: string; from?: string; to?: string }> }) {
  const storeResult = await requirePageStoreId("/inventory/movements");
  if (!storeResult.ok) {
    return (
      <AccessDenied title={storeResult.denial.title} description={storeResult.denial.description} />
    );
  }
  const storeId = storeResult.storeId;
  const params = await searchParams;
  const [store, warehouses] = await Promise.all([storeRepo.getStore(storeId), warehouseRepo.listWarehouses(storeId)]);
  const warehouseId = warehouses.some((warehouse) => warehouse.id === params.warehouseId) ? params.warehouseId : undefined;
  const movementType = MOVEMENT_TYPES.includes(params.type as MovementType) ? params.type as MovementType : undefined;
  const movements = await getMovementTimeline(storeId, warehouseId, 500, undefined, {
    from: params.from ? `${params.from}T00:00:00.000Z` : undefined,
    to: params.to ? `${params.to}T23:59:59.999Z` : undefined,
    movementTypes: movementType ? [movementType] : undefined,
  });

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumb={<span><LocalizedText text="Inventory" /> · <LocalizedText text="Movement log" /></span>}
        title="Inventory movements"
        description={`Inventory log - ${store?.name ?? "Branch"}`}
      />
      <MovementFilters warehouses={warehouses} warehouseId={warehouseId ?? ""} type={movementType ?? ""} from={params.from ?? ""} to={params.to ?? ""} />
      <MovementTimeline movements={movements} />
    </div>
  );
}
