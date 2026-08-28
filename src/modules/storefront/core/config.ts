import { z } from "zod";
import type { StorefrontContent, StorefrontThemeSlug } from "./types";

export const STOREFRONT_CONFIG_VERSION = 1;

const contentSchema = z.object({
  heroTitle: z.string().trim().min(1).max(100),
  heroSubtitle: z.string().trim().max(240),
  heroImageUrl: z.url().nullable(),
  heroCtaLabel: z.string().trim().min(1).max(40),
  featuredTitle: z.string().trim().min(1).max(80),
  benefitsTitle: z.string().trim().min(1).max(80),
});

export const storefrontConfigSchema = z.object({
  configVersion: z.literal(STOREFRONT_CONFIG_VERSION),
  theme: z.literal("nelaab"),
  content: contentSchema,
});

export type StorefrontConfig = z.infer<typeof storefrontConfigSchema>;

export const DEFAULT_STOREFRONT_CONTENT: StorefrontContent = {
  heroTitle: "اللعبة المناسبة لكل مرحلة",
  heroSubtitle: "اختيارات ممتعة ومدروسة تساعد أطفالك يتعلموا ويلعبوا ويكتشفوا.",
  heroImageUrl: null,
  heroCtaLabel: "تسوّق الآن",
  featuredTitle: "ألعاب محبوبة",
  benefitsTitle: "ليه تختار من عندنا؟",
};

export const DEFAULT_STOREFRONT_CONFIG: StorefrontConfig = {
  configVersion: STOREFRONT_CONFIG_VERSION,
  theme: "nelaab",
  content: DEFAULT_STOREFRONT_CONTENT,
};

/** Deterministic config migrations run before validation; never execute stored code. */
export function migrateStorefrontConfig(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const raw = value as Record<string, unknown>;
  if (raw.configVersion === undefined && raw.theme === "nelaab" && raw.content) {
    return { ...raw, configVersion: STOREFRONT_CONFIG_VERSION };
  }
  return raw;
}

export function normalizeStorefrontConfig(value: unknown): StorefrontConfig {
  const parsed = storefrontConfigSchema.safeParse(migrateStorefrontConfig(value));
  if (parsed.success) return parsed.data;
  return DEFAULT_STOREFRONT_CONFIG;
}

export function isStorefrontThemeSlug(value: unknown): value is StorefrontThemeSlug {
  return value === "nelaab";
}
