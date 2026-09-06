import { describe, expect, it, vi } from "vitest";
import { loadPosCatalogWithRetry } from "@/modules/pos/lib/load-pos-catalog";

describe("loadPosCatalogWithRetry", () => {
  it("retries transient server failures without cashier interaction", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "temporary database failure" }), {
          status: 500,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            categories: [{ id: "category-1" }],
            products: [{ id: "product-1" }],
          }),
          { status: 200 },
        ),
      );

    const result = await loadPosCatalogWithRetry({
      fetcher,
      retryDelaysMs: [0],
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.products).toEqual([{ id: "product-1" }]);
  });

  it("does not retry permission failures", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "مفيش صلاحية" }), { status: 403 }),
    );

    await expect(
      loadPosCatalogWithRetry({ fetcher, retryDelaysMs: [0, 0] }),
    ).rejects.toThrow("مفيش صلاحية");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("retries a dropped request and then succeeds", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ categories: [], products: [] }), {
          status: 200,
        }),
      );

    await expect(
      loadPosCatalogWithRetry({ fetcher, retryDelaysMs: [0] }),
    ).resolves.toEqual({ categories: [], products: [] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
