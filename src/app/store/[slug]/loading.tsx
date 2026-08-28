export default function StoreLoading() {
  return <main dir="rtl" className="min-h-dvh bg-[#FFF7E6] p-4" aria-busy="true" aria-label="جاري تحميل المتجر"><div className="mx-auto max-w-7xl animate-pulse"><div className="h-16 rounded-2xl bg-white" /><div className="mt-6 h-80 rounded-[32px] bg-[#482AD6]/15" /><div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="aspect-[.75] rounded-3xl bg-white" />)}</div></div></main>;
}
