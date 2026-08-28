import { describe, expect, it } from "vitest";
import { PRINT_DOCUMENT_CONFIGS } from "./document-config";
import {
  DEFAULT_PRINT_ENGINE_SETTINGS,
  parsePrintEngineSettings,
  resolvePrintTemplate,
} from "./print-engine-settings";

describe("Velora print design system", () => {
  it("ships Executive as the default and includes all three shared variants", () => {
    expect(DEFAULT_PRINT_ENGINE_SETTINGS.defaultTemplateId).toBe("executive");
    expect(DEFAULT_PRINT_ENGINE_SETTINGS.templates.map((template) => template.layout)).toEqual([
      "executive",
      "minimal",
      "corporate",
    ]);
  });

  it("keeps legacy print settings readable", () => {
    const parsed = parsePrintEngineSettings({ layout: "classic" });
    expect(resolvePrintTemplate(parsed).layout).toBe("classic");
  });

  it("models receipts as configurations in the shared system", () => {
    expect(PRINT_DOCUMENT_CONFIGS.payment_receipt).toMatchObject({
      family: "receipt",
      defaultVariant: "executive",
      showItems: false,
      showAmountHero: true,
      showBalanceSummary: true,
    });
    expect(PRINT_DOCUMENT_CONFIGS.refund_receipt.showBalanceSummary).toBe(false);
    expect(PRINT_DOCUMENT_CONFIGS.receipt_voucher.defaultVariant).toBe("minimal");
  });
});
