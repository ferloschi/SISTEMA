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
                  <strong>95mm × 12mm</strong> — 50mm com texto (duas metades de 25mm) + 45mm de cauda em branco.
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
                Cada etiqueta mede 95mm × 12mm: 50mm de área de texto (dividida em duas metades de 25mm por uma linha picotada) + 45mm de cauda em branco à direita.
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

        {/* Abbreviation legend */}
        <Card className="border-[#EBE8E3] mt-6" data-testid="etiquetas-legenda-card">
          <CardHeader>
            <CardTitle className="font-heading text-base text-[#2D2825]">
              Legenda das abreviações
            </CardTitle>
            <p className="text-xs text-[#7A726D]">
              Como o espaço da etiqueta é pequeno, material e tamanho são abreviados na impressão.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs uppercase tracking-wider text-[#7A726D] mb-2">
                  Material
                </h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {Object.entries(MATERIAL_ABBR).map(([full, abbr]) => (
                    <div
                      key={full}
                      className="flex items-baseline gap-2 text-sm"
                      data-testid={`legenda-material-${abbr}`}
                    >
                      <span className="font-mono font-semibold text-[#C97D63] min-w-[2.4rem]">
                        {abbr}
                      </span>
                      <span className="text-[#2D2825]">{full}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs uppercase tracking-wider text-[#7A726D] mb-2">
                  Tamanho
                </h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono font-semibold text-[#C97D63] min-w-[2.4rem]">E</span>
                    <span className="text-[#2D2825]">Espessura (mm)</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono font-semibold text-[#C97D63] min-w-[2.4rem]">H</span>
                    <span className="text-[#2D2825]">Haste (mm)</span>
                  </div>
                  <div className="mt-3 p-3 bg-[#FBF6F2] rounded-lg border border-[#EBE8E3]">
                    <p className="text-xs text-[#7A726D] mb-1">Exemplo</p>
                    <p className="text-sm text-[#2D2825]">
                      <span className="text-[#7A726D]">"1.2mm espessura x 8mm haste"</span>{" "}
                      →{" "}
                      <span className="font-mono font-semibold text-[#C97D63]">1.2E x 8H</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
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

// Text area on the left: 50mm wide. Split into two halves of 25mm by a
// vertical perforation line in the middle.
const textAreaStyle = {
  width: "50mm",
  height: "12mm",
  display: "flex",
  flexDirection: "row",
  boxSizing: "border-box",
};

const halfStyle = {
  width: "25mm",
  height: "12mm",
  boxSizing: "border-box",
  padding: "0.6mm 1mm",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "0.2mm",
  overflow: "hidden",
};

const perforationStyle = {
  width: 0,
  borderLeft: "0.25mm dashed #000",
  height: "12mm",
};

// Right tail: 45mm blank area (no text). Just empty space so the die-cut
// shape of the roll is respected — the printer simply prints nothing here.
const tailStyle = {
  width: "45mm",
  height: "12mm",
};

const lineStyle = {
  lineHeight: "2.6mm",
  fontSize: "2mm",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

// Material abbreviations. Codes match the user's request (T, AC...)
const MATERIAL_ABBR = {
  "Aço cirúrgico": "AC",
  "Aço inoxidável": "AI",
  "Titânio": "T",
  "Ouro 18k": "O18",
  "Ouro 24k": "O24",
  "Folheado a ouro": "FO",
  "Banhado a ouro": "BO",
  "Banhado a prata": "BP",
  "Prata 925": "P925",
  "Niobium": "N",
  "Plástico": "PL",
  "Acrílico": "AR",
  "Bioplast": "BI",
  "Algodão": "ALG",
  "Tecido": "TC",
  "Papel": "PP",
  "Metalizado": "MT",
};

function abbreviateMaterial(m = "") {
  if (!m) return "";
  if (MATERIAL_ABBR[m]) return MATERIAL_ABBR[m];
  // Fallback: take first 3 characters uppercased.
  return m.slice(0, 3).toUpperCase();
}

// Size abbreviation:
// "1.2mm espessura x 8mm haste" -> "1.2E x 8H"
function abbreviateSize(s = "") {
  if (!s) return "";
  let out = s
    .replace(/(\d+(?:[.,]\d+)?)\s*mm\s*espessura/gi, "$1E")
    .replace(/(\d+(?:[.,]\d+)?)\s*mm\s*haste/gi, "$1H")
    .replace(/\s+/g, " ")
    .trim();
  return out;
}

function LabelHalf({ product }) {
  const material = abbreviateMaterial(product.material || "");
  const size = abbreviateSize(product.size || "");
  const sku = product.sku || "";
  const price = formatBRL(product.sale_value);
  return (
    <div style={halfStyle}>
      <div style={{ ...lineStyle, fontWeight: 700 }} title={product.material}>
        {material || "—"} {size && <span style={{ fontWeight: 400 }}>{size}</span>}
      </div>
      <div style={{ ...lineStyle, fontWeight: 700 }}>{price}</div>
      <div style={{ ...lineStyle, fontSize: "1.7mm" }} title={sku}>
        {sku || "—"}
      </div>
    </div>
  );
}

function PrintLabel({ product }) {
  return (
    <div className="print-label" style={labelBaseStyle} data-testid="print-label">
      <div style={textAreaStyle}>
        <LabelHalf product={product} />
        <div style={perforationStyle} />
        <LabelHalf product={product} />
      </div>
      <div style={tailStyle} />
    </div>
  );
}

function LabelPreview({ product }) {
  // Same visual as PrintLabel, but with borders so it is visible on screen.
  return (
    <div
      style={{
        ...labelBaseStyle,
        border: "0.3mm solid #C97D63",
        borderRadius: "0.5mm",
      }}
      data-testid="etiquetas-preview-item"
    >
      <div style={{ ...textAreaStyle, borderRight: "0.3mm dashed #C97D63" }}>
        <LabelHalf product={product} />
        <div style={perforationStyle} />
        <LabelHalf product={product} />
      </div>
      <div
        style={{
          ...tailStyle,
          background:
            "repeating-linear-gradient(45deg, #FBF6F2, #FBF6F2 1mm, #F2E4DF 1mm, #F2E4DF 2mm)",
        }}
        title="Cauda em branco (não imprime)"
      />
    </div>
  );
}
