import { describe, expect, it } from "vitest";
import { isPaidReversalOrder } from "@/modules/reports/services/profit-report.service";

describe("profit report reversal classification", () => {
  it("counts paid voids and refunds but not an unpaid cancelled order", () => {
    expect(
      isPaidReversalOrder({ status: "refunded", payment_status: "paid" }),
    ).toBe(true);
    expect(
      isPaidReversalOrder({ status: "voided", payment_status: "paid" }),
    ).toBe(true);
    expect(
      isPaidReversalOrder({ status: "voided", payment_status: "unpaid" }),
    ).toBe(false);
  });
});
