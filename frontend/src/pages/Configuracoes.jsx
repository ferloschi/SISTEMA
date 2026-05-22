import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mail, KeyRound, Shield } from "lucide-react";

export default function Configuracoes() {
  const { user, refreshMe, logout } = useAuth();
  const [info, setInfo] = useState({ email: "", source: "" });

  // Email form
  const [emailForm, setEmailForm] = useState({ current_password: "", new_email: "" });
  const [emailLoading, setEmailLoading] = useState(false);

  // Password form
  const [pwForm, setPwForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [pwLoading, setPwLoading] = useState(false);

  const loadMe = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setInfo({ email: data.email, source: data.source });
    } catch {
      // interceptor handles 401
    }
  };

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitEmail = async (e) => {
    e.preventDefault();
    if (!emailForm.new_email || !emailForm.current_password) {
      toast.error("Preencha a senha atual e o novo e-mail.");
      return;
    }
    setEmailLoading(true);
    try {
      const { data } = await api.post("/auth/change-email", emailForm);
      toast.success(data.message || "E-mail atualizado.");
      setEmailForm({ current_password: "", new_email: "" });
      await refreshMe();
      await loadMe();
    } catch (err) {
      const d = err?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Erro ao atualizar e-mail");
    } finally {
      setEmailLoading(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    if (
      !pwForm.current_password ||
      !pwForm.new_password ||
      !pwForm.confirm_password
    ) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error("A confirmação não confere com a nova senha.");
      return;
    }
    setPwLoading(true);
    try {
      const { data } = await api.post("/auth/change-password", {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast.success(data.message || "Senha alterada.");
      setPwForm({ current_password: "", new_password: "", confirm_password: "" });
      // Force re-login for the new password to take effect cleanly
      setTimeout(() => logout(), 1200);
    } catch (err) {
      const d = err?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Erro ao alterar senha");
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="configuracoes-page">
      {/* Sessão atual */}
      <Card className="border-[#EBE8E3]">
        <CardHeader>
          <CardTitle className="font-heading text-xl text-[#2D2825] flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#C97D63]" strokeWidth={1.5} />
            Sessão atual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#7A726D]">
              Administrador conectado
            </p>
            <p
              className="text-base font-medium text-[#2D2825]"
              data-testid="current-admin-email"
            >
              {info.email || (user && user.email) || "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Trocar e-mail */}
      <Card className="border-[#EBE8E3]">
        <CardHeader>
          <CardTitle className="font-heading text-lg text-[#2D2825] flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#C97D63]" strokeWidth={1.5} />
            Alterar e-mail de acesso
          </CardTitle>
          <p className="text-sm text-[#7A726D]">
            O novo e-mail será salvo no banco e usado no próximo login.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitEmail} className="space-y-4">
            <div>
              <Label>Senha atual *</Label>
              <Input
                type="password"
                autoComplete="current-password"
                value={emailForm.current_password}
                onChange={(e) =>
                  setEmailForm({ ...emailForm, current_password: e.target.value })
                }
                data-testid="email-form-current-password"
                className="border-[#EBE8E3]"
              />
            </div>
            <div>
              <Label>Novo e-mail *</Label>
              <Input
                type="email"
                value={emailForm.new_email}
                onChange={(e) =>
                  setEmailForm({ ...emailForm, new_email: e.target.value })
                }
                data-testid="email-form-new-email"
                className="border-[#EBE8E3]"
                placeholder="novo@email.com"
              />
            </div>
            <Button
              type="submit"
              disabled={emailLoading}
              data-testid="email-form-submit"
              className="bg-[#C97D63] hover:bg-[#B36B53] text-white"
            >
              {emailLoading ? "Salvando..." : "Salvar novo e-mail"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Trocar senha */}
      <Card className="border-[#EBE8E3]">
        <CardHeader>
          <CardTitle className="font-heading text-lg text-[#2D2825] flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#C97D63]" strokeWidth={1.5} />
            Alterar senha
          </CardTitle>
          <p className="text-sm text-[#7A726D]">
            Após salvar, você será desconectado e precisará entrar com a senha nova.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitPassword} className="space-y-4">
            <div>
              <Label>Senha atual *</Label>
              <Input
                type="password"
                autoComplete="current-password"
                value={pwForm.current_password}
                onChange={(e) =>
                  setPwForm({ ...pwForm, current_password: e.target.value })
                }
                data-testid="pw-form-current"
                className="border-[#EBE8E3]"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nova senha *</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={pwForm.new_password}
                  onChange={(e) =>
                    setPwForm({ ...pwForm, new_password: e.target.value })
                  }
                  data-testid="pw-form-new"
                  className="border-[#EBE8E3]"
                />
                <p className="text-[11px] text-[#7A726D] mt-1">
                  Mínimo 6 caracteres.
                </p>
              </div>
              <div>
                <Label>Confirmar nova senha *</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={pwForm.confirm_password}
                  onChange={(e) =>
                    setPwForm({ ...pwForm, confirm_password: e.target.value })
                  }
                  data-testid="pw-form-confirm"
                  className="border-[#EBE8E3]"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={pwLoading}
              data-testid="pw-form-submit"
              className="bg-[#C97D63] hover:bg-[#B36B53] text-white"
            >
              {pwLoading ? "Salvando..." : "Alterar senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
