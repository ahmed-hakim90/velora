import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { formatCurrency } from "@/lib/format";
import { amountInArabicWords } from "@/modules/print-engine/lib/amount-in-words-ar";
import {
  documentTitle,
  normalizePrintBlocks,
  type PrintDocumentBlockId,
  type PrintEngineLayout,
} from "@/modules/print-engine/lib/print-engine-settings";
import type { CommercialDocumentViewProps } from "@/modules/print-engine/lib/commercial-document-types";
import { translateText } from "@/lib/i18n/translations";

type PrintVariant = "executive" | "minimal" | "corporate";

function printVariant(layout: PrintEngineLayout): PrintVariant {
  if (layout === "modern" || layout === "corporate") return "corporate";
  if (["minimal", "compact", "striped", "statement"].includes(layout))
    return "minimal";
  return "executive";
}

function DetailList({
  rows,
  muted,
}: {
  rows: Array<{ label: string; value: string }>;
  muted: string;
}) {
  return (
    <dl className="print-metadata">
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`} className="print-metadata__item">
          <dt style={{ color: muted }}>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CommercialDocumentView({
  branding,
  settings,
  document: doc,
  generatedBy,
  generatedAt,
  qrDataUrl = null,
  hideMoney: hideMoneyProp = false,
  language = "ar",
}: CommercialDocumentViewProps) {
  const t = (text: string) => translateText(text, language);
  const colors = settings.colors;
  const variant = printVariant(settings.layout);
  const title = t(documentTitle(settings, doc.kind));
  const legalName = settings.company.legalName.trim() || branding.orgName;
  const hideMoney = hideMoneyProp || doc.kind === "delivery_note";
  const footerNote =
    settings.documents?.[doc.kind]?.footerNote?.trim() ||
    settings.footerText.trim();
  const watermark = settings.documents?.[doc.kind]?.showWatermark
    ? t(doc.watermark?.trim() || "Draft")
    : null;
  const blocks = normalizePrintBlocks(settings.blocks);
  const extraCost = doc.extraCost ?? 0;
  const currency = branding.currency;
  const cssVars = {
    "--print-primary": colors.primary,
    "--print-accent": colors.accent,
    "--print-text": colors.text,
    "--print-muted": colors.muted,
    "--print-border": colors.border,
    "--print-table-head": colors.tableHeader,
  } as CSSProperties;
  const companyLines = [
    branding.storeName,
    settings.company.address || branding.storeAddress,
    settings.company.taxId ? `${t("Tax ID")} ${settings.company.taxId}` : null,
    settings.company.commercialRegister
      ? `${t("Commercial register")} ${settings.company.commercialRegister}`
      : null,
    settings.company.phone || branding.storePhone,
    settings.company.email,
  ].filter(Boolean) as string[];

  const sections: Record<PrintDocumentBlockId, ReactNode> = {
    header: (
      <header className="print-header">
        <div className="print-company">
          {settings.logo.show && branding.orgLogoUrl ? (
            <Image
              src={branding.orgLogoUrl}
              alt={legalName}
              width={
                settings.logo.size === "lg"
                  ? 128
                  : settings.logo.size === "sm"
                    ? 76
                    : 100
              }
              height={56}
              className="print-logo"
              unoptimized
              priority
            />
          ) : (
            <div className="print-wordmark">
              {legalName}
              <span>.</span>
            </div>
          )}
          <div className="print-company__details">
            {companyLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        <div className="print-identity">
          <h1>{title}</h1>
          <p className="print-document-number">
            #{doc.number.replace(/^#/, "")}
          </p>
          <p>{doc.dateLabel}</p>
          {doc.validUntil ? (
            <p>
              {t("Valid until")} {doc.validUntil}
            </p>
          ) : null}
        </div>
      </header>
    ),
    party: (
      <>
        <section className="print-parties">
          {doc.party ? (
            <div className="print-party">
              <p className="print-eyebrow">{t(doc.partyLabel)}</p>
              <h2>{doc.party.name}</h2>
              {settings.fields.showPartyAddress && doc.party.address ? (
                <p>{doc.party.address}</p>
              ) : null}
              {settings.fields.showPartyTaxId && doc.party.taxId ? (
                <p>
                  {t("Tax ID")} {doc.party.taxId}
                </p>
              ) : null}
              {doc.party.phone ? <p dir="ltr">{doc.party.phone}</p> : null}
              {doc.party.email ? <p>{doc.party.email}</p> : null}
            </div>
          ) : (
            <div />
          )}
          {doc.meta?.length ? (
            <div className="print-party print-party--secondary">
              <p className="print-eyebrow">{t("Document details")}</p>
              {doc.meta.map((row) => (
                <p key={row.label}>
                  <strong>{t(row.label)}</strong> {row.value}
                </p>
              ))}
            </div>
          ) : null}
        </section>
        {doc.meta?.length ? (
          <DetailList rows={doc.meta} muted={colors.muted} />
        ) : null}
      </>
    ),
    lines: (
      <table className="print-lines">
        <thead>
          <tr>
            <th className="print-line-index">#</th>
            <th>{t("Item")}</th>
            {settings.fields.showUnit ? <th>{t("Unit")}</th> : null}
            <th>{t("Quantity")}</th>
            {!hideMoney ? <th>{t("Price")}</th> : null}
            {!hideMoney && settings.fields.showLineDiscount ? (
              <th>{t("Discount")}</th>
            ) : null}
            {!hideMoney ? <th>{t("Total")}</th> : null}
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((line, index) => (
            <tr key={line.id}>
              <td className="print-line-index">
                {String(index + 1).padStart(2, "0")}
              </td>
              <td>
                <strong>{line.name}</strong>
                {settings.fields.showSku && line.sku ? (
                  <small>SKU {line.sku}</small>
                ) : null}
              </td>
              {settings.fields.showUnit ? <td>{line.unit || "—"}</td> : null}
              <td>{line.quantity}</td>
              {!hideMoney ? (
                <td>{formatCurrency(line.unitPrice, currency)}</td>
              ) : null}
              {!hideMoney && settings.fields.showLineDiscount ? (
                <td>
                  {line.discount
                    ? formatCurrency(line.discount, currency)
                    : "—"}
                </td>
              ) : null}
              {!hideMoney ? (
                <td>
                  <strong>{formatCurrency(line.lineTotal, currency)}</strong>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    ),
    totals: hideMoney ? null : (
      <section className="print-closing">
        <div className="print-notes-inline">
          {settings.fields.showNotes && doc.notes ? (
            <>
              <p className="print-eyebrow">{t("Notes")}</p>
              <p>{doc.notes}</p>
            </>
          ) : null}
        </div>
        <div className="print-totals">
          <p>
            <span>{t("Subtotal")}</span>
            <strong>{formatCurrency(doc.subtotal, currency)}</strong>
          </p>
          {doc.discount > 0 ? (
            <p>
              <span>{t("Discount")}</span>
              <strong>-{formatCurrency(doc.discount, currency)}</strong>
            </p>
          ) : null}
          {extraCost > 0 ? (
            <p>
              <span>{t("Additional cost")}</span>
              <strong>{formatCurrency(extraCost, currency)}</strong>
            </p>
          ) : null}
          {settings.fields.showTaxBreakdown && doc.tax > 0 ? (
            <p>
              <span>{t("Tax")}</span>
              <strong>{formatCurrency(doc.tax, currency)}</strong>
            </p>
          ) : null}
          <p className="print-grand-total">
            <span>{t("Total")}</span>
            <strong>{formatCurrency(doc.total, currency)}</strong>
          </p>
          {settings.fields.showAmountInWords && language === "ar" ? (
            <small>{amountInArabicWords(doc.total)}</small>
          ) : null}
        </div>
      </section>
    ),
    notes:
      settings.fields.showNotes && settings.company.bankDetails ? (
        <section className="print-bank">
          <strong>{t("Bank transfer details")}</strong>
          <p>{settings.company.bankDetails}</p>
        </section>
      ) : null,
    signature: settings.fields.showSignature ? (
      <section className="print-signatures">
        <div>
          <span />
          {t("Prepared by")}
        </div>
        <div>
          <span />
          {t("Approved by")}
        </div>
      </section>
    ) : null,
    qr:
      settings.fields.showQr && qrDataUrl ? (
        <div className="print-qr">
          <Image
            src={qrDataUrl}
            alt={`${t("Verification code")} ${doc.number}`}
            width={80}
            height={80}
            unoptimized
          />
        </div>
      ) : null,
    footer: (
      <footer className="print-footer">
        <span>{footerNote || branding.storeName || legalName}</span>
        <span>
          {generatedBy} · {generatedAt}
        </span>
        <span>1 / 1</span>
      </footer>
    ),
  };

  return (
    <article
      data-print-root
      data-print-variant={variant}
      dir={language === "ar" ? "rtl" : "ltr"}
      className="velora-print-page"
      style={cssVars}
    >
      {watermark ? <div className="print-watermark">{watermark}</div> : null}
      {blocks.map((block) =>
        block.enabled ? <div key={block.id}>{sections[block.id]}</div> : null,
      )}
    </article>
  );
}
