import type { Category } from "@/lib/types";
import type { POSProduct } from "@/modules/pos/services/catalog.service";

export interface PosCatalogPayload {
  categories: Category[];
  products: POSProduct[];
}

class PosCatalogRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "PosCatalogRequestError";
  }
}

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(signal.reason);

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, delayMs);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutId);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/** Hide short network/database hiccups instead of making the cashier press Retry. */
export async function loadPosCatalogWithRetry(
  options: {
    signal?: AbortSignal;
    retryDelaysMs?: number[];
    fetcher?: typeof fetch;
  } = {},
): Promise<PosCatalogPayload> {
  const fetcher = options.fetcher ?? fetch;
  const retryDelaysMs = options.retryDelaysMs ?? [250, 750];

  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetcher("/api/pos/catalog", {
        credentials: "same-origin",
        cache: "no-store",
        signal: options.signal,
      });
      const payload = (await response.json()) as Partial<PosCatalogPayload> & {
        error?: string;
      };

      if (!response.ok) {
        throw new PosCatalogRequestError(
          payload.error || "Could not load products",
          response.status === 408 ||
            response.status === 429 ||
            response.status >= 500,
        );
      }

      return {
        categories: payload.categories ?? [],
        products: payload.products ?? [],
      };
    } catch (error) {
      if (options.signal?.aborted) throw error;

      const retryable =
        !(error instanceof PosCatalogRequestError) || error.retryable;
      const delayMs = retryDelaysMs[attempt];
      if (!retryable || delayMs == null) throw error;
      await waitForRetry(delayMs, options.signal);
    }
  }
}
