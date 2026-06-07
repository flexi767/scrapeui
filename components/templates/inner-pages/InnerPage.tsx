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
export function InnerPage({ kind, dealer }: InnerPageProps) {
  return (
    <main className={s.wrap}>
      <article className={s.card}>{renderBody(kind, dealer)}</article>
    </main>
  );
}

/** Default page heading used when rendering dealer-supplied copy. */
const PAGE_TITLES: Record<Exclude<InnerPageKind, "contact">, string> = {
  about: "About",
  finance: "Financing",
  privacy: "Privacy Policy",
  terms: "Terms & Conditions",
};

/** Split a freeform copy block into paragraphs on blank lines. */
function customBody(kind: Exclude<InnerPageKind, "contact">, dealer: PublicDealer, text: string) {
  const title = kind === "about" ? `About ${dealer.name}` : PAGE_TITLES[kind];
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

function renderBody(kind: InnerPageKind, dealer: PublicDealer) {
  // Dealer-supplied copy takes precedence over the templated placeholders.
  if (kind !== "contact") {
    const custom = dealer.publicContent?.[kind]?.trim();
    if (custom) return customBody(kind, dealer, custom);
  }

  switch (kind) {
    case "about":
      return (
        <>
          <h1 className={s.title}>About {dealer.name}</h1>
          <p className={s.lead}>
            {dealer.name} is a trusted car dealership offering a carefully selected
            range of quality vehicles.
          </p>
          <p className={s.p}>
            Every car in our showroom is inspected and prepared to a high standard.
            Our team is on hand to help you find the right vehicle for your needs and
            budget, with honest advice at every step.
          </p>
          <p className={s.p}>
            Browse our current stock online and get in touch to arrange a viewing or
            test drive.
          </p>
        </>
      );
    case "finance":
      return (
        <>
          <h1 className={s.title}>Financing</h1>
          <p className={s.lead}>
            Flexible finance options to help you drive away in the car you want.
          </p>
          <ul className={s.list}>
            <li>Competitive monthly payment plans</li>
            <li>Part-exchange welcome</li>
            <li>Quick decisions, minimal paperwork</li>
            <li>Tailored terms to suit your budget</li>
          </ul>
          <p className={s.p}>
            Finance is subject to status and affordability. Contact {dealer.name} for a
            personalised quote and full terms.
          </p>
        </>
      );
    case "contact":
      return (
        <>
          <h1 className={s.title}>Contact {dealer.name}</h1>
          <p className={s.lead}>
            Have a question about a vehicle? Send us a message and we&apos;ll get back
            to you.
          </p>
          <div className={s.contactGrid}>
            <div className={s.contactInfo}>
              {dealer.publicDomain && (
                <div className={s.infoRow}>
                  <span className={s.infoLabel}>Website</span>
                  <span className={s.infoValue}>{dealer.publicDomain}</span>
                </div>
              )}
              {dealer.mobileUrl && (
                <div className={s.infoRow}>
                  <span className={s.infoLabel}>Listings</span>
                  <a
                    href={dealer.mobileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={s.infoLink}
                  >
                    View all our cars →
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
          <h1 className={s.title}>Privacy Policy</h1>
          <p className={s.lead}>
            How {dealer.name} handles the information you share with us.
          </p>
          <p className={s.p}>
            We collect only the information needed to respond to your enquiries and
            provide our services. We do not sell your personal data to third parties.
          </p>
          <p className={s.p}>
            Information you submit through our enquiry form is used solely to contact
            you about your request. You may ask us to remove your details at any time.
          </p>
        </>
      );
    case "terms":
      return (
        <>
          <h1 className={s.title}>Terms &amp; Conditions</h1>
          <p className={s.lead}>The terms governing use of the {dealer.name} website.</p>
          <p className={s.p}>
            Vehicle details, pricing and availability are provided in good faith and may
            change without notice. Listings do not form part of any contract.
          </p>
          <p className={s.p}>
            Please confirm all vehicle details with {dealer.name} directly before making
            a purchase decision.
          </p>
        </>
      );
  }
}
