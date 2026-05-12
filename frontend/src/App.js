import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Estoque from "@/pages/Estoque";
import Agendamento from "@/pages/Agendamento";
import Pacientes from "@/pages/Pacientes";
import Vendas from "@/pages/Vendas";
import Gestao from "@/pages/Gestao";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/agendamento" element={<Agendamento />} />
            <Route path="/pacientes" element={<Pacientes />} />
            <Route path="/vendas" element={<Vendas />} />
            <Route path="/gestao" element={<Gestao />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </div>
  );
}

export default App;
