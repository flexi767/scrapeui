import Link from "next/link";
import type { ShellProps } from "../types";
import s from "./ListingGrid.module.css";

const NAV = [
  { key: "cars", label: "Cars", href: "" },
  { key: "finance", label: "Finance", href: "/finance" },
  { key: "about", label: "About", href: "/about" },
] as const;

export function Shell({ dealer, current, children }: ShellProps) {
  const base = `/d/${dealer.slug}`;

  return (
    <div className={s.page}>
      <header className={s.header}>
        <Link href={base} className={s.logo}>
          <span className={s.logoBadge}>PRO</span>
          <span className={s.logoName}>{dealer.name}</span>
        </Link>
        <nav className={s.nav}>
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={`${base}${n.href}`}
              className={current === n.key ? s.navLinkActive : s.navLink}
            >
              {n.label}
            </Link>
          ))}
          <Link href={`${base}/contact`} className={s.headerEnquire}>Enquire</Link>
        </nav>
      </header>

      {children}

      <footer className={s.footer}>
        <span className={s.footLogo}>{dealer.name}</span>
        <span>{dealer.publicDomain ?? ""}</span>
        <div className={s.footerLinks}>
          <Link href={`${base}/privacy`} className={s.footerLink}>Privacy</Link>
          <Link href={`${base}/terms`} className={s.footerLink}>Terms</Link>
        </div>
      </footer>
    </div>
  );
}
