import { describe, expect, it } from "vitest";
import { validatePosCustomerDraft } from "@/modules/pos/lib/customer-input-validation";

describe("POS customer draft validation", () => {
  it("accepts a valid name and Egyptian phone", () => {
    expect(validatePosCustomerDraft("منى", "0100 123 4567")).toEqual({
      name: null,
      phone: null,
    });
  });

  it("reports missing fields next to their inputs", () => {
    expect(validatePosCustomerDraft(" ", "")).toEqual({
      name: "required",
      phone: "required",
    });
  });

  it("rejects a one-character name and short phone", () => {
    expect(validatePosCustomerDraft("م", "1234")).toEqual({
      name: "too_short",
      phone: "invalid",
    });
  });

  it("accepts an international phone up to fifteen digits", () => {
    expect(validatePosCustomerDraft("Mona", "+966 50 123 4567")).toEqual({
      name: null,
      phone: null,
    });
  });
});
