// Mensagem padrão usada como fallback quando a API de settings ainda
// não retornou. Mantida em sincronia com o backend
// (DEFAULT_WHATSAPP_TEMPLATE em server.py).
export const DEFAULT_WHATSAPP_TEMPLATE =
  "Oi, {nome}! Aqui é da Clínica Dra. Brinquinho. " +
  "Passando para saber como está a cicatrização do seu piercing feito há cerca de 45 dias. " +
  "Está tudo bem? Alguma dúvida ou incômodo? Fico à disposição.";

// Remove tudo que não é dígito para montar o número do wa.me.
export function digitsOnly(s) {
  return (s || "").replace(/\D/g, "");
}

// Substitui os placeholders {nome} e {primeiro_nome} pelo nome real da cliente.
// Se o nome estiver vazio, o placeholder some do texto (para não sobrar
// "Oi, !").
export function renderTemplate(template, name) {
  const raw = (name || "").trim();
  const first = (raw.split(" ")[0] || "").trim();
  return (template || DEFAULT_WHATSAPP_TEMPLATE)
    .replace(/\{nome\}/gi, raw || "")
    .replace(/\{primeiro_nome\}/gi, first || "")
    // Colapsa espaços duplos e vírgulas órfãs que surgem quando o nome fica vazio
    .replace(/,\s*!/g, "!")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Monta o link do wa.me com o número já normalizado e o texto renderizado.
export function whatsappLink(phone, name, template) {
  const tel = digitsOnly(phone);
  const full = tel.length === 11 ? "55" + tel : tel;
  const text = encodeURIComponent(renderTemplate(template, name));
  return `https://wa.me/${full}?text=${text}`;
}
