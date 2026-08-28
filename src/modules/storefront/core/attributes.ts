import { z } from "zod";
import type { StorefrontAttributeValue } from "./types";

export const attributeTypeSchema = z.enum(["number", "range", "enum", "multi_select", "boolean"]);
export type StorefrontAttributeType = z.infer<typeof attributeTypeSchema>;

export type StorefrontAttributeDefinition = {
  key: string;
  type: StorefrontAttributeType;
  options?: string[];
};

export const NELAAB_ATTRIBUTE_DEFINITIONS: StorefrontAttributeDefinition[] = [
  { key: "age_range", type: "range" },
  {
    key: "skills",
    type: "multi_select",
    options: ["problem_solving", "creativity", "motor_skills", "memory", "social", "logic", "stem", "language", "focus", "coordination"],
  },
  {
    key: "interests",
    type: "multi_select",
    options: ["stem", "creative", "building", "outdoor", "role_play", "board_games", "cars", "dolls", "sports", "gaming", "puzzles", "family"],
  },
];

export function validateAttributeValue(
  definition: StorefrontAttributeDefinition,
  value: unknown,
): StorefrontAttributeValue {
  switch (definition.type) {
    case "number":
      return z.number().finite().parse(value);
    case "boolean":
      return z.boolean().parse(value);
    case "range": {
      const range = z.object({ min: z.number().finite(), max: z.number().finite() }).parse(value);
      if (range.min > range.max) throw new Error("بداية النطاق يجب ألا تتجاوز نهايته");
      return range;
    }
    case "enum": {
      const result = z.string().parse(value);
      if (definition.options && !definition.options.includes(result)) throw new Error("قيمة الخاصية غير مسموحة");
      return result;
    }
    case "multi_select": {
      const result = z.array(z.string()).max(50).parse(value);
      if (definition.options && result.some((item) => !definition.options?.includes(item))) {
        throw new Error("إحدى قيم الخاصية غير مسموحة");
      }
      return [...new Set(result)];
    }
  }
}
