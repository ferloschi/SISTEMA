import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, formatBRL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  CreditCard,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

const emptyPM = { name: "", card_fee_pct: 0, is_card: false, active: true };

export default function Gestao() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const validTabs = ["financeiro", "pagamentos"];
  const activeTab = validTabs.includes(tabFromUrl) ? tabFromUrl : "financeiro";

  const [methods, setMethods] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPM);

  const [year, setYear] = useState(new Date().getFullYear());
  const [monthly, setMonthly] = useState([]);
  const [products, setProducts] = useState([]);

  const load = async () => {
    const [pm, m, p] = await Promise.all([
      api.get("/payment-methods"),
      api.get("/reports/monthly", { params: { year } }),
      api.get("/products"),
    ]);
    setMethods(pm.data);
    setMonthly(m.data);
    setProducts(p.data);
  };

  const deleteYearSales = async () => {
    if (
      !window.confirm(
        `Excluir TODAS as vendas do ano ${year}?\n\n` +
          "O estoque dos produtos vendidos será devolvido.\n" +
          "Esta ação não pode ser desfeita."
      )
    )
      return;
    try {
      const res = await api.post("/sales/bulk-delete", null, { params: { year } });
      toast.success(`${res.data.deleted || 0} venda(s) excluída(s) do ano ${year}`);
      load();
    } catch {
      toast.error("Erro ao excluir vendas do ano");
    }
  };

  useEffect(() => {
    load();
  }, [year]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyPM);
    setOpen(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({ ...emptyPM, ...m });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name) {
      toast.error("Informe o nome.");
      return;
    }
    const payload = {
      ...form,
      card_fee_pct: Number(form.card_fee_pct) || 0,
    };
    try {
      if (editing) {
        await api.put(`/payment-methods/${editing.id}`, payload);
        toast.success("Forma de pagamento atualizada");
      } else {
        await api.post("/payment-methods", payload);
        toast.success("Forma de pagamento criada");
      }
      setOpen(false);
      load();
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`Excluir "${m.name}"?`)) return;
    await api.delete(`/payment-methods/${m.id}`);
    toast.success("Excluído");
    load();
  };

  // ===== Ano totals =====
  const yearTotals = monthly.reduce(
    (acc, m) => {
      acc.gross += m.gross;
      acc.profit += m.profit;
      acc.fees += m.fees;
      acc.cost += m.cost;
      acc.count += m.count;
      return acc;
    },
    { gross: 0, profit: 0, fees: 0, cost: 0, count: 0 }
  );

  // Valor total do estoque: soma (qty * preço) de todas as variantes.
  const stockTotals = useMemo(() => {
    let cost = 0;
    let sale = 0;
    let units = 0;
    for (const p of products) {
      const variants =
        p.variants && p.variants.length > 0
          ? p.variants
          : [
              {
                stock_qty: p.stock_qty,
                purchase_value: p.purchase_value,
                sale_value: p.sale_value,
              },
            ];
      for (const v of variants) {
        const qty = Number(v.stock_qty) || 0;
        cost += qty * (Number(v.purchase_value) || 0);
        sale += qty * (Number(v.sale_value) || 0);
        units += qty;
      }
    }
    return { cost, sale, units };
  }, [products]);

  return (
    <div className="space-y-6" data-testid="gestao-page">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}
        className="w-full"
      >
        <TabsList className="bg-[#F2E4DF] rounded-xl p-1">
          <TabsTrigger
            value="financeiro"
            data-testid="tab-financeiro"
            className="data-[state=active]:bg-white data-[state=active]:text-[#C97D63] rounded-lg"
          >
            Relatório Financeiro
          </TabsTrigger>
          <TabsTrigger
            value="pagamentos"
            data-testid="tab-pagamentos"
            className="data-[state=active]:bg-white data-[state=active]:text-[#C97D63] rounded-lg"
          >
            Formas de Pagamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="space-y-6 mt-6">
          <div className="flex items-center gap-4">
            <Label>Ano:</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || year)}
              className="w-32"
              data-testid="year-filter"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { key: "count", label: "Vendas", value: yearTotals.count, color: "" },
              { key: "gross", label: "Bruto", value: formatBRL(yearTotals.gross), color: "" },
              { key: "cost", label: "Custo", value: formatBRL(yearTotals.cost), color: "" },
              { key: "fees", label: "Taxas", value: formatBRL(yearTotals.fees), color: "text-[#D06B6B]" },
              { key: "profit", label: "Lucro", value: formatBRL(yearTotals.profit), color: "text-[#5C7053]" },
            ].map((c) => (
              <div key={c.key} className="brinquinho-card p-4 relative">
                <button
                  onClick={deleteYearSales}
                  title={`Excluir todas as vendas de ${year}`}
                  data-testid={`year-card-${c.key}-delete`}
                  className="absolute top-2 right-2 p-1.5 rounded-lg text-[#7A726D] hover:text-[#D06B6B] hover:bg-[#FBE7E7]"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
                <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                  {c.label}
                </p>
                <p className={`stat-number text-xl mt-1 ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Estoque atual — capital parado em produtos */}
          <div
            className="brinquinho-card p-6"
            data-testid="stock-valuation-card"
          >
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <div>
                <h3 className="font-heading text-lg font-semibold text-[#2D2825]">
                  Valor do estoque atual
                </h3>
                <p className="text-xs text-[#7A726D] mt-1">
                  Soma (quantidade × preço) de todas as variantes em estoque hoje.
                </p>
              </div>
              <span className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                {stockTotals.units} unidade(s) em estoque
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-[#EBE8E3] p-4 bg-[#FBF6F2]/60">
                <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                  Custo total do estoque
                </p>
                <p
                  className="stat-number text-2xl mt-1 text-[#2D2825]"
                  data-testid="stock-cost-total"
                >
                  {formatBRL(stockTotals.cost)}
                </p>
                <p className="text-[11px] text-[#7A726D] mt-1">
                  Investimento de compra ainda parado em joias
                </p>
              </div>
              <div className="rounded-xl border border-[#EBE8E3] p-4 bg-[#F2E4DF]/60">
                <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                  Valor de venda do estoque
                </p>
                <p
                  className="stat-number text-2xl mt-1 text-[#C97D63]"
                  data-testid="stock-sale-total"
                >
                  {formatBRL(stockTotals.sale)}
                </p>
                <p className="text-[11px] text-[#7A726D] mt-1">
                  Receita potencial se vender todo estoque atual
                </p>
              </div>
              <div className="rounded-xl border border-[#EBE8E3] p-4 bg-[#E5F1E0]/40">
                <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                  Margem potencial
                </p>
                <p
                  className="stat-number text-2xl mt-1 text-[#5C7053]"
                  data-testid="stock-margin-total"
                >
                  {formatBRL(stockTotals.sale - stockTotals.cost)}
                </p>
                <p className="text-[11px] text-[#7A726D] mt-1">
                  Diferença entre valor de venda e custo
                </p>
              </div>
            </div>
          </div>

          <div className="brinquinho-card p-6">
            <h3 className="font-heading text-lg font-semibold mb-4">
              Vendas e lucro mensais — {year}
            </h3>
            <div className="h-80">
              {monthly.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-[#7A726D]">
                  Sem dados para o ano selecionado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly}>
                    <CartesianGrid stroke="#EBE8E3" strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#7A726D" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#7A726D" }} />
                    <Tooltip
                      contentStyle={{
                        background: "#fff",
                        border: "1px solid #EBE8E3",
                        borderRadius: 12,
                      }}
                      formatter={(v) => formatBRL(v)}
                    />
                    <Legend />
                    <Bar
                      dataKey="gross"
                      name="Vendas"
                      fill="#C97D63"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar
                      dataKey="profit"
                      name="Lucro"
                      fill="#8A9E82"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="brinquinho-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FDFDF9] border-b border-[#EBE8E3] text-xs font-semibold uppercase text-[#7A726D]">
                  <th className="py-3 px-4 text-left">Mês</th>
                  <th className="py-3 px-4 text-right">Vendas</th>
                  <th className="py-3 px-4 text-right">Bruto</th>
                  <th className="py-3 px-4 text-right">Custo</th>
                  <th className="py-3 px-4 text-right">Taxas</th>
                  <th className="py-3 px-4 text-right">Lucro</th>
                </tr>
              </thead>
              <tbody>
                {monthly.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[#7A726D]">
                      Nenhuma venda neste ano.
                    </td>
                  </tr>
                ) : (
                  monthly.map((m) => (
                    <tr key={m.month} className="border-b border-[#EBE8E3]">
                      <td className="py-3 px-4 font-medium">{m.month}</td>
                      <td className="py-3 px-4 text-right">{m.count}</td>
                      <td className="py-3 px-4 text-right">{formatBRL(m.gross)}</td>
                      <td className="py-3 px-4 text-right">{formatBRL(m.cost)}</td>
                      <td className="py-3 px-4 text-right text-[#D06B6B]">
                        {formatBRL(m.fees)}
                      </td>
                      <td className="py-3 px-4 text-right text-[#5C7053] font-semibold">
                        {formatBRL(m.profit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>


        <TabsContent value="pagamentos" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#7A726D]">
              Cadastre as formas de pagamento aceitas e as taxas dos cartões. Isso ajusta
              automaticamente o cálculo de lucro das vendas.
            </p>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={openNew}
                  data-testid="pm-new-btn"
                  className="bg-[#C97D63] hover:bg-[#B36B53] text-white rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                  Nova forma
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-heading">
                    {editing ? "Editar forma de pagamento" : "Nova forma de pagamento"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label>Nome *</Label>
                    <Input
                      data-testid="pm-form-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Ex: Cartão Crédito - Getnet"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="is_card">É cartão?</Label>
                    <Switch
                      id="is_card"
                      checked={form.is_card}
                      onCheckedChange={(v) => setForm({ ...form, is_card: v })}
                      data-testid="pm-form-iscard"
                    />
                  </div>
                  {form.is_card && (
                    <div>
                      <Label>Taxa do cartão (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.card_fee_pct}
                        onChange={(e) => setForm({ ...form, card_fee_pct: e.target.value })}
                        data-testid="pm-form-fee"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Label htmlFor="active">Ativa?</Label>
                    <Switch
                      id="active"
                      checked={form.active}
                      onCheckedChange={(v) => setForm({ ...form, active: v })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={submit}
                    data-testid="pm-form-submit"
                    className="bg-[#C97D63] hover:bg-[#B36B53] text-white"
                  >
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {methods.map((m) => (
              <div
                key={m.id}
                className="brinquinho-card p-5 flex items-start gap-3"
                data-testid={`pm-card-${m.id}`}
              >
                <div className="w-11 h-11 rounded-xl bg-[#F2E4DF] flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-[#C97D63]" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{m.name}</p>
                    {!m.active && (
                      <span className="text-xs bg-[#FBE7E7] text-[#D06B6B] px-2 py-0.5 rounded-full">
                        Inativa
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#7A726D]">
                    {m.is_card ? `Cartão · taxa ${m.card_fee_pct}%` : "Sem taxa"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(m)}
                    className="p-2 rounded-lg hover:bg-[#F2E4DF] text-[#7A726D] hover:text-[#C97D63]"
                  >
                    <Pencil className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => remove(m)}
                    className="p-2 rounded-lg hover:bg-[#FBE7E7] text-[#7A726D] hover:text-[#D06B6B]"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
