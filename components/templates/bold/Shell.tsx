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
  const half = Math.ceil(dealer.name.length / 2);

  return (
    <div className={s.page}>
      <header className={s.header}>
        <Link href={base} className={s.logo}>
          {dealer.name.slice(0, half)}
          <span className={s.logoAccent}>{dealer.name.slice(half)}</span>
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
        <div>
          <span className={s.footerAccent}>{dealer.name}</span>
          {dealer.publicDomain && ` · ${dealer.publicDomain}`}
        </div>
        <div className={s.footerLinks}>
          <Link href={`${base}/privacy`} className={s.footerLink}>{t("privacy")}</Link>
          <Link href={`${base}/terms`} className={s.footerLink}>{t("terms")}</Link>
        </div>
      </footer>
    </div>
  );
}
