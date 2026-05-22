import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles, Lock, AtSign, AlertCircle } from "lucide-react";

export default function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already authenticated? Bounce out.
  if (user && typeof user === "object") {
    const to = location.state?.from?.pathname || "/dashboard";
    return <Navigate to={to} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Não foi possível entrar. Verifique seu e-mail e senha."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="login-page"
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FBF6F2] via-[#FDFDF9] to-[#F2E4DF] p-6"
    >
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-[#EBE8E3] flex items-center justify-center mb-3">
            <Sparkles className="w-7 h-7 text-[#C97D63]" strokeWidth={1.5} />
          </div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#7A726D]">Clínica</p>
          <h1 className="font-heading text-2xl font-semibold text-[#2D2825]">
            Dra. <span className="text-[#C97D63]">Brinquinho</span>
          </h1>
        </div>

        <div className="bg-white rounded-2xl border border-[#EBE8E3] shadow-sm p-8">
          <h2 className="font-heading text-xl font-semibold text-[#2D2825]">Entrar</h2>
          <p className="text-sm text-[#7A726D] mt-1 mb-6">
            Use suas credenciais de administrador para acessar o sistema.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-[#2D2825]">
                E-mail
              </Label>
              <div className="relative mt-1">
                <AtSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A726D]" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 border-[#EBE8E3]"
                  placeholder="seu@email.com"
                  data-testid="login-email"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-[#2D2825]">
                Senha
              </Label>
              <div className="relative mt-1">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A726D]" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 border-[#EBE8E3]"
                  placeholder="••••••••"
                  data-testid="login-password"
                />
              </div>
            </div>

            {error && (
              <div
                data-testid="login-error"
                className="flex items-start gap-2 p-3 rounded-lg bg-[#FBE7E7] border border-[#F0C4C4] text-[#A23D3D] text-sm"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.5} />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              data-testid="login-submit"
              className="w-full bg-[#C97D63] hover:bg-[#B36B53] text-white"
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>

        <p className="text-center text-[11px] text-[#7A726D] mt-6">
          Sistema interno • Acesso restrito
        </p>
      </div>
    </div>
  );
}
