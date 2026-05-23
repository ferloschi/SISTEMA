import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Wallet,
  TrendingUp,
  Calculator,
  Tag,
  HeartPulse,
  Droplet,
  Settings,
  LogOut,
  Sparkles,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "sidebar-nav-dashboard" },
  { to: "/estoque", label: "Estoque", icon: Package, testid: "sidebar-nav-estoque" },
  { to: "/insumos", label: "Insumos", icon: Droplet, testid: "sidebar-nav-insumos" },
  { to: "/etiquetas", label: "Etiquetas", icon: Tag, testid: "sidebar-nav-etiquetas" },
  { to: "/precificacao", label: "Precificação", icon: Calculator, testid: "sidebar-nav-precificacao" },
  { to: "/prontuario", label: "Prontuário", icon: ClipboardList, testid: "sidebar-nav-prontuario" },
  { to: "/pos-venda", label: "Pós-venda", icon: HeartPulse, testid: "sidebar-nav-pos-venda" },
  { to: "/gestao", label: "Gestão Administrativa", icon: Wallet, testid: "sidebar-nav-gestao" },
  { to: "/financeiro", label: "Gestão Financeira", icon: TrendingUp, testid: "sidebar-nav-financeiro" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, testid: "sidebar-nav-configuracoes" },
];

const pageTitle = {
  "/dashboard": "Visão Geral",
  "/estoque": "Controle de Estoque",
  "/insumos": "Insumos",
  "/etiquetas": "Etiquetas de Produtos",
  "/precificacao": "Precificação de Procedimentos",
  "/prontuario": "Prontuário",
  "/prontuarios": "Prontuário",
  "/pos-venda": "Acompanhamento Pós-venda",
  "/agendamento": "Agendamento",
  "/vendas": "Vendas",
  "/gestao": "Gestão Administrativa",
  "/financeiro": "Gestão Financeira",
  "/configuracoes": "Configurações",
};

export default function Layout() {
  const location = useLocation();
  const title = pageTitle[location.pathname] || "Dra. Brinquinho";
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const SidebarContent = () => (
    <>
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

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={item.testid}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[#F2E4DF] text-[#C97D63]"
                    : "text-[#2D2825] hover:bg-[#F8F0ED] hover:text-[#C97D63]"
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

      {user && typeof user === "object" && (
        <div className="p-4 border-t border-[#EBE8E3]">
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-[#7A726D]">Logado como</p>
              <p
                className="text-xs font-medium text-[#2D2825] truncate"
                title={user.email}
                data-testid="sidebar-user-email"
              >
                {user.email}
              </p>
            </div>
            <button
              onClick={logout}
              data-testid="sidebar-logout-btn"
              title="Sair"
              className="p-2 rounded-lg hover:bg-[#FBE7E7] text-[#7A726D] hover:text-[#D06B6B]"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#FDFDF9]">
      {/* Sidebar desktop */}
      <aside
        data-testid="sidebar"
        className="hidden md:flex w-64 shrink-0 bg-[#FDFDF9] border-r border-[#EBE8E3] flex-col"
      >
        <SidebarContent />
      </aside>

      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar mobile drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-[#FDFDF9] border-r border-[#EBE8E3] flex flex-col transform transition-transform duration-300 md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex justify-end p-4">
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-[#F2E4DF] text-[#7A726D]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          data-testid="page-header"
          className="bg-white/80 backdrop-blur-md border-b border-[#EBE8E3] sticky top-0 z-30"
        >
          <div className="px-4 md:px-8 lg:px-10 py-4 md:py-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Hamburger mobile */}
              <button
                className="md:hidden p-2 rounded-lg hover:bg-[#F2E4DF] text-[#7A726D]"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Painel</p>
                <h1 className="font-heading text-lg md:text-2xl font-semibold text-[#2D2825] leading-tight">
                  {title}
                </h1>
              </div>
            </div>
            <div className="text-right hidden sm:block">
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

        <main className="flex-1 p-4 md:p-8 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
