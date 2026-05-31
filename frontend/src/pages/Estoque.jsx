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
import { Plus, Pencil, Trash2, Search, AlertTriangle, Printer, Upload, Image as ImageIcon, X } from "lucide-react";
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
  photo: "",
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
  const [photoDragOver, setPhotoDragOver] = useState(false);
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

  /**
   * Read a File, resize to max 400px (long edge) and compress to JPEG,
   * trying decreasing quality until under ~180KB base64.
   * Sets form.photo with the resulting data URL.
   */
  const handlePhotoChange = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem (JPG ou PNG).");
      return;
    }
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = dataUrl;
      });
      const MAX_SIDE = 400;
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      let q = 0.9;
      let out = canvas.toDataURL("image/jpeg", q);
      // Aim for <= 180KB base64 string (server limit is ~200KB)
      while (out.length > 180_000 && q > 0.4) {
        q -= 0.1;
        out = canvas.toDataURL("image/jpeg", q);
      }
      if (out.length > 200_000) {
        toast.error("Imagem muito grande mesmo após compressão. Use uma menor.");
        return;
      }
      setForm((prev) => ({ ...prev, photo: out }));
    } catch (err) {
      toast.error("Não foi possível processar a imagem.");
    }
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
                <Label>Foto do produto (opcional)</Label>
                <div
                  onPaste={(e) => {
                    const item = Array.from(e.clipboardData?.items || []).find(
                      (i) => i.type.startsWith("image/")
                    );
                    if (item) {
                      e.preventDefault();
                      handlePhotoChange(item.getAsFile());
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setPhotoDragOver(true);
                  }}
                  onDragLeave={() => setPhotoDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setPhotoDragOver(false);
                    const file = e.dataTransfer?.files?.[0];
                    if (file) handlePhotoChange(file);
                  }}
                  tabIndex={0}
                  data-testid="form-photo-dropzone"
                  className={`flex items-center gap-3 mt-1 p-3 rounded-lg border-2 border-dashed transition-colors outline-none ${
                    photoDragOver
                      ? "border-[#C97D63] bg-[#F2E4DF]"
                      : "border-transparent focus:border-[#E8CFC1]"
                  }`}
                >
                  {form.photo ? (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#EBE8E3] bg-white shrink-0">
                      <img
                        src={form.photo}
                        alt="Pré-visualização"
                        className="w-full h-full object-cover"
                        data-testid="form-photo-preview"
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, photo: "" })}
                        data-testid="form-photo-remove"
                        title="Remover foto"
                        className="absolute top-0 right-0 m-0.5 p-0.5 rounded-full bg-white/90 hover:bg-white text-[#D06B6B] shadow"
                      >
                        <X className="w-3 h-3" strokeWidth={2} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-lg border border-dashed border-[#E8CFC1] bg-[#FBF6F2] flex items-center justify-center text-[#C97D63] shrink-0">
                      <ImageIcon className="w-6 h-6" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="flex-1">
                    <label
                      htmlFor="product-photo-input"
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[#EBE8E3] bg-white text-[#2D2825] hover:bg-[#FBF6F2] cursor-pointer"
                      data-testid="form-photo-trigger"
                    >
                      <Upload className="w-4 h-4" strokeWidth={1.5} />
                      {form.photo ? "Trocar foto" : "Enviar foto"}
                    </label>
                    <input
                      id="product-photo-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      data-testid="form-photo-input"
                      onChange={(e) => handlePhotoChange(e.target.files?.[0])}
                    />
                    <p className="text-[11px] text-[#7A726D] mt-1">
                      Você também pode <strong>arrastar e soltar</strong> uma imagem aqui ou{" "}
                      <strong>colar (Ctrl+V)</strong> da área de transferência.
                    </p>
                    <p className="text-[11px] text-[#7A726D] mt-0.5">
                      Recomendado: JPG ou PNG quadrado. Será reduzido automaticamente (máx. 200KB).
                    </p>
                  </div>
                </div>
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

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {items.length === 0 ? (
          <div className="brinquinho-card p-10 text-center text-[#7A726D]">
            Nenhum produto cadastrado.
          </div>
        ) : (
          items.map((p) => {
            const low = p.stock_qty <= p.min_stock;
            return (
              <div
                key={p.id}
                data-testid={`product-card-${p.id}`}
                className="brinquinho-card p-4"
              >
                <div className="flex items-start gap-3">
                  {p.photo ? (
                    <img
                      src={p.photo}
                      alt={p.name}
                      className="w-16 h-16 rounded-md object-cover border border-[#EBE8E3] shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-md border border-dashed border-[#EBE8E3] bg-[#FBF6F2] flex items-center justify-center text-[#C97D63] shrink-0">
                      <ImageIcon className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[10px] text-[#7A726D]">{p.sku}</p>
                    <p className="font-medium text-[#2D2825] break-words">{p.name}</p>
                    <span className="inline-block mt-1 bg-[#F2E4DF] text-[#C97D63] border border-[#E8CFC1] px-2 py-0.5 rounded-full text-[11px] font-medium">
                      {p.category}
                    </span>
                  </div>
                </div>
                {(p.material || p.modelo || p.size || p.color || p.fornecedor) && (
                  <p className="text-xs text-[#7A726D] mt-3 break-words">
                    {[
                      p.material,
                      p.modelo,
                      p.size,
                      p.color,
                      p.fornecedor && `Fornecedor: ${p.fornecedor}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#7A726D]">Compra</p>
                    <p className="font-medium text-[#2D2825]">{formatBRL(p.purchase_value)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#7A726D]">Venda</p>
                    <p className="font-medium text-[#C97D63]">{formatBRL(p.sale_value)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#7A726D]">Estoque</p>
                    <p className={`font-medium ${low ? "text-[#D06B6B]" : "text-[#2D2825]"}`}>
                      {low && (
                        <AlertTriangle
                          className="inline w-3 h-3 mr-1 -mt-0.5"
                          strokeWidth={1.5}
                        />
                      )}
                      {p.stock_qty}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-[#EBE8E3]">
                  <button
                    onClick={() => navigate(`/etiquetas?p=${p.id}&auto=1`)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg border border-[#EBE8E3] text-[#7A726D] hover:text-[#C97D63] hover:bg-[#F2E4DF]"
                  >
                    <Printer className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Etiqueta
                  </button>
                  <button
                    onClick={() => openEdit(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg border border-[#EBE8E3] text-[#7A726D] hover:text-[#C97D63] hover:bg-[#F2E4DF]"
                  >
                    <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Editar
                  </button>
                  <button
                    onClick={() => remove(p)}
                    className="p-2 rounded-lg border border-[#EBE8E3] text-[#7A726D] hover:text-[#D06B6B] hover:bg-[#FBE7E7]"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop table */}
      <div
        className="hidden md:block brinquinho-card overflow-x-auto"
        data-testid="products-table"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#FDFDF9] border-b border-[#EBE8E3] text-xs font-semibold uppercase text-[#7A726D]">
              <th className="py-3 px-4 text-left w-14">Foto</th>
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
                <td colSpan={9} className="py-10 text-center text-[#7A726D]">
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
                    <td className="py-2 px-4">
                      {p.photo ? (
                        <img
                          src={p.photo}
                          alt={p.name}
                          data-testid={`product-photo-${p.id}`}
                          className="w-10 h-10 rounded-md object-cover border border-[#EBE8E3]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md border border-dashed border-[#EBE8E3] bg-[#FBF6F2] flex items-center justify-center text-[#C97D63]">
                          <ImageIcon className="w-4 h-4" strokeWidth={1.5} />
                        </div>
                      )}
                    </td>
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
