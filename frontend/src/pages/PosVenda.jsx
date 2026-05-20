import { useEffect, useMemo, useState } from "react";
import { api, formatDate } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Phone,
  MessageCircle,
  CheckCircle2,
  RotateCcw,
  Search,
  HeartPulse,
} from "lucide-react";

const TABS = [
  { id: "pendente", label: "Pendentes" },
  { id: "atrasado", label: "Atrasados" },
  { id: "contatado", label: "Já contatados" },
  { id: "all", label: "Todos" },
];

function daysUntil(iso) {
  if (!iso) return null;
  const target = new Date(iso + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function UrgencyBadge({ iso, status }) {
  const d = daysUntil(iso);
  if (status === "contatado") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-[#E5F1E0] text-[#5C7053] border-[#C7DBBE]">
        Contatado
      </span>
    );
  }
  if (d == null) return null;
  let label;
  let cls;
  if (d < 0) {
    label = `${Math.abs(d)}d atrasado`;
    cls = "bg-[#FBE7E7] text-[#D06B6B] border-[#F0C4C4]";
  } else if (d === 0) {
    label = "Hoje";
    cls = "bg-[#FDF3E2] text-[#A66A1F] border-[#EBD7AE]";
  } else if (d <= 3) {
    label = `Em ${d}d`;
    cls = "bg-[#FDF3E2] text-[#A66A1F] border-[#EBD7AE]";
  } else {
    label = `Em ${d}d`;
    cls = "bg-[#F2E4DF] text-[#C97D63] border-[#E8CFC1]";
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}
      data-testid="posventa-urgency-badge"
    >
      {label}
    </span>
  );
}

const digitsOnly = (s) => (s || "").replace(/\D/g, "");

export default function PosVenda() {
  const [tab, setTab] = useState("pendente");
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ pendente: 0, atrasado: 0, contatado: 0, all: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const [cur, pend, atra, cont, all] = await Promise.all([
        api.get("/post-sale", { params: { status: tab } }),
        api.get("/post-sale", { params: { status: "pendente" } }),
        api.get("/post-sale", { params: { status: "atrasado" } }),
        api.get("/post-sale", { params: { status: "contatado" } }),
        api.get("/post-sale"),
      ]);
      setItems(cur.data || []);
      setCounts({
        pendente: pend.data.length,
        atrasado: atra.data.length,
        contatado: cont.data.length,
        all: all.data.length,
      });
    } catch (err) {
      toast.error("Erro ao carregar pós-venda");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (r) =>
        (r.patient_name || "").toLowerCase().includes(q) ||
        (r.child_name || "").toLowerCase().includes(q) ||
        (r.patient_phone || "").toLowerCase().includes(q) ||
        (r.procedure_type || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const markCalled = async (id) => {
    try {
      await api.post(`/appointments/${id}/mark-called`);
      toast.success("Marcado como contatado");
      load();
    } catch {
      toast.error("Erro ao atualizar");
    }
  };

  const markPending = async (id) => {
    try {
      await api.post(`/appointments/${id}/mark-pending`);
      toast.success("Voltou para pendente");
      load();
    } catch {
      toast.error("Erro ao atualizar");
    }
  };

  return (
    <div className="space-y-6" data-testid="posventa-page">
      <Card className="border-[#EBE8E3]">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="font-heading text-xl text-[#2D2825] flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-[#C97D63]" strokeWidth={1.5} />
                Acompanhamento Pós-venda
              </CardTitle>
              <p className="text-sm text-[#7A726D] mt-1">
                Histórico completo dos lembretes de 45 dias após cada perfuração.
              </p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A726D]" />
              <Input
                data-testid="posventa-search"
                placeholder="Buscar paciente, criança, telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 border-[#EBE8E3]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {TABS.map((t) => {
              const active = tab === t.id;
              const count = counts[t.id];
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  data-testid={`posventa-tab-${t.id}`}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    active
                      ? "bg-[#C97D63] text-white border-[#C97D63]"
                      : "bg-white text-[#2D2825] border-[#EBE8E3] hover:bg-[#FBF6F2]"
                  }`}
                >
                  {t.label}
                  <span
                    className={`ml-2 inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] font-semibold ${
                      active ? "bg-white/25 text-white" : "bg-[#F2E4DF] text-[#C97D63]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-sm text-[#7A726D]" data-testid="posventa-loading">
              Carregando...
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[#7A726D]" data-testid="posventa-empty">
              Nenhum lembrete nesta categoria.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FDFDF9] border-y border-[#EBE8E3] text-xs font-semibold uppercase text-[#7A726D]">
                    <th className="py-3 px-4 text-left">Status</th>
                    <th className="py-3 px-4 text-left">Paciente</th>
                    <th className="py-3 px-4 text-left">Criança</th>
                    <th className="py-3 px-4 text-left">Procedimento</th>
                    <th className="py-3 px-4 text-left">Telefone</th>
                    <th className="py-3 px-4 text-left">Perfuração</th>
                    <th className="py-3 px-4 text-left">Pós-venda</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const tel = digitsOnly(r.patient_phone);
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-[#EBE8E3] hover:bg-[#FDFDF9]/50"
                        data-testid={`posventa-row-${r.id}`}
                      >
                        <td className="py-3 px-4">
                          <UrgencyBadge iso={r.post_sale_date} status={r.reminder_status} />
                        </td>
                        <td className="py-3 px-4 font-medium text-[#2D2825]">
                          {r.patient_name}
                        </td>
                        <td className="py-3 px-4 text-[#7A726D]">{r.child_name || "—"}</td>
                        <td className="py-3 px-4">{r.procedure_type}</td>
                        <td className="py-3 px-4">
                          {r.patient_phone ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[#2D2825]">{r.patient_phone}</span>
                              <a
                                href={`tel:${tel}`}
                                title="Ligar"
                                className="p-1.5 rounded-lg hover:bg-[#F2E4DF] text-[#7A726D] hover:text-[#C97D63]"
                              >
                                <Phone className="w-3.5 h-3.5" strokeWidth={1.5} />
                              </a>
                              <a
                                href={`https://wa.me/${tel.length === 11 ? "55" + tel : tel}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="WhatsApp"
                                className="p-1.5 rounded-lg hover:bg-[#E5F1E0] text-[#7A726D] hover:text-[#5C7053]"
                              >
                                <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                              </a>
                            </div>
                          ) : (
                            <span className="text-[#7A726D] italic text-xs">
                              sem telefone
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#7A726D]">{formatDate(r.date)}</td>
                        <td className="py-3 px-4 font-medium text-[#C97D63]">
                          {formatDate(r.post_sale_date)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {r.reminder_status === "contatado" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markPending(r.id)}
                              data-testid={`posventa-undo-${r.id}`}
                              className="border-[#EBE8E3] text-[#7A726D] hover:text-[#C97D63]"
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1" strokeWidth={1.5} />
                              Reabrir
                            </Button>
                          ) : (
                            <button
                              onClick={() => markCalled(r.id)}
                              data-testid={`posventa-mark-called-${r.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#E5F1E0] text-[#5C7053] border border-[#C7DBBE] hover:bg-[#D8E8D0]"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                              Já liguei
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
