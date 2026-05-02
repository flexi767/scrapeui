import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { raw } from "@/db/client";
import Link from "next/link";

interface Config {
  id: number;
  dealerId: number | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  isActive: number;
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

  const bases = configs.filter((c) => c.dealerId === null);
  const mine = configs.filter((c) => c.dealerId !== null);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Template Configs</h1>
      </div>

      {mine.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">My Configs</h2>
          <div className="space-y-2">
            {mine.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
                <div>
                  <span className="font-medium">{c.name}</span>
                  {c.isActive === 1 && <span className="ml-2 text-xs bg-green-900 text-green-300 border border-green-700 rounded px-2 py-0.5">Active</span>}
                  <div className="text-xs text-gray-500 mt-0.5">Updated {new Date(c.updatedAt).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2">
                  {c.isActive === 0 && <ActivateButton configId={c.id} />}
                  <Link href={`/templates/editor/${c.id}`} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md">Edit</Link>
                  <ForkButton configId={c.id} />
                  {c.isActive === 0 && <DeleteButton configId={c.id} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Base Templates (fork to use)</h2>
        <div className="grid grid-cols-3 gap-3">
          {bases.map((c) => (
            <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="font-medium mb-3">{c.name}</div>
              <ForkBaseButton configId={c.id} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ActivateButton({ configId }: { configId: number }) {
  return (
    <form action={`/api/dealer-templates/${configId}/activate`} method="POST">
      <button type="submit" className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-md">Activate</button>
    </form>
  );
}

function ForkButton({ configId }: { configId: number }) {
  return (
    <form action={`/api/dealer-templates/${configId}/fork`} method="POST">
      <button type="submit" className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-md">Fork</button>
    </form>
  );
}

function ForkBaseButton({ configId }: { configId: number }) {
  return (
    <form action={`/api/dealer-templates/${configId}/fork`} method="POST">
      <button type="submit" className="text-sm w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-md">Use This Template</button>
    </form>
  );
}

function DeleteButton({ configId }: { configId: number }) {
  return (
    <form action={`/api/dealer-templates/${configId}/delete`} method="POST">
      <button type="submit" className="text-sm bg-red-900/60 hover:bg-red-800 text-red-300 px-3 py-1.5 rounded-md">Delete</button>
    </form>
  );
}
