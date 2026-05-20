import { useEffect, useState } from "react";
import { api, formatBRL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Droplet } from "lucide-react";

const emptyForm = { name: "", purchase_value: 0, notes: "" };

export default function Insumos() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const { data } = await api.get("/insumos");
    setItems(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (ins) => {
    setEditing(ins);
    setForm({ ...emptyForm, ...ins });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name) {
      toast.error("Informe o nome do insumo.");
      return;
    }
    const payload = {
      name: form.name,
      purchase_value: Number(form.purchase_value) || 0,
      notes: form.notes,
    };
    try {
      if (editing) {
        await api.put(`/insumos/${editing.id}`, payload);
        toast.success("Insumo atualizado");
      } else {
        await api.post("/insumos", payload);
        toast.success("Insumo cadastrado");
      }
      setOpen(false);
      load();
    } catch {
      toast.error("Erro ao salvar insumo");
    }
  };

  const remove = async (ins) => {
    if (!window.confirm(`Excluir insumo "${ins.name}"?`)) return;
    await api.delete(`/insumos/${ins.id}`);
    toast.success("Insumo excluído");
    load();
  };

  return (
    <div className="space-y-6" data-testid="insumos-page">
      <Card className="border-[#EBE8E3]">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="font-heading text-xl text-[#2D2825] flex items-center gap-2">
                <Droplet className="w-5 h-5 text-[#C97D63]" strokeWidth={1.5} />
                Insumos
              </CardTitle>
              <p className="text-sm text-[#7A726D] mt-1 max-w-2xl">
                Cadastre os insumos usados nos procedimentos (algodão, agulha, gaze, etc.)
                com seu valor de compra. Eles ficam disponíveis ao montar o kit dos
                procedimentos na Precificação.
              </p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={openNew}
                  data-testid="insumo-new-btn"
                  className="bg-[#C97D63] hover:bg-[#B36B53] text-white rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                  Novo insumo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-heading">
                    {editing ? "Editar insumo" : "Novo insumo"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label>Nome *</Label>
                    <Input
                      data-testid="insumo-form-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Ex: Algodão"
                    />
                  </div>
                  <div>
                    <Label>Valor de compra (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      data-testid="insumo-form-value"
                      value={form.purchase_value}
                      onChange={(e) =>
                        setForm({ ...form, purchase_value: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Input
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={submit}
                    data-testid="insumo-form-submit"
                    className="bg-[#C97D63] hover:bg-[#B36B53] text-white"
                  >
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="p-10 text-center text-[#7A726D]">
              <Droplet
                className="w-10 h-10 mx-auto text-[#C97D63] mb-3"
                strokeWidth={1.5}
              />
              <p className="font-medium text-[#2D2825]">
                Nenhum insumo cadastrado ainda.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden border border-[#EBE8E3] rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FDFDF9] border-b border-[#EBE8E3] text-xs font-semibold uppercase text-[#7A726D]">
                    <th className="py-3 px-4 text-left">Insumo</th>
                    <th className="py-3 px-4 text-right">Valor de compra</th>
                    <th className="py-3 px-4 text-left">Observações</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((ins) => (
                    <tr
                      key={ins.id}
                      className="border-b border-[#EBE8E3] hover:bg-[#FDFDF9]/60"
                      data-testid={`insumo-row-${ins.id}`}
                    >
                      <td className="py-3 px-4 font-medium text-[#2D2825]">
                        {ins.name}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {formatBRL(ins.purchase_value)}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#7A726D]">
                        {ins.notes || "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => openEdit(ins)}
                            data-testid={`insumo-edit-${ins.id}`}
                            className="p-2 rounded-lg hover:bg-[#F2E4DF] text-[#7A726D] hover:text-[#C97D63]"
                          >
                            <Pencil className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={() => remove(ins)}
                            data-testid={`insumo-delete-${ins.id}`}
                            className="p-2 rounded-lg hover:bg-[#FBE7E7] text-[#7A726D] hover:text-[#D06B6B]"
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
