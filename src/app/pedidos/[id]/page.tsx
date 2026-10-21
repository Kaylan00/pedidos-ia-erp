import { PaginaPedido } from "@/components/pagina-pedido";

export default async function Pedido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaginaPedido id={id} />;
}
