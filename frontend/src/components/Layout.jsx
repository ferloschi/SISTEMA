import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Wallet,
  TrendingUp,
  Calculator,
  Sparkles,
} from "lucide-react";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "sidebar-nav-dashboard" },
  { to: "/estoque", label: "Estoque", icon: Package, testid: "sidebar-nav-estoque" },
  { to: "/precificacao", label: "Precificação", icon: Calculator, testid: "sidebar-nav-precificacao" },
  { to: "/prontuario", label: "Prontuário", icon: ClipboardList, testid: "sidebar-nav-prontuario" },
  { to: "/gestao", label: "Gestão Administrativa", icon: Wallet, testid: "sidebar-nav-gestao" },
  { to: "/financeiro", label: "Gestão Financeira", icon: TrendingUp, testid: "sidebar-nav-financeiro" },
];

const pageTitle = {
  "/dashboard": "Visão Geral",
  "/estoque": "Controle de Estoque",
  "/precificacao": "Precificação de Procedimentos",
  "/prontuario": "Prontuário",
  "/prontuarios": "Prontuário",
  "/agendamento": "Agendamento",
  "/vendas": "Vendas",
  "/gestao": "Gestão Administrativa",
  "/financeiro": "Gestão Financeira",
};

export default function Layout() {
  const location = useLocation();
  const title = pageTitle[location.pathname] || "Dra. Brinquinho";

  return (
    <div className="flex min-h-screen bg-[#FDFDF9]">
      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className="w-64 shrink-0 bg-[#FDFDF9] border-r border-[#EBE8E3] flex flex-col"
      >
        <div className="p-6 border-b border-[#EBE8E3]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#F2E4DF] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#C97D63]" strokeWidth={1.5} />
            </div>
            <div className="font-heading leading-tight">
              <div className="text-[11px] uppercase tracking-widest text-[#7A726D]">Clínica</div>
              <div className="text-lg font-semibold text-[#2D2825]">
                Dra. <span className="text-[#C97D63]">Brinquinho</span>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                data-testid={item.testid}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-[#F2E4DF] text-[#C97D63]"
                      : "text-[#2D2825] hover:bg-[#FDFDF9] hover:text-[#C97D63]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={isActive ? "w-5 h-5 text-[#C97D63]" : "w-5 h-5 text-[#7A726D]"}
                      strokeWidth={1.5}
                    />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 m-4 rounded-2xl bg-[#F2E4DF]/60 border border-[#E8CFC1]">
          <p className="text-xs text-[#7A726D] leading-relaxed">
            Lembretes de pós-venda são gerados 45 dias após a perfuração.
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          data-testid="page-header"
          className="bg-white/80 backdrop-blur-md border-b border-[#EBE8E3] sticky top-0 z-30"
        >
          <div className="px-8 lg:px-10 py-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Painel</p>
              <h1 className="font-heading text-2xl font-semibold text-[#2D2825]">{title}</h1>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Hoje</p>
              <p className="text-sm font-medium text-[#2D2825]">
                {new Date().toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
