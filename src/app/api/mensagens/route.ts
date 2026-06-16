import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const EVOLUTION_URL = process.env.EVOLUTION_API_URL ?? "https://evolution-api-8ko1.onrender.com";
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY ?? "";
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE ?? "siah-atendimento";

export async function POST(req: NextRequest) {
  const { ticketId, texto } = await req.json();

  if (!ticketId || !texto?.trim()) {
    return NextResponse.json({ error: "ticketId e texto são obrigatórios" }, { status: 400 });
  }

  // Busca o ticket com o contato
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { contato: true },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });
  }

  const telefone = ticket.contato.telefone;
  const numeroFormatado = telefone.startsWith("55") ? telefone : `55${telefone}`;

  // Envia a mensagem via Evolution API
  const res = await fetch(
    `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_KEY,
      },
      body: JSON.stringify({
        number: numeroFormatado,
        text: texto,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("Erro ao enviar mensagem:", data);
    return NextResponse.json({ error: "Erro ao enviar mensagem", detail: data }, { status: 500 });
  }

  // Salva a mensagem enviada no banco
  const mensagem = await prisma.mensagem.create({
    data: {
      ticketId,
      direcao: "SAIDA",
      tipo: "TEXTO",
      conteudo: texto,
      whatsappMessageId: data?.key?.id ?? null,
      status: "sent",
    },
  });

  // Atualiza o updatedAt do ticket
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, mensagem });
}
