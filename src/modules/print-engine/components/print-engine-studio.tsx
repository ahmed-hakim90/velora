"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import { OperationalCard } from "@/components/Velora/operational-card";
import type { ReportBranding } from "@/modules/reports/core/report-context";
import { CommercialDocumentView } from "@/modules/print-engine/components/commercial-document-view";
import { sampleCommercialDocument } from "@/modules/print-engine/lib/sample-document";
import { commercialDocumentQrDataUrl } from "@/modules/print-engine/lib/document-qr";
import {
  COMMERCIAL_DOCUMENT_KIND_LABELS,
  COMMERCIAL_DOCUMENT_KINDS,
  duplicatePrintTemplate,
  MAX_PRINT_TEMPLATES,
  normalizePrintBlocks,
  PRINT_DOCUMENT_BLOCK_LABELS,
  PRINT_ENGINE_LAYOUT_LABELS,
  PRINT_ENGINE_LAYOUTS,
  PRINT_LOGO_POSITIONS,
  PRINT_LOGO_SIZES,
  resolvePrintTemplate,
  type CommercialDocumentKind,
  type PrintEngineLayout,
  type PrintEngineSettings,
  type PrintTemplate,
} from "@/modules/print-engine/lib/print-engine-settings";
import { savePrintEngineSettingsAction } from "@/modules/print-engine/actions/print-engine.actions";
import { uploadOrganizationLogoAction } from "@/modules/system/actions/system.actions";
import { useTranslation } from "@/lib/i18n/use-translation";

const COLOR_FIELDS = [
  ["primary", "اللون الأساسي"],
  ["accent", "لون مميز"],
  ["tableHeader", "رأس الجدول"],
  ["text", "النص"],
  ["muted", "نص ثانوي"],
  ["border", "الحدود"],
] as const;

const FIELD_TOGGLES = [
  ["showSku", "كود الصنف"],
  ["showUnit", "الوحدة"],
  ["showLineDiscount", "خصم السطر"],
  ["showTaxBreakdown", "تفصيل الضريبة"],
  ["showPartyAddress", "عنوان الطرف"],
  ["showPartyTaxId", "الرقم الضريبي للطرف"],
  ["showNotes", "الملاحظات"],
  ["showAmountInWords", "التفقيط"],
  ["showSignature", "التوقيع والختم"],
  ["showQr", "QR لرقم المستند"],
] as const;

type Props = {
  initialSettings: PrintEngineSettings;
  branding: ReportBranding;
  generatedBy: string;
  canUploadLogo?: boolean;
};

export function PrintEngineStudio({
  initialSettings,
  branding,
  generatedBy,
  canUploadLogo = false,
}: Props) {
  const { t, language } = useTranslation();
  const [settings, setSettings] = useState(initialSettings);
  const [activeId, setActiveId] = useState(initialSettings.defaultTemplateId);
  const [brandingState, setBrandingState] = useState(branding);
  const [previewKind, setPreviewKind] =
    useState<CommercialDocumentKind>("sales_invoice");
  const [pending, startTransition] = useTransition();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sample = useMemo(
    () => sampleCommercialDocument(previewKind),
    [previewKind],
  );
  const template = useMemo(
    () =>
      settings.templates.find((item) => item.id === activeId) ??
      resolvePrintTemplate(settings),
    [settings, activeId],
  );
  const blocks = normalizePrintBlocks(template.blocks);
  const kindOverride = template.documents?.[previewKind];
  const assignedPrintTemplate = resolvePrintTemplate(settings, previewKind);

  useEffect(() => {
    if (!template.fields.showQr) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void commercialDocumentQrDataUrl(sample.number).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [template.fields.showQr, sample.number]);

  function patchTemplate(patchValue: Partial<PrintTemplate>) {
    setSettings((current) => ({
      ...current,
      templates: current.templates.map((item) =>
        item.id === template.id ? { ...item, ...patchValue } : item,
      ),
    }));
  }

  function save() {
    startTransition(async () => {
      const result = await savePrintEngineSettingsAction(settings);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSettings(result.data);
      toast.success(
        t(
          "Templates saved. Each document type will use its assigned template.",
        ),
      );
    });
  }

  function uploadLogo(file: File) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("logo", file);
        const url = await uploadOrganizationLogoAction(formData);
        setBrandingState((current) => ({ ...current, orgLogoUrl: url }));
        toast.success(t("Logo uploaded"));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("Could not upload logo"),
        );
      }
    });
  }

  function createFromActive() {
    if (settings.templates.length >= MAX_PRINT_TEMPLATES) {
      toast.error(
        `${t("Maximum number of templates:")} ${MAX_PRINT_TEMPLATES}`,
      );
      return;
    }
    const created = duplicatePrintTemplate(
      template,
      `${t("Copy of")} ${template.name}`,
    );
    setSettings((current) => ({
      ...current,
      templates: [...current.templates, created],
    }));
    setActiveId(created.id);
    toast.success(t("New template created. Edit it, then save."));
  }

  function removeActive() {
    if (settings.templates.length <= 1) {
      toast.error(t("At least one template is required"));
      return;
    }
    const remaining = settings.templates.filter(
      (item) => item.id !== template.id,
    );
    const nextDefault =
      settings.defaultTemplateId === template.id
        ? remaining[0].id
        : settings.defaultTemplateId;
    const assignments = { ...settings.assignments };
    for (const kind of COMMERCIAL_DOCUMENT_KINDS) {
      if (assignments[kind] === template.id) delete assignments[kind];
    }
    setSettings({
      templates: remaining,
      defaultTemplateId: nextDefault,
      assignments,
    });
    setActiveId(nextDefault);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    patchTemplate({ blocks: next });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <OperationalCard
          title={t("Print templates")}
          description={t(
            "Create multiple layouts and assign one to each document type.",
          )}
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t("Open template")}</Label>
              <Select
                value={template.id}
                onValueChange={(value) => {
                  if (value) setActiveId(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {settings.templates.map((item) => (
                    <SelectItem key={item.id} value={item.id} label={item.name}>
                      {item.name}
                      {item.id === settings.defaultTemplateId
                        ? ` · ${t("Default")}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("Template name")}</Label>
              <Input
                value={template.name}
                onChange={(event) =>
                  patchTemplate({ name: event.target.value.slice(0, 60) })
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={createFromActive}
              >
                <Copy className="size-4" />
                {t("Duplicate template")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={settings.templates.length >= MAX_PRINT_TEMPLATES}
                onClick={() => {
                  if (settings.templates.length >= MAX_PRINT_TEMPLATES) return;
                  const created = duplicatePrintTemplate(
                    template,
                    t("New template"),
                  );
                  created.layout = "classic";
                  setSettings((current) => ({
                    ...current,
                    templates: [...current.templates, created],
                  }));
                  setActiveId(created.id);
                }}
              >
                <Plus className="size-4" />
                {t("Blank template")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={template.id === settings.defaultTemplateId}
                onClick={() =>
                  setSettings((current) => ({
                    ...current,
                    defaultTemplateId: template.id,
                  }))
                }
              >
                {t("Make default")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={settings.templates.length <= 1}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" />
                {t("Delete")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(
                "The logo is shared across templates. Layout, colors, and order belong to the open template.",
              )}
            </p>
          </div>
        </OperationalCard>

        <OperationalCard title={t("Template appearance")}>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t("Page layout")}</Label>
              <Select
                value={template.layout}
                onValueChange={(value) =>
                  patchTemplate({ layout: value as PrintEngineLayout })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRINT_ENGINE_LAYOUTS.map((layout) => (
                    <SelectItem
                      key={layout}
                      value={layout}
                      label={t(PRINT_ENGINE_LAYOUT_LABELS[layout])}
                    >
                      {t(PRINT_ENGINE_LAYOUT_LABELS[layout])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {COLOR_FIELDS.map(([key, label]) => (
                <label key={key} className="space-y-1 text-sm">
                  <span>{t(label)}</span>
                  <Input
                    type="color"
                    value={template.colors[key]}
                    onChange={(event) =>
                      patchTemplate({
                        colors: {
                          ...template.colors,
                          [key]: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>

            {canUploadLogo ? (
              <div className="space-y-2">
                <Label>{t("Company logo")}</Label>
                {brandingState.orgLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brandingState.orgLogoUrl}
                    alt={t("Company logo")}
                    className="h-16 w-16 rounded-lg object-contain"
                  />
                ) : null}
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={pending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadLogo(file);
                    event.target.value = "";
                  }}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("Logo from")}{" "}
                <Link
                  href="/settings?tab=business"
                  className="text-primary underline"
                >
                  {t("Business settings")}
                </Link>
                {brandingState.orgLogoUrl
                  ? ` — ${t("Uploaded")}.`
                  : ` — ${t("The owner can upload the logo")}.`}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>{t("Logo position")}</Label>
                <Select
                  value={template.logo.position}
                  onValueChange={(value) =>
                    patchTemplate({
                      logo: {
                        ...template.logo,
                        position: value as PrintTemplate["logo"]["position"],
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRINT_LOGO_POSITIONS.map((position) => (
                      <SelectItem
                        key={position}
                        value={position}
                        label={
                          position === "start"
                            ? t("Start")
                            : position === "end"
                              ? t("End")
                              : t("Center")
                        }
                      >
                        {position === "start"
                          ? t("Start")
                          : position === "end"
                            ? t("End")
                            : t("Center")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("Logo size")}</Label>
                <Select
                  value={template.logo.size}
                  onValueChange={(value) =>
                    patchTemplate({
                      logo: {
                        ...template.logo,
                        size: value as PrintTemplate["logo"]["size"],
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRINT_LOGO_SIZES.map((size) => (
                      <SelectItem
                        key={size}
                        value={size}
                        label={
                          size === "sm"
                            ? t("Small")
                            : size === "lg"
                              ? t("Large")
                              : t("Medium")
                        }
                      >
                        {size === "sm"
                          ? t("Small")
                          : size === "lg"
                            ? t("Large")
                            : t("Medium")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={template.logo.show}
                onChange={(event) =>
                  patchTemplate({
                    logo: { ...template.logo, show: event.target.checked },
                  })
                }
              />
              {t("Show logo")}
            </label>
          </div>
        </OperationalCard>

        <OperationalCard
          title={t("Page element order")}
          description={t(
            "Move sections up or down, or hide them. The preview updates instantly.",
          )}
        >
          <div className="space-y-1">
            {blocks.map((block, index) => (
              <div
                key={block.id}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
              >
                <input
                  type="checkbox"
                  checked={block.enabled}
                  onChange={(event) => {
                    const next = blocks.map((item) =>
                      item.id === block.id
                        ? { ...item, enabled: event.target.checked }
                        : item,
                    );
                    patchTemplate({ blocks: next });
                  }}
                  aria-label={`${t("Show")} ${t(PRINT_DOCUMENT_BLOCK_LABELS[block.id])}`}
                />
                <span className="min-w-0 flex-1 text-sm">
                  {t(PRINT_DOCUMENT_BLOCK_LABELS[block.id])}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={index === 0}
                  onClick={() => moveBlock(index, -1)}
                  aria-label={t("Move up")}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={index === blocks.length - 1}
                  onClick={() => moveBlock(index, 1)}
                  aria-label={t("Move down")}
                >
                  <ChevronDown className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </OperationalCard>

        <OperationalCard title={t("Company details on this template")}>
          <div className="space-y-3">
            {(
              [
                ["legalName", "الاسم القانوني"],
                ["taxId", "الرقم الضريبي"],
                ["commercialRegister", "السجل التجاري"],
                ["phone", "الهاتف"],
                ["email", "الإيميل"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label>{t(label)}</Label>
                <Input
                  value={template.company[key]}
                  onChange={(event) =>
                    patchTemplate({
                      company: {
                        ...template.company,
                        [key]: event.target.value,
                      },
                    })
                  }
                />
              </div>
            ))}
            <div className="space-y-1">
              <Label>{t("Company address")}</Label>
              <Textarea
                rows={2}
                value={template.company.address}
                onChange={(event) =>
                  patchTemplate({
                    company: {
                      ...template.company,
                      address: event.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>{t("Bank transfer details")}</Label>
              <Textarea
                rows={2}
                value={template.company.bankDetails}
                onChange={(event) =>
                  patchTemplate({
                    company: {
                      ...template.company,
                      bankDetails: event.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>{t("Default header")}</Label>
              <Textarea
                rows={2}
                value={template.headerText}
                onChange={(event) =>
                  patchTemplate({ headerText: event.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>{t("Default footer")}</Label>
              <Textarea
                rows={2}
                value={template.footerText}
                onChange={(event) =>
                  patchTemplate({ footerText: event.target.value })
                }
              />
            </div>
          </div>
        </OperationalCard>

        <OperationalCard title={t("Document fields")}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {FIELD_TOGGLES.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={template.fields[key]}
                  onChange={(event) =>
                    patchTemplate({
                      fields: {
                        ...template.fields,
                        [key]: event.target.checked,
                      },
                    })
                  }
                />
                {t(label)}
              </label>
            ))}
          </div>
        </OperationalCard>

        <OperationalCard
          title={`${t("Customize")}: ${t(COMMERCIAL_DOCUMENT_KIND_LABELS[previewKind])}`}
          description={t(
            "Set this document type's title, footer, and print template.",
          )}
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t("Template used for this document type")}</Label>
              <Select
                value={settings.assignments?.[previewKind] || "__default__"}
                onValueChange={(value) => {
                  if (!value) return;
                  setSettings((current) => {
                    const assignments = { ...current.assignments };
                    if (value === "__default__")
                      delete assignments[previewKind];
                    else assignments[previewKind] = value;
                    return { ...current, assignments };
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="__default__"
                    label={`${t("Default")} (${settings.templates.find((item) => item.id === settings.defaultTemplateId)?.name ?? "—"})`}
                  >
                    {t("Default")}
                  </SelectItem>
                  {settings.templates.map((item) => (
                    <SelectItem key={item.id} value={item.id} label={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("Document title")}</Label>
              <Input
                placeholder={t(COMMERCIAL_DOCUMENT_KIND_LABELS[previewKind])}
                value={kindOverride?.title ?? ""}
                onChange={(event) =>
                  patchTemplate({
                    documents: {
                      ...template.documents,
                      [previewKind]: {
                        ...kindOverride,
                        title: event.target.value,
                      },
                    },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>{t("Footer for this document type")}</Label>
              <Textarea
                rows={2}
                placeholder={t("Empty = default footer")}
                value={kindOverride?.footerNote ?? ""}
                onChange={(event) =>
                  patchTemplate({
                    documents: {
                      ...template.documents,
                      [previewKind]: {
                        ...kindOverride,
                        footerNote: event.target.value,
                      },
                    },
                  })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={kindOverride?.showWatermark === true}
                onChange={(event) =>
                  patchTemplate({
                    documents: {
                      ...template.documents,
                      [previewKind]: {
                        ...kindOverride,
                        showWatermark: event.target.checked,
                      },
                    },
                  })
                }
              />
              {t("Watermark (draft)")}
            </label>
          </div>
        </OperationalCard>

        <Button
          type="button"
          onClick={save}
          disabled={pending}
          className="h-11 w-full font-semibold"
        >
          {pending ? t("Saving...") : t("Save all templates")}
        </Button>
      </div>

      <OperationalCard
        title={t("Live A4 preview")}
        description={
          assignedPrintTemplate.id === template.id
            ? t(
                "The preview matches the open template used for this document type.",
              )
            : language === "ar"
              ? `المعاينة للقالب المفتوح. ستستخدم طباعة ${COMMERCIAL_DOCUMENT_KIND_LABELS[previewKind]} قالب «${assignedPrintTemplate.name}».`
              : `This preview shows the open template. Printing ${t(COMMERCIAL_DOCUMENT_KIND_LABELS[previewKind])} will use “${assignedPrintTemplate.name}”.`
        }
        action={
          <Select
            value={previewKind}
            onValueChange={(value) =>
              setPreviewKind(value as CommercialDocumentKind)
            }
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMERCIAL_DOCUMENT_KINDS.map((kind) => (
                <SelectItem
                  key={kind}
                  value={kind}
                  label={t(COMMERCIAL_DOCUMENT_KIND_LABELS[kind])}
                >
                  {t(COMMERCIAL_DOCUMENT_KIND_LABELS[kind])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        <div className="overflow-auto rounded-md border bg-muted/30 p-2">
          <CommercialDocumentView
            branding={brandingState}
            settings={template}
            document={sample}
            generatedBy={generatedBy}
            generatedAt={new Date().toISOString()}
            qrDataUrl={qrDataUrl}
            language={language}
          />
        </div>
      </OperationalCard>

      <ConfirmActionDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("Delete template?")}
        description={
          language === "ar"
            ? `سيُحذف «${template.name}»، وستعود المستندات المرتبطة به إلى القالب الافتراضي.`
            : `“${template.name}” will be deleted. Assigned documents will return to the default template.`
        }
        confirmLabel={t("Delete template")}
        destructive
        onConfirm={removeActive}
      />
    </div>
  );
}
