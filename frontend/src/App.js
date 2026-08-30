import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Estoque from "@/pages/Estoque";
import Vendas from "@/pages/Vendas";
import Gestao from "@/pages/Gestao";
import GestaoFinanceira from "@/pages/GestaoFinanceira";
import Precificacao from "@/pages/Precificacao";
import Etiquetas from "@/pages/Etiquetas";
import PosVenda from "@/pages/PosVenda";
import Insumos from "@/pages/Insumos";
import Configuracoes from "@/pages/Configuracoes";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/estoque" element={<Estoque />} />
              <Route path="/insumos" element={<Insumos />} />
              <Route path="/precificacao" element={<Precificacao />} />
              <Route path="/vendas" element={<Vendas />} />
              <Route path="/gestao" element={<Gestao />} />
              <Route path="/financeiro" element={<GestaoFinanceira />} />
              <Route path="/etiquetas" element={<Etiquetas />} />
              <Route path="/pos-venda" element={<PosVenda />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              {/* Legacy Prontuário routes redirect to Vendas */}
              <Route path="/prontuario" element={<Navigate to="/vendas" replace />} />
              <Route path="/prontuarios" element={<Navigate to="/vendas" replace />} />
              <Route path="/pacientes" element={<Navigate to="/vendas" replace />} />
              <Route path="/agendamento" element={<Navigate to="/vendas" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </div>
  );
}

export default App;
