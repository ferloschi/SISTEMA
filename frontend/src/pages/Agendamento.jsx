import { useEffect, useState } from "react";
import { api, formatDate, PROCEDURE_TYPES } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
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
import { Plus, Pencil, Trash2, Clock, CheckCircle2, XCircle } from "lucide-react";

const emptyForm = {
  patient_id: "",
  patient_name: "",
  child_name: "",
  procedure_type: "Perfuração Baby",
  date: "",
  time: "09:00",
  status: "agendado",
  notes: "",
};

const STATUS_COLORS = {
  agendado: "bg-[#F2E4DF] text-[#C97D63] border-[#E8CFC1]",
  realizado: "bg-[#E4EDDF] text-[#5C7053] border-[#C8DABF]",
  cancelado: "bg-[#FBE7E7] text-[#D06B6B] border-[#F0CBCB]",
};

const toLocalISO = (d) => {
  if (!d) return "";
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
};

export default function Agendamento() {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const [a, p] = await Promise.all([
      api.get("/appointments"),
      api.get("/patients"),
    ]);
    setAppointments(a.data);
    setPatients(p.data);
  };

  useEffect(() => {
    load();
  }, []);

  const selectedISO = toLocalISO(selectedDate);
  const dayAppts = appointments.filter((a) => a.date === selectedISO);
  const datesWithAppts = appointments.map((a) => a.date);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, date: selectedISO });
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ ...emptyForm, ...item });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.patient_name || !form.date) {
      toast.error("Informe o paciente e a data.");
      return;
    }
    try {
      if (editing) {
        await api.put(`/appointments/${editing.id}`, form);
        toast.success("Agendamento atualizado");
      } else {
        await api.post("/appointments", form);
        toast.success("Agendamento criado");
      }
      setOpen(false);
      load();
    } catch {
      toast.error("Erro ao salvar agendamento");
    }
  };

  const remove = async (item) => {
    if (!window.confirm("Excluir agendamento?")) return;
    await api.delete(`/appointments/${item.id}`);
    toast.success("Agendamento excluído");
    load();
  };

  const changeStatus = async (item, status) => {
    await api.put(`/appointments/${item.id}`, { ...item, status });
    toast.success("Status atualizado");
    load();
  };

  const pickPatient = (id) => {
    const pt = patients.find((p) => p.id === id);
    if (pt) {
      setForm({
        ...form,
        patient_id: pt.id,
        patient_name: pt.parent_name,
        child_name: pt.child_name || "",
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-testid="agendamento-page">
      <div className="brinquinho-card p-6 lg:col-span-1">
        <h3 className="font-heading text-lg font-semibold mb-4">Calendário</h3>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(d) => d && setSelectedDate(d)}
          className="rounded-xl border border-[#EBE8E3] bg-white"
          modifiers={{ hasAppt: datesWithAppts.map((d) => new Date(d + "T12:00:00")) }}
          modifiersStyles={{
            hasAppt: {
              fontWeight: 700,
              color: "#C97D63",
              textDecoration: "underline",
            },
          }}
          data-testid="agendamento-calendar"
        />
        <div className="mt-6 p-4 rounded-xl bg-[#F2E4DF]/40 border border-[#E8CFC1]">
          <p className="text-xs uppercase tracking-widest text-[#7A726D]">Dia selecionado</p>
          <p className="font-heading text-xl font-semibold text-[#2D2825] mt-1">
            {formatDate(selectedISO)}
          </p>
          <p className="text-sm text-[#7A726D] mt-1">{dayAppts.length} agendamento(s)</p>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold">
            Agendamentos do dia — {formatDate(selectedISO)}
          </h3>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={openNew}
                data-testid="agendamento-new-btn"
                className="bg-[#C97D63] hover:bg-[#B36B53] text-white rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Novo agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle className="font-heading">
                  {editing ? "Editar agendamento" : "Novo agendamento"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                <div className="md:col-span-2">
                  <Label>Selecionar paciente (opcional)</Label>
                  <Select onValueChange={pickPatient}>
                    <SelectTrigger data-testid="form-patient">
                      <SelectValue placeholder="— Buscar paciente —" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.parent_name} {p.child_name ? `· ${p.child_name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nome do cliente/mãe *</Label>
                  <Input
                    data-testid="form-patient-name"
                    value={form.patient_name}
                    onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Nome da criança</Label>
                  <Input
                    value={form.child_name}
                    onChange={(e) => setForm({ ...form, child_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Procedimento</Label>
                  <Select
                    value={form.procedure_type}
                    onValueChange={(v) => setForm({ ...form, procedure_type: v })}
                  >
                    <SelectTrigger data-testid="form-procedure">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROCEDURE_TYPES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agendado">Agendado</SelectItem>
                      <SelectItem value="realizado">Realizado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    data-testid="form-date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Horário</Label>
                  <Input
                    type="time"
                    data-testid="form-time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
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
                  data-testid="agendamento-form-submit"
                  className="bg-[#C97D63] hover:bg-[#B36B53] text-white"
                >
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3" data-testid="day-appointments-list">
          {dayAppts.length === 0 ? (
            <div className="brinquinho-card p-10 text-center text-[#7A726D]">
              Nenhum agendamento neste dia.
            </div>
          ) : (
            dayAppts
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((a) => (
                <div key={a.id} className="brinquinho-card p-5 flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1 min-w-[72px] py-2 px-3 rounded-xl bg-[#FDFDF9] border border-[#EBE8E3]">
                    <Clock className="w-4 h-4 text-[#C97D63]" strokeWidth={1.5} />
                    <span className="font-heading font-semibold text-lg">{a.time}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[#2D2825]">{a.patient_name}</span>
                      {a.child_name && (
                        <span className="text-sm text-[#7A726D]">· {a.child_name}</span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                          STATUS_COLORS[a.status]
                        }`}
                      >
                        {a.status}
                      </span>
                    </div>
                    <div className="text-sm text-[#7A726D] mt-1">{a.procedure_type}</div>
                    {a.post_sale_date && (
                      <div className="text-xs text-[#C97D63] mt-1">
                        Pós-venda: {formatDate(a.post_sale_date)}
                      </div>
                    )}
                    {a.notes && <div className="text-xs text-[#7A726D] mt-1">{a.notes}</div>}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => changeStatus(a, "realizado")}
                      title="Marcar como realizado"
                      className="p-2 rounded-lg hover:bg-[#E4EDDF] text-[#7A726D] hover:text-[#5C7053]"
                    >
                      <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => changeStatus(a, "cancelado")}
                      title="Cancelar"
                      className="p-2 rounded-lg hover:bg-[#FBE7E7] text-[#7A726D] hover:text-[#D06B6B]"
                    >
                      <XCircle className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => openEdit(a)}
                      className="p-2 rounded-lg hover:bg-[#F2E4DF] text-[#7A726D] hover:text-[#C97D63]"
                    >
                      <Pencil className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => remove(a)}
                      className="p-2 rounded-lg hover:bg-[#FBE7E7] text-[#7A726D] hover:text-[#D06B6B]"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
