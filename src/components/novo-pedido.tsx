"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { lembrar } from "@/lib/cliente-api";

interface Props {
  exemplos: { id: string; titulo: string; texto: string }[];
}

export function NovoPedido({ exemplos }: Props) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [origem, setOrigem] = useState<"texto" | "exemplo">("texto");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function tratar(resp: Response) {
    const json = await resp.json().catch(() => null);
    if (!resp.ok) {
      setErro(json?.erro ?? `erro ${resp.status}`);
      setEnviando(false);
      return;
    }
    lembrar(json.pedido);
    router.push(`/pedidos/${json.pedido.id}`);
  }

  async function enviarTexto(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setErro(null);
    await tratar(
      await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, origem }),
      }),
    );
  }

  async function enviarPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    const form = new FormData();
    form.append("arquivo", arquivo);
    await tratar(await fetch("/api/pdf", { method: "POST", body: form }));
    e.target.value = "";
  }

  return (
    <form onSubmit={enviarTexto} className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="text-suave" htmlFor="exemplo">
          Carregar exemplo
        </label>
        <select
          id="exemplo"
          className="campo w-auto max-w-full"
          defaultValue=""
          onChange={(e) => {
            const ex = exemplos.find((x) => x.id === e.target.value);
            if (ex) {
              setTexto(ex.texto);
              setOrigem("exemplo");
            }
          }}
        >
          <option value="" disabled>
            escolha um pedido
          </option>
          {exemplos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.titulo}
            </option>
          ))}
        </select>
        <span className="text-suave">ou</span>
        <label className="botao-sec cursor-pointer">
          Enviar PDF
          <input type="file" accept="application/pdf" className="sr-only" onChange={enviarPdf} disabled={enviando} />
        </label>
      </div>
      <textarea
        className="campo h-64 font-mono text-[13px] leading-relaxed"
        placeholder="Cole aqui o corpo do e-mail do pedido"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setOrigem("texto");
        }}
      />
      <div className="flex items-center gap-4">
        <button type="submit" className="botao" disabled={enviando || !texto.trim()}>
          {enviando ? "Extraindo..." : "Extrair pedido"}
        </button>
        {erro && <p className="text-erro">{erro}</p>}
      </div>
    </form>
  );
}
