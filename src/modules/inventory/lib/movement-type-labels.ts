import type { MovementType } from "@/lib/types";

/** Canonical labels for inventory movement types. */
export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  sale: "Sale",
  purchase: "Purchase",
  purchase_from_session: "Session purchase",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  waste: "Waste",
  adjustment: "Adjustment",
  stock_count: "Stock count",
  reservation: "Reservation",
  reservation_release: "Reservation release",
};

export function aggregateMovementTypeCounts(
  movements: { movement_type: MovementType }[]
): { type: MovementType; label: string; count: number }[] {
  const counts = new Map<MovementType, number>();
  for (const m of movements) {
    counts.set(m.movement_type, (counts.get(m.movement_type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({
      type,
      label: MOVEMENT_TYPE_LABELS[type] ?? type,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}
