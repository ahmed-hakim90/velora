import { describe, expect, it } from "vitest";
import { buildKitchenGlance } from "@/modules/kitchen/lib/kitchen-glance";
import type { KitchenTicket } from "@/modules/kitchen/services/kitchen.service";

describe("buildKitchenGlance", () => {
  it("counts backlog and oldest wait without inventing prep duration", () => {
    const now = Date.now();
    const tickets = [
      {
        id: "1",
        orderNumber: "A1",
        kitchenStatus: "queued",
        createdAt: new Date(now - 30 * 60000).toISOString(),
        total: 10,
        items: [],
      },
      {
        id: "2",
        orderNumber: "A2",
        kitchenStatus: "preparing",
        createdAt: new Date(now - 10 * 60000).toISOString(),
        total: 20,
        items: [],
      },
      {
        id: "3",
        orderNumber: "A3",
        kitchenStatus: "ready",
        createdAt: new Date(now - 5 * 60000).toISOString(),
        total: 15,
        items: [],
      },
    ] as KitchenTicket[];

    const glance = buildKitchenGlance(tickets);
    expect(glance.backlog).toBe(3);
    expect(glance.queued).toBe(1);
    expect(glance.preparing).toBe(1);
    expect(glance.ready).toBe(1);
    expect(glance.oldestWaitMinutes).toBe(30);
  });
});
