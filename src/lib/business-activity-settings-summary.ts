import {
  ACTIVITY_PRESETS,
  BUSINESS_ACTIVITY_TYPE_LABELS,
  type BusinessActivitySettings,
  type BusinessActivityType,
} from "@/lib/constants";
import { buildBusinessActivityFeatureFlags } from "@/lib/business-activity-flags";
import type { AppLanguage } from "@/lib/i18n/translations";

const ACTIVITY_LABELS_EN: Record<BusinessActivityType, string> = {
  cafe: "Cafe / takeaway",
  ice_cream: "Ice cream",
  juice_bar: "Juice bar",
  supermarket: "Supermarket",
  restaurant: "Restaurant",
  retail: "Retail",
  wholesale: "Wholesale",
  mixed: "Retail and wholesale",
  bakery: "Bakery",
  pharmacy: "Pharmacy",
};

/** Human-readable delta when applying an activity preset (Settings UX). */
export function describeActivityPresetChanges(
  activityType: BusinessActivityType,
  language: AppLanguage = "ar",
): string[] {
  const preset = ACTIVITY_PRESETS[activityType];
  const flags = buildBusinessActivityFeatureFlags({
    activity_type: activityType,
  });
  if (language === "en") {
    const lines = [`Business activity: ${ACTIVITY_LABELS_EN[activityType]}`];
    if (preset.enabled_sales_modes?.length) {
      lines.push(`Sales modes: ${preset.enabled_sales_modes.join(" + ")}`);
    }
    if (preset.enable_weight_sales) lines.push("Enable weight-based sales");
    if (preset.enable_wholesale_sales) lines.push("Enable wholesale sales");
    if (preset.enable_variants === false) lines.push("Hide product variants");
    if (preset.enable_variants) lines.push("Enable product variants");
    if (preset.enable_price_by_amount)
      lines.push("Sell by amount (price / weight)");
    if (preset.require_manager_for_wholesale)
      lines.push("Wholesale requires manager approval");
    if (preset.default_inventory_rotation_method) {
      lines.push(`Stock rotation: ${preset.default_inventory_rotation_method}`);
    }
    if (preset.default_expiry_policy) {
      lines.push(`Expiry policy: ${preset.default_expiry_policy}`);
    }
    if (flags.recipes) lines.push("Enable recipes");
    if (flags.credit_sales) lines.push("Enable credit sales");
    if (flags.barcode_scanner) lines.push("Enable barcode scanner");
    return lines;
  }
  const lines: string[] = [
    `نوع النشاط: ${BUSINESS_ACTIVITY_TYPE_LABELS[activityType]}`,
  ];

  if (preset.enabled_sales_modes?.length) {
    lines.push(`أوضاع البيع: ${preset.enabled_sales_modes.join(" + ")}`);
  }
  if (preset.enable_weight_sales) lines.push("تفعيل البيع بالوزن");
  if (preset.enable_wholesale_sales) lines.push("تفعيل مبيعات الجملة");
  if (preset.enable_variants === false)
    lines.push("إخفاء المتغيرات (variants)");
  if (preset.enable_variants) lines.push("تفعيل المتغيرات");
  if (preset.enable_price_by_amount) lines.push("البيع بالمبلغ (سعر/وزن)");
  if (preset.require_manager_for_wholesale) {
    lines.push("الجملة تتطلب موافقة مدير");
  }
  if (preset.default_inventory_rotation_method) {
    lines.push(`دوران المخزون: ${preset.default_inventory_rotation_method}`);
  }
  if (preset.default_expiry_policy) {
    lines.push(`سياسة الصلاحية: ${preset.default_expiry_policy}`);
  }
  if (flags.recipes) lines.push("تفعيل الوصفات (recipes)");
  if (flags.credit_sales) lines.push("تفعيل البيع الآجل");
  if (flags.barcode_scanner) lines.push("تفعيل ماسح الباركود");

  return lines;
}

export function activitySettingsHints(
  settings: Pick<BusinessActivitySettings, "activity_type">,
): string[] {
  return describeActivityPresetChanges(settings.activity_type);
}
