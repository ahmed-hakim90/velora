import { beforeEach, describe, expect, it, vi } from "vitest";
import * as repo from "@/lib/repositories/journal.repository";
import { getIncomeStatement } from "@/modules/accounting/services/income-statement.service";
import { getBalanceSheet } from "@/modules/accounting/services/balance-sheet.service";
vi.mock("@/lib/repositories/journal.repository");
vi.mock("@/modules/accounting/services/gl-account.service", () => ({
  ensureSeeded: vi.fn(),
}));

const row = (
  code: string,
  system_key: string,
  account_type: string,
  debit: number,
  credit: number,
) => ({
  account_id: code,
  code,
  name: system_key,
  system_key,
  account_type,
  debit,
  credit,
});
describe("accounting statements after cash overage reclassification", () => {
  beforeEach(() => vi.resetAllMocks());
  it("reconciles the supplied report figures without negative overage expenses", async () => {
    vi.mocked(repo.getTrialBalanceRows).mockResolvedValue([
      row("1111", "cash", "asset", 5218.97, 6305),
      row("1130", "inventory", "asset", 3770, 0),
      row("2110", "ap", "liability", 0, 625),
      row("4100", "sales_revenue", "revenue", 190, 1823.98),
      row("4200", "sales_discount", "revenue", 17.5, 0),
      row("4300", "cash_overage", "revenue", 0, 442.49),
      row("5200", "expense_default", "expense", 2970, 2970),
    ]);
    const income = await getIncomeStatement({
      from: "2026-09-01",
      to: "2026-09-08",
    });
    expect(income).toMatchObject({
      grossRevenue: 1633.98,
      salesDiscounts: 17.5,
      netRevenue: 1616.48,
      otherRevenue: 442.49,
      totalExpenses: 0,
      netIncome: 2058.97,
      expenseLines: [],
    });
    expect(income.otherRevenueLines).toHaveLength(1);
    expect(
      income.revenueLines.some((l) => l.systemKey === "cash_overage"),
    ).toBe(false);
    const balance = await getBalanceSheet({ asOf: "2026-09-08" });
    expect(balance).toMatchObject({
      totalAssets: 2683.97,
      totalLiabilities: 625,
      netIncomeYtd: 2058.97,
      totalLiabilitiesAndEquity: 2683.97,
      balanced: true,
    });
  });
  it("keeps shortage expenses and overage reversals signed", async () => {
    vi.mocked(repo.getTrialBalanceRows).mockResolvedValue([
      row("5210", "cash_over_short", "expense", 30, 0),
      row("4300", "cash_overage", "revenue", 8, 0),
    ]);
    const income = await getIncomeStatement({
      from: "2026-09-01",
      to: "2026-09-08",
    });
    expect(income).toMatchObject({
      otherRevenue: -8,
      totalExpenses: 30,
      netIncome: -38,
    });
  });
  it("supports empty periods", async () => {
    vi.mocked(repo.getTrialBalanceRows).mockResolvedValue([]);
    expect(
      await getIncomeStatement({ from: "2026-09-01", to: "2026-09-08" }),
    ).toMatchObject({
      otherRevenueLines: [],
      expenseLines: [],
      netIncome: 0,
    });
  });
});
