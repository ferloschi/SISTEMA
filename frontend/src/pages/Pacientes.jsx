import { useEffect, useMemo, useState } from "react";
import { api, formatDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Search,
  Phone,
  Mail,
  History,
  Calendar,
} from "lucide-react";

const emptyForm = {
  child_name: "",
  parent_name: "",
  phone: "",
  email: "",
  birth_date: "",
  notes: "",
};

const STATUS_COLORS = {
  agendado: "bg-[#F2E4DF] text-[#C97D63] border-[#E8CFC1]",
  realizado: "bg-[#E4EDDF] text-[#5C7053] border-[#C8DABF]",
  cancelado: "bg-[#FBE7E7] text-[#D06B6B] border-[#F0CBCB]",
};

export default function Pacientes() {
  const [items, setItems] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPatient, setHistoryPatient] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const [p, a] = await Promise.all([
      api.get("/patients", { params: { q: search || undefined } }),
      api.get("/appointments"),
    ]);
    setItems(p.data);
    setAppointments(a.data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [search]);

  const apptsByPatient = useMemo(() => {
    const map = {};
    for (const a of appointments) {
      if (!a.patient_id) continue;
      if (!map[a.patient_id]) map[a.patient_id] = [];
      map[a.patient_id].push(a);
    }
    for (const id in map) {
      map[id].sort((x, y) => (y.date || "").localeCompare(x.date || ""));
    }
    return map;
  }, [appointments]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ ...emptyForm, ...item });
    setOpen(true);
  };

  const openHistory = (item) => {
    setHistoryPatient(item);
    setHistoryOpen(true);
  };

  const submit = async () => {
    if (!form.parent_name) {
      toast.error("Informe o nome do responsável/cliente.");
      return;
    }
    try {
      if (editing) {
        await api.put(`/patients/${editing.id}`, form);
        toast.success("Paciente atualizado");
      } else {
        await api.post("/patients", form);
        toast.success("Paciente cadastrado");
      }
      setOpen(false);
      load();
    } catch {
      toast.error("Erro ao salvar paciente");
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Excluir paciente "${item.parent_name}"?`)) return;
    await api.delete(`/patients/${item.id}`);
    toast.success("Paciente excluído");
    load();
  };

  const patientAppts = historyPatient ? apptsByPatient[historyPatient.id] || [] : [];

  return (
    <div className="space-y-6" data-testid="pacientes-page">
      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A726D]" />
          <Input
            data-testid="pacientes-search"
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white border-[#EBE8E3] rounded-xl"
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openNew}
              data-testid="pacientes-new-btn"
              className="bg-[#C97D63] hover:bg-[#B36B53] text-white rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Novo paciente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="font-heading">
                {editing ? "Editar paciente" : "Novo paciente"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
              <div>
                <Label>Nome do responsável / cliente *</Label>
                <Input
                  data-testid="form-parent"
                  value={form.parent_name}
                  onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Nome da criança</Label>
                <Input
                  data-testid="form-child"
                  value={form.child_name}
                  onChange={(e) => setForm({ ...form, child_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  data-testid="form-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Data de nascimento (criança)</Label>
                <Input
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={submit}
                data-testid="pacientes-form-submit"
                className="bg-[#C97D63] hover:bg-[#B36B53] text-white"
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="brinquinho-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#FDFDF9] border-b border-[#EBE8E3] text-xs font-semibold uppercase text-[#7A726D]">
              <th className="py-3 px-4 text-left">Responsável</th>
              <th className="py-3 px-4 text-left">Criança</th>
              <th className="py-3 px-4 text-left">Contato</th>
              <th className="py-3 px-4 text-left">Último procedimento</th>
              <th className="py-3 px-4 text-left">Pós-venda</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[#7A726D]">
                  Nenhum paciente cadastrado.
                </td>
              </tr>
            ) : (
              items.map((p) => {
                const list = apptsByPatient[p.id] || [];
                const last = list[0];
                return (
                  <tr
                    key={p.id}
                    className="border-b border-[#EBE8E3] hover:bg-[#FDFDF9]/60"
                    data-testid={`patient-row-${p.id}`}
                  >
                    <td className="py-3 px-4 font-medium">{p.parent_name}</td>
                    <td className="py-3 px-4">{p.child_name || "—"}</td>
                    <td className="py-3 px-4">
                      <div className="space-y-1 text-xs text-[#7A726D]">
                        {p.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" strokeWidth={1.5} />
                            {p.phone}
                          </div>
                        )}
                        {p.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" strokeWidth={1.5} />
                            {p.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {last ? (
                        <div className="text-xs">
                          <div className="font-medium text-[#2D2825]">
                            {last.procedure_type}
                          </div>
                          <div className="text-[#7A726D]">{formatDate(last.date)}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-[#7A726D]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {last && last.post_sale_date ? (
                        <span className="text-xs font-medium text-[#C97D63]">
                          {formatDate(last.post_sale_date)}
                        </span>
                      ) : (
                        <span className="text-xs text-[#7A726D]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex gap-2">
                        {list.length > 0 && (
                          <button
                            onClick={() => openHistory(p)}
                            title={`Ver histórico (${list.length})`}
                            data-testid={`history-${p.id}`}
                            className="p-2 rounded-lg hover:bg-[#F2E4DF] text-[#7A726D] hover:text-[#C97D63] relative"
                          >
                            <History className="w-4 h-4" strokeWidth={1.5} />
                            <span className="absolute -top-1 -right-1 bg-[#C97D63] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                              {list.length}
                            </span>
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(p)}
                          className="p-2 rounded-lg hover:bg-[#F2E4DF] text-[#7A726D] hover:text-[#C97D63]"
                        >
                          <Pencil className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => remove(p)}
                          className="p-2 rounded-lg hover:bg-[#FBE7E7] text-[#7A726D] hover:text-[#D06B6B]"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* History dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Histórico de procedimentos
            </DialogTitle>
          </DialogHeader>
          {historyPatient && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#F2E4DF]/40 border border-[#E8CFC1]">
                <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                  Paciente
                </p>
                <p className="font-heading text-lg font-semibold">
                  {historyPatient.parent_name}
                  {historyPatient.child_name ? ` · ${historyPatient.child_name}` : ""}
                </p>
                {historyPatient.phone && (
                  <p className="text-xs text-[#7A726D] mt-1">
                    {historyPatient.phone}
                  </p>
                )}
              </div>

              <div className="overflow-x-auto" data-testid="history-table">
                {patientAppts.length === 0 ? (
                  <div className="py-10 text-center text-[#7A726D] text-sm">
                    Nenhum procedimento registrado.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#FDFDF9] border-b border-[#EBE8E3] text-xs font-semibold uppercase text-[#7A726D]">
                        <th className="py-2 px-3 text-left">Data</th>
                        <th className="py-2 px-3 text-left">Procedimento</th>
                        <th className="py-2 px-3 text-left">Pós-venda (+45d)</th>
                        <th className="py-2 px-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patientAppts.map((a) => (
                        <tr
                          key={a.id}
                          className="border-b border-[#EBE8E3]"
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <Calendar
                                className="w-3.5 h-3.5 text-[#C97D63]"
                                strokeWidth={1.5}
                              />
                              <span>{formatDate(a.date)}</span>
                              <span className="text-xs text-[#7A726D]">{a.time}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-medium">
                            {a.procedure_type}
                          </td>
                          <td className="py-3 px-3 text-[#C97D63] font-medium">
                            {formatDate(a.post_sale_date)}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                                STATUS_COLORS[a.status] || ""
                              }`}
                            >
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
