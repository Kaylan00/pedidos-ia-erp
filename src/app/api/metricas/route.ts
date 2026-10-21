import { NextResponse } from "next/server";
import { servico } from "@/lib/app";
import { resumirChamadas } from "@/lib/metrics";

export async function GET() {
  const s = await servico();
  return NextResponse.json(resumirChamadas(await s.repo.listarChamadas()));
}
