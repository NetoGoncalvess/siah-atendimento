import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tickets = await prisma.ticket.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      contato: true,
      atendente: true,
      mensagens: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json(tickets);
}
