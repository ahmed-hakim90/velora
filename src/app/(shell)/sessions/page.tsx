import { SessionsPage } from "@/modules/sessions/components/sessions-page";

export const dynamic = "force-dynamic";

export default async function SessionsRoute({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  return <SessionsPage filterStoreId={params.storeId ?? "all"} filterFrom={params.from ?? ""} filterTo={params.to ?? ""} />;
}
