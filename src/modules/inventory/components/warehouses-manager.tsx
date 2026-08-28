"use client";

import { useState, useTransition } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Check, Pencil, Plus, Power, Star, Warehouse as WarehouseIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { StatusPill } from "@/components/Velora/status-pill";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createWarehouseAction,
  setDefaultWarehouseAction,
  updateWarehouseAction,
} from "@/modules/system/actions/system.actions";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { Store, Warehouse } from "@/lib/types";

interface WarehousesManagerProps {
  stores: Store[];
  warehouses: Warehouse[];
}

export function WarehousesManager({ stores, warehouses }: WarehousesManagerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addNames, setAddNames] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  function addWarehouse(storeId: string) {
    const name = addNames[storeId]?.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        await createWarehouseAction({ storeId, name });
        setAddNames((current) => ({ ...current, [storeId]: "" }));
        router.refresh();
        toast.success(t("Warehouse created"));
      } catch {
        toast.error(t("Failed to create warehouse"));
      }
    });
  }

  function saveRename() {
    if (!editing || !editing.name.trim()) return;
    const { id, name } = editing;
    startTransition(async () => {
      try {
        await updateWarehouseAction(id, { name: name.trim() });
        setEditing(null);
        router.refresh();
        toast.success(t("Warehouse updated"));
      } catch {
        toast.error(t("Failed to update warehouse"));
      }
    });
  }

  function toggleActive(warehouse: Warehouse) {
    startTransition(async () => {
      try {
        await updateWarehouseAction(warehouse.id, { isActive: !warehouse.is_active });
        router.refresh();
        toast.success(t("Warehouse updated"));
      } catch {
        toast.error(t("Failed to update warehouse"));
      }
    });
  }

  function makeDefault(warehouse: Warehouse) {
    startTransition(async () => {
      try {
        await setDefaultWarehouseAction(warehouse.store_id, warehouse.id);
        router.refresh();
        toast.success(t("Default warehouse updated"));
      } catch {
        toast.error(t("Failed to update default warehouse"));
      }
    });
  }

  function warehouseActions(warehouse: Warehouse) {
    if (editing?.id === warehouse.id) {
      return <CompactActions><CompactAction label={t("Save")} icon={Check} variant="default" disabled={pending} onClick={saveRename} /><CompactAction label={t("Cancel")} icon={X} variant="ghost" onClick={() => setEditing(null)} /></CompactActions>;
    }
    return <CompactActions><CompactAction label={t("Rename")} icon={Pencil} disabled={pending} onClick={() => setEditing({ id: warehouse.id, name: warehouse.name })} />{!warehouse.is_default ? <><CompactAction label={t("Make default")} icon={Star} disabled={pending || !warehouse.is_active} onClick={() => makeDefault(warehouse)} /><CompactAction label={warehouse.is_active ? t("Disable") : t("Enable")} icon={Power} variant="ghost" disabled={pending} onClick={() => toggleActive(warehouse)} /></> : null}</CompactActions>;
  }

  function warehouseName(warehouse: Warehouse) {
    return editing?.id === warehouse.id ? <Input value={editing.name} autoFocus className="h-8 min-h-8" aria-label={t("Warehouse name")} onChange={(event) => setEditing({ id: warehouse.id, name: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") saveRename(); if (event.key === "Escape") setEditing(null); }} /> : <span className="flex items-center gap-2 font-medium"><WarehouseIcon className="size-4 shrink-0 text-muted-foreground" />{warehouse.name}</span>;
  }

  return (
    <>
      <PageHeader
        title={t("Warehouses")}
        description={t("Each branch has a default warehouse that POS sales deduct from. Add more warehouses for storage or production")}
      />

      <div className="grid gap-3">
        {stores.map((store) => {
          const storeWarehouses = warehouses.filter((w) => w.store_id === store.id);
          return (
            <OperationalCard key={store.id} title={store.name}>
              <div className="grid gap-3">
                <div className="hidden overflow-hidden rounded-[var(--mds-radius-md)] border border-border md:block"><Table><TableHeader><TableRow><TableHead>{t("Warehouse")}</TableHead><TableHead>{t("Status")}</TableHead><TableHead>{t("Default")}</TableHead><TableHead className="text-center">{t("Actions")}</TableHead></TableRow></TableHeader><TableBody>{storeWarehouses.map((warehouse) => <TableRow key={warehouse.id}><TableCell className="min-w-52">{warehouseName(warehouse)}</TableCell><TableCell><StatusPill variant={warehouse.is_active ? "success" : "danger"} label={warehouse.is_active ? t("Active") : t("Disabled")} /></TableCell><TableCell>{warehouse.is_default ? <StatusPill variant="info" label={t("Default")} /> : "—"}</TableCell><TableCell><div className="flex justify-center">{warehouseActions(warehouse)}</div></TableCell></TableRow>)}</TableBody></Table></div>
                <div className="grid gap-2 md:hidden">{storeWarehouses.map((warehouse) => <MobileEntityCard key={warehouse.id} title={warehouse.name} subtitle={store.name} badge={<StatusPill variant={warehouse.is_active ? "success" : "danger"} label={warehouse.is_active ? t("Active") : t("Disabled")} />} fields={[{ label: t("Default"), value: warehouse.is_default ? t("Yes") : t("No") }]} footer={editing?.id === warehouse.id ? <div className="grid w-full gap-2">{warehouseName(warehouse)}{warehouseActions(warehouse)}</div> : warehouseActions(warehouse)} />)}</div>

                <form
                  className="flex w-full max-w-md flex-row items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addWarehouse(store.id);
                  }}
                >
                  <Input
                    placeholder={t("Warehouse name, e.g. Cold storage")}
                    value={addNames[store.id] ?? ""}
                    onChange={(e) =>
                      setAddNames((current) => ({ ...current, [store.id]: e.target.value }))
                    }
                    className="h-9 min-h-9 min-w-0 flex-1"
                  />
                  <CompactAction
                    label={t("Add warehouse")}
                    icon={Plus}
                    variant="default"
                    type="submit"
                    disabled={pending || !(addNames[store.id]?.trim())}
                  />
                </form>
              </div>
            </OperationalCard>
          );
        })}
      </div>
    </>
  );
}
