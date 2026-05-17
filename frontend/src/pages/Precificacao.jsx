import { useEffect, useMemo, useState } from "react";
import { api, formatBRL, PROCEDURE_TYPES } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Trash2, X, Calculator } from "lucide-react";

const emptyItem = { product_id: "", name: "", qty: 1, unit_cost: 0 };

const emptyForm = {
  name: "Perfuração Baby",
  description: "",
  items: [{ ...emptyItem }],
  indirect_cost_pct: 20,
  margin_pct: 100,
  manual_price: 0,
  active: true,
};

const computePreview = (form) => {
  const items_cost = form.items.reduce(
    (s, i) => s + Number(i.qty || 0) * Number(i.unit_cost || 0),
    0
  );
  const indirect_value = (items_cost * Number(form.indirect_cost_pct || 0)) / 100;
  const total_cost = items_cost + indirect_value;
  const margin_value = (total_cost * Number(form.margin_pct || 0)) / 100;
  const suggested_price = total_cost + margin_value;
  const manual = Number(form.manual_price || 0);
  const final_price = manual > 0 ? manual : suggested_price;
  return { items_cost, indirect_value, total_cost, margin_value, suggested_price, final_price };
};

export default function Precificacao() {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const [p, pr] = await Promise.all([
      api.get("/procedures"),
      api.get("/products"),
    ]);
    setItems(p.data);
    setProducts(pr.data);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, items: [{ ...emptyItem }] });
    setOpen(true);
  };

  const openEdit = (proc) => {
    setEditing(proc);
    setForm({
      name: proc.name,
      description: proc.description || "",
      items: proc.items && proc.items.length > 0 ? proc.items : [{ ...emptyItem }],
      indirect_cost_pct: proc.indirect_cost_pct,
      margin_pct: proc.margin_pct,
      manual_price: proc.manual_price || 0,
      active: proc.active,
    });
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
          unit_cost: pr.purchase_value,
        };
        return { ...f, items };
      });
    }
  };

  const preview = useMemo(() => computePreview(form), [form]);

  const submit = async () => {
    if (!form.name) {
      toast.error("Informe o nome do procedimento.");
      return;
    }
    const payload = {
      ...form,
      indirect_cost_pct: Number(form.indirect_cost_pct) || 0,
      margin_pct: Number(form.margin_pct) || 0,
      manual_price: Number(form.manual_price) || 0,
      items: form.items
        .filter((i) => i.name)
        .map((i) => ({
          product_id: i.product_id || "",
          name: i.name,
          qty: Number(i.qty) || 1,
          unit_cost: Number(i.unit_cost) || 0,
        })),
    };
    try {
      if (editing) {
        await api.put(`/procedures/${editing.id}`, payload);
        toast.success("Procedimento atualizado");
      } else {
        await api.post("/procedures", payload);
        toast.success("Procedimento cadastrado");
      }
      setOpen(false);
      load();
    } catch {
      toast.error("Erro ao salvar procedimento");
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Excluir procedimento "${p.name}"?`)) return;
    await api.delete(`/procedures/${p.id}`);
    toast.success("Excluído");
    load();
  };

  return (
    <div className="space-y-6" data-testid="precificacao-page">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#7A726D] max-w-2xl">
          Monte o kit de cada procedimento (joia + insumos como algodão, agulha, cateter...) e
          o sistema calcula o custo total e sugere o preço de venda usando custos indiretos e
          margem de lucro.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openNew}
              data-testid="precificacao-new-btn"
              className="bg-[#C97D63] hover:bg-[#B36B53] text-white rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Novo procedimento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">
                {editing ? "Editar procedimento" : "Novo procedimento"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome do procedimento *</Label>
                  <Select
                    value={
                      PROCEDURE_TYPES.includes(form.name) ? form.name : "_custom"
                    }
                    onValueChange={(v) =>
                      setForm({ ...form, name: v === "_custom" ? "" : v })
                    }
                  >
                    <SelectTrigger data-testid="form-proc-name-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROCEDURE_TYPES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                      <SelectItem value="_custom">— Personalizado —</SelectItem>
                    </SelectContent>
                  </Select>
                  {!PROCEDURE_TYPES.includes(form.name) && (
                    <Input
                      className="mt-2"
                      placeholder="Digite o nome do procedimento"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Itens utilizados (joia + insumos) *</Label>
                  <Button
                    type="button"
                    onClick={addItem}
                    variant="outline"
                    size="sm"
                    data-testid="proc-add-item-btn"
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
                      <div className="col-span-12 md:col-span-5">
                        <Label className="text-xs">Produto do estoque</Label>
                        <Select
                          value={it.product_id || ""}
                          onValueChange={(v) => pickProduct(idx, v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="— Selecionar produto —" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} ({formatBRL(p.purchase_value)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-7 md:col-span-3">
                        <Label className="text-xs">Descrição (livre)</Label>
                        <Input
                          value={it.name}
                          onChange={(e) => updateItem(idx, "name", e.target.value)}
                          placeholder="Ex: Algodão"
                        />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <Label className="text-xs">Qtd</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={it.qty}
                          onChange={(e) => updateItem(idx, "qty", e.target.value)}
                        />
                      </div>
                      <div className="col-span-2 md:col-span-2">
                        <Label className="text-xs">Custo unit.</Label>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Custos indiretos (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.indirect_cost_pct}
                    onChange={(e) => setForm({ ...form, indirect_cost_pct: e.target.value })}
                    data-testid="form-indirect-pct"
                  />
                  <p className="text-xs text-[#7A726D] mt-1">% sobre o custo dos itens</p>
                </div>
                <div>
                  <Label>Margem de lucro (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.margin_pct}
                    onChange={(e) => setForm({ ...form, margin_pct: e.target.value })}
                    data-testid="form-margin-pct"
                  />
                  <p className="text-xs text-[#7A726D] mt-1">% sobre custo + indiretos</p>
                </div>
                <div>
                  <Label>Preço manual (opcional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.manual_price}
                    onChange={(e) => setForm({ ...form, manual_price: e.target.value })}
                  />
                  <p className="text-xs text-[#7A726D] mt-1">
                    0 = usar preço sugerido
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
                <Label>Procedimento ativo</Label>
              </div>

              <div className="p-4 rounded-xl bg-[#F2E4DF]/40 border border-[#E8CFC1]">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] uppercase text-[#7A726D]">Custo insumos</p>
                    <p className="font-semibold">{formatBRL(preview.items_cost)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-[#7A726D]">
                      Indiretos ({form.indirect_cost_pct}%)
                    </p>
                    <p className="font-semibold">{formatBRL(preview.indirect_value)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-[#7A726D]">Custo total</p>
                    <p className="font-semibold">{formatBRL(preview.total_cost)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-[#7A726D]">
                      Margem ({form.margin_pct}%)
                    </p>
                    <p className="font-semibold text-[#5C7053]">
                      {formatBRL(preview.margin_value)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-[#7A726D]">Preço final</p>
                    <p
                      className="font-semibold text-[#C97D63] text-lg"
                      data-testid="preview-final-price"
                    >
                      {formatBRL(preview.final_price)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={submit}
                data-testid="precificacao-form-submit"
                className="bg-[#C97D63] hover:bg-[#B36B53] text-white"
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <div className="brinquinho-card p-10 text-center text-[#7A726D]">
          <Calculator
            className="w-10 h-10 mx-auto text-[#C97D63] mb-3"
            strokeWidth={1.5}
          />
          <p className="font-medium text-[#2D2825]">
            Nenhum procedimento precificado ainda.
          </p>
          <p className="text-sm mt-1">
            Cadastre seu primeiro procedimento para começar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((p) => (
            <div
              key={p.id}
              className="brinquinho-card p-6 flex flex-col"
              data-testid={`proc-card-${p.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading text-lg font-semibold text-[#2D2825]">
                      {p.name}
                    </h3>
                    {!p.active && (
                      <span className="text-xs bg-[#FBE7E7] text-[#D06B6B] px-2 py-0.5 rounded-full">
                        Inativo
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-xs text-[#7A726D] mt-1">{p.description}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
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
              </div>

              <div className="space-y-1 mb-4 flex-1">
                {p.items.length === 0 ? (
                  <p className="text-xs text-[#7A726D] italic">Sem itens cadastrados</p>
                ) : (
                  p.items.slice(0, 5).map((it, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center text-xs"
                    >
                      <span className="text-[#2D2825] truncate">
                        {it.qty}× {it.name}
                      </span>
                      <span className="text-[#7A726D] tabular-nums">
                        {formatBRL(it.qty * it.unit_cost)}
                      </span>
                    </div>
                  ))
                )}
                {p.items.length > 5 && (
                  <p className="text-[11px] text-[#7A726D] italic">
                    + {p.items.length - 5} itens
                  </p>
                )}
              </div>

              <div className="space-y-2 pt-3 border-t border-[#EBE8E3]">
                <div className="flex justify-between text-xs">
                  <span className="text-[#7A726D]">Custo insumos</span>
                  <span className="tabular-nums">{formatBRL(p.items_cost)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#7A726D]">
                    Indiretos {p.indirect_cost_pct}%
                  </span>
                  <span className="tabular-nums">{formatBRL(p.indirect_value)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#7A726D]">Custo total</span>
                  <span className="tabular-nums font-medium">
                    {formatBRL(p.total_cost)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-[#5C7053]">
                  <span>Margem {p.margin_pct}%</span>
                  <span className="tabular-nums">+{formatBRL(p.margin_value)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-[#EBE8E3]">
                  <span className="text-[11px] uppercase tracking-widest text-[#7A726D]">
                    Preço final
                  </span>
                  <span className="font-heading font-semibold text-xl text-[#C97D63]">
                    {formatBRL(p.final_price)}
                  </span>
                </div>
                {p.manual_price > 0 && (
                  <p className="text-[10px] text-[#7A726D] italic text-right">
                    (preço manual; sugerido {formatBRL(p.suggested_price)})
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
