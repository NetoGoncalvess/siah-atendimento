import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseIncomingWebhook } from "@/lib/whatsapp";

/**
 * GET /api/webhook/whatsapp
 *
 * Usado pela Meta para validar a URL do webhook quando você configura
 * o produto WhatsApp no Meta for Developers. A Meta envia:
 *   ?hub.mode=subscribe&hub.verify_token=XXXX&hub.challenge=YYYY
 * e espera receber de volta o valor de "hub.challenge" em texto puro,
 * desde que o "hub.verify_token" seja igual ao WHATSAPP_VERIFY_TOKEN.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * POST /api/webhook/whatsapp
 *
 * Recebe eventos da WhatsApp Cloud API: novas mensagens, atualizações de
 * status de entrega, etc. Aqui processamos apenas novas mensagens de texto
 * (outros tipos de mídia podem ser tratados depois).
 */
export async function POST(req: NextRequest) {
  const payload = await req.json();

  try {
    const incoming = parseIncomingWebhook(payload);

    for (const msg of incoming) {
      await registrarMensagemRecebida(msg);
    }
  } catch (err) {
    console.error("Erro ao processar webhook do WhatsApp:", err);
    // Sempre respondemos 200 para a Meta não ficar reenviando o evento.
  }

  return NextResponse.json({ ok: true });
}

async function registrarMensagemRecebida(
  msg: Awaited<ReturnType<typeof parseIncomingWebhook>>[number]
) {
  // 1. Garante que o contato existe (cria se for a primeira mensagem dele)
  const contato = await prisma.contato.upsert({
    where: { telefone: msg.from },
    update: msg.contactName ? { nome: msg.contactName } : {},
    create: { telefone: msg.from, nome: msg.contactName },
  });

  // 2. Procura um ticket ainda em aberto para esse contato, ou cria um novo
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

  // 3. Salva a mensagem recebida
  await prisma.mensagem.create({
    data: {
      ticketId: ticket.id,
      direcao: "ENTRADA",
      tipo: mapTipoMensagem(msg.type),
      conteudo: msg.text ?? msg.mediaId ?? "",
      whatsappMessageId: msg.whatsappMessageId,
      status: "received",
    },
  });
}

function mapTipoMensagem(
  tipo: string
): "TEXTO" | "IMAGEM" | "AUDIO" | "VIDEO" | "DOCUMENTO" | "LOCALIZACAO" | "OUTRO" {
  switch (tipo) {
    case "text":
      return "TEXTO";
    case "image":
      return "IMAGEM";
    case "audio":
      return "AUDIO";
    case "video":
      return "VIDEO";
    case "document":
      return "DOCUMENTO";
    case "location":
      return "LOCALIZACAO";
    default:
      return "OUTRO";
  }
}

/**
 * Gera um protocolo no formato AAAAMMDD-NNNN, onde NNNN é sequencial
 * dentro do dia (ex: 20260613-0001).
 */
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
