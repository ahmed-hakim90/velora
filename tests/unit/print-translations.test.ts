import { describe, expect, it } from "vitest";
import { translateText } from "@/lib/i18n/translations";

describe("print translations", () => {
  it("translates barcode studio labels in both directions", () => {
    expect(translateText("Barcode Labels", "ar")).toBe("ملصقات الباركود");
    expect(translateText("Print preview", "ar")).toBe("معاينة الطباعة");
    expect(translateText("Thermal 40×30 mm", "ar")).toBe("حراري 40×30 مم");
    expect(translateText("ملصقات الباركود", "en")).toBe("Barcode Labels");
  });

  it("translates print report labels in both directions", () => {
    expect(translateText("Stock Count Report", "ar")).toBe("تقرير جرد المخزون");
    expect(translateText("Customer Statement", "ar")).toBe("كشف حساب عميل");
    expect(translateText("تقرير المخزون", "en")).toBe("Inventory Report");
  });

  it("keeps business values while translating composite print summaries", () => {
    expect(
      translateText("Branch: Downtown · Warehouse: Main", "ar"),
    ).toBe("الفرع: Downtown · المخزن: Main");
    expect(
      translateText("فرع: Downtown · مخزن: Main", "en"),
    ).toBe("Branch: Downtown · Warehouse: Main");
  });
});
