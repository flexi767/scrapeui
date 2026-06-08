import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ShellProps } from "../types";
import s from "./ListingGrid.module.css";

const NAV = [
  { key: "cars", href: "" },
  { key: "finance", href: "/finance" },
  { key: "about", href: "/about" },
] as const;

export function Shell({ dealer, current, children }: ShellProps) {
  const t = useTranslations("ui");
  const base = `/d/${dealer.slug}`;
  const nameFirst = dealer.name.charAt(0);
  const nameRest = dealer.name.slice(1);

  return (
    <div className={s.page}>
      <header className={s.header}>
        <Link href={base} className={s.logoWrap}>
          <div className={s.logoDot} />
          <div className={s.logoText}><span className={s.logoAccent}>{nameFirst}</span>{nameRest}</div>
        </Link>
        <nav className={s.nav}>
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={`${base}${n.href}`}
              className={current === n.key ? s.navLinkActive : s.navLink}
            >
              {t(n.key)}
            </Link>
          ))}
          <Link href={`${base}/contact`} className={s.headerCta}>{t("contact")}</Link>
        </nav>
      </header>

      {children}

      <footer className={s.footer}>
        <div className={s.footLogo}><span className={s.footLogoAccent}>{nameFirst}</span>{nameRest}</div>
        <div>{dealer.publicDomain ?? ""}</div>
        <div className={s.footerLinks}>
          <Link href={`${base}/privacy`} className={s.footerLink}>{t("privacy")}</Link>
          <Link href={`${base}/terms`} className={s.footerLink}>{t("terms")}</Link>
        </div>
      </footer>
    </div>
  );
}
