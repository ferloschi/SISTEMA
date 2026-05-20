import { useEffect, useState } from "react";
import {
  api,
  formatBRL,
  PRODUCT_CATEGORIES,
  MATERIAL_OPTIONS,
  MODELO_OPTIONS,
  SIZE_OPTIONS,
  COR_OPTIONS,
} from "@/lib/api";
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
import { Plus, Pencil, Trash2, Search, AlertTriangle, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";

const emptyForm = {
  sku: "",
  name: "",
  category: "Brinco",
  insumo: "",
  material: "",
  modelo: "",
  size: "",
  color: "",
  fornecedor: "",
  purchase_value: 0,
  sale_value: 0,
  stock_qty: 0,
  min_stock: 0,
  notes: "",
};

const NONE = "__none__";

const SelectOrNone = ({ value, onValueChange, options, placeholder, testid }) => (
  <Select
    value={value || NONE}
    onValueChange={(v) => onValueChange(v === NONE ? "" : v)}
  >
    <SelectTrigger data-testid={testid}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value={NONE}>— Nenhum —</SelectItem>
      {options.map((o) => (
        <SelectItem key={o} value={o}>
          {o}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export default function Estoque() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const res = await api.get("/products", { params: { q: search || undefined } });
    setItems(res.data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [search]);

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

  const submit = async () => {
    if (!form.name) {
      toast.error("Informe o nome do produto.");
      return;
    }
    const payload = {
      ...form,
      purchase_value: Number(form.purchase_value) || 0,
      sale_value: Number(form.sale_value) || 0,
      stock_qty: parseInt(form.stock_qty) || 0,
      min_stock: parseInt(form.min_stock) || 0,
    };
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, payload);
        toast.success("Produto atualizado");
      } else {
        await api.post("/products", payload);
        toast.success("Produto criado");
      }
      setOpen(false);
      load();
    } catch {
      toast.error("Erro ao salvar produto");
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Excluir "${item.name}"?`)) return;
    await api.delete(`/products/${item.id}`);
    toast.success("Produto excluído");
    load();
  };

  return (
    <div className="space-y-6" data-testid="estoque-page">
      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A726D]" />
          <Input
            data-testid="estoque-search"
            placeholder="Buscar por nome, SKU ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white border-[#EBE8E3] rounded-xl"
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openNew}
              data-testid="estoque-new-btn"
              className="bg-[#C97D63] hover:bg-[#B36B53] text-white rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Novo produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">
                {editing ? "Editar produto" : "Novo produto"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
              <div>
                <Label>SKU</Label>
                <Input
                  data-testid="form-sku"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="Auto-gerado se vazio"
                />
              </div>
              <div>
                <Label>Nome *</Label>
                <Input
                  data-testid="form-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger data-testid="form-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Material</Label>
                <SelectOrNone
                  value={form.material}
                  onValueChange={(v) => setForm({ ...form, material: v })}
                  options={MATERIAL_OPTIONS}
                  placeholder="Selecione (opcional)"
                  testid="form-material"
                />
              </div>
              <div>
                <Label>Modelo</Label>
                <SelectOrNone
                  value={form.modelo}
                  onValueChange={(v) => setForm({ ...form, modelo: v })}
                  options={MODELO_OPTIONS}
                  placeholder="Selecione (opcional)"
                  testid="form-modelo"
                />
              </div>
              <div>
                <Label>Tamanho</Label>
                <SelectOrNone
                  value={form.size}
                  onValueChange={(v) => setForm({ ...form, size: v })}
                  options={SIZE_OPTIONS}
                  placeholder="Selecione (opcional)"
                  testid="form-size"
                />
              </div>
              <div>
                <Label>Cor</Label>
                <SelectOrNone
                  value={form.color}
                  onValueChange={(v) => setForm({ ...form, color: v })}
                  options={COR_OPTIONS}
                  placeholder="Selecione (opcional)"
                  testid="form-color"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Fornecedor</Label>
                <Input
                  data-testid="form-fornecedor"
                  value={form.fornecedor}
                  onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
                  placeholder="Nome do fornecedor"
                />
              </div>
              <div>
                <Label>Valor de Compra (R$)</Label>
                <Input
                  data-testid="form-purchase"
                  type="number"
                  step="0.01"
                  value={form.purchase_value}
                  onChange={(e) => setForm({ ...form, purchase_value: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor de Venda (R$)</Label>
                <Input
                  data-testid="form-sale"
                  type="number"
                  step="0.01"
                  value={form.sale_value}
                  onChange={(e) => setForm({ ...form, sale_value: e.target.value })}
                />
              </div>
              <div>
                <Label>Quantidade em estoque</Label>
                <Input
                  data-testid="form-stock"
                  type="number"
                  value={form.stock_qty}
                  onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
                />
              </div>
              <div>
                <Label>Estoque mínimo</Label>
                <Input
                  type="number"
                  value={form.min_stock}
                  onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
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
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="form-cancel"
              >
                Cancelar
              </Button>
              <Button
                onClick={submit}
                data-testid="form-submit"
                className="bg-[#C97D63] hover:bg-[#B36B53] text-white"
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="brinquinho-card overflow-x-auto" data-testid="products-table">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#FDFDF9] border-b border-[#EBE8E3] text-xs font-semibold uppercase text-[#7A726D]">
              <th className="py-3 px-4 text-left">SKU</th>
              <th className="py-3 px-4 text-left">Nome</th>
              <th className="py-3 px-4 text-left">Categoria</th>
              <th className="py-3 px-4 text-left">Detalhes</th>
              <th className="py-3 px-4 text-right">Compra</th>
              <th className="py-3 px-4 text-right">Venda</th>
              <th className="py-3 px-4 text-right">Estoque</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-[#7A726D]">
                  Nenhum produto cadastrado.
                </td>
              </tr>
            ) : (
              items.map((p) => {
                const low = p.stock_qty <= p.min_stock;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-[#EBE8E3] hover:bg-[#FDFDF9]/60"
                    data-testid={`product-row-${p.id}`}
                  >
                    <td className="py-3 px-4 font-mono text-xs text-[#7A726D]">{p.sku}</td>
                    <td className="py-3 px-4 font-medium">{p.name}</td>
                    <td className="py-3 px-4">
                      <span className="bg-[#F2E4DF] text-[#C97D63] border border-[#E8CFC1] px-2 py-1 rounded-full text-xs font-medium">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#7A726D]">
                      {[
                        p.material,
                        p.modelo,
                        p.size,
                        p.color,
                        p.fornecedor && `Fornecedor: ${p.fornecedor}`,
                      ].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="py-3 px-4 text-right">{formatBRL(p.purchase_value)}</td>
                    <td className="py-3 px-4 text-right font-medium">
                      {formatBRL(p.sale_value)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 ${
                          low ? "text-[#D06B6B] font-semibold" : ""
                        }`}
                      >
                        {low && <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        {p.stock_qty}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          data-testid={`print-label-${p.id}`}
                          onClick={() => navigate(`/etiquetas?p=${p.id}&auto=1`)}
                          title="Imprimir etiqueta deste produto"
                          className="p-2 rounded-lg hover:bg-[#F2E4DF] text-[#7A726D] hover:text-[#C97D63]"
                        >
                          <Printer className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                        <button
                          data-testid={`edit-${p.id}`}
                          onClick={() => openEdit(p)}
                          className="p-2 rounded-lg hover:bg-[#F2E4DF] text-[#7A726D] hover:text-[#C97D63]"
                        >
                          <Pencil className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                        <button
                          data-testid={`delete-${p.id}`}
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
    </div>
  );
}
