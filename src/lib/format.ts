const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });

export const reais = (v: number | null | undefined) => (v == null ? "-" : brl.format(v));
export const dolares = (v: number) => usd.format(v);
/** 38.9 vira "38,90", como aparece num pedido. */
export const numeroBRFixo = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const dataBR = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};
export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
export const pct = (v: number) => `${Math.round(v * 100)}%`;
