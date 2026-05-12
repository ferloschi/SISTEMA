import { useEffect, useMemo, useState } from "react";
import { api, formatBRL, formatDate, PROCEDURE_TYPES } from "@/lib/api";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  CreditCard,
  Stethoscope,
  Calendar as CalendarIcon,
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
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#C97D63", "#8A9E82", "#DDA15E", "#D06B6B", "#E8CFC1", "#7A726D", "#B36B53"];

const emptyPM = { name: "", card_fee_pct: 0, is_card: false, active: true };

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthAgoISO = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};

export default function Gestao() {
  const [methods, setMethods] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPM);

  const [year, setYear] = useState(new Date().getFullYear());
  const [monthly, setMonthly] = useState([]);

  // Procedimentos realizados
  const [appointments, setAppointments] = useState([]);
  const [dateFrom, setDateFrom] = useState(monthAgoISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [procFilter, setProcFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("realizado");

  const load = async () => {
    const [pm, m, a] = await Promise.all([
      api.get("/payment-methods"),
      api.get("/reports/monthly", { params: { year } }),
      api.get("/appointments"),
    ]);
    setMethods(pm.data);
    setMonthly(m.data);
    setAppointments(a.data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
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

  // ===== Procedimentos Realizados (filtros + métricas) =====
  const filteredAppts = useMemo(() => {
    return appointments.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (procFilter !== "all" && a.procedure_type !== procFilter) return false;
      if (dateFrom && (a.date || "") < dateFrom) return false;
      if (dateTo && (a.date || "") > dateTo) return false;
      return true;
    });
  }, [appointments, statusFilter, procFilter, dateFrom, dateTo]);

  const procStats = useMemo(() => {
    const by = {};
    for (const a of filteredAppts) {
      const k = a.procedure_type || "—";
      by[k] = (by[k] || 0) + 1;
    }
    return Object.entries(by)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredAppts]);

  const totalProcs = filteredAppts.length;
  const uniquePatients = new Set(
    filteredAppts.map((a) => a.patient_id || a.patient_name)
  ).size;

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

  return (
    <div className="space-y-6" data-testid="gestao-page">
      <Tabs defaultValue="financeiro" className="w-full">
        <TabsList className="bg-[#F2E4DF] rounded-xl p-1">
          <TabsTrigger
            value="financeiro"
            data-testid="tab-financeiro"
            className="data-[state=active]:bg-white data-[state=active]:text-[#C97D63] rounded-lg"
          >
            Relatório Financeiro
          </TabsTrigger>
          <TabsTrigger
            value="procedimentos"
            data-testid="tab-procedimentos"
            className="data-[state=active]:bg-white data-[state=active]:text-[#C97D63] rounded-lg"
          >
            Procedimentos Realizados
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
            <div className="brinquinho-card p-4">
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Vendas</p>
              <p className="stat-number text-xl mt-1">{yearTotals.count}</p>
            </div>
            <div className="brinquinho-card p-4">
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Bruto</p>
              <p className="stat-number text-xl mt-1">{formatBRL(yearTotals.gross)}</p>
            </div>
            <div className="brinquinho-card p-4">
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Custo</p>
              <p className="stat-number text-xl mt-1">{formatBRL(yearTotals.cost)}</p>
            </div>
            <div className="brinquinho-card p-4">
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Taxas</p>
              <p className="stat-number text-xl mt-1 text-[#D06B6B]">
                {formatBRL(yearTotals.fees)}
              </p>
            </div>
            <div className="brinquinho-card p-4">
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Lucro</p>
              <p className="stat-number text-xl mt-1 text-[#5C7053]">
                {formatBRL(yearTotals.profit)}
              </p>
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

        <TabsContent value="procedimentos" className="space-y-6 mt-6" data-testid="procedimentos-tab">
          <div className="brinquinho-card p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                De
              </Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1"
                data-testid="proc-filter-from"
              />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                Até
              </Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1"
                data-testid="proc-filter-to"
              />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                Procedimento
              </Label>
              <Select value={procFilter} onValueChange={setProcFilter}>
                <SelectTrigger className="mt-1" data-testid="proc-filter-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {PROCEDURE_TYPES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1" data-testid="proc-filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realizado">Realizado</SelectItem>
                  <SelectItem value="agendado">Agendado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="brinquinho-card p-5">
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                Total no período
              </p>
              <p className="stat-number text-3xl mt-1" data-testid="proc-total">
                {totalProcs}
              </p>
              <p className="text-xs text-[#7A726D] mt-1">
                {formatDate(dateFrom)} → {formatDate(dateTo)}
              </p>
            </div>
            <div className="brinquinho-card p-5">
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                Pacientes únicos
              </p>
              <p className="stat-number text-3xl mt-1">{uniquePatients}</p>
            </div>
            <div className="brinquinho-card p-5">
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                Tipo mais realizado
              </p>
              <p className="stat-number text-xl mt-1 truncate">
                {procStats[0]?.name || "—"}
              </p>
              <p className="text-xs text-[#7A726D] mt-1">
                {procStats[0]?.value || 0} atendimento(s)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="brinquinho-card p-6 lg:col-span-1">
              <h3 className="font-heading text-lg font-semibold mb-4">
                Distribuição
              </h3>
              {procStats.length === 0 ? (
                <p className="text-sm text-[#7A726D] text-center py-10">
                  Sem dados para os filtros selecionados.
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={procStats}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={80}
                        innerRadius={40}
                      >
                        {procStats.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="brinquinho-card p-6 lg:col-span-2">
              <h3 className="font-heading text-lg font-semibold mb-4">
                Por tipo de procedimento
              </h3>
              {procStats.length === 0 ? (
                <p className="text-sm text-[#7A726D] text-center py-10">
                  Sem dados.
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={procStats} layout="vertical">
                      <CartesianGrid stroke="#EBE8E3" strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#7A726D" }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={140}
                        tick={{ fontSize: 11, fill: "#7A726D" }}
                      />
                      <Tooltip />
                      <Bar dataKey="value" fill="#C97D63" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="brinquinho-card overflow-x-auto" data-testid="proc-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FDFDF9] border-b border-[#EBE8E3] text-xs font-semibold uppercase text-[#7A726D]">
                  <th className="py-3 px-4 text-left">Data</th>
                  <th className="py-3 px-4 text-left">Procedimento</th>
                  <th className="py-3 px-4 text-left">Paciente</th>
                  <th className="py-3 px-4 text-left">Criança</th>
                  <th className="py-3 px-4 text-left">Pós-venda</th>
                  <th className="py-3 px-4 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[#7A726D]">
                      Nenhum procedimento encontrado para esses filtros.
                    </td>
                  </tr>
                ) : (
                  filteredAppts
                    .slice()
                    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                    .map((a) => (
                      <tr
                        key={a.id}
                        className="border-b border-[#EBE8E3] hover:bg-[#FDFDF9]/60"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <CalendarIcon
                              className="w-3.5 h-3.5 text-[#C97D63]"
                              strokeWidth={1.5}
                            />
                            <span>{formatDate(a.date)}</span>
                            <span className="text-xs text-[#7A726D]">{a.time}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium">{a.procedure_type}</td>
                        <td className="py-3 px-4">{a.patient_name}</td>
                        <td className="py-3 px-4 text-[#7A726D]">
                          {a.child_name || "—"}
                        </td>
                        <td className="py-3 px-4 text-[#C97D63] font-medium">
                          {formatDate(a.post_sale_date)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                              a.status === "realizado"
                                ? "bg-[#E4EDDF] text-[#5C7053] border-[#C8DABF]"
                                : a.status === "cancelado"
                                ? "bg-[#FBE7E7] text-[#D06B6B] border-[#F0CBCB]"
                                : "bg-[#F2E4DF] text-[#C97D63] border-[#E8CFC1]"
                            }`}
                          >
                            {a.status}
                          </span>
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
