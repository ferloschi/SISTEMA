import { useEffect, useMemo, useState } from "react";
import { api, formatBRL, formatDate, PROCEDURE_TYPES } from "@/lib/api";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Phone,
  ClipboardList,
  X,
  PlusCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const todayISO = () => new Date().toISOString().slice(0, 10);

const addDaysISO = (iso, days) => {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

const emptyPatient = {
  parent_name: "",
  child_name: "",
  phone: "",
  comorbidades: "",
  email: "",
  birth_date: "",
  notes: "",
};

const emptyProcForm = {
  procedure_id: "",
  procedure_type: "",
  description: "",
  procedure_date: todayISO(),
  manual_value: "",
  manual_cost: "",
  payment_method_id: "",
  card_fee_pct: "",
  installments: 1,
  // Mixed payments
  mixed: false,
  mixed_payments: [], // [{method_id, amount, card_fee_pct, installments}]
  avulsos: [],
};

const emptyMixedPayment = {
  method_id: "",
  amount: "",
  card_fee_pct: "",
  installments: 1,
};

const emptyAvulso = { product_id: "", name: "", qty: 1, unit_price: 0, unit_cost: 0 };

export default function Prontuario() {
  const [patients, setPatients] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [products, setProducts] = useState([]);
  const [methods, setMethods] = useState([]);
  const [sales, setSales] = useState([]);

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pForm, setPForm] = useState(emptyPatient);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPatient, setDetailPatient] = useState(null);
  const [showAddProc, setShowAddProc] = useState(false);
  const [procForm, setProcForm] = useState(emptyProcForm);

  const load = async () => {
    const [p, pr, pd, pm, s] = await Promise.all([
      api.get("/patients", { params: { q: search || undefined } }),
      api.get("/procedures"),
      api.get("/products"),
      api.get("/payment-methods"),
      api.get("/sales"),
    ]);
    setPatients(p.data);
    setProcedures(pr.data);
    setProducts(pd.data);
    setMethods(pm.data);
    setSales(s.data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [search]);

  const salesByPatient = useMemo(() => {
    const map = {};
    for (const s of sales) {
      if (!s.patient_id) continue;
      if (!map[s.patient_id]) map[s.patient_id] = [];
      map[s.patient_id].push(s);
    }
    for (const id in map) {
      map[id].sort((a, b) => (b.sale_date || "").localeCompare(a.sale_date || ""));
    }
    return map;
  }, [sales]);

  // ===== Patient CRUD =====
  const openNewPatient = () => {
    setEditing(null);
    setPForm(emptyPatient);
    setOpen(true);
  };
  const openEditPatient = (p) => {
    setEditing(p);
    setPForm({ ...emptyPatient, ...p });
    setOpen(true);
  };
  const submitPatient = async () => {
    if (!pForm.parent_name) {
      toast.error("Informe o nome do responsável/cliente.");
      return;
    }
    try {
      if (editing) {
        await api.put(`/patients/${editing.id}`, pForm);
        toast.success("Prontuário atualizado");
      } else {
        await api.post("/patients", pForm);
        toast.success("Prontuário cadastrado");
      }
      setOpen(false);
      load();
    } catch {
      toast.error("Erro ao salvar prontuário");
    }
  };
  const removePatient = async (p) => {
    if (!window.confirm(`Excluir prontuário de "${p.parent_name}"?`)) return;
    await api.delete(`/patients/${p.id}`);
    toast.success("Prontuário excluído");
    load();
  };

  // ===== Detail view =====
  const openDetail = (p) => {
    setDetailPatient(p);
    setShowAddProc(false);
    setProcForm({ ...emptyProcForm, procedure_date: todayISO(), avulsos: [] });
    setDetailOpen(true);
  };

  // ===== Procedure form helpers =====
  const pickProcedure = (id) => {
    const pr = procedures.find((p) => p.id === id);
    if (!pr) return;
    setProcForm((f) => ({
      ...f,
      procedure_id: pr.id,
      procedure_type: pr.name,
      manual_value: String(pr.final_price || ""),
      manual_cost: String(pr.total_cost || ""),
    }));
  };

  const pickPayment = (id) => {
    const m = methods.find((x) => x.id === id);
    setProcForm((f) => ({
      ...f,
      payment_method_id: id,
      card_fee_pct: m && m.is_card ? String(m.card_fee_pct) : "0",
      installments: m && m.is_card ? f.installments || 1 : 1,
    }));
  };

  const selectedMethod = methods.find((m) => m.id === procForm.payment_method_id);
  const isCardPayment = !!(selectedMethod && selectedMethod.is_card);

  const addAvulso = () =>
    setProcForm((f) => ({ ...f, avulsos: [...f.avulsos, { ...emptyAvulso }] }));
  const removeAvulso = (idx) =>
    setProcForm((f) => ({ ...f, avulsos: f.avulsos.filter((_, i) => i !== idx) }));
  const updateAvulso = (idx, field, value) => {
    setProcForm((f) => {
      const av = [...f.avulsos];
      av[idx] = { ...av[idx], [field]: value };
      return { ...f, avulsos: av };
    });
  };
  const pickAvulsoProduct = (idx, productId) => {
    const pr = products.find((p) => p.id === productId);
    if (pr) {
      setProcForm((f) => {
        const av = [...f.avulsos];
        av[idx] = {
          ...av[idx],
          product_id: pr.id,
          name: pr.name,
          unit_price: pr.sale_value,
          unit_cost: pr.purchase_value,
        };
        return { ...f, avulsos: av };
      });
    }
  };

  const preview = useMemo(() => {
    const procValue = Number(procForm.manual_value) || 0;
    const procCost = Number(procForm.manual_cost) || 0;
    const avulsosValue = procForm.avulsos.reduce(
      (s, i) => s + Number(i.qty || 0) * Number(i.unit_price || 0),
      0
    );
    const avulsosCost = procForm.avulsos.reduce(
      (s, i) => s + Number(i.qty || 0) * Number(i.unit_cost || 0),
      0
    );
    const gross = procValue + avulsosValue;
    const cost = procCost + avulsosCost;

    let fee = 0;
    let feePct = 0;
    let inst = 1;
    let perInstallment = 0;
    let schedule = [];
    let mixedTotal = 0;
    let mixedFee = 0;

    if (procForm.mixed) {
      // Calculate fee from each mixed payment
      for (const mp of procForm.mixed_payments) {
        const amt = Number(mp.amount) || 0;
        const m = methods.find((x) => x.id === mp.method_id);
        const isCard = !!(m && m.is_card);
        const pct = isCard ? Number(mp.card_fee_pct) || 0 : 0;
        const f = (amt * pct) / 100;
        mixedFee += f;
        mixedTotal += amt;
      }
      fee = mixedFee;
      feePct = 0;
    } else {
      feePct = Number(procForm.card_fee_pct) || 0;
      fee = (gross * feePct) / 100;
      inst = Math.max(1, parseInt(procForm.installments) || 1);
      const net = gross - fee;
      perInstallment = inst > 0 ? net / inst : net;
      if (isCardPayment && procForm.procedure_date) {
        const baseDate = new Date(procForm.procedure_date + "T12:00:00");
        for (let i = 0; i < inst; i++) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() + 30 * (i + 1));
          const val = i < inst - 1 ? perInstallment : net - perInstallment * (inst - 1);
          schedule.push({
            date: d.toISOString().slice(0, 10),
            value: Math.round(val * 100) / 100,
          });
        }
      }
    }
    const profit = gross - cost - fee;
    const diff = procForm.mixed ? mixedTotal - gross : 0;
    return {
      procValue,
      procCost,
      avulsosValue,
      avulsosCost,
      gross,
      cost,
      fee,
      profit,
      feePct,
      net: gross - fee,
      inst,
      perInstallment,
      schedule,
      mixedTotal,
      mixedDiff: diff,
    };
  }, [procForm, isCardPayment, methods]);

  // Mixed payments handlers
  const addMixedPayment = () =>
    setProcForm((f) => ({
      ...f,
      mixed_payments: [...f.mixed_payments, { ...emptyMixedPayment }],
    }));
  const removeMixedPayment = (idx) =>
    setProcForm((f) => ({
      ...f,
      mixed_payments: f.mixed_payments.filter((_, i) => i !== idx),
    }));
  const updateMixedPayment = (idx, field, value) => {
    setProcForm((f) => {
      const arr = [...f.mixed_payments];
      arr[idx] = { ...arr[idx], [field]: value };
      // Auto-fill fee_pct when method is picked
      if (field === "method_id") {
        const m = methods.find((x) => x.id === value);
        arr[idx].card_fee_pct = m && m.is_card ? String(m.card_fee_pct) : "0";
      }
      return { ...f, mixed_payments: arr };
    });
  };
  const toggleMixed = (on) => {
    setProcForm((f) => ({
      ...f,
      mixed: on,
      mixed_payments: on
        ? f.mixed_payments.length > 0
          ? f.mixed_payments
          : [{ ...emptyMixedPayment }, { ...emptyMixedPayment }]
        : f.mixed_payments,
    }));
  };

  const submitProcedure = async () => {
    if (!detailPatient) return;
    if (!procForm.procedure_type) {
      toast.error("Selecione o procedimento.");
      return;
    }
    if (!procForm.mixed && !procForm.payment_method_id) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    if (procForm.mixed) {
      const filled = procForm.mixed_payments.filter(
        (p) => p.method_id && Number(p.amount) > 0
      );
      if (filled.length < 2) {
        toast.error("Adicione ao menos 2 formas de pagamento.");
        return;
      }
      const sumAmt = filled.reduce((s, p) => s + Number(p.amount), 0);
      if (Math.abs(sumAmt - preview.gross) > 0.05) {
        toast.error(
          `Soma das formas (${formatBRL(sumAmt)}) deve igualar o total ${formatBRL(
            preview.gross
          )}.`
        );
        return;
      }
    }
    try {
      const procItem = {
        product_id: "",
        name: `Procedimento: ${procForm.procedure_type}`,
        qty: 1,
        unit_price: Number(procForm.manual_value) || 0,
        unit_cost: Number(procForm.manual_cost) || 0,
      };
      const avulsoItems = procForm.avulsos
        .filter((a) => a.name)
        .map((a) => ({
          product_id: a.product_id || "",
          name: a.name,
          qty: parseInt(a.qty) || 1,
          unit_price: Number(a.unit_price) || 0,
          unit_cost: Number(a.unit_cost) || 0,
        }));

      const apptRes = await api.post("/appointments", {
        patient_id: detailPatient.id,
        patient_name: detailPatient.parent_name,
        child_name: detailPatient.child_name || "",
        procedure_type: procForm.procedure_type,
        date: procForm.procedure_date,
        time: "09:00",
        status: procForm.procedure_date <= todayISO() ? "realizado" : "agendado",
        notes: procForm.description,
      });

      const saleBody = {
        sale_date: procForm.procedure_date,
        patient_id: detailPatient.id,
        patient_name: detailPatient.parent_name,
        child_name: detailPatient.child_name || "",
        items: [procItem, ...avulsoItems],
        description: procForm.description,
        appointment_id: apptRes.data.id,
      };

      if (procForm.mixed) {
        saleBody.payments = procForm.mixed_payments
          .filter((p) => p.method_id && Number(p.amount) > 0)
          .map((p) => ({
            method_id: p.method_id,
            amount: Number(p.amount),
            card_fee_pct:
              p.card_fee_pct === "" || p.card_fee_pct === null
                ? null
                : Number(p.card_fee_pct),
            installments: parseInt(p.installments) || 1,
          }));
      } else {
        saleBody.payment_method_id = procForm.payment_method_id;
        saleBody.card_fee_pct =
          procForm.card_fee_pct === "" ? null : Number(procForm.card_fee_pct);
        saleBody.installments = parseInt(procForm.installments) || 1;
      }

      await api.post("/sales", saleBody);

      toast.success("Procedimento registrado");
      setShowAddProc(false);
      setProcForm({ ...emptyProcForm, procedure_date: todayISO(), avulsos: [] });
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro ao registrar procedimento");
    }
  };

  const removeSale = async (s) => {
    if (!window.confirm("Excluir este procedimento e sua venda?")) return;
    await api.delete(`/sales/${s.id}`);
    if (s.appointment_id) {
      try {
        await api.delete(`/appointments/${s.appointment_id}`);
      } catch {
        // ignore if already gone
      }
    }
    toast.success("Procedimento removido");
    load();
  };

  const patientSales = detailPatient ? salesByPatient[detailPatient.id] || [] : [];
  const postSalePreview = procForm.procedure_date
    ? addDaysISO(procForm.procedure_date, 45)
    : "";

  return (
    <div className="space-y-6" data-testid="prontuario-page">
      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A726D]" />
          <Input
            data-testid="prontuario-search"
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white border-[#EBE8E3] rounded-xl"
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openNewPatient}
              data-testid="prontuario-new-btn"
              className="bg-[#C97D63] hover:bg-[#B36B53] text-white rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Novo prontuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">
                {editing ? "Editar prontuário" : "Novo prontuário"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Nome do responsável / cliente *</Label>
                  <Input
                    data-testid="form-parent"
                    value={pForm.parent_name}
                    onChange={(e) => setPForm({ ...pForm, parent_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Nome da criança</Label>
                  <Input
                    data-testid="form-child"
                    value={pForm.child_name}
                    onChange={(e) => setPForm({ ...pForm, child_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    data-testid="form-phone"
                    value={pForm.phone}
                    onChange={(e) => setPForm({ ...pForm, phone: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Comorbidades</Label>
                  <Textarea
                    data-testid="form-comorbidades"
                    rows={3}
                    placeholder="Alergias, doenças, medicamentos em uso..."
                    value={pForm.comorbidades}
                    onChange={(e) =>
                      setPForm({ ...pForm, comorbidades: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={submitPatient}
                data-testid="prontuario-form-submit"
                className="bg-[#C97D63] hover:bg-[#B36B53] text-white"
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="brinquinho-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#FDFDF9] border-b border-[#EBE8E3] text-xs font-semibold uppercase text-[#7A726D]">
              <th className="py-3 px-4 text-left">Responsável</th>
              <th className="py-3 px-4 text-left">Criança</th>
              <th className="py-3 px-4 text-left">Telefone</th>
              <th className="py-3 px-4 text-left">Comorbidades</th>
              <th className="py-3 px-4 text-center">Procedimentos</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[#7A726D]">
                  Nenhum prontuário cadastrado.
                </td>
              </tr>
            ) : (
              patients.map((p) => {
                const list = salesByPatient[p.id] || [];
                return (
                  <tr
                    key={p.id}
                    className="border-b border-[#EBE8E3] hover:bg-[#FDFDF9]/60 cursor-pointer"
                    onClick={() => openDetail(p)}
                    data-testid={`patient-row-${p.id}`}
                  >
                    <td className="py-3 px-4 font-medium">{p.parent_name}</td>
                    <td className="py-3 px-4">{p.child_name || "—"}</td>
                    <td className="py-3 px-4 text-xs text-[#7A726D]">
                      {p.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" strokeWidth={1.5} />
                          {p.phone}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#7A726D] max-w-xs truncate">
                      {p.comorbidades || "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block bg-[#F2E4DF] text-[#C97D63] border border-[#E8CFC1] px-2 py-1 rounded-full text-xs font-medium">
                        {list.length}
                      </span>
                    </td>
                    <td
                      className="py-3 px-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => openEditPatient(p)}
                          className="p-2 rounded-lg hover:bg-[#F2E4DF] text-[#7A726D] hover:text-[#C97D63]"
                        >
                          <Pencil className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => removePatient(p)}
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

      {/* ===== DETAIL DIALOG ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Prontuário · Procedimentos
            </DialogTitle>
          </DialogHeader>

          {detailPatient && (
            <div className="space-y-5">
              {/* Patient header */}
              <div className="p-4 rounded-xl bg-[#F2E4DF]/40 border border-[#E8CFC1]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                      Responsável
                    </p>
                    <p className="font-heading text-lg font-semibold">
                      {detailPatient.parent_name}
                    </p>
                  </div>
                  {detailPatient.child_name && (
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                        Criança
                      </p>
                      <p className="font-medium">{detailPatient.child_name}</p>
                    </div>
                  )}
                  {detailPatient.phone && (
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                        Telefone
                      </p>
                      <p className="font-medium">{detailPatient.phone}</p>
                    </div>
                  )}
                  {detailPatient.comorbidades && (
                    <div className="md:col-span-3">
                      <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                        Comorbidades
                      </p>
                      <p className="text-sm text-[#2D2825] whitespace-pre-wrap">
                        {detailPatient.comorbidades}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <h4 className="font-medium text-sm">
                  {patientSales.length} procedimento(s) registrado(s)
                </h4>
                <Button
                  size="sm"
                  onClick={() => setShowAddProc((v) => !v)}
                  data-testid="add-procedure-toggle"
                  className="bg-[#C97D63] hover:bg-[#B36B53] text-white"
                >
                  <PlusCircle className="w-4 h-4 mr-2" strokeWidth={1.5} />
                  {showAddProc ? (
                    <>
                      Cancelar <ChevronUp className="w-3 h-3 ml-1" />
                    </>
                  ) : (
                    <>
                      Adicionar procedimento <ChevronDown className="w-3 h-3 ml-1" />
                    </>
                  )}
                </Button>
              </div>

              {/* Add procedure form */}
              {showAddProc && (
                <div className="rounded-xl border border-dashed border-[#E8CFC1] bg-[#F2E4DF]/30 p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Procedimento (pacote da Precificação) *</Label>
                      <Select
                        value={procForm.procedure_id}
                        onValueChange={pickProcedure}
                      >
                        <SelectTrigger data-testid="proc-pkg-select">
                          <SelectValue placeholder="— Selecionar —" />
                        </SelectTrigger>
                        <SelectContent>
                          {procedures
                            .filter((p) => p.active)
                            .map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} — {formatBRL(p.final_price)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Data do procedimento *</Label>
                      <Input
                        type="date"
                        data-testid="proc-date"
                        value={procForm.procedure_date}
                        onChange={(e) =>
                          setProcForm({ ...procForm, procedure_date: e.target.value })
                        }
                      />
                      {postSalePreview && (
                        <p className="text-[11px] text-[#C97D63] mt-1">
                          Pós-venda (+45d):{" "}
                          <span className="font-medium">
                            {formatDate(postSalePreview)}
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <Label>Descrição do procedimento</Label>
                      <Textarea
                        rows={2}
                        data-testid="proc-description"
                        value={procForm.description}
                        onChange={(e) =>
                          setProcForm({ ...procForm, description: e.target.value })
                        }
                        placeholder="Observações, intercorrências, posição da perfuração..."
                      />
                    </div>
                    <div>
                      <Label>Valor cobrado (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        data-testid="proc-value"
                        value={procForm.manual_value}
                        onChange={(e) =>
                          setProcForm({ ...procForm, manual_value: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Custo (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        data-testid="proc-cost"
                        value={procForm.manual_cost}
                        onChange={(e) =>
                          setProcForm({ ...procForm, manual_cost: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Forma de pagamento {procForm.mixed ? "" : "*"}</Label>
                      <Select
                        value={procForm.payment_method_id}
                        onValueChange={pickPayment}
                        disabled={procForm.mixed}
                      >
                        <SelectTrigger data-testid="proc-pm">
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {methods
                            .filter((m) => m.active)
                            .map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name}{" "}
                                {m.is_card ? `(padrão ${m.card_fee_pct}%)` : ""}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {!procForm.mixed && (
                      <div>
                        <Label>Taxa do cartão (%) — editável</Label>
                        <Input
                          type="number"
                          step="0.01"
                          data-testid="proc-fee"
                          value={procForm.card_fee_pct}
                          onChange={(e) =>
                            setProcForm({ ...procForm, card_fee_pct: e.target.value })
                          }
                        />
                      </div>
                    )}
                    {!procForm.mixed && isCardPayment && (
                      <div>
                        <Label>Parcelas</Label>
                        <Select
                          value={String(procForm.installments)}
                          onValueChange={(v) =>
                            setProcForm({ ...procForm, installments: parseInt(v) })
                          }
                        >
                          <SelectTrigger data-testid="proc-installments">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n}x{" "}
                                {n === 1
                                  ? "(à vista)"
                                  : `de ${formatBRL(preview.perInstallment)}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Mixed payment toggle + UI */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="mixed-toggle"
                      checked={procForm.mixed}
                      onChange={(e) => toggleMixed(e.target.checked)}
                      data-testid="proc-mixed-toggle"
                      className="w-4 h-4 rounded accent-[#C97D63]"
                    />
                    <Label htmlFor="mixed-toggle" className="cursor-pointer">
                      Pagamento dividido em mais de uma forma (ex: Dinheiro + PIX)
                    </Label>
                  </div>

                  {procForm.mixed && (
                    <div className="rounded-xl border border-[#E8CFC1] bg-white p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-[#C97D63]">Formas de pagamento</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addMixedPayment}
                          data-testid="add-mixed-pm-btn"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Adicionar forma
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {procForm.mixed_payments.map((mp, idx) => {
                          const m = methods.find((x) => x.id === mp.method_id);
                          const isCard = !!(m && m.is_card);
                          return (
                            <div
                              key={idx}
                              className="grid grid-cols-12 gap-2 items-end p-2 rounded-lg bg-[#FDFDF9] border border-[#EBE8E3]"
                            >
                              <div className="col-span-12 md:col-span-4">
                                <Label className="text-xs">Forma</Label>
                                <Select
                                  value={mp.method_id}
                                  onValueChange={(v) =>
                                    updateMixedPayment(idx, "method_id", v)
                                  }
                                >
                                  <SelectTrigger
                                    data-testid={`mixed-pm-${idx}`}
                                  >
                                    <SelectValue placeholder="—" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {methods
                                      .filter((m) => m.active)
                                      .map((m) => (
                                        <SelectItem key={m.id} value={m.id}>
                                          {m.name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-6 md:col-span-3">
                                <Label className="text-xs">Valor (R$)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  data-testid={`mixed-amount-${idx}`}
                                  value={mp.amount}
                                  onChange={(e) =>
                                    updateMixedPayment(idx, "amount", e.target.value)
                                  }
                                />
                              </div>
                              {isCard && (
                                <>
                                  <div className="col-span-3 md:col-span-2">
                                    <Label className="text-xs">Taxa %</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={mp.card_fee_pct}
                                      onChange={(e) =>
                                        updateMixedPayment(
                                          idx,
                                          "card_fee_pct",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="col-span-3 md:col-span-2">
                                    <Label className="text-xs">Parcelas</Label>
                                    <Select
                                      value={String(mp.installments)}
                                      onValueChange={(v) =>
                                        updateMixedPayment(
                                          idx,
                                          "installments",
                                          parseInt(v)
                                        )
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(
                                          (n) => (
                                            <SelectItem
                                              key={n}
                                              value={String(n)}
                                            >
                                              {n}x
                                            </SelectItem>
                                          )
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </>
                              )}
                              <div className="col-span-12 md:col-span-1 flex items-end justify-end">
                                <button
                                  type="button"
                                  onClick={() => removeMixedPayment(idx)}
                                  className="p-2 rounded-lg hover:bg-[#FBE7E7] text-[#7A726D] hover:text-[#D06B6B]"
                                >
                                  <X className="w-4 h-4" strokeWidth={1.5} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-[#EBE8E3]">
                        <span className="text-xs text-[#7A726D]">
                          Soma das formas:
                        </span>
                        <span
                          className={`font-semibold ${
                            Math.abs(preview.mixedDiff) < 0.05
                              ? "text-[#5C7053]"
                              : "text-[#D06B6B]"
                          }`}
                          data-testid="mixed-sum"
                        >
                          {formatBRL(preview.mixedTotal)} / {formatBRL(preview.gross)}
                          {Math.abs(preview.mixedDiff) >= 0.05 && (
                            <span className="ml-2 text-xs">
                              (diferença {formatBRL(preview.mixedDiff)})
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {!procForm.mixed && isCardPayment && preview.schedule.length > 0 && (
                    <div className="rounded-xl bg-white border border-[#E8CFC1] p-3">
                      <p className="text-[11px] uppercase tracking-widest text-[#7A726D] mb-2">
                        Cronograma de recebimento (líquido)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {preview.schedule.map((r, idx) => (
                          <div
                            key={idx}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-[#F2E4DF] border border-[#E8CFC1]"
                          >
                            <span className="text-[#7A726D]">{formatDate(r.date)}</span>
                            <span className="ml-2 font-semibold text-[#C97D63]">
                              {formatBRL(r.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vendas avulsas */}
                  <div className="border-t border-[#EBE8E3] pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-[#C97D63]">
                        Vendas avulsas (mercadorias do estoque)
                      </Label>
                      <Button
                        type="button"
                        onClick={addAvulso}
                        variant="outline"
                        size="sm"
                        data-testid="add-avulso-btn"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Adicionar item
                      </Button>
                    </div>
                    {procForm.avulsos.length === 0 ? (
                      <p className="text-xs text-[#7A726D] italic">
                        Nenhuma mercadoria avulsa adicionada.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {procForm.avulsos.map((a, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-12 gap-2 items-end p-2 rounded-lg bg-white border border-[#EBE8E3]"
                          >
                            <div className="col-span-12 md:col-span-5">
                              <Label className="text-xs">Produto</Label>
                              <Select
                                value={a.product_id || ""}
                                onValueChange={(v) => pickAvulsoProduct(idx, v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="— Selecionar —" />
                                </SelectTrigger>
                                <SelectContent>
                                  {products.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name} ({formatBRL(p.sale_value)})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                              <Label className="text-xs">Qtd</Label>
                              <Input
                                type="number"
                                min="1"
                                value={a.qty}
                                onChange={(e) => updateAvulso(idx, "qty", e.target.value)}
                              />
                            </div>
                            <div className="col-span-4 md:col-span-2">
                              <Label className="text-xs">Preço</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={a.unit_price}
                                onChange={(e) =>
                                  updateAvulso(idx, "unit_price", e.target.value)
                                }
                              />
                            </div>
                            <div className="col-span-4 md:col-span-2">
                              <Label className="text-xs">Custo</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={a.unit_cost}
                                onChange={(e) =>
                                  updateAvulso(idx, "unit_cost", e.target.value)
                                }
                              />
                            </div>
                            <div className="col-span-2 md:col-span-2 text-xs">
                              <Label className="text-xs">Total</Label>
                              <p className="font-semibold pt-2">
                                {formatBRL(
                                  Number(a.qty || 0) * Number(a.unit_price || 0)
                                )}
                              </p>
                            </div>
                            <div className="col-span-12 md:col-span-12 flex justify-end -mt-9">
                              <button
                                type="button"
                                onClick={() => removeAvulso(idx)}
                                className="p-1 rounded-lg hover:bg-[#FBE7E7] text-[#7A726D] hover:text-[#D06B6B]"
                              >
                                <X className="w-4 h-4" strokeWidth={1.5} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Resumo */}
                  <div className="p-4 rounded-xl bg-white border border-[#E8CFC1]">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] uppercase text-[#7A726D]">Valor total</p>
                        <p className="font-semibold">{formatBRL(preview.gross)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase text-[#7A726D]">Custo</p>
                        <p className="font-semibold">{formatBRL(preview.cost)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase text-[#7A726D]">
                          Taxa ({preview.feePct}%)
                        </p>
                        <p className="font-semibold text-[#D06B6B]">
                          {formatBRL(preview.fee)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase text-[#7A726D]">Líquido</p>
                        <p className="font-semibold">
                          {formatBRL(preview.gross - preview.fee)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase text-[#7A726D]">Lucro</p>
                        <p
                          className="font-semibold text-[#5C7053]"
                          data-testid="proc-preview-profit"
                        >
                          {formatBRL(preview.profit)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={submitProcedure}
                      data-testid="proc-submit"
                      className="bg-[#C97D63] hover:bg-[#B36B53] text-white"
                    >
                      Registrar procedimento
                    </Button>
                  </div>
                </div>
              )}

              {/* Procedure history table */}
              {patientSales.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#7A726D]">
                  Nenhum procedimento registrado ainda.
                </div>
              ) : (
                <div className="overflow-x-auto" data-testid="proc-history">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#FDFDF9] border-b border-[#EBE8E3] text-xs font-semibold uppercase text-[#7A726D]">
                        <th className="py-2 px-3 text-left">Data</th>
                        <th className="py-2 px-3 text-left">Procedimento</th>
                        <th className="py-2 px-3 text-left">Pós-venda</th>
                        <th className="py-2 px-3 text-left">Pagto</th>
                        <th className="py-2 px-3 text-right">Valor</th>
                        <th className="py-2 px-3 text-right">Lucro</th>
                        <th className="py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {patientSales.map((s) => {
                        const procName =
                          s.items?.find((i) =>
                            String(i.name).startsWith("Procedimento:")
                          )?.name?.replace("Procedimento: ", "") || s.description || "—";
                        return (
                          <tr key={s.id} className="border-b border-[#EBE8E3]">
                            <td className="py-3 px-3">{formatDate(s.sale_date)}</td>
                            <td className="py-3 px-3 font-medium">
                              {procName}
                              {s.items && s.items.length > 1 && (
                                <span className="text-[11px] text-[#7A726D] ml-1">
                                  (+{s.items.length - 1} avulso{s.items.length - 1 > 1 ? "s" : ""})
                                </span>
                              )}
                              {s.description && (
                                <div className="text-[11px] text-[#7A726D] italic mt-0.5">
                                  {s.description}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-[#C97D63] font-medium">
                              {formatDate(s.post_sale_date)}
                            </td>
                            <td className="py-3 px-3 text-xs">
                              {s.payment_method_name}
                              <div className="text-[#7A726D]">
                                taxa {s.card_fee_pct}%
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-medium">
                              {formatBRL(s.gross_value)}
                            </td>
                            <td className="py-3 px-3 text-right text-[#5C7053] font-semibold">
                              {formatBRL(s.profit)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => removeSale(s)}
                                className="p-2 rounded-lg hover:bg-[#FBE7E7] text-[#7A726D] hover:text-[#D06B6B]"
                              >
                                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
