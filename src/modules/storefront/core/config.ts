import { z } from "zod";
import type {
  StorefrontContent,
  StorefrontHomeSection,
  StorefrontThemeSlug,
} from "./types";

export const STOREFRONT_CONFIG_VERSION = 2;

const contentSchema = z.object({
  heroTitle: z.string().trim().min(1).max(100),
  heroSubtitle: z.string().trim().max(240),
  heroImageUrl: z.url().nullable(),
  heroCtaLabel: z.string().trim().min(1).max(40),
  featuredTitle: z.string().trim().min(1).max(80),
  benefitsTitle: z.string().trim().min(1).max(80),
});

const sectionIdSchema = z.enum([
  "hero",
  "ageSelector",
  "featuredCategories",
  "featuredProducts",
  "benefits",
]);

const homeSectionsSchema = z
  .array(z.object({ id: sectionIdSchema, enabled: z.boolean() }))
  .length(5)
  .refine(
    (sections) => new Set(sections.map((section) => section.id)).size === 5,
    "Home sections must be unique",
  );

export const storefrontConfigSchema = z.object({
  configVersion: z.literal(STOREFRONT_CONFIG_VERSION),
  theme: z.literal("nelaab"),
  content: contentSchema,
  homeSections: homeSectionsSchema,
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

export const DEFAULT_STOREFRONT_HOME_SECTIONS: StorefrontHomeSection[] = [
  { id: "hero", enabled: true },
  { id: "ageSelector", enabled: false },
  { id: "featuredCategories", enabled: true },
  { id: "featuredProducts", enabled: true },
  { id: "benefits", enabled: true },
];

export const DEFAULT_STOREFRONT_CONFIG: StorefrontConfig = {
  configVersion: STOREFRONT_CONFIG_VERSION,
  theme: "nelaab",
  content: DEFAULT_STOREFRONT_CONTENT,
  homeSections: DEFAULT_STOREFRONT_HOME_SECTIONS,
};

/** Deterministic config migrations run before validation; never execute stored code. */
export function migrateStorefrontConfig(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const raw = value as Record<string, unknown>;
  if (
    (raw.configVersion === undefined || raw.configVersion === 1) &&
    raw.theme === "nelaab" &&
    raw.content
  ) {
    return {
      ...raw,
      configVersion: STOREFRONT_CONFIG_VERSION,
      homeSections: DEFAULT_STOREFRONT_HOME_SECTIONS,
    };
  }
  return raw;
}

export function normalizeStorefrontConfig(value: unknown): StorefrontConfig {
  const parsed = storefrontConfigSchema.safeParse(
    migrateStorefrontConfig(value),
  );
  if (parsed.success) return parsed.data;
  return DEFAULT_STOREFRONT_CONFIG;
}

export function isStorefrontThemeSlug(
  value: unknown,
): value is StorefrontThemeSlug {
  return value === "nelaab";
}
