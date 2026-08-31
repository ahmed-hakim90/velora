import Link from "next/link";

export function StorefrontPreviewUnavailable({ slug }: { slug: string }) {
  return (
    <main
      dir="rtl"
      className="grid min-h-[70dvh] place-items-center bg-[#FFF7E6] px-4 text-center"
    >
      <div className="max-w-lg">
        <span className="text-7xl" aria-hidden>
          ⏳
        </span>
        <h1 className="mt-5 text-3xl font-black text-[#1A1A2E]">
          رابط المعاينة اتغيّر أو انتهى
        </h1>
        <p className="mt-3 leading-7 text-[#6B6B7B]">
          كل حفظ للمسودة ينشئ رابط معاينة جديد لحماية النسخة غير المنشورة. افتح
          المعاينة مرة أخرى من إعدادات المتجر.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/storefront/preview"
            className="inline-flex min-h-12 items-center rounded-xl bg-[#FFD32A] px-5 font-bold text-[#1A1A2E]"
          >
            فتح أحدث معاينة
          </Link>
          <Link
            href={`/store/${encodeURIComponent(slug)}`}
            className="inline-flex min-h-12 items-center rounded-xl border border-[#E8E3DA] bg-white px-5 font-bold text-[#1A1A2E]"
          >
            فتح النسخة المنشورة
          </Link>
        </div>
      </div>
    </main>
  );
}
