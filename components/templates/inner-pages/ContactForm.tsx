"use client";
import { useState } from "react";
import s from "./InnerPage.module.css";

export function ContactForm({ dealerSlug }: { dealerSlug: string }) {
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
      setError(payload?.error ?? "Something went wrong. Please try again.");
      setStatus("error");
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return <div className={s.sent}>Thanks — your message has been sent. We&apos;ll be in touch soon.</div>;
  }

  const sending = status === "sending";

  return (
    <form className={s.form} onSubmit={onSubmit}>
      <label className={s.field}>
        <span className={s.fieldLabel}>Name</span>
        <input className={s.input} type="text" name="name" autoComplete="name" required maxLength={120} />
      </label>
      <label className={s.field}>
        <span className={s.fieldLabel}>Email</span>
        <input className={s.input} type="email" name="email" autoComplete="email" required maxLength={200} />
      </label>
      <label className={s.field}>
        <span className={s.fieldLabel}>Message</span>
        <textarea className={s.textarea} name="message" rows={5} required maxLength={5000} />
      </label>
      {error && <p className={s.error}>{error}</p>}
      <button className={s.submit} type="submit" disabled={sending}>
        {sending ? "Sending…" : "Send enquiry"}
      </button>
    </form>
  );
}
