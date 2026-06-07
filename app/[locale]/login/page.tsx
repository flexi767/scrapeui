"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const t = useTranslations('ui');
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(process.env.NODE_ENV === "development");

  // Auto-login in development mode
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    signIn("credentials", {
      username: "",
      password: "__dev_auto__",
      redirect: false,
    }).then((res) => {
      if (res?.error) {
        setLoading(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      username: form.get("username") as string,
      password: form.get("password") as string,
      redirect: false,
    });

    if (res?.error) {
      setError(t('invalid_username_or_password'));
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#111827]">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-gray-700 bg-gray-800 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-100">{t('sign_in')}</h1>
          <p className="mt-1 text-sm text-gray-400">{t('dealer_management_system')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">{t('username')}</Label>
            <Input
              id="username"
              name="username"
              type="text"
              required
              autoFocus
              placeholder={t('enter_username')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('password')}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              placeholder={t('enter_password')}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('signing_in') : t('sign_in')}
          </Button>
        </form>
      </div>
    </div>
  );
}
