import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import { servico } from "@/lib/app";
import { resumirChamadas } from "@/lib/metrics";
import type { Lancamento, PedidoRegistro, StatusPedido } from "@/lib/repo/types";
import { buscarExemplo } from "@/lib/samples";

/*
 * Toda a API num handler só. Na Vercel cada rota vira uma função separada, e com
 * o armazenamento em memória da demo uma rota não enxergaria o que a outra gravou.
 * Com um handler, as telas (que buscam tudo por aqui) e a API dividem o mesmo estado.
 *
 *   POST  /api/extract                { texto } | { exemplo }
 *   POST  /api/pdf                    multipart, campo "arquivo"
 *   GET   /api/pedidos?status=        lista
 *   GET   /api/pedidos/:id            pedido + lançamento + chamadas
 *   PATCH /api/pedidos/:id            { pedido } corrigido na revisão
 *   POST  /api/pedidos/:id/aprovar    { pedido? } aplica a correção, aprova e lança no Bling
 *   POST  /api/pedidos/restaurar      { registro, lancamento } (só com armazenamento em memória)
 *   GET   /api/metricas               resumo de custo e latência + últimas chamadas
 */

type Ctx = { params: Promise<{ rota?: string[] }> };

const erro = (mensagem: string, status: number) => NextResponse.json({ erro: mensagem }, { status });
const STATUS: StatusPedido[] = ["revisao", "pronto", "lancado", "erro"];
const LIMITE_PDF = 5 * 1024 * 1024;

const EntradaTexto = z.union([
  z.object({ texto: z.string().min(10).max(50_000), origem: z.enum(["texto", "exemplo"]).optional() }),
  z.object({ exemplo: z.string() }),
]);

async function extrair(req: Request) {
  const corpo = EntradaTexto.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return erro("envie { texto } com pelo menos 10 caracteres ou { exemplo }", 400);
  let texto: string;
  let origem: "texto" | "exemplo";
  if ("exemplo" in corpo.data) {
    const ex = buscarExemplo(corpo.data.exemplo);
    if (!ex) return erro("exemplo não existe", 404);
    texto = ex.texto;
    origem = "exemplo";
  } else {
    texto = corpo.data.texto;
    origem = corpo.data.origem ?? "texto";
  }
  const s = await servico();
  return NextResponse.json({ pedido: await s.receber(texto, origem) });
}

/** PDF com texto selecionável. PDF escaneado sem OCR não tem texto para extrair. */
async function pdf(req: Request) {
  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  if (!(arquivo instanceof File)) return erro("envie o PDF no campo 'arquivo'", 400);
  if (arquivo.size > LIMITE_PDF) return erro("PDF maior que 5 MB", 413);
  let texto: string;
  try {
    const doc = await getDocumentProxy(new Uint8Array(await arquivo.arrayBuffer()));
    texto = (await extractText(doc, { mergePages: true })).text.trim();
  } catch {
    return erro("não foi possível ler o PDF", 422);
  }
  if (texto.length < 10) return erro("o PDF não tem texto selecionável (provavelmente é imagem escaneada)", 422);
  const s = await servico();
  return NextResponse.json({ pedido: await s.receber(texto, "pdf") });
}

async function listar(req: Request) {
  const param = new URL(req.url).searchParams.get("status");
  const filtros = param ? param.split(",") : [];
  if (filtros.some((f) => !STATUS.includes(f as StatusPedido))) return erro("status inválido", 400);
  const s = await servico();
  const todos = await s.repo.listarPedidos();
  const pedidos = filtros.length ? todos.filter((p) => filtros.includes(p.status)) : todos;
  return NextResponse.json({ pedidos, limiar: s.limiarConfianca });
}

async function obter(id: string) {
  const s = await servico();
  const pedido = await s.repo.obterPedido(id);
  if (!pedido) return erro("pedido não encontrado", 404);
  const lancamento = pedido.chave_idempotencia ? await s.repo.obterLancamento(pedido.chave_idempotencia) : null;
  const chamadas = (await s.repo.listarChamadas()).filter((c) => c.pedido_id === id);
  return NextResponse.json({ pedido, lancamento, chamadas, limiar: s.limiarConfianca });
}

async function corrigir(req: Request, id: string) {
  const corpo = (await req.json().catch(() => null)) as { pedido?: unknown } | null;
  const s = await servico();
  const r = await s.corrigir(id, corpo?.pedido);
  if (!r.ok) return erro(r.erro, r.status);
  return NextResponse.json({ pedido: r.pedido });
}

async function aprovar(req: Request, id: string) {
  const corpo = (await req.json().catch(() => null)) as { pedido?: unknown } | null;
  const s = await servico();
  if (corpo?.pedido) {
    const c = await s.corrigir(id, corpo.pedido);
    if (!c.ok && c.status !== 409) return erro(c.erro, c.status);
  }
  const r = await s.aprovar(id);
  if (!r.ok) return erro(r.erro, r.status);
  return NextResponse.json({ duplicado: r.duplicado, lancamento: r.lancamento, pedido: r.pedido });
}

/** Ver Repositorio.restaurar: só existe na memória, para a demo sobreviver a troca de instância. */
async function restaurar(req: Request) {
  const s = await servico();
  if (!s.repo.restaurar) return erro("rota não encontrada", 404);
  const corpo = (await req.json().catch(() => null)) as { registro?: PedidoRegistro; lancamento?: Lancamento | null } | null;
  const r = corpo?.registro;
  if (!r?.id || typeof r.texto_original !== "string" || !Array.isArray(r.motivos)) return erro("registro inválido", 400);
  await s.repo.restaurar(r, corpo?.lancamento ?? null);
  return NextResponse.json({ ok: true });
}

async function metricas() {
  const s = await servico();
  const chamadas = await s.repo.listarChamadas();
  return NextResponse.json({ ...resumirChamadas(chamadas), ultimas: chamadas.slice(0, 100) });
}

export async function GET(req: Request, { params }: Ctx) {
  const r = (await params).rota ?? [];
  if (r[0] === "pedidos" && r.length === 1) return listar(req);
  if (r[0] === "pedidos" && r.length === 2) return obter(r[1]);
  if (r[0] === "metricas" && r.length === 1) return metricas();
  return erro("rota não encontrada", 404);
}

export async function POST(req: Request, { params }: Ctx) {
  const r = (await params).rota ?? [];
  if (r[0] === "extract" && r.length === 1) return extrair(req);
  if (r[0] === "pdf" && r.length === 1) return pdf(req);
  if (r[0] === "pedidos" && r.length === 2 && r[1] === "restaurar") return restaurar(req);
  if (r[0] === "pedidos" && r.length === 3 && r[2] === "aprovar") return aprovar(req, r[1]);
  return erro("rota não encontrada", 404);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const r = (await params).rota ?? [];
  if (r[0] === "pedidos" && r.length === 2) return corrigir(req, r[1]);
  return erro("rota não encontrada", 404);
}
