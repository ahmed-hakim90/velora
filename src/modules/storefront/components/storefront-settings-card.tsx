"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Store } from "@/lib/types";
import {
  DEFAULT_STOREFRONT_CONFIG,
  normalizeStorefrontConfig,
} from "../core/config";
import {
  publishStorefrontDraftAction,
  saveStorefrontDraftAction,
} from "../actions/storefront-settings.actions";
import {
  defaultOnlineFulfillmentConfig,
  parseOnlineFulfillment,
} from "@/modules/online-menu/lib/online-fulfillment";
import {
  WEEKDAY_KEYS,
  WEEKDAY_LABELS_AR,
  parseOnlineOrderingHours,
} from "@/modules/online-menu/lib/online-ordering-hours";

export function StorefrontSettingsCard({ store }: { store: Store }) {
  const sectionLabels = {
    hero: "البانر الرئيسي",
    ageSelector: "اختيار حسب العمر",
    featuredCategories: "الأقسام المميزة",
    featuredProducts: "المنتجات المميزة",
    benefits: "مميزات المتجر",
  } as const;
  const storedBrand =
    store.settings.storefront_brand &&
    typeof store.settings.storefront_brand === "object" &&
    !Array.isArray(store.settings.storefront_brand)
      ? (store.settings.storefront_brand as Record<string, unknown>)
      : {};
  const initial = useMemo(
    () =>
      normalizeStorefrontConfig(
        store.settings.storefront_draft ??
          store.settings.storefront_published ??
          DEFAULT_STOREFRONT_CONFIG,
      ),
    [store.settings],
  );
  const initialHours = useMemo(
    () =>
      parseOnlineOrderingHours({
        online_ordering_hours: store.settings.storefront_hours,
      }),
    [store.settings.storefront_hours],
  );
  const initialFulfillment = useMemo(() => {
    const parsed = parseOnlineFulfillment({
      online_fulfillment: store.settings.storefront_fulfillment,
    });
    return parsed.pickupEnabled || parsed.deliveryEnabled
      ? parsed
      : defaultOnlineFulfillmentConfig();
  }, [store.settings.storefront_fulfillment]);
  const [config, setConfig] = useState(initial);
  const [previewToken, setPreviewToken] = useState(
    typeof store.settings.storefront_preview_token === "string"
      ? store.settings.storefront_preview_token
      : "",
  );
  const [publicSettings, setPublicSettings] = useState({
    enabled: store.settings.storefront_enabled === true,
    orderingEnabled: store.settings.storefront_ordering_enabled === true,
    slug:
      typeof store.settings.storefront_slug === "string"
        ? store.settings.storefront_slug
        : "",
    unlisted: store.settings.storefront_unlisted === true,
    customDomainEnabled: store.settings.storefront_domain_enabled === true,
    brandName:
      typeof storedBrand.name === "string" ? storedBrand.name : store.name,
    tagline: typeof storedBrand.tagline === "string" ? storedBrand.tagline : "",
    orderingPaused: store.settings.storefront_ordering_paused === true,
    hours: initialHours,
    fulfillment: initialFulfillment,
  });
  const [pending, startTransition] = useTransition();
  const previewHref =
    publicSettings.slug && previewToken ? "/storefront/preview" : "";
  return (
    <div className="grid gap-4 rounded-xl border border-border/60 p-4">
      <div>
        <p className="font-semibold">واجهة المتجر</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Draft منفصل عن النسخة المنشورة. الثيم لا يغيّر منطق الأسعار أو
          الطلبات.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <Label>رابط المتجر المستقل</Label>
          <Input
            className="mt-2 font-mono"
            dir="ltr"
            value={publicSettings.slug}
            onChange={(e) =>
              setPublicSettings({ ...publicSettings, slug: e.target.value })
            }
            placeholder="my-store"
          />
        </label>
        <div className="sm:col-span-2">
          <Label>ترتيب أقسام الرئيسية</Label>
          <div className="mt-2 grid gap-2">
            {config.homeSections.map((section, index) => (
              <div
                key={section.id}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-border/70 bg-background px-3"
              >
                <Checkbox
                  checked={section.enabled}
                  onCheckedChange={(value) =>
                    setConfig({
                      ...config,
                      homeSections: config.homeSections.map((item) =>
                        item.id === section.id
                          ? { ...item, enabled: value === true }
                          : item,
                      ),
                    })
                  }
                  aria-label={`إظهار ${sectionLabels[section.id]}`}
                />
                <span className="text-sm font-bold">
                  {sectionLabels[section.id]}
                </span>
                <div className="ms-auto flex gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={`تحريك ${sectionLabels[section.id]} لأعلى`}
                    onClick={() => {
                      const next = [...config.homeSections];
                      [next[index - 1], next[index]] = [
                        next[index],
                        next[index - 1],
                      ];
                      setConfig({ ...config, homeSections: next });
                    }}
                    className="grid size-8 place-items-center rounded-md hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === config.homeSections.length - 1}
                    aria-label={`تحريك ${sectionLabels[section.id]} لأسفل`}
                    onClick={() => {
                      const next = [...config.homeSections];
                      [next[index], next[index + 1]] = [
                        next[index + 1],
                        next[index],
                      ];
                      setConfig({ ...config, homeSections: next });
                    }}
                    className="grid size-8 place-items-center rounded-md hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 self-end">
          <button
            type="button"
            onClick={() =>
              setPublicSettings({
                ...publicSettings,
                enabled: !publicSettings.enabled,
              })
            }
            className={`h-10 rounded-lg border text-sm font-bold ${publicSettings.enabled ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
          >
            {publicSettings.enabled ? "المتجر مفعّل" : "المتجر متوقف"}
          </button>
          <button
            type="button"
            onClick={() =>
              setPublicSettings({
                ...publicSettings,
                orderingEnabled: !publicSettings.orderingEnabled,
              })
            }
            className={`h-10 rounded-lg border text-sm font-bold ${publicSettings.orderingEnabled ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
          >
            {publicSettings.orderingEnabled
              ? "الطلبات مفعّلة"
              : "الطلبات متوقفة"}
          </button>
        </div>
        <label>
          <Label>اسم البراند في المتجر</Label>
          <Input
            className="mt-2"
            value={publicSettings.brandName}
            onChange={(e) =>
              setPublicSettings({
                ...publicSettings,
                brandName: e.target.value,
              })
            }
          />
        </label>
        <label>
          <Label>وصف البراند</Label>
          <Input
            className="mt-2"
            value={publicSettings.tagline}
            onChange={(e) =>
              setPublicSettings({ ...publicSettings, tagline: e.target.value })
            }
          />
        </label>
        <button
          type="button"
          onClick={() =>
            setPublicSettings({
              ...publicSettings,
              unlisted: !publicSettings.unlisted,
            })
          }
          className={`h-10 rounded-lg border px-3 text-sm font-bold ${publicSettings.unlisted ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
        >
          {publicSettings.unlisted ? "المتجر خاص بتوكن" : "المتجر عام"}
        </button>
        <button
          type="button"
          onClick={() =>
            setPublicSettings({
              ...publicSettings,
              customDomainEnabled: !publicSettings.customDomainEnabled,
            })
          }
          className={`h-10 rounded-lg border px-3 text-sm font-bold ${publicSettings.customDomainEnabled ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
        >
          {publicSettings.customDomainEnabled
            ? "الدومين يفتح المتجر"
            : "الدومين لا يفتح المتجر"}
        </button>
        <button
          type="button"
          onClick={() =>
            setPublicSettings({
              ...publicSettings,
              orderingPaused: !publicSettings.orderingPaused,
            })
          }
          className={`h-10 rounded-lg border px-3 text-sm font-bold ${publicSettings.orderingPaused ? "border-destructive bg-destructive/10 text-destructive" : "border-border"}`}
        >
          {publicSettings.orderingPaused
            ? "الطلبات متوقفة مؤقتًا"
            : "لا يوجد إيقاف مؤقت"}
        </button>
        <label>
          <Label>الثيم</Label>
          <div className="mt-2 flex h-10 items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3">
            <span className="size-4 rounded-full bg-[#482AD6]" />
            <strong>نلعب</strong>
            <span className="ms-auto text-xs text-muted-foreground" dir="ltr">
              nelaab v1
            </span>
          </div>
        </label>
        <label>
          <Label>عنوان الـHero</Label>
          <Input
            className="mt-2"
            value={config.content.heroTitle}
            onChange={(e) =>
              setConfig({
                ...config,
                content: { ...config.content, heroTitle: e.target.value },
              })
            }
          />
        </label>
        <label className="sm:col-span-2">
          <Label>وصف الـHero</Label>
          <Input
            className="mt-2"
            value={config.content.heroSubtitle}
            onChange={(e) =>
              setConfig({
                ...config,
                content: { ...config.content, heroSubtitle: e.target.value },
              })
            }
          />
        </label>
        <label>
          <Label>نص زر الـHero</Label>
          <Input
            className="mt-2"
            value={config.content.heroCtaLabel}
            onChange={(e) =>
              setConfig({
                ...config,
                content: { ...config.content, heroCtaLabel: e.target.value },
              })
            }
          />
        </label>
        <label>
          <Label>عنوان المنتجات المميزة</Label>
          <Input
            className="mt-2"
            value={config.content.featuredTitle}
            onChange={(e) =>
              setConfig({
                ...config,
                content: { ...config.content, featuredTitle: e.target.value },
              })
            }
          />
        </label>
      </div>

      <div className="grid gap-3 rounded-xl border border-border/60 p-3">
        <label className="flex items-center gap-2 text-sm font-bold">
          <Checkbox
            checked={publicSettings.hours.enforce}
            onCheckedChange={(value) => {
              const enforce = value === true;
              const days =
                enforce && Object.keys(publicSettings.hours.days).length === 0
                  ? Object.fromEntries(
                      WEEKDAY_KEYS.map((day) => [
                        day,
                        { windows: [{ open: "10:00", close: "22:00" }] },
                      ]),
                    )
                  : publicSettings.hours.days;
              setPublicSettings({
                ...publicSettings,
                hours: { ...publicSettings.hours, enforce, days },
              });
            }}
          />
          تقييد الطلب بساعات مستقلة للمتجر
        </label>
        {publicSettings.hours.enforce ? (
          <div className="grid gap-2">
            {WEEKDAY_KEYS.map((day) => {
              const value = publicSettings.hours.days[day];
              const closed = value?.closed === true;
              const window = !closed
                ? (value?.windows?.[0] ?? { open: "10:00", close: "22:00" })
                : { open: "10:00", close: "22:00" };
              return (
                <div
                  key={day}
                  className="grid grid-cols-[80px_auto_1fr_1fr] items-center gap-2 rounded-lg bg-muted/40 p-2"
                >
                  <strong className="text-xs">{WEEKDAY_LABELS_AR[day]}</strong>
                  <Checkbox
                    checked={closed}
                    aria-label={`إغلاق ${WEEKDAY_LABELS_AR[day]}`}
                    onCheckedChange={(checked) =>
                      setPublicSettings({
                        ...publicSettings,
                        hours: {
                          ...publicSettings.hours,
                          days: {
                            ...publicSettings.hours.days,
                            [day]:
                              checked === true
                                ? { closed: true }
                                : { windows: [window] },
                          },
                        },
                      })
                    }
                  />
                  <Input
                    type="time"
                    disabled={closed}
                    value={window.open}
                    onChange={(e) =>
                      setPublicSettings({
                        ...publicSettings,
                        hours: {
                          ...publicSettings.hours,
                          days: {
                            ...publicSettings.hours.days,
                            [day]: {
                              windows: [{ ...window, open: e.target.value }],
                            },
                          },
                        },
                      })
                    }
                  />
                  <Input
                    type="time"
                    disabled={closed}
                    value={window.close}
                    onChange={(e) =>
                      setPublicSettings({
                        ...publicSettings,
                        hours: {
                          ...publicSettings.hours,
                          days: {
                            ...publicSettings.hours.days,
                            [day]: {
                              windows: [{ ...window, close: e.target.value }],
                            },
                          },
                        },
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-xl border border-border/60 p-3">
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm font-bold">
            <Checkbox
              checked={publicSettings.fulfillment.pickupEnabled}
              onCheckedChange={(value) =>
                setPublicSettings({
                  ...publicSettings,
                  fulfillment: {
                    ...publicSettings.fulfillment,
                    pickupEnabled: value === true,
                  },
                })
              }
            />
            استلام من الفرع
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <Checkbox
              checked={publicSettings.fulfillment.deliveryEnabled}
              onCheckedChange={(value) =>
                setPublicSettings({
                  ...publicSettings,
                  fulfillment: {
                    ...publicSettings.fulfillment,
                    deliveryEnabled: value === true,
                  },
                })
              }
            />
            توصيل
          </label>
        </div>
        {publicSettings.fulfillment.deliveryEnabled ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>مناطق ورسوم التوصيل</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setPublicSettings({
                    ...publicSettings,
                    fulfillment: {
                      ...publicSettings.fulfillment,
                      zones: [
                        ...publicSettings.fulfillment.zones,
                        {
                          id: crypto
                            .randomUUID()
                            .replaceAll("-", "")
                            .slice(0, 12),
                          name: "",
                          fee: 0,
                        },
                      ],
                    },
                  })
                }
              >
                <Plus className="size-4" />
                إضافة منطقة
              </Button>
            </div>
            {publicSettings.fulfillment.zones.map((zone, index) => (
              <div
                key={zone.id}
                className="grid grid-cols-[1fr_120px_36px] gap-2"
              >
                <Input
                  value={zone.name}
                  placeholder="اسم المنطقة"
                  onChange={(e) =>
                    setPublicSettings({
                      ...publicSettings,
                      fulfillment: {
                        ...publicSettings.fulfillment,
                        zones: publicSettings.fulfillment.zones.map(
                          (item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, name: e.target.value }
                              : item,
                        ),
                      },
                    })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  value={zone.fee}
                  aria-label={`رسوم ${zone.name || "المنطقة"}`}
                  onChange={(e) =>
                    setPublicSettings({
                      ...publicSettings,
                      fulfillment: {
                        ...publicSettings.fulfillment,
                        zones: publicSettings.fulfillment.zones.map(
                          (item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, fee: Number(e.target.value) }
                              : item,
                        ),
                      },
                    })
                  }
                />
                <button
                  type="button"
                  aria-label="حذف المنطقة"
                  onClick={() =>
                    setPublicSettings({
                      ...publicSettings,
                      fulfillment: {
                        ...publicSettings.fulfillment,
                        zones: publicSettings.fulfillment.zones.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      },
                    })
                  }
                  className="grid size-9 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {previewHref ? (
          <Link
            href={previewHref}
            target="_blank"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
          >
            معاينة <ExternalLink className="size-4" />
          </Link>
        ) : null}
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const result = await saveStorefrontDraftAction(
                  store.id,
                  config,
                  publicSettings,
                );
                setPreviewToken(result.previewToken);
                toast.success("تم حفظ المسودة — المعاينة متاحة لمدة 30 دقيقة");
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "تعذر حفظ المسودة",
                );
              }
            })
          }
        >
          حفظ كمسودة
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const result = await saveStorefrontDraftAction(
                  store.id,
                  config,
                  publicSettings,
                );
                setPreviewToken(result.previewToken);
                await publishStorefrontDraftAction(store.id);
                toast.success("تم نشر واجهة المتجر");
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "تعذر نشر المتجر",
                );
              }
            })
          }
        >
          نشر
        </Button>
      </div>
    </div>
  );
}
