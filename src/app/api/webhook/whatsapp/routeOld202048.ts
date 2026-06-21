import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/webhook/whatsapp
 * Recebe eventos da Evolution API (Baileys) e salva no banco.
 * O payload da Evolution API tem o formato:
 * { event: "messages.upsert", instance: "...", data: { key: {...}, message: {...}, ... } }
 */
export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  try {
    await processarEvento(payload as Record<string, unknown>);
  } catch (err) {
    console.error("Erro ao processar webhook Evolution API:", err);
  }

  // Sempre retorna 200 para a Evolution API não reenviar
  return NextResponse.json({ ok: true });
}

// GET não é usado pela Evolution API, mas mantemos para compatibilidade
export async function GET() {
  return NextResponse.json({ ok: true, message: "Webhook ativo" });
}

type EvolutionPayload = {
  event?: string;
  instance?: string;
  data?: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
      id?: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      imageMessage?: { caption?: string };
      audioMessage?: Record<string, unknown>;
      videoMessage?: { caption?: string };
      documentMessage?: { caption?: string; fileName?: string };
    };
    messageType?: string;
    pushName?: string;
    messageTimestamp?: number;
  };
};

async function processarEvento(payload: EvolutionPayload) {
  const evento = payload?.event;

  // Só processa mensagens recebidas (não enviadas pelo próprio sistema)
  if (evento !== "messages.upsert") return;

  const data = payload?.data;
  if (!data?.key) return;

  // Ignora mensagens enviadas pelo próprio número conectado
  if (data.key.fromMe) return;

  const remoteJid = data.key.remoteJid ?? "";
  // Ignora grupos (JID de grupo termina com @g.us)
  if (remoteJid.endsWith("@g.us")) return;

  // Extrai o número de telefone limpo (remove @s.whatsapp.net)
  const telefone = remoteJid.replace("@s.whatsapp.net", "").replace(/[^0-9]/g, "");
  if (!telefone) return;

  // Extrai o conteúdo da mensagem
  const msg = data.message;
  const texto =
    msg?.conversation ||
    msg?.extendedTextMessage?.text ||
    msg?.imageMessage?.caption ||
    msg?.videoMessage?.caption ||
    msg?.documentMessage?.caption ||
    "";

  const tipo = mapTipo(data.messageType ?? "");
  const whatsappId = data.key.id ?? "";
  const nomeContato = data.pushName;

  // 1. Cria ou atualiza o contato
  const contato = await prisma.contato.upsert({
    where: { telefone },
    update: nomeContato ? { nome: nomeContato } : {},
    create: { telefone, nome: nomeContato },
  });

  // 2. Busca ticket aberto ou cria novo
  let ticket = await prisma.ticket.findFirst({
    where: {
      contatoId: contato.id,
      status: { in: ["Atendendo", "AguardandoAvaliacao"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!ticket) {
    ticket = await prisma.ticket.create({
      data: {
        protocolo: await gerarProtocolo(),
        contatoId: contato.id,
        status: "Atendendo",
        criadoPor: "WhatsApp",
      },
    });
  }

  // 3. Salva a mensagem (evita duplicatas pelo whatsappMessageId)
  if (whatsappId) {
    const existe = await prisma.mensagem.findUnique({
      where: { whatsappMessageId: whatsappId },
    });
    if (existe) return;
  }

  await prisma.mensagem.create({
    data: {
      ticketId: ticket.id,
      direcao: "ENTRADA",
      tipo,
      conteudo: texto,
      whatsappMessageId: whatsappId || null,
      status: "received",
    },
  });

  console.log(`✅ Mensagem salva | Contato: ${telefone} | Ticket: ${ticket.protocolo}`);
}

function mapTipo(messageType: string): "TEXTO" | "IMAGEM" | "AUDIO" | "VIDEO" | "DOCUMENTO" | "LOCALIZACAO" | "OUTRO" {
  switch (messageType) {
    case "conversation":
    case "extendedTextMessage":
      return "TEXTO";
    case "imageMessage":
      return "IMAGEM";
    case "audioMessage":
    case "pttMessage":
      return "AUDIO";
    case "videoMessage":
      return "VIDEO";
    case "documentMessage":
      return "DOCUMENTO";
    case "locationMessage":
      return "LOCALIZACAO";
    default:
      return "OUTRO";
  }
}

async function gerarProtocolo(): Promise<string> {
  const hoje = new Date();
  const prefixo =
    hoje.getFullYear().toString() +
    String(hoje.getMonth() + 1).padStart(2, "0") +
    String(hoje.getDate()).padStart(2, "0");

  const count = await prisma.ticket.count({
    where: { protocolo: { startsWith: prefixo } },
  });

  return `${prefixo}-${String(count + 1).padStart(4, "0")}`;
}
