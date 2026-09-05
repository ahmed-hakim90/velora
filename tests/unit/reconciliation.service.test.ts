import { describe, expect, it, vi, beforeEach } from "vitest";
import { calcExpectedCash, calcVariance } from "@/modules/sessions/services/reconciliation.service";
import * as repositoryClient from "@/lib/repositories/client";
import * as sessionRepo from "@/lib/repositories/session.repository";

vi.mock("@/lib/repositories/client");
vi.mock("@/lib/repositories/session.repository");
vi.mock("@/lib/repositories/order.repository");
vi.mock("@/lib/repositories/expense.repository");
vi.mock("@/lib/repositories/supplier-payment.repository");

describe("calcVariance", () => {
  it("returns positive variance when actual exceeds expected", () => {
    expect(calcVariance(100, 105)).toBe(5);
  });

  it("returns negative variance when actual is short", () => {
    expect(calcVariance(100, 95)).toBe(-5);
  });
});

describe("calcExpectedCash", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("computes expected cash from opening, sales, refunds, expenses, and supplier cash payments", async () => {
    vi.mocked(repositoryClient.callRpc).mockResolvedValue({
      data: {
        reconciliation: {
          openingCash: 100,
          cashSales: 50,
          cashRefunds: 20,
          expenses: 15,
          supplierPayments: 10,
          expectedCash: 105,
          totalSales: 50,
          orderCount: 1,
        },
        expenses: [],
        supplierPayments: [],
      },
      error: null,
    });

    const result = await calcExpectedCash("s1");

    expect(repositoryClient.callRpc).toHaveBeenCalledWith(
      "pos_session_cash_bundle",
      { p_session_id: "s1" },
    );
    expect(result.openingCash).toBe(100);
    expect(result.cashSales).toBe(50);
    expect(result.cashRefunds).toBe(20);
    expect(result.expenses).toBe(15);
    expect(result.supplierPayments).toBe(10);
    expect(result.expectedCash).toBe(105);
    expect(result.totalSales).toBe(50);
    expect(result.orderCount).toBe(1);
  });

  it("falls back safely while the optimized RPC is missing from the schema cache", async () => {
    vi.mocked(repositoryClient.callRpc).mockResolvedValue({
      data: null,
      error: {
        message:
          "Could not find the function public.pos_session_cash_bundle(p_session_id) in the schema cache",
      },
    });
    vi.mocked(sessionRepo.getSession).mockResolvedValue(null);

    await expect(calcExpectedCash("missing-session")).resolves.toEqual({
      openingCash: 0,
      cashSales: 0,
      cashRefunds: 0,
      expenses: 0,
      supplierPayments: 0,
      expectedCash: 0,
      totalSales: 0,
      orderCount: 0,
    });
  });
});
