"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import s from "./InnerPage.module.css";

export function ContactForm({ dealerSlug }: { dealerSlug: string }) {
  const t = useTranslations('ui');
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/public/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: dealerSlug,
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
        }),
      });
      if (res.ok) {
        form.reset();
        setStatus("sent");
        return;
      }
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? t('contact_form_error_generic'));
      setStatus("error");
    } catch {
      setError(t('contact_form_error_network'));
      setStatus("error");
    }
  }

  if (status === "sent") {
    return <div className={s.sent}>{t('contact_form_sent')}</div>;
  }

  const sending = status === "sending";

  return (
    <form className={s.form} onSubmit={onSubmit}>
      <label className={s.field}>
        <span className={s.fieldLabel}>{t('contact_form_name')}</span>
        <input className={s.input} type="text" name="name" autoComplete="name" required maxLength={120} />
      </label>
      <label className={s.field}>
        <span className={s.fieldLabel}>{t('contact_form_email')}</span>
        <input className={s.input} type="email" name="email" autoComplete="email" required maxLength={200} />
      </label>
      <label className={s.field}>
        <span className={s.fieldLabel}>{t('contact_form_message')}</span>
        <textarea className={s.textarea} name="message" rows={5} required maxLength={5000} />
      </label>
      {error && <p className={s.error}>{error}</p>}
      <button className={s.submit} type="submit" disabled={sending}>
        {sending ? t('contact_form_sending') : t('contact_form_submit')}
      </button>
    </form>
  );
}
