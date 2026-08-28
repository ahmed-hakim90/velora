"use client";
export default function StoreError({ reset }: { reset: () => void }) {
  return <main dir="rtl" className="grid min-h-[70dvh] place-items-center bg-[#FFF7E6] px-4 text-center"><div><span className="text-6xl">🧩</span><h1 className="mt-4 text-2xl font-black text-[#1A1A2E]">حصلت مشكلة في تحميل المتجر</h1><p className="mt-2 text-[#6B6B7B]">جرّب مرة تانية، ولو المشكلة مستمرة ارجع بعد شوية.</p><button onClick={reset} className="mt-5 h-12 rounded-xl bg-[#FFD32A] px-5 font-bold text-[#1A1A2E]">حاول مرة تانية</button></div></main>;
}
