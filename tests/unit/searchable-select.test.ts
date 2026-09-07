import { describe, expect, it } from "vitest";
import { searchableSelectOptionMatches } from "@/components/Velora/searchable-select";

const option = {
  value: "product-1",
  label: "قهوة تركي",
  description: "SKU-104 · 6221234567890",
  keywords: ["SKU-104", "6221234567890"],
};

describe("searchableSelectOptionMatches", () => {
  it("matches labels without case sensitivity", () => {
    expect(searchableSelectOptionMatches(option, "قهوة")).toBe(true);
  });

  it("matches extra keywords such as SKU and barcode", () => {
    expect(searchableSelectOptionMatches(option, "sku-104")).toBe(true);
    expect(searchableSelectOptionMatches(option, "622123")).toBe(true);
  });

  it("supports multiple terms across fields", () => {
    expect(searchableSelectOptionMatches(option, "تركي 104")).toBe(true);
  });

  it("rejects unmatched terms", () => {
    expect(searchableSelectOptionMatches(option, "شاي")).toBe(false);
  });
});
