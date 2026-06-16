import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const mensagens = await prisma.mensagem.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(mensagens);
}
