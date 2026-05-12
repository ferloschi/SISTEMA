import { useEffect, useMemo, useState } from "react";
import { api, formatBRL, formatDate } from "@/lib/api";
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
import { Plus, Trash2, X } from "lucide-react";

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyItem = { product_id: "", name: "", qty: 1, unit_price: 0, unit_cost: 0 };

const emptyForm = {
  sale_date: todayISO(),
  patient_id: "",
  patient_name: "",
  child_name: "",
  items: [{ ...emptyItem }],
  description: "",
  payment_method_id: "",
};

export default function Vendas() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [methods, setMethods] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [monthFilter, setMonthFilter] = useState(todayISO().slice(0, 7));

  const load = async () => {
    const [s, p, pat, pm] = await Promise.all([
      api.get("/sales", { params: { month: monthFilter || undefined } }),
      api.get("/products"),
      api.get("/patients"),
      api.get("/payment-methods"),
    ]);
    setSales(s.data);
    setProducts(p.data);
    setPatients(pat.data);
    setMethods(pm.data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [monthFilter]);

  const totals = useMemo(() => {
    return sales.reduce(
      (acc, s) => {
        acc.gross += s.gross_value;
        acc.profit += s.profit;
        acc.fees += s.fee_amount;
        return acc;
      },
      { gross: 0, profit: 0, fees: 0 }
    );
  }, [sales]);

  const openNew = () => {
    setForm({ ...emptyForm, sale_date: todayISO(), items: [{ ...emptyItem }] });
    setOpen(true);
  };

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { ...emptyItem }] }));
  const removeItem = (idx) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const updateItem = (idx, field, value) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const pickProduct = (idx, productId) => {
    const pr = products.find((p) => p.id === productId);
    if (pr) {
      setForm((f) => {
        const items = [...f.items];
        items[idx] = {
          ...items[idx],
          product_id: pr.id,
          name: pr.name,
          unit_price: pr.sale_value,
          unit_cost: pr.purchase_value,
        };
        return { ...f, items };
      });
    }
  };

  const pickPatient = (id) => {
    const pt = patients.find((p) => p.id === id);
    if (pt) {
      setForm((f) => ({
        ...f,
        patient_id: pt.id,
        patient_name: pt.parent_name,
        child_name: pt.child_name || "",
      }));
    }
  };

  const livePreview = useMemo(() => {
    const pm = methods.find((m) => m.id === form.payment_method_id);
    const feePct = pm && pm.is_card ? pm.card_fee_pct : 0;
    const gross = form.items.reduce(
      (s, i) => s + Number(i.qty || 0) * Number(i.unit_price || 0),
      0
    );
    const cost = form.items.reduce(
      (s, i) => s + Number(i.qty || 0) * Number(i.unit_cost || 0),
      0
    );
    const fee = (gross * feePct) / 100;
    return {
      gross,
      cost,
      fee,
      net: gross - fee,
      profit: gross - cost - fee,
      feePct,
    };
  }, [form, methods]);

  const submit = async () => {
    if (!form.payment_method_id) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    if (form.items.length === 0 || !form.items.some((i) => i.name && i.qty > 0)) {
      toast.error("Adicione ao menos um item.");
      return;
    }
    const payload = {
      ...form,
      items: form.items
        .filter((i) => i.name)
        .map((i) => ({
          product_id: i.product_id || "",
          name: i.name,
          qty: parseInt(i.qty) || 1,
          unit_price: Number(i.unit_price) || 0,
          unit_cost: Number(i.unit_cost) || 0,
        })),
    };
    try {
      await api.post("/sales", payload);
      toast.success("Venda registrada");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro ao salvar venda");
    }
  };

  const remove = async (s) => {
    if (!window.confirm("Excluir esta venda? O estoque será restaurado.")) return;
    await api.delete(`/sales/${s.id}`);
    toast.success("Venda excluída");
    load();
  };

  return (
    <div className="space-y-6" data-testid="vendas-page">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="brinquinho-card p-4">
          <Label className="text-[11px] uppercase tracking-widest text-[#7A726D]">
            Mês
          </Label>
          <Input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="mt-1"
            data-testid="vendas-month-filter"
          />
        </div>
        <div className="brinquinho-card p-4">
          <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Bruto</p>
          <p className="stat-number text-2xl mt-1">{formatBRL(totals.gross)}</p>
        </div>
        <div className="brinquinho-card p-4">
          <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">Lucro</p>
          <p className="stat-number text-2xl mt-1 text-[#5C7053]">{formatBRL(totals.profit)}</p>
        </div>
        <div className="brinquinho-card p-4">
          <p className="text-[11px] uppercase tracking-widest text-[#7A726D]">
            Taxas de cartão
          </p>
          <p className="stat-number text-2xl mt-1 text-[#D06B6B]">{formatBRL(totals.fees)}</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-heading text-lg font-semibold">Vendas — {monthFilter}</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openNew}
              data-testid="vendas-new-btn"
              className="bg-[#C97D63] hover:bg-[#B36B53] text-white rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Nova venda
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">Nova venda</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Data da venda *</Label>
                  <Input
                    type="date"
                    value={form.sale_date}
                    onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
                    data-testid="form-sale-date"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Paciente</Label>
                  <Select onValueChange={pickPatient}>
                    <SelectTrigger>
                      <SelectValue placeholder="— Selecionar (opcional) —" />
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
                  <Label>Nome do cliente</Label>
                  <Input
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
                  <Label>Forma de pagamento *</Label>
                  <Select
                    value={form.payment_method_id}
                    onValueChange={(v) => setForm({ ...form, payment_method_id: v })}
                  >
                    <SelectTrigger data-testid="form-payment-method">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {methods
                        .filter((m) => m.active)
                        .map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} {m.is_card ? `(${m.card_fee_pct}%)` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Itens *</Label>
                  <Button
                    type="button"
                    onClick={addItem}
                    variant="outline"
                    size="sm"
                    data-testid="add-item-btn"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Adicionar item
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl bg-[#FDFDF9] border border-[#EBE8E3]"
                    >
                      <div className="col-span-12 md:col-span-4">
                        <Label className="text-xs">Produto (opcional)</Label>
                        <Select
                          value={it.product_id || ""}
                          onValueChange={(v) => pickProduct(idx, v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="— Avulso —" />
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
                      <div className="col-span-12 md:col-span-3">
                        <Label className="text-xs">Descrição</Label>
                        <Input
                          value={it.name}
                          onChange={(e) => updateItem(idx, "name", e.target.value)}
                        />
                      </div>
                      <div className="col-span-3 md:col-span-1">
                        <Label className="text-xs">Qtd</Label>
                        <Input
                          type="number"
                          min="1"
                          value={it.qty}
                          onChange={(e) => updateItem(idx, "qty", e.target.value)}
                        />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Label className="text-xs">Preço unit.</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={it.unit_price}
                          onChange={(e) => updateItem(idx, "unit_price", e.target.value)}
                        />
                      </div>
                      <div className="col-span-4 md:col-span-1">
                        <Label className="text-xs">Custo</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={it.unit_cost}
                          onChange={(e) => updateItem(idx, "unit_cost", e.target.value)}
                        />
                      </div>
                      <div className="col-span-1 flex items-end justify-end">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-2 rounded-lg hover:bg-[#FBE7E7] text-[#7A726D] hover:text-[#D06B6B]"
                        >
                          <X className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Descrição da compra</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 rounded-xl bg-[#F2E4DF]/40 border border-[#E8CFC1]">
                <div>
                  <p className="text-[11px] uppercase text-[#7A726D]">Bruto</p>
                  <p className="font-semibold">{formatBRL(livePreview.gross)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-[#7A726D]">Custo</p>
                  <p className="font-semibold">{formatBRL(livePreview.cost)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-[#7A726D]">
                    Taxa ({livePreview.feePct}%)
                  </p>
                  <p className="font-semibold text-[#D06B6B]">{formatBRL(livePreview.fee)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-[#7A726D]">Líquido</p>
                  <p className="font-semibold">{formatBRL(livePreview.net)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-[#7A726D]">Lucro</p>
                  <p className="font-semibold text-[#5C7053]" data-testid="preview-profit">
                    {formatBRL(livePreview.profit)}
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={submit}
                data-testid="vendas-form-submit"
                className="bg-[#C97D63] hover:bg-[#B36B53] text-white"
              >
                Registrar venda
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="brinquinho-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#FDFDF9] border-b border-[#EBE8E3] text-xs font-semibold uppercase text-[#7A726D]">
              <th className="py-3 px-4 text-left">Data</th>
              <th className="py-3 px-4 text-left">Cliente</th>
              <th className="py-3 px-4 text-left">Descrição</th>
              <th className="py-3 px-4 text-left">Pagamento</th>
              <th className="py-3 px-4 text-right">Bruto</th>
              <th className="py-3 px-4 text-right">Taxa</th>
              <th className="py-3 px-4 text-right">Lucro</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-[#7A726D]">
                  Nenhuma venda neste mês.
                </td>
              </tr>
            ) : (
              sales.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-[#EBE8E3] hover:bg-[#FDFDF9]/60"
                  data-testid={`sale-row-${s.id}`}
                >
                  <td className="py-3 px-4">{formatDate(s.sale_date)}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium">{s.patient_name || "—"}</div>
                    {s.child_name && (
                      <div className="text-xs text-[#7A726D]">{s.child_name}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-[#7A726D]">
                    {s.items.map((i) => `${i.qty}x ${i.name}`).join(", ") || s.description}
                  </td>
                  <td className="py-3 px-4">
                    <span className="bg-[#F2E4DF] text-[#C97D63] border border-[#E8CFC1] px-2 py-1 rounded-full text-xs">
                      {s.payment_method_name}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatBRL(s.gross_value)}
                  </td>
                  <td className="py-3 px-4 text-right text-[#D06B6B]">
                    {formatBRL(s.fee_amount)}
                  </td>
                  <td className="py-3 px-4 text-right text-[#5C7053] font-semibold">
                    {formatBRL(s.profit)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => remove(s)}
                      className="p-2 rounded-lg hover:bg-[#FBE7E7] text-[#7A726D] hover:text-[#D06B6B]"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
