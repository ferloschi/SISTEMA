import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatBRL, formatDate } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Banknote,
  Smartphone,
  CreditCard,
  Layers,
  TrendingUp,
  Calendar,
  Check,
  Clock,
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

const todayISO = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => todayISO().slice(0, 7);

const BUCKET_META = {
  dinheiro:        { label: "Dinheiro",        color: "#5C7053", icon: Banknote   },
  pix:             { label: "PIX",             color: "#8A9E82", icon: Smartphone  },
  debito:          { label: "Cartão Débito",   color: "#DDA15E", icon: CreditCard  },
  cartao_parcelado:{ label: "Cartão Parcelado",color: "#C97D63", icon: Layers      },
  outros:          { label: "Outros",          color: "#7A726D", icon: TrendingUp  },
};

/* ─── Card de bucket ─── */
const BucketCard = ({ bucket, value, count, onDelete }) => {
  const meta = BUCKET_META[bucket];
  const Icon = meta.icon;
  return (
    <div className="brinquinho-card p-5 relative" data-testid={`finance-card-${bucket}`}>
      {onDelete && (
        <button onClick={onDelete} title={`Excluir vendas em ${meta.label}`}
          data-testid={`finance-card-${bucket}-delete`}
          className="absolute top-2 right-2 p-1.5 rounded-lg text-[#7A726D] hover:text-[#D06B6B] hover:bg-[#FBE7E7]">
          <X className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      )}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">{meta.label}</p>
          <p className="stat-number text-2xl mt-1">{formatBRL(value)}</p>
          <p className="text-xs text-[#7A726D] mt-1">{count} venda(s)</p>
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: `${meta.color}1A` }}>
          <Icon className="w-5 h-5" style={{ color: meta.color }} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
};

/* ─── Formata mês "2026-07" → "Jul/2026" ─── */
const fmtMonth = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${months[parseInt(m) - 1]}/${y}`;
};

/* ═══════════════════════════════════════════════
   ABA: CONFERÊNCIA MENSAL DE CARTÃO
═══════════════════════════════════════════════ */
function ConferenciaCartao() {
  const [recvMonth, setRecvMonth] = useState(currentMonth());
  const [allSales, setAllSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Busca TODAS as vendas de cartão (sem filtro de mês de venda)
      const res = await api.get("/finance/card-sales");
      setAllSales(res.data);
    } catch {
      toast.error("Erro ao carregar vendas de cartão");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Filtra parcelas cujo date começa com recvMonth */
  const rows = useMemo(() => {
    const result = [];
    for (const sale of allSales) {
      for (const r of sale.receive_schedule || []) {
        if ((r.date || "").startsWith(recvMonth)) {
          const gross = sale.gross_value || 0;
          const feePct = sale.card_fee_pct || 0;
          const totalInstallments = sale.installments || 1;
          // valor bruto desta parcela = gross / installments
          const grossParcela = round2(gross / totalInstallments);
          // taxa desta parcela
          const taxaParcela = round2(grossParcela * feePct / 100);
          // valor líquido = r.value (já é líquido do backend)
          const liquido = round2(r.value || 0);
          result.push({
            saleId: sale.id,
            saleDate: sale.sale_date,
            client: sale.patient_name || "—",
            child: sale.child_name || "",
            paymentMethod: sale.payment_method_name || "Cartão",
            totalInstallments,
            installmentNum: r.installment,
            recvDate: r.date,
            received: !!r.received,
            grossParcela,
            feePct,
            taxaParcela,
            liquido,
            // guarda ref para toggle
            _installmentObj: r,
            _sale: sale,
          });
        }
      }
    }
    // Ordena por data de recebimento, depois por data de venda
    result.sort((a, b) => a.recvDate.localeCompare(b.recvDate) || a.saleDate.localeCompare(b.saleDate));
    return result;
  }, [allSales, recvMonth]);

  /* Totais */
  const totals = useMemo(() => {
    let bruto = 0, taxa = 0, liquido = 0, recebido = 0, pendente = 0;
    for (const r of rows) {
      bruto    += r.grossParcela;
      taxa     += r.taxaParcela;
      liquido  += r.liquido;
      if (r.received) recebido += r.liquido;
      else            pendente += r.liquido;
    }
    return { bruto: round2(bruto), taxa: round2(taxa), liquido: round2(liquido),
             recebido: round2(recebido), pendente: round2(pendente) };
  }, [rows]);

  /* Agrupa por data de recebimento para exibição */
  const byDate = useMemo(() => {
    const map = {};
    for (const r of rows) {
      if (!map[r.recvDate]) map[r.recvDate] = [];
      map[r.recvDate].push(r);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const toggleRow = (date) =>
    setExpanded((e) => ({ ...e, [date]: !e[date] }));

  const toggleInstallment = async (row) => {
    const newVal = !row.received;
    try {
      await api.patch(`/sales/${row.saleId}/installments/${row.installmentNum}`, { received: newVal });
      toast.success(newVal ? "Parcela marcada como recebida" : "Marcada como pendente");
      load();
    } catch {
      toast.error("Erro ao atualizar parcela");
    }
  };

  return (
    <div className="space-y-5">
      {/* Filtro de mês de RECEBIMENTO */}
      <div className="brinquinho-card p-4 flex flex-wrap gap-6 items-end">
        <div>
          <Label className="text-[11px] uppercase tracking-widest text-[#7A726D]">
            Mês de recebimento
          </Label>
          <Input
            type="month"
            value={recvMonth}
            onChange={(e) => setRecvMonth(e.target.value)}
            className="mt-1 w-44"
          />
          <p className="text-[11px] text-[#7A726D] mt-1">
            Mostra todas as parcelas que caem em <strong>{fmtMonth(recvMonth)}</strong>,
            independente do mês da venda.
          </p>
        </div>

        {/* Totalizadores */}
        <div className="flex flex-wrap gap-6 ml-auto">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Bruto</p>
            <p className="font-heading text-xl font-semibold text-[#2D2825]">{formatBRL(totals.bruto)}</p>
            <p className="text-[11px] text-[#D06B6B]">Taxa: {formatBRL(totals.taxa)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Líquido total</p>
            <p className="font-heading text-2xl font-semibold text-[#5C7053]">{formatBRL(totals.liquido)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Recebido</p>
            <p className="font-heading text-xl font-semibold text-[#5C7053]">{formatBRL(totals.recebido)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Pendente</p>
            <p className="font-heading text-xl font-semibold text-[#C97D63]">{formatBRL(totals.pendente)}</p>
            <p className="text-[11px] text-[#7A726D]">{rows.filter(r => !r.received).length} parcela(s)</p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-10 text-[#7A726D] text-sm">Carregando…</div>
      )}

      {!loading && rows.length === 0 && (
        <div className="brinquinho-card p-10 text-center text-[#7A726D]">
          <CreditCard className="w-10 h-10 mx-auto text-[#C97D63] mb-3" strokeWidth={1.5} />
          <p className="font-medium text-[#2D2825]">
            Nenhuma parcela de cartão a receber em {fmtMonth(recvMonth)}.
          </p>
          <p className="text-sm mt-1">Verifique outro mês ou registre vendas parceladas.</p>
        </div>
      )}

      {/* Agrupado por data de recebimento */}
      {byDate.map(([date, parcelas]) => {
        const isOpen = expanded[date] !== false; // aberto por padrão
        const subtotalLiquido = round2(parcelas.reduce((s, r) => s + r.liquido, 0));
        const subtotalTaxa    = round2(parcelas.reduce((s, r) => s + r.taxaParcela, 0));
        const qtdRecebidas    = parcelas.filter(r => r.received).length;
        const allReceived     = qtdRecebidas === parcelas.length;

        return (
          <div key={date} className="brinquinho-card overflow-hidden">
            {/* cabeçalho do grupo */}
            <button
              type="button"
              onClick={() => toggleRow(date)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#FDFDF9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${allReceived ? "bg-[#5C7053]" : "bg-[#C97D63]"}`} />
                <div className="text-left">
                  <p className="font-semibold text-[#2D2825]">{formatDate(date)}</p>
                  <p className="text-xs text-[#7A726D]">
                    {parcelas.length} parcela(s) · {qtdRecebidas}/{parcelas.length} recebida(s)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <p className="text-[11px] text-[#7A726D]">Taxa: {formatBRL(subtotalTaxa)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Líquido do dia</p>
                  <p className={`font-heading text-xl font-semibold ${allReceived ? "text-[#5C7053]" : "text-[#C97D63]"}`}>
                    {formatBRL(subtotalLiquido)}
                  </p>
                </div>
                {isOpen
                  ? <ChevronUp className="w-4 h-4 text-[#7A726D] shrink-0" strokeWidth={1.5} />
                  : <ChevronDown className="w-4 h-4 text-[#7A726D] shrink-0" strokeWidth={1.5} />
                }
              </div>
            </button>

            {/* linhas de parcelas */}
            {isOpen && (
              <div className="border-t border-[#EBE8E3]">
                {/* cabeçalho da tabela — desktop */}
                <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-2 bg-[#FDFDF9] text-[10px] uppercase tracking-widest text-[#7A726D] font-semibold">
                  <div className="col-span-2">Data venda</div>
                  <div className="col-span-3">Cliente</div>
                  <div className="col-span-2">Pagamento</div>
                  <div className="col-span-1 text-right">Parcela</div>
                  <div className="col-span-1 text-right">Bruto</div>
                  <div className="col-span-1 text-right">Taxa</div>
                  <div className="col-span-1 text-right font-semibold text-[#5C7053]">Líquido</div>
                  <div className="col-span-1 text-center">Status</div>
                </div>

                {parcelas.map((r, i) => (
                  <div
                    key={`${r.saleId}-${r.installmentNum}`}
                    className={`px-5 py-3 border-t border-[#EBE8E3] ${r.received ? "bg-[#E4EDDF]/20" : ""}`}
                  >
                    {/* Desktop */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 items-center text-sm">
                      <div className="col-span-2 text-[#7A726D] text-xs">{formatDate(r.saleDate)}</div>
                      <div className="col-span-3 font-medium truncate">
                        {r.client}
                        {r.child && <span className="text-[#7A726D] text-xs ml-1">· {r.child}</span>}
                      </div>
                      <div className="col-span-2 text-xs text-[#7A726D]">{r.paymentMethod}</div>
                      <div className="col-span-1 text-right text-xs text-[#7A726D]">
                        {r.installmentNum}/{r.totalInstallments}
                      </div>
                      <div className="col-span-1 text-right text-xs">{formatBRL(r.grossParcela)}</div>
                      <div className="col-span-1 text-right text-xs text-[#D06B6B]">
                        -{formatBRL(r.taxaParcela)}
                        <span className="text-[10px] text-[#7A726D] ml-0.5">({r.feePct}%)</span>
                      </div>
                      <div className="col-span-1 text-right font-semibold text-[#5C7053]">
                        {formatBRL(r.liquido)}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button
                          onClick={() => toggleInstallment(r)}
                          title={r.received ? "Clique para marcar como pendente" : "Clique para marcar como recebida"}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition ${
                            r.received
                              ? "bg-[#E4EDDF] border-[#C8DABF] text-[#5C7053] hover:bg-[#D0E3C8]"
                              : "bg-[#F2E4DF]/60 border-[#E8CFC1] text-[#C97D63] hover:bg-[#F2E4DF]"
                          }`}
                        >
                          {r.received
                            ? <Check className="w-3 h-3" strokeWidth={2.5} />
                            : <Clock className="w-3 h-3" strokeWidth={1.5} />
                          }
                          {r.received ? "Recebida" : "Pendente"}
                        </button>
                      </div>
                    </div>

                    {/* Mobile */}
                    <div className="sm:hidden flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#2D2825] truncate">{r.client}</p>
                        <p className="text-xs text-[#7A726D]">
                          Venda: {formatDate(r.saleDate)} · {r.paymentMethod} · {r.installmentNum}/{r.totalInstallments}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-[#7A726D]">Bruto {formatBRL(r.grossParcela)}</span>
                          <span className="text-xs text-[#D06B6B]">-{formatBRL(r.taxaParcela)}</span>
                          <span className="text-sm font-semibold text-[#5C7053]">{formatBRL(r.liquido)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleInstallment(r)}
                        className={`shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border ${
                          r.received
                            ? "bg-[#E4EDDF] border-[#C8DABF] text-[#5C7053]"
                            : "bg-[#F2E4DF]/60 border-[#E8CFC1] text-[#C97D63]"
                        }`}
                      >
                        {r.received ? <Check className="w-3 h-3" strokeWidth={2.5} /> : <Clock className="w-3 h-3" strokeWidth={1.5} />}
                      </button>
                    </div>
                  </div>
                ))}

                {/* subtotal do dia */}
                <div className="hidden sm:flex items-center justify-end gap-8 px-5 py-3 bg-[#FDFDF9] border-t border-[#EBE8E3] text-xs">
                  <span className="text-[#7A726D]">
                    Subtotal bruto: <strong>{formatBRL(round2(parcelas.reduce((s,r) => s+r.grossParcela, 0)))}</strong>
                  </span>
                  <span className="text-[#D06B6B]">
                    Taxas: <strong>-{formatBRL(subtotalTaxa)}</strong>
                  </span>
                  <span className="text-[#5C7053] font-semibold">
                    Líquido: <strong>{formatBRL(subtotalLiquido)}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* helper */
function round2(n) { return Math.round((n || 0) * 100) / 100; }

/* ═══════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════ */
export default function GestaoFinanceira() {
  const [scope, setScope] = useState("month");
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState(null);
  const [cardSales, setCardSales] = useState([]);
  const [cardMonth, setCardMonth] = useState(currentMonth());
  const [receivables, setReceivables] = useState([]);

  const loadSummary = useCallback(async () => {
    const params = scope === "month" ? { month } : { year };
    const res = await api.get("/finance/summary", { params });
    setSummary(res.data);
  }, [scope, month, year]);

  const deleteBucket = async (bucket) => {
    const scopeLabel = scope === "month" ? `mês ${month}` : `ano ${year}`;
    if (!window.confirm(
      `Excluir TODAS as vendas em ${BUCKET_META[bucket].label} no ${scopeLabel}?\n\n` +
      "O estoque dos produtos vendidos será devolvido.\nEsta ação não pode ser desfeita."
    )) return;
    try {
      const params = { bucket };
      if (scope === "month") params.month = month;
      else params.year = year;
      const res = await api.post("/sales/bulk-delete", null, { params });
      toast.success(`${res.data.deleted || 0} venda(s) excluída(s)`);
      loadSummary();
      loadCard();
    } catch {
      toast.error("Erro ao excluir vendas");
    }
  };

  const deleteInstallment = async (sale, installmentNum) => {
    if (!window.confirm(
      `Excluir a parcela ${installmentNum}/${sale.installments || 1} da venda de ${sale.patient_name || "cliente"}?\n\n` +
      "Apenas esta parcela sai da lista de recebimentos. A venda em si continua registrada."
    )) return;
    try {
      await api.delete(`/sales/${sale.id}/installments/${installmentNum}`);
      toast.success("Parcela excluída");
      loadCard();
    } catch {
      toast.error("Erro ao excluir parcela");
    }
  };

  const loadCard = useCallback(async () => {
    const [c, r] = await Promise.all([
      api.get("/finance/card-sales", { params: { month: cardMonth || undefined } }),
      api.get("/finance/receivables"),
    ]);
    setCardSales(c.data);
    setReceivables(r.data);
  }, [cardMonth]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadCard(); }, [loadCard]);

  const buckets = useMemo(() => summary?.buckets || {}, [summary]);
  const counts = summary?.counts || {};

  const pieData = useMemo(() =>
    Object.entries(buckets)
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => ({ name: BUCKET_META[k].label, value: v, key: k })),
    [buckets]);

  const monthlyReceivables = useMemo(() => receivables.slice(-12), [receivables]);

  const totals = useMemo(() => {
    let prev = 0, recv = 0, pend = 0;
    for (const s of cardSales) {
      for (const r of s.receive_schedule || []) {
        prev += Number(r.value || 0);
        if (r.received) recv += Number(r.value || 0);
        else pend += Number(r.value || 0);
      }
    }
    return { prev, recv, pend };
  }, [cardSales]);

  const toggleInstallment = async (sale, installment) => {
    const newReceived = !installment.received;
    try {
      await api.patch(`/sales/${sale.id}/installments/${installment.installment}`, { received: newReceived });
      toast.success(newReceived ? "Parcela marcada como recebida" : "Marcada como pendente");
      await loadCard();
    } catch {
      toast.error("Erro ao atualizar parcela");
    }
  };

  return (
    <div className="space-y-6" data-testid="financeiro-page">
      <Tabs defaultValue="resumo">
        <TabsList className="bg-[#F2E4DF] rounded-xl p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="resumo"
            className="data-[state=active]:bg-white data-[state=active]:text-[#C97D63] rounded-lg"
            data-testid="tab-resumo-fin">
            Resumo
          </TabsTrigger>
          <TabsTrigger value="cartao"
            className="data-[state=active]:bg-white data-[state=active]:text-[#C97D63] rounded-lg"
            data-testid="tab-cartao-fin">
            Vendas de Cartão
          </TabsTrigger>
          <TabsTrigger value="conferencia"
            className="data-[state=active]:bg-white data-[state=active]:text-[#C97D63] rounded-lg"
            data-testid="tab-conferencia-fin">
            Conferência Mensal
          </TabsTrigger>
        </TabsList>

        {/* ── ABA RESUMO ── */}
        <TabsContent value="resumo" className="space-y-6 mt-6">
          <div className="brinquinho-card p-5 flex flex-col md:flex-row gap-4 md:items-end">
            <div className="flex gap-1 bg-[#FDFDF9] rounded-lg p-1 border border-[#EBE8E3] w-fit">
              <button onClick={() => setScope("month")} data-testid="scope-month"
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${scope === "month" ? "bg-[#C97D63] text-white" : "text-[#7A726D] hover:text-[#C97D63]"}`}>
                Mensal
              </button>
              <button onClick={() => setScope("year")} data-testid="scope-year"
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${scope === "year" ? "bg-[#C97D63] text-white" : "text-[#7A726D] hover:text-[#C97D63]"}`}>
                Anual
              </button>
            </div>
            {scope === "month" ? (
              <div>
                <Label className="text-[11px] uppercase tracking-widest text-[#7A726D]">Mês</Label>
                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                  data-testid="month-filter" className="mt-1 w-44" />
              </div>
            ) : (
              <div>
                <Label className="text-[11px] uppercase tracking-widest text-[#7A726D]">Ano</Label>
                <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || year)}
                  data-testid="year-filter" className="mt-1 w-32" />
              </div>
            )}
            <div className="ml-auto text-right">
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Total no período</p>
              <p className="font-heading text-2xl font-semibold text-[#2D2825]">{formatBRL(summary?.total || 0)}</p>
              <p className="text-xs text-[#7A726D]">{summary?.sales_count || 0} venda(s)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <BucketCard bucket="dinheiro"        value={buckets.dinheiro || 0}         count={counts.dinheiro || 0}         onDelete={() => deleteBucket("dinheiro")} />
            <BucketCard bucket="pix"             value={buckets.pix || 0}              count={counts.pix || 0}              onDelete={() => deleteBucket("pix")} />
            <BucketCard bucket="debito"          value={buckets.debito || 0}           count={counts.debito || 0}           onDelete={() => deleteBucket("debito")} />
            <BucketCard bucket="cartao_parcelado"value={buckets.cartao_parcelado || 0} count={counts.cartao_parcelado || 0} onDelete={() => deleteBucket("cartao_parcelado")} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="brinquinho-card p-6">
              <h3 className="font-heading text-lg font-semibold mb-4">Distribuição por forma de pagamento</h3>
              {pieData.length === 0 ? (
                <p className="text-sm text-[#7A726D] text-center py-10">Sem vendas no período selecionado.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50} label={(e) => e.name}>
                        {pieData.map((d, i) => <Cell key={i} fill={BUCKET_META[d.key].color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatBRL(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="brinquinho-card p-6">
              <h3 className="font-heading text-lg font-semibold mb-4">Recebimentos previstos (próximos meses)</h3>
              {monthlyReceivables.length === 0 ? (
                <p className="text-sm text-[#7A726D] text-center py-10">Sem parcelas a receber.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={monthlyReceivables}>
                      <CartesianGrid stroke="#EBE8E3" strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#7A726D" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#7A726D" }} />
                      <Tooltip formatter={(v) => formatBRL(v)} />
                      <Bar dataKey="value" fill="#C97D63" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── ABA VENDAS DE CARTÃO ── */}
        <TabsContent value="cartao" className="space-y-5 mt-6">
          <div className="brinquinho-card p-4 flex flex-wrap items-center gap-6">
            <div>
              <Label className="text-[11px] uppercase tracking-widest text-[#7A726D]">Mês da venda</Label>
              <Input type="month" value={cardMonth} onChange={(e) => setCardMonth(e.target.value)}
                data-testid="card-month-filter" className="mt-1 w-44" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Total previsto</p>
              <p className="font-heading text-xl font-semibold text-[#2D2825]">{formatBRL(totals.prev)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Recebido</p>
              <p className="font-heading text-xl font-semibold text-[#5C7053]">{formatBRL(totals.recv)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Pendente</p>
              <p className="font-heading text-xl font-semibold text-[#C97D63]">{formatBRL(totals.pend)}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Total bruto cartões</p>
              <p className="font-heading text-xl font-semibold text-[#2D2825]">
                {formatBRL(cardSales.reduce((s, c) => s + (c.gross_value || 0), 0))}
              </p>
            </div>
          </div>

          {cardSales.length === 0 ? (
            <div className="brinquinho-card p-10 text-center text-[#7A726D]">
              <CreditCard className="w-10 h-10 mx-auto text-[#C97D63] mb-3" strokeWidth={1.5} />
              <p className="font-medium text-[#2D2825]">Nenhuma venda em cartão neste mês.</p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="card-sales-list">
              {cardSales.map((s) => {
                const isParcelado = (s.installments || 1) > 1;
                return (
                  <div key={s.id} className="brinquinho-card p-5" data-testid={`card-sale-${s.id}`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading text-lg font-semibold text-[#2D2825]">
                            Venda de {formatBRL(s.gross_value)}
                          </span>
                          <span className="text-sm text-[#7A726D]">em {formatDate(s.sale_date)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${isParcelado ? "bg-[#F2E4DF] text-[#C97D63] border-[#E8CFC1]" : "bg-[#E4EDDF] text-[#5C7053] border-[#C8DABF]"}`}>
                            {isParcelado ? `Parcelado ${s.installments}x` : `${s.payment_method_name || "Débito"} 1x`}
                          </span>
                        </div>
                        <p className="text-sm text-[#7A726D] mt-1">
                          {s.patient_name || "—"}{s.child_name ? ` · ${s.child_name}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                          Valor com desconto da taxa ({s.card_fee_pct}%)
                        </p>
                        <p className="font-heading text-xl font-semibold text-[#5C7053]">{formatBRL(s.net_value)}</p>
                        <p className="text-[11px] text-[#D06B6B]">Taxa: {formatBRL(s.fee_amount)}</p>
                      </div>
                    </div>

                    {s.receive_schedule?.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#EBE8E3]">
                        <p className="text-[11px] uppercase tracking-widest text-[#7A726D] mb-2 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#C97D63]" strokeWidth={1.5} />
                          Meses a receber — clique para marcar como recebido
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {s.receive_schedule.map((r) => {
                            const received = !!r.received;
                            return (
                              <div key={r.installment}
                                className={`inline-flex items-center rounded-lg border transition ${received ? "bg-[#E4EDDF] border-[#C8DABF]" : "bg-[#F2E4DF]/60 border-[#E8CFC1]"}`}>
                                <button onClick={() => toggleInstallment(s, r)}
                                  data-testid={`installment-${s.id}-${r.installment}`}
                                  className="text-xs px-3 py-1.5 rounded-l-lg flex items-center gap-2 hover:bg-black/5">
                                  {received
                                    ? <Check className="w-3 h-3 text-[#5C7053]" strokeWidth={2.5} />
                                    : <Clock className="w-3 h-3 text-[#C97D63]" strokeWidth={1.5} />}
                                  <span className="text-[#7A726D]">{formatDate(r.date)}</span>
                                  <span className={`font-semibold ${received ? "text-[#5C7053]" : "text-[#C97D63]"}`}>
                                    {formatBRL(r.value)}
                                  </span>
                                </button>
                                <button onClick={() => deleteInstallment(s, r.installment)}
                                  data-testid={`installment-delete-${s.id}-${r.installment}`}
                                  title="Excluir esta parcela"
                                  className="p-1.5 rounded-r-lg border-l border-inherit text-[#7A726D] hover:text-[#D06B6B] hover:bg-[#FBE7E7]">
                                  <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── ABA CONFERÊNCIA MENSAL ── */}
        <TabsContent value="conferencia" className="mt-6">
          <ConferenciaCartao />
        </TabsContent>
      </Tabs>
    </div>
  );
}
