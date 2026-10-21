import { describe, expect, it } from "vitest";
import { cnpjValido, completarCnpj, formatarCnpj, soDigitos } from "@/lib/cnpj";

describe("CNPJ", () => {
  it("aceita CNPJ com dígitos corretos, com ou sem máscara", () => {
    expect(cnpjValido("12.345.678/0001-95")).toBe(true);
    expect(cnpjValido("12345678000195")).toBe(true);
  });

  it("aceita CNPJs reais conhecidos", () => {
    // Banco do Brasil e Petrobras, públicos.
    expect(cnpjValido("00.000.000/0001-91")).toBe(true);
    expect(cnpjValido("33.000.167/0001-01")).toBe(true);
  });

  it("recusa quando o dígito verificador não confere", () => {
    expect(cnpjValido("12.345.678/0001-96")).toBe(false);
    expect(cnpjValido("45.678.123/0001-41")).toBe(false);
  });

  it("recusa sequências repetidas, tamanho errado e vazio", () => {
    expect(cnpjValido("11.111.111/1111-11")).toBe(false);
    expect(cnpjValido("1234567800019")).toBe(false);
    expect(cnpjValido("")).toBe(false);
    expect(cnpjValido(null)).toBe(false);
  });

  it("formata e limpa", () => {
    expect(soDigitos("12.345.678/0001-95")).toBe("12345678000195");
    expect(formatarCnpj("12345678000195")).toBe("12.345.678/0001-95");
    expect(formatarCnpj("123")).toBe("123");
  });

  it("completa os dígitos verificadores de uma base", () => {
    const gerado = completarCnpj("456781230001");
    expect(gerado).toBe("45.678.123/0001-14");
    expect(cnpjValido(gerado)).toBe(true);
  });
});
