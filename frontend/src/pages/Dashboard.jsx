import { useEffect, useState } from "react";
import { api, formatBRL, formatDate } from "@/lib/api";
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Bell,
  AlertTriangle,
  PiggyBank,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["#C97D63", "#8A9E82", "#DDA15E", "#D06B6B", "#E8CFC1", "#7A726D"];

const StatCard = ({ icon: Icon, label, value, hint, accent = "#C97D63", testid }) => (
  <div className="brinquinho-card p-6" data-testid={testid}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">{label}</p>
        <p className="stat-number text-3xl mt-2 text-[#2D2825]">{value}</p>
        {hint && <p className="text-xs text-[#7A726D] mt-1">{hint}</p>}
      </div>
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ background: `${accent}1A` }}
      >
        <Icon className="w-5 h-5" style={{ color: accent }} strokeWidth={1.5} />
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [d, r] = await Promise.all([
        api.get("/dashboard"),
        api.get("/reminders/pending"),
      ]);
      setData(d.data);
      setReminders(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading || !data) {
    return (
      <div className="text-[#7A726D]" data-testid="dashboard-loading">
        Carregando dados...
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
        <StatCard
          icon={DollarSign}
          label="Vendas do mês"
          value={formatBRL(data.month_gross)}
          hint={`${data.sales_count} vendas em ${data.month}`}
          accent="#C97D63"
          testid="stat-month-gross"
        />
        <StatCard
          icon={PiggyBank}
          label="Lucro do mês"
          value={formatBRL(data.month_profit)}
          hint={`Taxas: ${formatBRL(data.month_fees)}`}
          accent="#8A9E82"
          testid="stat-month-profit"
        />
        <StatCard
          icon={Calendar}
          label="Agendamentos hoje"
          value={data.today_appointments}
          hint={formatDate(data.today)}
          accent="#DDA15E"
          testid="stat-today-appts"
        />
        <StatCard
          icon={Bell}
          label="Lembretes pós-venda"
          value={data.pending_reminders}
          hint="Próximos 14 dias"
          accent="#C97D63"
          testid="stat-pending-reminders"
        />
        <StatCard
          icon={AlertTriangle}
          label="Estoque baixo"
          value={data.low_stock_count}
          hint="Itens abaixo do mínimo"
          accent="#D06B6B"
          testid="stat-low-stock"
        />
        <StatCard
          icon={TrendingUp}
          label="Custo total"
          value={formatBRL(data.month_cost)}
          hint="Produtos vendidos no mês"
          accent="#7A726D"
          testid="stat-month-cost"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="brinquinho-card p-6 lg:col-span-2" data-testid="chart-daily-sales">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold text-[#2D2825]">
              Vendas diárias — {data.month}
            </h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.chart_daily}>
                <CartesianGrid stroke="#EBE8E3" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#7A726D" }} />
                <YAxis tick={{ fontSize: 11, fill: "#7A726D" }} />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #EBE8E3",
                    borderRadius: 12,
                  }}
                  formatter={(v) => formatBRL(v)}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#C97D63"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#C97D63" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="brinquinho-card p-6" data-testid="chart-payment-methods">
          <h3 className="font-heading text-lg font-semibold text-[#2D2825] mb-4">
            Por forma de pagamento
          </h3>
          <div className="h-72">
            {data.chart_payment_methods.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-[#7A726D]">
                Sem vendas no mês.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.chart_payment_methods}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    innerRadius={50}
                    label={(e) => e.name}
                  >
                    {data.chart_payment_methods.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatBRL(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="brinquinho-card p-6" data-testid="reminders-list">
        <h3 className="font-heading text-lg font-semibold text-[#2D2825] mb-4">
          Lembretes de pós-venda pendentes
        </h3>
        {reminders.length === 0 ? (
          <p className="text-sm text-[#7A726D]">Nenhum lembrete pendente nos próximos dias.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FDFDF9] border-y border-[#EBE8E3] text-xs font-semibold uppercase text-[#7A726D]">
                  <th className="py-3 px-4 text-left">Paciente</th>
                  <th className="py-3 px-4 text-left">Criança</th>
                  <th className="py-3 px-4 text-left">Procedimento</th>
                  <th className="py-3 px-4 text-left">Data perfuração</th>
                  <th className="py-3 px-4 text-left">Data pós-venda</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((r) => (
                  <tr key={r.id} className="border-b border-[#EBE8E3] hover:bg-[#FDFDF9]/50">
                    <td className="py-3 px-4">{r.patient_name}</td>
                    <td className="py-3 px-4 text-[#7A726D]">{r.child_name || "—"}</td>
                    <td className="py-3 px-4">{r.procedure_type}</td>
                    <td className="py-3 px-4">{formatDate(r.date)}</td>
                    <td className="py-3 px-4 font-medium text-[#C97D63]">
                      {formatDate(r.post_sale_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
