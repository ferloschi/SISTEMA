import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

export const formatBRL = (v) => {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export const formatDate = (d) => {
  if (!d) return "—";
  try {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  } catch {
    return d;
  }
};

export const PROCEDURE_TYPES = [
  "Perfuração Baby",
  "Perfuração Piercing",
  "Lobuloplastia",
  "Aplicação de Laser",
  "Laserterapia",
  "Consulta",
  "Outros",
];

export const PRODUCT_CATEGORIES = ["Brinco", "Piercing", "Outros"];

export const INSUMO_OPTIONS = [
  "Algodão",
  "Agulha",
  "Cateter",
  "Gaze",
  "Pomada anestésica",
  "Anestésico",
  "Clorexidina 0,5%",
  "Clorexidina degermante",
  "Soro fisiológico",
  "Álcool",
  "Água destilada",
  "Luva estéril",
  "Luva de procedimento",
  "Cotonete",
  "Microbrush",
  "Campo / Babador",
  "Touca",
  "Fita micropore",
  "Fita zebrada",
  "Envelope grau cirúrgico",
  "Sabão enzimático",
  "Bicarbonato de sódio",
  "Vaselina",
  "Plástico filme",
  "Plástico para lóbulo",
  "Seringa",
  "Sacola plástica P",
  "Sacola plástica G",
  "Saco metalizado P",
  "Saco metalizado G",
  "Sacolinha transparente",
  "Caixinha",
  "Tag brinco",
  "Tag colar",
  "Ácido tricloroacético 90%",
  "Outros",
];

export const MATERIAL_OPTIONS = [
  "Ouro 18k",
  "Ouro 24k",
  "Folheado a ouro",
  "Prata 925",
  "Aço cirúrgico",
  "Titânio",
  "Aço inoxidável",
  "Niobium",
  "Banhado a ouro",
  "Banhado a prata",
  "Plástico",
  "Acrílico",
  "Bioplast",
  "Algodão",
  "Tecido",
  "Papel",
  "Metalizado",
  "Outros",
];

export const MODELO_OPTIONS = [
  "Brinco infantil",
  "Bolsa",
  "Monzi",
  "Almofada",
  "Brinco",
  "Piercing argola",
  "Piercing labret",
  "Piercing microbel",
  "Pulseira",
  "Colar",
];

export const SIZE_OPTIONS = [
  "1.2mm espessura x 10mm haste",
  "1.2mm espessura x 8mm haste",
  "1.2mm espessura x 6mm haste",
  "1.2mm espessura x 5mm haste",
  "1.2mm espessura x 4mm haste",
  "1.0mm espessura x 10mm haste",
  "1.0mm espessura x 8mm haste",
  "1.0mm espessura x 6mm haste",
  "0.8mm espessura x 10mm haste",
  "0.8mm espessura x 8mm haste",
  "0.8mm espessura x 6mm haste",
];

export const COR_OPTIONS = [
  "Dourado",
  "Prateado",
  "Rose Gold",
  "Rosa",
  "Rosa claro",
  "Vermelho",
  "Azul",
  "Azul claro",
  "Verde",
  "Roxo",
  "Lilás",
  "Preto",
  "Branco",
  "Transparente",
  "Cristal",
  "Pérola",
  "Multicolorido",
  "Outros",
];
