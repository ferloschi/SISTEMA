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

const emptyItem = {
  product_id: "",
  variant_id: "",
  name: "",
  qty: 1,
  unit_price: 0,
  unit_cost: 0,
};

const emptyForm = {
  sale_date: todayISO(),
  patient_name: "",
  phone: "",
  items: [{ ...emptyItem }],
  description: "",
  payment_method_id: "",
  installments: 1,
  card_fee_pct: "",
};

export default function Vendas() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [methods, setMethods] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [monthFilter, setMonthFilter] = useState(todayISO().slice(0, 7));

  const load = async () => {
    const [s, p, pm, pr] = await Promise.all([
      api.get("/sales", { params: { month: monthFilter || undefined } }),
      api.get("/products"),
      api.get("/payment-methods"),
      api.get("/procedures"),
    ]);
    setSales(s.data);
    setProducts(p.data);
    setMethods(pm.data);
    setProcedures(pr.data);
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
    if (!pr) return;
    // Auto-pick the first variant if it's the only one; otherwise leave empty
    const onlyVariant =
      pr.variants && pr.variants.length === 1 ? pr.variants[0] : null;
    setForm((f) => {
      const items = [...f.items];
      items[idx] = {
        ...items[idx],
        product_id: pr.id,
        variant_id: onlyVariant ? onlyVariant.id : "",
        name: pr.name,
        unit_price: onlyVariant ? onlyVariant.sale_value : pr.sale_value,
        unit_cost: onlyVariant ? onlyVariant.purchase_value : pr.purchase_value,
      };
      return { ...f, items };
    });
  };

  const pickVariant = (idx, variantId) => {
    setForm((f) => {
      const items = [...f.items];
      const pr = products.find((p) => p.id === items[idx].product_id);
      const v = pr?.variants?.find((x) => x.id === variantId);
      if (v) {
        const label = [v.color, v.material].filter(Boolean).join(" / ");
        items[idx] = {
          ...items[idx],
          variant_id: v.id,
          name: label ? `${pr.name} — ${label}` : pr.name,
          unit_price: v.sale_value,
          unit_cost: v.purchase_value,
        };
      }
      return { ...f, items };
    });
  };

  const pickProcedure = (id) => {
    const pr = procedures.find((p) => p.id === id);
    if (!pr) return;
    // Map procedure items into sale items. Use final_price split or per-item price.
    // Strategy: keep each procedure item as a sale line with cost from procedure
    // and unit_price = 0 except first item which carries the total price.
    // Simpler: one combined line with name "Procedimento: X" + the kit items
    // We use a transparent approach: each kit item appears as a line with cost,
    // and unit_price = 0; then add one line "Procedimento {name}" with the final_price.
    const kitLines = pr.items.map((it) => ({
      product_id: it.product_id || "",
      name: it.name,
      qty: Number(it.qty) || 1,
      unit_price: 0,
      unit_cost: Number(it.unit_cost) || 0,
    }));
    kitLines.push({
      product_id: "",
      name: `Procedimento: ${pr.name}`,
      qty: 1,
      unit_price: Number(pr.final_price) || 0,
      unit_cost: 0,
    });
    setForm((f) => ({
      ...f,
      items: kitLines,
      description: f.description || pr.name,
    }));
    toast.success(`Kit "${pr.name}" carregado`);
  };

  const livePreview = useMemo(() => {
    const pm = methods.find((m) => m.id === form.payment_method_id);
    // Manual fee % takes precedence; otherwise use the method's default
    const manualFee = form.card_fee_pct;
    const feePct =
      manualFee !== "" && manualFee !== null && manualFee !== undefined
        ? Number(manualFee) || 0
        : pm && pm.is_card
        ? pm.card_fee_pct
        : 0;
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

  // When user picks a payment method, pre-fill the fee % with its default
  // so they can quickly tweak it for this specific sale.
  const onPickMethod = (id) => {
    const pm = methods.find((m) => m.id === id);
    setForm((f) => ({
      ...f,
      payment_method_id: id,
      card_fee_pct: pm && pm.is_card ? String(pm.card_fee_pct) : "0",
    }));
  };

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
      card_fee_pct:
        form.card_fee_pct === "" || form.card_fee_pct === null
          ? null
          : Number(form.card_fee_pct),
      items: form.items
        .filter((i) => i.name)
        .map((i) => ({
          product_id: i.product_id || "",
          variant_id: i.variant_id || "",
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
                <div>
                  <Label>Nome do paciente *</Label>
                  <Input
                    value={form.patient_name}
                    onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
                    placeholder="Nome completo"
                    data-testid="form-patient-name"
                  />
                </div>
                <div>
                  <Label>Contato (telefone)</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                    data-testid="form-phone"
                  />
                </div>
                <div>
                  <Label>Forma de pagamento *</Label>
                  <Select
                    value={form.payment_method_id}
                    onValueChange={onPickMethod}
                  >
                    <SelectTrigger data-testid="form-payment-method">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {methods
                        .filter((m) => m.active)
                        .map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} {m.is_card ? `(padrão ${m.card_fee_pct}%)` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {(() => {
                  const pm = methods.find((m) => m.id === form.payment_method_id);
                  const isCard =
                    pm && (pm.is_card || /crédito|credito/i.test(pm.name || ""));
                  if (!isCard) return null;
                  return (
                    <>
                      <div>
                        <Label>Parcelas</Label>
                        <Select
                          value={String(form.installments || 1)}
                          onValueChange={(v) =>
                            setForm({ ...form, installments: parseInt(v) || 1 })
                          }
                        >
                          <SelectTrigger data-testid="form-installments">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1× à vista</SelectItem>
                            <SelectItem value="2">2×</SelectItem>
                            <SelectItem value="3">3×</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Taxa do cartão (%) — editável</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Ex: 3.99"
                          value={form.card_fee_pct}
                          onChange={(e) =>
                            setForm({ ...form, card_fee_pct: e.target.value })
                          }
                          data-testid="form-card-fee-pct"
                        />
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="p-3 rounded-xl bg-[#F2E4DF]/30 border border-dashed border-[#E8CFC1]">
                <Label className="text-[#C97D63]">
                  Carregar kit de procedimento (opcional)
                </Label>
                <Select onValueChange={pickProcedure}>
                  <SelectTrigger data-testid="form-procedure-picker" className="mt-1 bg-white">
                    <SelectValue placeholder="— Selecione um procedimento pré-precificado —" />
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
                <p className="text-xs text-[#7A726D] mt-1">
                  Os insumos (algodão, agulha etc.) serão adicionados como itens com seus
                  custos. Você pode editar tudo antes de salvar.
                </p>
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
                      <div className="col-span-12 md:col-span-3">
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
                                {p.name}
                                {p.variants?.length > 1
                                  ? ` (${p.variants.length} variantes)`
                                  : ` (${formatBRL(p.sale_value)})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {(() => {
                        const pr = products.find((p) => p.id === it.product_id);
                        if (!pr || !pr.variants || pr.variants.length <= 1) return null;
                        return (
                          <div className="col-span-12 md:col-span-2">
                            <Label className="text-xs text-[#C97D63]">Variante *</Label>
                            <Select
                              value={it.variant_id || ""}
                              onValueChange={(v) => pickVariant(idx, v)}
                            >
                              <SelectTrigger data-testid={`form-variant-${idx}`}>
                                <SelectValue placeholder="Selecionar" />
                              </SelectTrigger>
                              <SelectContent>
                                {pr.variants.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {[v.color, v.material].filter(Boolean).join(" / ") ||
                                      "sem detalhes"}{" "}
                                    · {formatBRL(v.sale_value)} · est. {v.stock_qty}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })()}
                      <div className="col-span-12 md:col-span-2">
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
                        <Label className="text-xs flex items-center gap-1">
                          Custo
                          {it.product_id && (
                            <span
                              className="text-[10px] text-[#5C7053]"
                              title="Puxado automaticamente do estoque"
                            >
                              auto
                            </span>
                          )}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={it.unit_cost}
                          onChange={(e) => updateItem(idx, "unit_cost", e.target.value)}
                          className={it.product_id ? "bg-[#E4EDDF]/30" : ""}
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
                    {s.phone && (
                      <div className="text-xs text-[#7A726D]">{s.phone}</div>
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
