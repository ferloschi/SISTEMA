import { useEffect, useMemo, useState } from "react";
import { api, formatBRL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Printer, Search, Plus, Minus, Tag } from "lucide-react";

export default function Etiquetas() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  // map: { [productId]: quantity }
  const [selected, setSelected] = useState({});

  const load = async () => {
    try {
      const { data } = await api.get("/products");
      setProducts(data || []);
    } catch (err) {
      toast.error("Erro ao carregar produtos");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.material || "").toLowerCase().includes(q) ||
        (p.modelo || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const setQty = (id, qty) => {
    setSelected((prev) => {
      const next = { ...prev };
      const n = Math.max(0, Number(qty) || 0);
      if (n === 0) delete next[id];
      else next[id] = n;
      return next;
    });
  };

  const inc = (id) => setQty(id, (selected[id] || 0) + 1);
  const dec = (id) => setQty(id, (selected[id] || 0) - 1);

  // Build a flat array of labels (one entry per copy) for printing
  const labelsToPrint = useMemo(() => {
    const arr = [];
    products.forEach((p) => {
      const q = selected[p.id] || 0;
      for (let i = 0; i < q; i++) arr.push(p);
    });
    return arr;
  }, [products, selected]);

  const totalCount = labelsToPrint.length;

  const selectAllVisible = () => {
    const next = { ...selected };
    filtered.forEach((p) => {
      if (!next[p.id]) next[p.id] = 1;
    });
    setSelected(next);
  };

  const clearAll = () => setSelected({});

  const handlePrint = () => {
    if (totalCount === 0) {
      toast.error("Selecione ao menos uma etiqueta");
      return;
    }
    window.print();
  };

  return (
    <div className="space-y-6" data-testid="etiquetas-page">
      {/* Print-only styles. Strict 95x12mm continuous roll. */}
      <style>{`
        #print-area { display: none; }
        @media print {
          @page { size: 95mm 12mm; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #print-area { display: block !important; position: absolute; left: 0; top: 0; width: 95mm; }
          #print-area, #print-area * { visibility: visible !important; }
          .print-label { page-break-after: always; break-after: page; }
          .print-label:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>

      {/* Header / Controls (hidden in print) */}
      <div className="no-print">
        <Card className="border-[#EBE8E3]">
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="font-heading text-xl text-[#2D2825] flex items-center gap-2">
                  <Tag className="w-5 h-5 text-[#C97D63]" strokeWidth={1.5} />
                  Etiquetas de Produtos
                </CardTitle>
                <p className="text-sm text-[#7A726D] mt-1">
                  Selecione os produtos e a quantidade de etiquetas. Tamanho fixo:{" "}
                  <strong>95mm × 12mm</strong> (horizontal, com aba à direita).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  data-testid="etiquetas-total-count"
                  className="text-sm text-[#2D2825] bg-[#F2E4DF] px-3 py-1.5 rounded-full"
                >
                  {totalCount} etiqueta(s)
                </span>
                <Button
                  variant="outline"
                  onClick={clearAll}
                  data-testid="etiquetas-clear-btn"
                  className="border-[#EBE8E3]"
                >
                  Limpar
                </Button>
                <Button
                  onClick={handlePrint}
                  data-testid="etiquetas-print-btn"
                  className="bg-[#C97D63] hover:bg-[#B56A52] text-white"
                >
                  <Printer className="w-4 h-4 mr-2" strokeWidth={1.5} />
                  Imprimir
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A726D]" />
                <Input
                  data-testid="etiquetas-search-input"
                  placeholder="Buscar por nome, SKU, material ou modelo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 border-[#EBE8E3]"
                />
              </div>
              <Button
                variant="outline"
                onClick={selectAllVisible}
                data-testid="etiquetas-select-all-btn"
                className="border-[#EBE8E3]"
              >
                Selecionar todos visíveis (1 cópia)
              </Button>
            </div>

            <div className="border border-[#EBE8E3] rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-[#FBF6F2] text-[11px] uppercase tracking-wider text-[#7A726D]">
                <div className="col-span-4">Produto</div>
                <div className="col-span-2">SKU</div>
                <div className="col-span-2">Material</div>
                <div className="col-span-2">Tamanho</div>
                <div className="col-span-1 text-right">Valor</div>
                <div className="col-span-1 text-center">Qtd.</div>
              </div>
              <div className="divide-y divide-[#EBE8E3] max-h-[480px] overflow-y-auto">
                {filtered.length === 0 && (
                  <div className="p-6 text-center text-sm text-[#7A726D]">
                    Nenhum produto cadastrado. Cadastre em Estoque primeiro.
                  </div>
                )}
                {filtered.map((p) => {
                  const qty = selected[p.id] || 0;
                  return (
                    <div
                      key={p.id}
                      data-testid={`etiquetas-row-${p.id}`}
                      className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-[#FDFDF9]"
                    >
                      <div className="col-span-4">
                        <div className="text-sm font-medium text-[#2D2825]">{p.name}</div>
                        <div className="text-xs text-[#7A726D]">{p.category}</div>
                      </div>
                      <div className="col-span-2 text-sm text-[#2D2825]">{p.sku || "—"}</div>
                      <div className="col-span-2 text-sm text-[#2D2825]">{p.material || "—"}</div>
                      <div className="col-span-2 text-sm text-[#2D2825]">{p.size || "—"}</div>
                      <div className="col-span-1 text-sm text-[#2D2825] text-right">
                        {formatBRL(p.sale_value)}
                      </div>
                      <div className="col-span-1 flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => dec(p.id)}
                          data-testid={`etiquetas-dec-${p.id}`}
                          className="h-7 w-7 border-[#EBE8E3]"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          value={qty}
                          onChange={(e) => setQty(p.id, e.target.value)}
                          data-testid={`etiquetas-qty-${p.id}`}
                          className="h-7 w-12 text-center px-1 border-[#EBE8E3]"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => inc(p.id)}
                          data-testid={`etiquetas-inc-${p.id}`}
                          className="h-7 w-7 border-[#EBE8E3]"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* On-screen preview */}
        {totalCount > 0 && (
          <Card className="border-[#EBE8E3] mt-6">
            <CardHeader>
              <CardTitle className="font-heading text-base text-[#2D2825]">
                Pré-visualização
              </CardTitle>
              <p className="text-xs text-[#7A726D]">
                Cada etiqueta mede exatamente 95mm × 12mm. A aba à direita exibe o SKU em vertical.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {labelsToPrint.slice(0, 12).map((p, idx) => (
                  <LabelPreview key={idx} product={p} />
                ))}
                {labelsToPrint.length > 12 && (
                  <p className="text-xs text-[#7A726D]">
                    + {labelsToPrint.length - 12} etiqueta(s) adicionais serão impressas...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Hidden print area — rendered with exact mm units */}
      <div id="print-area" aria-hidden={totalCount === 0}>
        {labelsToPrint.map((p, idx) => (
          <PrintLabel key={idx} product={p} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Label components                                                    */
/* ------------------------------------------------------------------ */

const labelBaseStyle = {
  width: "95mm",
  height: "12mm",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "row",
  background: "#fff",
  color: "#000",
  fontFamily: "Arial, Helvetica, sans-serif",
  overflow: "hidden",
};

const mainAreaStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  padding: "0.8mm 1.5mm",
  borderRight: "0.2mm dashed #000",
  minWidth: 0,
};

const flapStyle = {
  width: "13mm",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.5mm",
};

const lineStyle = {
  lineHeight: "3mm",
  fontSize: "2.4mm",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

function abbreviateMaterial(m = "") {
  return m
    .replace("Aço cirúrgico", "Aço Cir.")
    .replace("Aço inoxidável", "Aço Inox")
    .replace("Folheado a ouro", "Folh. Ouro")
    .replace("Banhado a ouro", "Banh. Ouro")
    .replace("Banhado a prata", "Banh. Prata");
}

function PrintLabel({ product }) {
  const material = abbreviateMaterial(product.material || "—");
  const size = product.size || "—";
  const sku = product.sku || "—";
  const price = formatBRL(product.sale_value);

  return (
    <div className="print-label" style={labelBaseStyle} data-testid="print-label">
      <div style={mainAreaStyle}>
        <div style={{ ...lineStyle, fontWeight: 700 }} title={material}>
          {material}
        </div>
        <div style={lineStyle} title={size}>
          {size}
        </div>
        <div style={{ ...lineStyle, fontWeight: 700 }}>{price}</div>
      </div>
      <div style={flapStyle}>
        <div
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "center",
            fontSize: "2mm",
            letterSpacing: "0.1mm",
            whiteSpace: "nowrap",
            fontWeight: 600,
          }}
        >
          {sku}
        </div>
      </div>
    </div>
  );
}

function LabelPreview({ product }) {
  // Same visual as PrintLabel, but with a border so it is visible on screen.
  const material = abbreviateMaterial(product.material || "—");
  const size = product.size || "—";
  const sku = product.sku || "—";
  const price = formatBRL(product.sale_value);

  return (
    <div
      style={{
        ...labelBaseStyle,
        border: "0.3mm solid #C97D63",
        borderRadius: "0.5mm",
      }}
      data-testid="etiquetas-preview-item"
    >
      <div style={mainAreaStyle}>
        <div style={{ ...lineStyle, fontWeight: 700 }}>{material}</div>
        <div style={lineStyle}>{size}</div>
        <div style={{ ...lineStyle, fontWeight: 700 }}>{price}</div>
      </div>
      <div style={flapStyle}>
        <div
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "center",
            fontSize: "2mm",
            letterSpacing: "0.1mm",
            whiteSpace: "nowrap",
            fontWeight: 600,
          }}
        >
          {sku}
        </div>
      </div>
    </div>
  );
}
