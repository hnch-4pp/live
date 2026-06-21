import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { apiUrl } from "@/lib/apiFetch";
import { CheckCircle2, Pencil, X, Save, AlertCircle, ExternalLink } from "lucide-react";

type Plan = {
  id: string;
  name: string;
  amountCents: number;
  currency: string;
  ticketsPerMonth: number;
  badge: string;
  features: string[];
};

type EditState = {
  name: string;
  badge: string;
  features: string;
  amountCents: string;
  ticketsPerMonth: string;
};

function fmtMXN(cents: number) {
  return `$${(cents / 100).toFixed(0)} MXN`;
}

export default function AdminPricing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/admin/pricing-plans"), {
      credentials: "include",
      headers: { "X-Admin-Request": "1" },
    })
      .then((r) => r.json())
      .then((data: { plans: Plan[] }) => {
        setPlans(data.plans);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function startEdit(plan: Plan) {
    setEditingId(plan.id);
    setEditState({
      name: plan.name,
      badge: plan.badge,
      features: plan.features.join("\n"),
      amountCents: String(plan.amountCents),
      ticketsPerMonth: String(plan.ticketsPerMonth),
    });
    setError(null);
    setSuccess(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
  }

  async function savePlan(id: string) {
    if (!editState) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: editState.name.trim(),
        badge: editState.badge.trim(),
        features: editState.features
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean),
        amountCents: parseInt(editState.amountCents, 10),
        ticketsPerMonth: parseInt(editState.ticketsPerMonth, 10),
      };
      const res = await fetch(apiUrl(`/api/admin/pricing-plans/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Admin-Request": "1" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { plan?: Plan; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      setPlans((prev) =>
        prev.map((p) => (p.id === id ? (data.plan ?? p) : p))
      );
      setEditingId(null);
      setEditState(null);
      setSuccess(`Plan "${body.name}" actualizado correctamente.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div className="p-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Pricing — Planes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Edita el nombre, precio, tickets y caracteristicas de cada plan. Los cambios se reflejan inmediatamente en la pagina de pricing.
          </p>
        </div>

        {/* Stripe notice */}
        <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">Productos de Stripe</p>
            <p>
              Los precios que se muestran aqui son solo de visualizacion. Para cambiar lo que Stripe cobra, ejecuta el script de aprovisionamiento:{" "}
              <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">
                pnpm --filter @workspace/scripts run seed-stripe-plans
              </code>
            </p>
            <a
              href="https://dashboard.stripe.com/products"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-amber-700 font-medium hover:underline text-xs"
            >
              Ver productos en Stripe
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {success && (
          <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-400 py-8 text-center">Cargando planes...</div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {plans.map((plan) => {
              const isEditing = editingId === plan.id;
              return (
                <div
                  key={plan.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                        {plan.id}
                      </span>
                      <span className="text-base font-bold text-gray-900">{plan.name}</span>
                      {plan.badge ? (
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                          {plan.badge}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {!isEditing ? (
                        <button
                          onClick={() => startEdit(plan)}
                          className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Editar
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={cancelEdit}
                            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancelar
                          </button>
                          <button
                            onClick={() => savePlan(plan.id)}
                            disabled={saving}
                            className="flex items-center gap-1.5 text-sm text-white bg-violet-600 hover:bg-violet-700 font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {saving ? "Guardando..." : "Guardar"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-6 py-5">
                    {!isEditing ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Precio</p>
                          <p className="text-lg font-bold text-gray-900">{fmtMXN(plan.amountCents)}<span className="text-xs font-normal text-gray-400 ml-1">/mes</span></p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Tickets/mes</p>
                          <p className="text-lg font-bold text-gray-900">{plan.ticketsPerMonth}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Badge</p>
                          <p className="text-sm text-gray-700">{plan.badge || <span className="text-gray-400 italic">Sin badge</span>}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Costo/ticket</p>
                          <p className="text-sm text-gray-700">${(plan.amountCents / 100 / plan.ticketsPerMonth).toFixed(1)} MXN</p>
                        </div>
                        <div className="col-span-2 sm:col-span-4">
                          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">Caracteristicas</p>
                          <ul className="space-y-1.5">
                            {plan.features.map((f, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                <CheckCircle2 className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : editState ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Nombre del plan</label>
                          <input
                            value={editState.name}
                            onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Badge (dejar vacio para ocultar)</label>
                          <input
                            value={editState.badge}
                            onChange={(e) => setEditState({ ...editState, badge: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Precio (centavos MXN)</label>
                          <div className="relative">
                            <input
                              value={editState.amountCents}
                              onChange={(e) => setEditState({ ...editState, amountCents: e.target.value })}
                              type="number"
                              min="0"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                            <span className="absolute right-3 top-2 text-xs text-gray-400">
                              = {editState.amountCents ? `$${(parseInt(editState.amountCents, 10) / 100).toFixed(0)} MXN` : ""}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Ej: 19900 = $199 MXN. No cambia Stripe — usa el script.</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Tickets por mes</label>
                          <input
                            value={editState.ticketsPerMonth}
                            onChange={(e) => setEditState({ ...editState, ticketsPerMonth: e.target.value })}
                            type="number"
                            min="1"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Caracteristicas (una por linea)</label>
                          <textarea
                            value={editState.features}
                            onChange={(e) => setEditState({ ...editState, features: e.target.value })}
                            rows={4}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                          />
                        </div>
                        {error && (
                          <div className="sm:col-span-2 flex items-center gap-2 text-red-600 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
