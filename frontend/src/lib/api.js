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

export const PRODUCT_CATEGORIES = [
  "Brinco",
  "Piercing",
  "Material",
  "Insumo",
  "Procedimento",
  "Embalagem",
  "Outros",
];
