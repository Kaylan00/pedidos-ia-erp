export function soDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

function digito(base: string): number {
  const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = base.split("").reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Valida CNPJ numérico pelos dois dígitos verificadores. */
export function cnpjValido(v: string | null | undefined): boolean {
  if (!v) return false;
  const d = soDigitos(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const d1 = digito(d.slice(0, 12));
  const d2 = digito(d.slice(0, 12) + d1);
  return d.endsWith(`${d1}${d2}`);
}

export function formatarCnpj(v: string): string {
  const d = soDigitos(v);
  if (d.length !== 14) return v;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Gera os dígitos verificadores para uma base de 12 dígitos (usado nos dados de exemplo). */
export function completarCnpj(base12: string): string {
  const d1 = digito(base12);
  const d2 = digito(base12 + d1);
  return formatarCnpj(base12 + d1 + d2);
}
