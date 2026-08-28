import Link from "next/link";
export default function StoreNotFound() {
  return <main dir="rtl" className="grid min-h-[70dvh] place-items-center bg-[#FFF7E6] px-4 text-center"><div><span className="text-7xl">🪀</span><h1 className="mt-5 text-3xl font-black text-[#1A1A2E]">المتجر أو الصفحة مش موجودة</h1><Link href="/" className="mt-6 inline-flex h-12 items-center rounded-xl bg-[#FFD32A] px-5 font-bold">العودة إلى Velora</Link></div></main>;
}
