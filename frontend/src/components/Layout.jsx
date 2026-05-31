import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
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

function SidebarBody({ onNavigate, user, logout }) {
  return (
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
              onClick={onNavigate}
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
}

export default function Layout() {
  const location = useLocation();
  const title = pageTitle[location.pathname] || "Dra. Brinquinho";
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen bg-[#FDFDF9]">
      {/* Desktop sidebar */}
      <aside
        data-testid="sidebar"
        className="hidden md:flex w-64 shrink-0 bg-[#FDFDF9] border-r border-[#EBE8E3] flex-col"
      >
        <SidebarBody user={user} logout={logout} />
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          data-testid="sidebar-overlay"
          onClick={() => setDrawerOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        />
      )}

      {/* Mobile drawer */}
      <aside
        data-testid="sidebar-mobile"
        aria-hidden={!drawerOpen}
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#FDFDF9] border-r border-[#EBE8E3] flex flex-col shadow-2xl transform transition-transform duration-300 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex justify-end p-2">
          <button
            onClick={() => setDrawerOpen(false)}
            data-testid="sidebar-close-btn"
            className="p-2 rounded-lg text-[#7A726D] hover:text-[#C97D63] hover:bg-[#F2E4DF]"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
        <SidebarBody
          user={user}
          logout={logout}
          onNavigate={() => setDrawerOpen(false)}
        />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          data-testid="page-header"
          className="bg-white/80 backdrop-blur-md border-b border-[#EBE8E3] sticky top-0 z-30"
        >
          <div className="px-4 sm:px-6 md:px-8 lg:px-10 py-4 md:py-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setDrawerOpen(true)}
                data-testid="sidebar-open-btn"
                className="md:hidden p-2 rounded-lg text-[#2D2825] hover:bg-[#F2E4DF] hover:text-[#C97D63] shrink-0"
                aria-label="Abrir menu"
              >
                <Menu className="w-6 h-6" strokeWidth={1.5} />
              </button>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] uppercase tracking-widest text-[#7A726D]">
                  Painel
                </p>
                <h1 className="font-heading text-lg sm:text-xl md:text-2xl font-semibold text-[#2D2825] truncate">
                  {title}
                </h1>
              </div>
            </div>
            <div className="text-right shrink-0 hidden sm:block">
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

        <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
