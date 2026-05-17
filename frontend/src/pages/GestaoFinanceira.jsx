import { useEffect, useMemo, useState } from "react";
import { api, formatBRL, formatDate } from "@/lib/api";
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

const BUCKET_META = {
  dinheiro: { label: "Dinheiro", color: "#5C7053", icon: Banknote },
  pix: { label: "PIX", color: "#8A9E82", icon: Smartphone },
  debito: { label: "Cartão Débito", color: "#DDA15E", icon: CreditCard },
  cartao_parcelado: { label: "Cartão Parcelado", color: "#C97D63", icon: Layers },
  outros: { label: "Outros", color: "#7A726D", icon: TrendingUp },
};

const Card = ({ bucket, value, count }) => {
  const meta = BUCKET_META[bucket];
  const Icon = meta.icon;
  return (
    <div className="brinquinho-card p-5" data-testid={`finance-card-${bucket}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
            {meta.label}
          </p>
          <p className="stat-number text-2xl mt-1">{formatBRL(value)}</p>
          <p className="text-xs text-[#7A726D] mt-1">{count} venda(s)</p>
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: `${meta.color}1A` }}
        >
          <Icon className="w-5 h-5" style={{ color: meta.color }} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
};

export default function GestaoFinanceira() {
  const [scope, setScope] = useState("month"); // 'month' or 'year'
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [year, setYear] = useState(new Date().getFullYear());

  const [summary, setSummary] = useState(null);
  const [cardSales, setCardSales] = useState([]);
  const [cardMonth, setCardMonth] = useState(todayISO().slice(0, 7));
  const [receivables, setReceivables] = useState([]);

  const loadSummary = async () => {
    const params = scope === "month" ? { month } : { year };
    const res = await api.get("/finance/summary", { params });
    setSummary(res.data);
  };

  const loadCard = async () => {
    const [c, r] = await Promise.all([
      api.get("/finance/card-sales", { params: { month: cardMonth || undefined } }),
      api.get("/finance/receivables"),
    ]);
    setCardSales(c.data);
    setReceivables(r.data);
  };

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line
  }, [scope, month, year]);

  useEffect(() => {
    loadCard();
    // eslint-disable-next-line
  }, [cardMonth]);

  const buckets = summary?.buckets || {};
  const counts = summary?.counts || {};

  const pieData = useMemo(() => {
    return Object.entries(buckets)
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => ({ name: BUCKET_META[k].label, value: v, key: k }));
  }, [buckets]);

  const monthlyReceivables = useMemo(() => receivables.slice(-12), [receivables]);

  return (
    <div className="space-y-6" data-testid="financeiro-page">
      <Tabs defaultValue="resumo">
        <TabsList className="bg-[#F2E4DF] rounded-xl p-1">
          <TabsTrigger
            value="resumo"
            className="data-[state=active]:bg-white data-[state=active]:text-[#C97D63] rounded-lg"
            data-testid="tab-resumo-fin"
          >
            Resumo
          </TabsTrigger>
          <TabsTrigger
            value="cartao"
            className="data-[state=active]:bg-white data-[state=active]:text-[#C97D63] rounded-lg"
            data-testid="tab-cartao-fin"
          >
            Vendas de Cartão
          </TabsTrigger>
        </TabsList>

        {/* RESUMO */}
        <TabsContent value="resumo" className="space-y-6 mt-6">
          <div className="brinquinho-card p-5 flex flex-col md:flex-row gap-4 md:items-end">
            <div className="flex gap-1 bg-[#FDFDF9] rounded-lg p-1 border border-[#EBE8E3] w-fit">
              <button
                onClick={() => setScope("month")}
                data-testid="scope-month"
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  scope === "month"
                    ? "bg-[#C97D63] text-white"
                    : "text-[#7A726D] hover:text-[#C97D63]"
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setScope("year")}
                data-testid="scope-year"
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  scope === "year"
                    ? "bg-[#C97D63] text-white"
                    : "text-[#7A726D] hover:text-[#C97D63]"
                }`}
              >
                Anual
              </button>
            </div>
            {scope === "month" ? (
              <div>
                <Label className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                  Mês
                </Label>
                <Input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  data-testid="month-filter"
                  className="mt-1 w-44"
                />
              </div>
            ) : (
              <div>
                <Label className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                  Ano
                </Label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value) || year)}
                  data-testid="year-filter"
                  className="mt-1 w-32"
                />
              </div>
            )}
            <div className="ml-auto text-right">
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                Total no período
              </p>
              <p className="font-heading text-2xl font-semibold text-[#2D2825]">
                {formatBRL(summary?.total || 0)}
              </p>
              <p className="text-xs text-[#7A726D]">
                {summary?.sales_count || 0} venda(s)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card
              bucket="dinheiro"
              value={buckets.dinheiro || 0}
              count={counts.dinheiro || 0}
            />
            <Card bucket="pix" value={buckets.pix || 0} count={counts.pix || 0} />
            <Card
              bucket="debito"
              value={buckets.debito || 0}
              count={counts.debito || 0}
            />
            <Card
              bucket="cartao_parcelado"
              value={buckets.cartao_parcelado || 0}
              count={counts.cartao_parcelado || 0}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="brinquinho-card p-6">
              <h3 className="font-heading text-lg font-semibold mb-4">
                Distribuição por forma de pagamento
              </h3>
              {pieData.length === 0 ? (
                <p className="text-sm text-[#7A726D] text-center py-10">
                  Sem vendas no período selecionado.
                </p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={90}
                        innerRadius={50}
                        label={(e) => e.name}
                      >
                        {pieData.map((d, i) => (
                          <Cell key={i} fill={BUCKET_META[d.key].color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatBRL(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="brinquinho-card p-6">
              <h3 className="font-heading text-lg font-semibold mb-4">
                Recebimentos previstos (próximos meses)
              </h3>
              {monthlyReceivables.length === 0 ? (
                <p className="text-sm text-[#7A726D] text-center py-10">
                  Sem parcelas a receber.
                </p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
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

        {/* VENDAS DE CARTÃO */}
        <TabsContent value="cartao" className="space-y-5 mt-6">
          <div className="brinquinho-card p-4 flex items-center gap-4">
            <div>
              <Label className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                Mês
              </Label>
              <Input
                type="month"
                value={cardMonth}
                onChange={(e) => setCardMonth(e.target.value)}
                data-testid="card-month-filter"
                className="mt-1 w-44"
              />
            </div>
            <div className="ml-auto text-right">
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                Total bruto cartões
              </p>
              <p className="font-heading text-xl font-semibold text-[#2D2825]">
                {formatBRL(cardSales.reduce((s, c) => s + (c.gross_value || 0), 0))}
              </p>
            </div>
          </div>

          {cardSales.length === 0 ? (
            <div className="brinquinho-card p-10 text-center text-[#7A726D]">
              <CreditCard
                className="w-10 h-10 mx-auto text-[#C97D63] mb-3"
                strokeWidth={1.5}
              />
              <p className="font-medium text-[#2D2825]">
                Nenhuma venda em cartão neste mês.
              </p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="card-sales-list">
              {cardSales.map((s) => {
                const isParcelado = (s.installments || 1) > 1;
                return (
                  <div
                    key={s.id}
                    className="brinquinho-card p-5"
                    data-testid={`card-sale-${s.id}`}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading text-lg font-semibold text-[#2D2825]">
                            Venda de {formatBRL(s.gross_value)}
                          </span>
                          <span className="text-sm text-[#7A726D]">
                            em {formatDate(s.sale_date)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                              isParcelado
                                ? "bg-[#F2E4DF] text-[#C97D63] border-[#E8CFC1]"
                                : "bg-[#E4EDDF] text-[#5C7053] border-[#C8DABF]"
                            }`}
                          >
                            {isParcelado
                              ? `Parcelado ${s.installments}x`
                              : `${s.payment_method_name || "Débito"} 1x`}
                          </span>
                        </div>
                        <p className="text-sm text-[#7A726D] mt-1">
                          {s.patient_name || "—"}
                          {s.child_name ? ` · ${s.child_name}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                          Valor com desconto da taxa ({s.card_fee_pct}%)
                        </p>
                        <p className="font-heading text-xl font-semibold text-[#5C7053]">
                          {formatBRL(s.net_value)}
                        </p>
                        <p className="text-[11px] text-[#D06B6B]">
                          Taxa: {formatBRL(s.fee_amount)}
                        </p>
                      </div>
                    </div>

                    {s.receive_schedule && s.receive_schedule.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#EBE8E3]">
                        <p className="text-[11px] uppercase tracking-widest text-[#7A726D] mb-2 flex items-center gap-1">
                          <Calendar
                            className="w-3.5 h-3.5 text-[#C97D63]"
                            strokeWidth={1.5}
                          />
                          Meses a receber
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {s.receive_schedule.map((r) => (
                            <div
                              key={r.installment}
                              className="text-xs px-3 py-1.5 rounded-lg bg-[#F2E4DF]/60 border border-[#E8CFC1]"
                            >
                              <span className="text-[#7A726D]">
                                {formatDate(r.date)}
                              </span>
                              <span className="ml-2 font-semibold text-[#C97D63]">
                                {formatBRL(r.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
