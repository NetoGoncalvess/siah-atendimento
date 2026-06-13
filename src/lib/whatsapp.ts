// Helper para falar com a WhatsApp Cloud API (Meta).
//
// Variáveis de ambiente necessárias:
// - WHATSAPP_TOKEN: token de acesso permanente do app na Meta
// - WHATSAPP_PHONE_NUMBER_ID: ID do número de telefone (Cloud API)
// - WHATSAPP_VERIFY_TOKEN: token escolhido por você para validar o webhook (GET)
// - WHATSAPP_API_VERSION: opcional, ex. "v21.0" (padrão abaixo)

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

function getEnv() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error(
      "WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID precisam estar configurados no .env"
    );
  }

  return { token, phoneNumberId };
}

type SendTextResult = {
  messagingProductId: string | null;
  raw: unknown;
};

/**
 * Envia uma mensagem de texto simples para um número do WhatsApp.
 * `to` deve estar no formato E.164 sem o "+", ex: "5592999999999".
 */
export async function sendWhatsAppText(to: string, body: string): Promise<SendTextResult> {
  const { token, phoneNumberId } = getEnv();

  const res = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    }
  );

  const json = await res.json();

  if (!res.ok) {
    throw new Error(`Erro ao enviar mensagem WhatsApp: ${JSON.stringify(json)}`);
  }

  const messagingProductId: string | null = json?.messages?.[0]?.id ?? null;
  return { messagingProductId, raw: json };
}

/**
 * Estrutura simplificada de uma mensagem recebida via webhook,
 * já normalizada para o restante da aplicação.
 */
export type IncomingWhatsAppMessage = {
  from: string; // telefone do contato (E.164, sem "+")
  whatsappMessageId: string;
  timestamp: string;
  type: "text" | "image" | "audio" | "video" | "document" | "location" | "other";
  text?: string;
  mediaId?: string;
  contactName?: string;
};

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body?: string };
          image?: { id?: string; caption?: string };
          audio?: { id?: string; caption?: string };
          video?: { id?: string; caption?: string };
          document?: { id?: string; caption?: string };
          location?: { latitude?: number; longitude?: number };
        }>;
      };
    }>;
  }>;
};

/**
 * Extrai as mensagens recebidas do payload bruto enviado pela Meta no webhook.
 * Retorna um array vazio se o payload não contiver mensagens (ex: status updates).
 */
export function parseIncomingWebhook(payload: WhatsAppWebhookPayload): IncomingWhatsAppMessage[] {
  const messages: IncomingWhatsAppMessage[] = [];

  const entries = payload?.entry ?? [];
  for (const entry of entries) {
    const changes = entry?.changes ?? [];
    for (const change of changes) {
      const value = change?.value;
      const contacts = value?.contacts ?? [];
      const msgs = value?.messages ?? [];

      for (const msg of msgs) {
        const contactName = contacts.find((c) => c.wa_id === msg.from)?.profile?.name;

        let type: IncomingWhatsAppMessage["type"] = "other";
        let text: string | undefined;
        let mediaId: string | undefined;

        if (msg.type === "text") {
          type = "text";
          text = msg.text?.body;
        } else if (msg.type === "image" || msg.type === "audio" || msg.type === "video" || msg.type === "document") {
          type = msg.type;
          const media = msg[msg.type];
          mediaId = media?.id;
          text = media?.caption;
        } else if (msg.type === "location") {
          type = "location";
          text = `${msg.location?.latitude}, ${msg.location?.longitude}`;
        }

        messages.push({
          from: msg.from,
          whatsappMessageId: msg.id,
          timestamp: msg.timestamp,
          type,
          text,
          mediaId,
          contactName,
        });
      }
    }
  }

  return messages;
}
