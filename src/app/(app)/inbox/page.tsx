import { Search, Send, Smile, Paperclip } from "lucide-react";

// Dados de exemplo só para visualizar o layout — serão substituídos
// por dados reais do banco (tickets + mensagens) na próxima fase.
const TICKETS_EXEMPLO = [
  {
    id: "1",
    protocolo: "20260613-0001",
    contato: "Pajé Material de Construção",
    ultimaMensagem: "Bom dia, preciso de ajuda com o sistema A7",
    hora: "08:28",
    status: "Atendendo",
    naoLidas: 2,
  },
  {
    id: "2",
    protocolo: "20260613-0002",
    contato: "Neto Gonçalves",
    ultimaMensagem: "Dúvidas sobre emissão de nota.",
    hora: "08:36",
    status: "AguardandoAvaliacao",
    naoLidas: 0,
  },
];

const STATUS_LABEL: Record<string, string> = {
  Atendendo: "Atendendo",
  AguardandoAvaliacao: "Ag. avaliação",
  Fechado: "Fechado",
  Cancelado: "Cancelado",
};

export default function InboxPage() {
  return (
    <div className="flex h-full">
      {/* Lista de conversas */}
      <div className="flex w-80 flex-col border-r border-border bg-card">
        <div className="border-b border-border p-4">
          <h1 className="mb-3 text-base font-bold text-text-primary">Atendimentos</h1>
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              placeholder="Buscar conversa..."
              className="w-full rounded-lg border border-border-md bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-blue"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {TICKETS_EXEMPLO.map((t) => (
            <button
              key={t.id}
              className="flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors hover:bg-secondary"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">{t.contato}</span>
                <span className="text-xs text-text-tertiary">{t.hora}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-text-secondary">{t.ultimaMensagem}</span>
                {t.naoLidas > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue px-1 text-[11px] font-semibold text-white">
                    {t.naoLidas}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium text-text-tertiary">
                #{t.protocolo} · {STATUS_LABEL[t.status]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Conversa aberta */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div>
            <div className="text-sm font-bold text-text-primary">Pajé Material de Construção</div>
            <div className="text-xs text-text-tertiary">
              #20260613-0001 · 1-Suporte Sistema A7 e Aplicativos
            </div>
          </div>
          <span className="rounded-full bg-blue/10 px-3 py-1 text-xs font-semibold text-blue">
            Atendendo
          </span>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <div className="flex justify-start">
            <div className="max-w-md rounded-2xl rounded-tl-sm bg-secondary px-4 py-2 text-sm text-text-primary">
              Bom dia, preciso de ajuda com o sistema A7
              <div className="mt-1 text-[11px] text-text-tertiary">08:28</div>
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-md rounded-2xl rounded-tr-sm bg-blue px-4 py-2 text-sm text-white">
              Bom dia! Pode me explicar o que está acontecendo?
              <div className="mt-1 text-[11px] text-white/70">08:30</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border bg-card p-4">
          <button className="rounded-lg p-2 text-text-tertiary hover:bg-secondary">
            <Paperclip size={18} />
          </button>
          <button className="rounded-lg p-2 text-text-tertiary hover:bg-secondary">
            <Smile size={18} />
          </button>
          <input
            placeholder="Digite uma mensagem..."
            className="flex-1 rounded-lg border border-border-md bg-card px-3 py-2 text-sm outline-none focus:border-blue"
          />
          <button className="flex items-center gap-2 rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Send size={16} />
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
