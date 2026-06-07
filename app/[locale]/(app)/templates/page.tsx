import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { raw } from "@/db/client";
import { TemplatesClient } from "./TemplatesClient";

interface Config {
  id: number;
  dealerId: number | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  isActive: number;
}

interface DealerOption {
  id: number;
  name: string;
}

async function getTemplatesForSession(session: { role: string; dealerId: number | null }) {
  if (session.role === "admin") {
    return raw
      .prepare(
        `SELECT dtc.id, dtc.dealer_id as dealerId, dtc.name,
                dtc.created_at as createdAt, dtc.updated_at as updatedAt,
                CASE WHEN d.active_template_config_id = dtc.id THEN 1 ELSE 0 END as isActive
         FROM dealer_template_configs dtc
         LEFT JOIN dealers d ON d.id = dtc.dealer_id
         ORDER BY dtc.dealer_id IS NULL DESC, dtc.dealer_id ASC, dtc.created_at ASC`,
      )
      .all() as Config[];
  }
  if (!session.dealerId) return [];
  return raw
    .prepare(
      `SELECT dtc.id, dtc.dealer_id as dealerId, dtc.name,
              dtc.created_at as createdAt, dtc.updated_at as updatedAt,
              CASE WHEN d.active_template_config_id = dtc.id THEN 1 ELSE 0 END as isActive
       FROM dealer_template_configs dtc
       LEFT JOIN dealers d ON d.id = dtc.dealer_id
       WHERE dtc.dealer_id = ? OR dtc.dealer_id IS NULL
       ORDER BY dtc.dealer_id IS NULL DESC, dtc.created_at ASC`,
    )
    .all(session.dealerId) as Config[];
}

export default async function TemplatesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user as { role: string; dealerId: number | null };
  const configs = await getTemplatesForSession(user);
  const dealerOptions =
    user.role === "admin"
      ? (raw
          .prepare(`SELECT id, name FROM dealers ORDER BY active DESC, priority DESC, name ASC`)
          .all() as DealerOption[])
      : [];

  const bases = configs.filter((c) => c.dealerId === null);
  const mine = configs.filter((c) => c.dealerId !== null);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Template Configs</h1>
      </div>
      <TemplatesClient mine={mine} bases={bases} dealerOptions={dealerOptions} />
    </div>
  );
}
