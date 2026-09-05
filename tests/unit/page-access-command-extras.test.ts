import { describe, expect, it } from "vitest";
import { getPageAccessDenial } from "@/lib/auth/page-access";

describe("page access for command extras", () => {
  it("allows the account page for owner and cashier", () => {
    expect(getPageAccessDenial("/account", "owner", {}, new Set())).toBeNull();
    expect(getPageAccessDenial("/account", "cashier", {}, new Set())).toBeNull();
  });

  it("still hides reports when the reports flag is off", () => {
    const denial = getPageAccessDenial(
      "/reports/heatmap",
      "owner",
      { reports: false },
      new Set()
    );
    expect(denial).not.toBeNull();
  });
});
