import { getTranslations } from "next-intl/server";
import type { PublicDealer, InnerPageKind } from "../types";
import { ContactForm } from "./ContactForm";
import s from "./InnerPage.module.css";

interface InnerPageProps {
  kind: InnerPageKind;
  dealer: PublicDealer;
}

/**
 * Shared content layout for the static inner pages. Rendered inside each
 * design's Shell, so it carries the design's header/footer chrome while the
 * body stays a consistent, readable content card across all designs.
 *
 * About / Finance / Privacy / Terms copy is editable per dealer (stored as
 * JSON in `dealers.public_content`, managed from the dealer Settings page). When
 * a dealer has not supplied copy for a page, we fall back to the templated
 * placeholder text below, keyed off the dealer name.
 */
export async function InnerPage({ kind, dealer }: InnerPageProps) {
  const t = await getTranslations('ui');
  return (
    <main className={s.wrap}>
      <article className={s.card}>{renderBody(kind, dealer, t)}</article>
    </main>
  );
}

type TFunc = Awaited<ReturnType<typeof getTranslations<'ui'>>>;

/** Split a freeform copy block into paragraphs on blank lines. */
function customBody(kind: Exclude<InnerPageKind, "contact">, dealer: PublicDealer, text: string, t: TFunc) {
  const PAGE_TITLES: Record<Exclude<InnerPageKind, "contact">, string> = {
    about: t('inner_page_about'),
    finance: t('inner_page_finance'),
    privacy: t('inner_page_privacy'),
    terms: t('inner_page_terms'),
  };
  const title = kind === "about" ? `${t('inner_page_about')} ${dealer.name}` : PAGE_TITLES[kind];
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <>
      <h1 className={s.title}>{title}</h1>
      {paragraphs.map((p, i) => (
        <p key={i} className={i === 0 ? s.lead : s.p}>{p}</p>
      ))}
    </>
  );
}

function renderBody(kind: InnerPageKind, dealer: PublicDealer, t: TFunc) {
  // Dealer-supplied copy takes precedence over the templated placeholders.
  if (kind !== "contact") {
    const custom = dealer.publicContent?.[kind]?.trim();
    if (custom) return customBody(kind, dealer, custom, t);
  }

  switch (kind) {
    case "about":
      return (
        <>
          <h1 className={s.title}>{t('inner_page_about')} {dealer.name}</h1>
          <p className={s.lead}>
            {dealer.name} {t('about_lead_text')}
          </p>
          <p className={s.p}>
            {t('about_body_1')}
          </p>
          <p className={s.p}>
            {t('about_body_2')}
          </p>
        </>
      );
    case "finance":
      return (
        <>
          <h1 className={s.title}>{t('inner_page_finance')}</h1>
          <p className={s.lead}>
            {t('finance_lead_text')}
          </p>
          <ul className={s.list}>
            <li>{t('finance_item_1')}</li>
            <li>{t('finance_item_2')}</li>
            <li>{t('finance_item_3')}</li>
            <li>{t('finance_item_4')}</li>
          </ul>
          <p className={s.p}>
            {t('finance_body')} {dealer.name} {t('finance_body_suffix')}
          </p>
        </>
      );
    case "contact":
      return (
        <>
          <h1 className={s.title}>{t('inner_page_contact')} {dealer.name}</h1>
          <p className={s.lead}>
            {t('contact_lead_text')}
          </p>
          <div className={s.contactGrid}>
            <div className={s.contactInfo}>
              {dealer.publicDomain && (
                <div className={s.infoRow}>
                  <span className={s.infoLabel}>{t('contact_label_website')}</span>
                  <span className={s.infoValue}>{dealer.publicDomain}</span>
                </div>
              )}
              {dealer.mobileUrl && (
                <div className={s.infoRow}>
                  <span className={s.infoLabel}>{t('contact_label_listings')}</span>
                  <a
                    href={dealer.mobileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={s.infoLink}
                  >
                    {t('contact_view_all_cars')}
                  </a>
                </div>
              )}
            </div>
            <ContactForm dealerSlug={dealer.slug} />
          </div>
        </>
      );
    case "privacy":
      return (
        <>
          <h1 className={s.title}>{t('inner_page_privacy')}</h1>
          <p className={s.lead}>
            {t('privacy_lead_text_prefix')} {dealer.name} {t('privacy_lead_text_suffix')}
          </p>
          <p className={s.p}>
            {t('privacy_body_1')}
          </p>
          <p className={s.p}>
            {t('privacy_body_2')}
          </p>
        </>
      );
    case "terms":
      return (
        <>
          <h1 className={s.title}>{t('inner_page_terms')}</h1>
          <p className={s.lead}>{t('terms_lead_text_prefix')} {dealer.name} {t('terms_lead_text_suffix')}</p>
          <p className={s.p}>
            {t('terms_body_1')}
          </p>
          <p className={s.p}>
            {t('terms_body_2_prefix')} {dealer.name} {t('terms_body_2_suffix')}
          </p>
        </>
      );
  }
}
