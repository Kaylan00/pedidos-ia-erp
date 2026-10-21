"use client";

import { useMemo, useState } from "react";
import { chamar, lembrar } from "@/lib/cliente-api";
import type { Motivo } from "@/lib/confidence";
import { reais } from "@/lib/format";
import { aparece, segmentar, trechosDoPedido } from "@/lib/highlight";
import type { Lancamento, PedidoRegistro } from "@/lib/repo/types";
import { type Pedido, totalPedido } from "@/lib/schema";

type ItemRascunho = { sku: string; descricao: string; quantidade: string; unidade: string; preco: string };
type Rascunho = {
  razao_social: string;
  cnpj: string;
  email: string;
  itens: ItemRascunho[];
  frete_modalidade: string;
  frete_valor: string;
  condicao: string;
  forma: string;
  data_entrega: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  total: string;
  observacoes: string;
};

const s = (v: string | number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));
const t = (v: string | null | undefined) => v ?? "";
const dinheiro = (v: number | null | undefined) => (v == null ? "" : v.toFixed(2).replace(".", ","));

function paraRascunho(p: Pedido | null): Rascunho {
  const e = p?.endereco_entrega;
  return {
    razao_social: t(p?.cliente.razao_social),
    cnpj: t(p?.cliente.cnpj),
    email: t(p?.cliente.email),
    itens: (p?.itens ?? []).map((i) => ({
      sku: t(i.sku),
      descricao: i.descricao,
      quantidade: s(i.quantidade),
      unidade: i.unidade,
      preco: dinheiro(i.preco_unitario),
    })),
    frete_modalidade: t(p?.frete.modalidade),
    frete_valor: dinheiro(p?.frete.valor),
    condicao: t(p?.pagamento.condicao),
    forma: t(p?.pagamento.forma),
    data_entrega: t(p?.data_entrega),
    logradouro: t(e?.logradouro),
    numero: t(e?.numero),
    bairro: t(e?.bairro),
    cidade: t(e?.cidade),
    uf: t(e?.uf),
    cep: t(e?.cep),
    total: dinheiro(p?.total_declarado),
    observacoes: t(p?.observacoes),
  };
}

const nulo = (v: string) => (v.trim() === "" ? null : v.trim());
function numero(v: string): number | null {
  const x = v.trim();
  if (!x) return null;
  const n = x.includes(",") ? Number(x.replace(/\./g, "").replace(",", ".")) : Number(x);
  return Number.isFinite(n) ? n : NaN;
}

function paraPedido(r: Rascunho): Pedido {
  const temEndereco = [r.logradouro, r.numero, r.bairro, r.cidade, r.uf, r.cep].some((v) => v.trim());
  return {
    cliente: { razao_social: nulo(r.razao_social), cnpj: nulo(r.cnpj), email: nulo(r.email) },
    itens: r.itens.map((i) => ({
      sku: nulo(i.sku),
      descricao: i.descricao.trim(),
      quantidade: numero(i.quantidade) ?? 0,
      unidade: i.unidade.trim().toUpperCase() || "UN",
      preco_unitario: numero(i.preco),
    })),
    frete: { modalidade: (nulo(r.frete_modalidade) as "CIF" | "FOB" | null) ?? null, valor: numero(r.frete_valor) },
    pagamento: { condicao: nulo(r.condicao), forma: nulo(r.forma) },
    data_entrega: nulo(r.data_entrega),
    endereco_entrega: temEndereco
      ? {
          logradouro: nulo(r.logradouro),
          numero: nulo(r.numero),
          bairro: nulo(r.bairro),
          cidade: nulo(r.cidade),
          uf: nulo(r.uf)?.toUpperCase() ?? null,
          cep: nulo(r.cep),
        }
      : null,
    total_declarado: numero(r.total),
    observacoes: nulo(r.observacoes),
  };
}

const json = (corpo: unknown, method: string): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(corpo),
});

interface Props {
  registro: PedidoRegistro;
  lancamento: Lancamento | null;
  limiar: number;
  onAtualizado: (mensagem: string) => void;
}

export function Revisao({ registro, lancamento, limiar, onAtualizado }: Props) {
  const [rascunho, setRascunho] = useState(() => paraRascunho(registro.pedido));
  const [ativo, setAtivo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const lancado = registro.status === "lancado";
  const atual = useMemo(() => paraPedido(rascunho), [rascunho]);
  const trechos = useMemo(() => trechosDoPedido(atual), [atual]);
  const segmentos = useMemo(() => segmentar(registro.texto_original, trechos), [registro.texto_original, trechos]);
  const ausentes = useMemo(
    () => new Set(trechos.filter((x) => !aparece(registro.texto_original, x.valor)).map((x) => x.campo)),
    [trechos, registro.texto_original],
  );
  const motivosPorCampo = useMemo(() => {
    const m = new Map<string, Motivo[]>();
    for (const mo of registro.motivos) m.set(mo.campo, [...(m.get(mo.campo) ?? []), mo]);
    return m;
  }, [registro.motivos]);

  const set = (k: keyof Rascunho) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setRascunho((r) => ({ ...r, [k]: e.target.value }));
  const setItem = (i: number, k: keyof ItemRascunho) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRascunho((r) => ({ ...r, itens: r.itens.map((it, n) => (n === i ? { ...it, [k]: e.target.value } : it)) }));

  const props = (campo: string) => ({
    onFocus: () => setAtivo(campo),
    onBlur: () => setAtivo(null),
    "aria-invalid": motivosPorCampo.has(campo) || undefined,
    disabled: lancado,
  });

  async function acao(aprovar: boolean) {
    setOcupado(true);
    setMsg(null);
    try {
      const resp = aprovar
        ? await chamar(`/api/pedidos/${registro.id}/aprovar`, json({ pedido: atual }, "POST"), registro.id)
        : await chamar(`/api/pedidos/${registro.id}`, json({ pedido: atual }, "PATCH"), registro.id);
      const corpo = await resp.json().catch(() => null);
      if (!resp.ok) {
        setMsg({ tipo: "erro", texto: corpo?.erro ?? `erro ${resp.status}` });
        return;
      }
      lembrar(corpo.pedido, corpo.lancamento);
      if (!aprovar) onAtualizado("Correção salva e confiança recalculada.");
      else onAtualizado(corpo.duplicado ? "Este pedido já tinha sido lançado; nada foi enviado de novo." : "Pedido lançado.");
    } finally {
      setOcupado(false);
    }
  }

  const Rotulo = ({ campo, children }: { campo: string; children: React.ReactNode }) => (
    <span className="mb-0.5 flex items-baseline gap-2 text-suave">
      {children}
      {ausentes.has(campo) && <span className="text-xs text-alerta">não está no texto</span>}
    </span>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="lg:sticky lg:top-4 lg:self-start">
        <h2 className="mb-2 font-semibold">Texto original</h2>
        <pre className="max-h-[75vh] overflow-auto whitespace-pre-wrap border border-fio bg-white p-4 font-mono text-[12.5px] leading-relaxed">
          {segmentos.map((sg, i) =>
            sg.campo ? (
              <mark key={i} data-ativo={ativo === sg.campo} title={sg.campo}>
                {sg.texto}
              </mark>
            ) : (
              <span key={i}>{sg.texto}</span>
            ),
          )}
        </pre>
        <p className="mt-2 text-xs text-suave">
          Marcado: valores extraídos encontrados no texto. Clique num campo para ver de onde ele veio.
        </p>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="mb-1 font-semibold">
            Confiança {registro.confianca.toFixed(2)}{" "}
            <span className="font-normal text-suave">(limiar {limiar.toFixed(2)})</span>
          </h2>
          {registro.erro && <p className="mb-2 whitespace-pre-wrap text-erro">{registro.erro}</p>}
          {registro.motivos.length === 0 ? (
            <p className="text-suave">Nenhuma conferência falhou.</p>
          ) : (
            <table className="tabela">
              <tbody>
                {registro.motivos.map((m, i) => (
                  <tr key={i}>
                    <td className="w-16 font-mono text-alerta">-{m.penalidade.toFixed(2)}</td>
                    <td>{m.mensagem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 font-semibold">Cliente</legend>
          <label className="sm:col-span-2">
            <Rotulo campo="cliente.razao_social">Razão social</Rotulo>
            <input className="campo" value={rascunho.razao_social} onChange={set("razao_social")} {...props("cliente.razao_social")} />
          </label>
          <label>
            <Rotulo campo="cliente.cnpj">CNPJ</Rotulo>
            <input className="campo font-mono" value={rascunho.cnpj} onChange={set("cnpj")} {...props("cliente.cnpj")} />
          </label>
          <label>
            <Rotulo campo="cliente.email">E-mail</Rotulo>
            <input className="campo" value={rascunho.email} onChange={set("email")} {...props("cliente.email")} />
          </label>
        </fieldset>

        <fieldset>
          <legend className="mb-2 font-semibold">Itens</legend>
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Descrição</th>
                  <th className="num">Qtd</th>
                  <th>Un</th>
                  <th className="num">Preço</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rascunho.itens.map((it, i) => (
                  <tr key={i}>
                    <td className="w-32">
                      <input className="campo font-mono" value={it.sku} onChange={setItem(i, "sku")} {...props(`itens.${i}.sku`)} />
                      {ausentes.has(`itens.${i}.sku`) && <span className="text-xs text-alerta">não está no texto</span>}
                    </td>
                    <td>
                      <input className="campo" value={it.descricao} onChange={setItem(i, "descricao")} {...props(`itens.${i}.descricao`)} />
                    </td>
                    <td className="w-20">
                      <input className="campo text-right" value={it.quantidade} onChange={setItem(i, "quantidade")} {...props(`itens.${i}.quantidade`)} />
                    </td>
                    <td className="w-20">
                      <input className="campo" value={it.unidade} onChange={setItem(i, "unidade")} {...props(`itens.${i}.unidade`)} />
                    </td>
                    <td className="w-28">
                      <input className="campo text-right" value={it.preco} onChange={setItem(i, "preco")} {...props(`itens.${i}.preco_unitario`)} />
                    </td>
                    <td className="w-8">
                      {!lancado && (
                        <button
                          type="button"
                          className="text-suave hover:text-erro"
                          aria-label={`remover item ${i + 1}`}
                          onClick={() => setRascunho((r) => ({ ...r, itens: r.itens.filter((_, n) => n !== i) }))}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!lancado && (
            <button
              type="button"
              className="mt-2 text-destaque hover:underline"
              onClick={() =>
                setRascunho((r) => ({ ...r, itens: [...r.itens, { sku: "", descricao: "", quantidade: "1", unidade: "UN", preco: "" }] }))
              }
            >
              Adicionar item
            </button>
          )}
          <p className="mt-2 text-right text-suave">
            Itens + frete: <span className="text-tinta">{reais(totalPedido(atual))}</span> · declarado:{" "}
            <span className="text-tinta">{reais(atual.total_declarado)}</span>
          </p>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-4">
          <legend className="mb-2 font-semibold">Condições</legend>
          <label>
            <Rotulo campo="frete.modalidade">Frete</Rotulo>
            <select className="campo" value={rascunho.frete_modalidade} onChange={set("frete_modalidade")} {...props("frete.modalidade")}>
              <option value="">-</option>
              <option value="CIF">CIF</option>
              <option value="FOB">FOB</option>
            </select>
          </label>
          <label>
            <Rotulo campo="frete.valor">Valor do frete</Rotulo>
            <input className="campo text-right" value={rascunho.frete_valor} onChange={set("frete_valor")} {...props("frete.valor")} />
          </label>
          <label>
            <Rotulo campo="pagamento.condicao">Condição</Rotulo>
            <input className="campo" value={rascunho.condicao} onChange={set("condicao")} {...props("pagamento.condicao")} />
          </label>
          <label>
            <Rotulo campo="pagamento.forma">Forma</Rotulo>
            <input className="campo" value={rascunho.forma} onChange={set("forma")} {...props("pagamento.forma")} />
          </label>
          <label>
            <Rotulo campo="data_entrega">Entrega</Rotulo>
            <input type="date" className="campo" value={rascunho.data_entrega} onChange={set("data_entrega")} {...props("data_entrega")} />
          </label>
          <label>
            <Rotulo campo="total_declarado">Total declarado</Rotulo>
            <input className="campo text-right" value={rascunho.total} onChange={set("total")} {...props("total_declarado")} />
          </label>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-6">
          <legend className="mb-2 font-semibold">Endereço de entrega</legend>
          <label className="sm:col-span-4">
            <Rotulo campo="endereco_entrega.logradouro">Logradouro</Rotulo>
            <input className="campo" value={rascunho.logradouro} onChange={set("logradouro")} {...props("endereco_entrega")} />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-0.5 block text-suave">Número</span>
            <input className="campo" value={rascunho.numero} onChange={set("numero")} {...props("endereco_entrega")} />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-0.5 block text-suave">Bairro</span>
            <input className="campo" value={rascunho.bairro} onChange={set("bairro")} {...props("endereco_entrega")} />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-0.5 block text-suave">Cidade</span>
            <input className="campo" value={rascunho.cidade} onChange={set("cidade")} {...props("endereco_entrega")} />
          </label>
          <label>
            <span className="mb-0.5 block text-suave">UF</span>
            <input className="campo" value={rascunho.uf} onChange={set("uf")} {...props("endereco_entrega")} />
          </label>
          <label>
            <Rotulo campo="endereco_entrega.cep">CEP</Rotulo>
            <input className="campo" value={rascunho.cep} onChange={set("cep")} {...props("endereco_entrega")} />
          </label>
        </fieldset>

        {!lancado && (
          <div className="flex flex-wrap items-center gap-3 border-t border-fio pt-4">
            <button type="button" className="botao" disabled={ocupado} onClick={() => acao(true)}>
              Aprovar e lançar no Bling
            </button>
            <button type="button" className="botao-sec" disabled={ocupado} onClick={() => acao(false)}>
              Salvar correção
            </button>
          </div>
        )}
        {msg && <p className={msg.tipo === "ok" ? "text-ok" : "whitespace-pre-wrap text-erro"}>{msg.texto}</p>}

        {lancamento && (
          <div className="border-t border-fio pt-4">
            <h2 className="mb-1 font-semibold">Lançamento no Bling</h2>
            <p className="mb-2 text-suave">
              Modo {lancamento.modo}
              {lancamento.modo === "sandbox" ? ": este é o payload que seria enviado para POST /pedidos/vendas." : `, id ${lancamento.bling_id}.`}{" "}
              Chave de idempotência <span className="font-mono text-tinta">{lancamento.chave}</span>
            </p>
            <pre className="max-h-96 overflow-auto border border-fio bg-white p-3 font-mono text-[12px]">
              {JSON.stringify(lancamento.payload, null, 2)}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}
