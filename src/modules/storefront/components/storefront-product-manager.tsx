"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ImagePlus, Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/format";
import { saveStorefrontProductAction } from "../actions/storefront-product.actions";
import type { StorefrontProductAdminItem } from "../services/storefront-product-admin.service";

export function StorefrontProductManager({
  storeId,
  currency,
  products,
}: {
  storeId: string;
  currency: string;
  products: StorefrontProductAdminItem[];
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(products[0]?.id ?? "");
  const selected =
    products.find((product) => product.id === selectedId) ?? null;
  const [draft, setDraft] = useState(selected);
  const [pending, startTransition] = useTransition();
  useEffect(() => setDraft(selected), [selected]);
  const filtered = useMemo(
    () =>
      products.filter((product) =>
        `${product.name} ${product.sku}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [products, query],
  );
  if (!products.length)
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
        أضف منتجات أولًا من الكتالوج، ثم ارجع لتجهيز عرضها في المتجر.
      </div>
    );
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="rounded-2xl border bg-card p-3">
        <label className="relative block">
          <Search className="absolute end-3 top-3 size-4 text-muted-foreground" />
          <span className="sr-only">بحث في المنتجات</span>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="اسم المنتج أو SKU"
            className="pe-10"
          />
        </label>
        <div className="mt-3 max-h-[70dvh] space-y-1 overflow-y-auto">
          {filtered.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => setSelectedId(product.id)}
              className={`flex w-full items-center gap-3 rounded-xl p-3 text-start ${selectedId === product.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
            >
              <span
                className={`size-2 shrink-0 rounded-full ${product.published ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
              />
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm">
                  {product.name}
                </strong>
                <span className="font-mono text-xs text-muted-foreground">
                  {product.sku || "—"}
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>
      {draft ? (
        <section className="space-y-6 rounded-2xl border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">المنتج الأساسي</p>
              <h2 className="text-xl font-bold">{draft.name}</h2>
              <p className="mt-1 text-sm">
                السعر الأساسي:{" "}
                <strong>{formatCurrency(draft.basePrice, currency)}</strong>
              </p>
            </div>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold">
              <Checkbox
                checked={draft.published}
                onCheckedChange={(value) =>
                  setDraft({ ...draft, published: value === true })
                }
              />
              عرض في المتجر
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <Label>عنوان العرض</Label>
              <Input
                className="mt-2"
                value={draft.title}
                placeholder={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
              />
            </label>
            <label>
              <Label>سعر المتجر لهذا الفرع</Label>
              <Input
                className="mt-2"
                type="number"
                min={0}
                step="0.01"
                value={draft.storefrontPrice ?? ""}
                placeholder={String(draft.basePrice)}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    storefrontPrice:
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="sm:col-span-2">
              <Label>وصف المتجر</Label>
              <Textarea
                className="mt-2 min-h-32"
                value={draft.description}
                placeholder="اتركه فارغًا لاستخدام وصف المنتج الأساسي"
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
              />
            </label>
            <label>
              <Label>السعر قبل الخصم (اختياري)</Label>
              <Input
                className="mt-2"
                type="number"
                min={0}
                step="0.01"
                value={draft.compareAtPrice ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    compareAtPrice:
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>الصور الإضافية</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  أول صورة تصبح الصورة الرئيسية في المتجر فقط.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraft({
                    ...draft,
                    media: [...draft.media, { url: "", altText: "" }],
                  })
                }
              >
                <ImagePlus className="size-4" />
                إضافة صورة
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {draft.media.map((media, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_40px]"
                >
                  <Input
                    dir="ltr"
                    value={media.url}
                    placeholder="https://..."
                    aria-label={`رابط الصورة ${index + 1}`}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        media: draft.media.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, url: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                  <Input
                    value={media.altText}
                    placeholder="وصف الصورة"
                    aria-label={`وصف الصورة ${index + 1}`}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        media: draft.media.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, altText: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    aria-label="حذف الصورة"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        media: draft.media.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      })
                    }
                    className="grid size-10 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <Label>المواصفات</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraft({
                    ...draft,
                    specifications: [
                      ...draft.specifications,
                      { name: "", value: "" },
                    ],
                  })
                }
              >
                <Plus className="size-4" />
                إضافة مواصفة
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {draft.specifications.map((specification, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_1fr_40px] gap-2"
                >
                  <Input
                    value={specification.name}
                    placeholder="مثال: الخامة"
                    aria-label={`اسم المواصفة ${index + 1}`}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        specifications: draft.specifications.map(
                          (item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, name: event.target.value }
                              : item,
                        ),
                      })
                    }
                  />
                  <Input
                    value={specification.value}
                    placeholder="مثال: خشب طبيعي"
                    aria-label={`قيمة المواصفة ${index + 1}`}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        specifications: draft.specifications.map(
                          (item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, value: event.target.value }
                              : item,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    aria-label="حذف المواصفة"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        specifications: draft.specifications.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      })
                    }
                    className="grid size-10 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await saveStorefrontProductAction({
                      productId: draft.id,
                      storeId,
                      published: draft.published,
                      title: draft.title,
                      description: draft.description,
                      specifications: draft.specifications.filter(
                        (item) => item.name.trim() && item.value.trim(),
                      ),
                      media: draft.media.filter((item) => item.url.trim()),
                      storefrontPrice: draft.storefrontPrice,
                      compareAtPrice: draft.compareAtPrice,
                    });
                    toast.success("تم حفظ بيانات المنتج للمتجر");
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "تعذر الحفظ",
                    );
                  }
                })
              }
            >
              <Save className="size-4" />
              {pending ? "جاري الحفظ..." : "حفظ المنتج"}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
