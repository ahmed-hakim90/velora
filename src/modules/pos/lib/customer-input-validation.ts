import { phoneSearchDigits } from "@/lib/phone";

export type PosCustomerDraftValidation = {
  name: "required" | "too_short" | null;
  phone: "required" | "invalid" | null;
};

export function validatePosCustomerDraft(nameInput: string, phoneInput: string): PosCustomerDraftValidation {
  const name = nameInput.trim();
  const phone = phoneInput.trim();
  const digits = phoneSearchDigits(phone);

  return {
    name: !name ? "required" : name.length < 2 ? "too_short" : null,
    phone: !phone ? "required" : digits.length < 8 || digits.length > 15 ? "invalid" : null,
  };
}
