"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, Send, Smile, Paperclip, RefreshCw } from "lucide-react";

type Contato = { id: string; telefone: string; nome?: string; empresa?: string };
type Mensagem = { id: string; direcao: "ENTRADA" | "SAIDA"; conteudo: string; tipo: string; createdAt: string };
type Ticket = {
  id: string;
  protocolo: string;
  status: string;
  contato: Contato;
  mensagens: Mensagem[];
  updatedAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  Atendendo: "Atendendo",
  AguardandoAvaliacao: "Ag. avaliação",
  Fechado: "Fechado",
  Cancelado: "Cancelado",
  FechadoAssistenteVirtualInatividade: "Bot/Inativ.",
};

const STATUS_CLS: Record<string, string> = {
  Atendendo: "bg-blue/10 text-blue",
  AguardandoAvaliacao: "bg-purple/10 text-purple",
  Fechado: "bg-green/10 text-green",
  Cancelado: "bg-red/10 text-red",
  FechadoAssistenteVirtualInatividade: "bg-orange/10 text-orange",
};

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatData(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return formatHora(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function InboxPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketAtivo, setTicketAtivo] = useState<Ticket | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const carregarTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/tickets");
      const data = await res.json();
      setTickets(data);
    } catch (err) {
      console.error("Erro ao carregar tickets:", err);
    } finally {
      setCarregando(false);
    }
  }, []);

  const carregarMensagens = useCallback(async (ticketId: string) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/mensagens`);
      const data = await res.json();
      setMensagens(data);
    } catch (err) {
      console.error("Erro ao carregar mensagens:", err);
    }
  }, []);

  useEffect(() => {
    carregarTickets();
    const interval = setInterval(carregarTickets, 10000);
    return () => clearInterval(interval);
  }, [carregarTickets]);

  useEffect(() => {
    if (!ticketAtivo) return;
    carregarMensagens(ticketAtivo.id);
    const interval = setInterval(() => carregarMensagens(ticketAtivo.id), 5000);
    return () => clearInterval(interval);
  }, [ticketAtivo, carregarMensagens]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  async function enviarMensagem() {
    if (!texto.trim() || !ticketAtivo || enviando) return;
    setEnviando(true);
    try {
      await fetch("/api/mensagens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticketAtivo.id, texto }),
      });
      setTexto("");
      await carregarMensagens(ticketAtivo.id);
      await carregarTickets();
    } catch (err) {
      console.error("Erro ao enviar:", err);
    } finally {
      setEnviando(false);
    }
  }

  const ticketsFiltrados = tickets.filter((t) => {
    const q = busca.toLowerCase();
    return (
      !q ||
      t.contato.nome?.toLowerCase().includes(q) ||
      t.contato.telefone.includes(q) ||
      t.protocolo.includes(q)
    );
  });

  const nomeContato = (t: Ticket) =>
    t.contato.nome || t.contato.telefone;

  return (
    <div className="flex h-full">
      {/* Lista de conversas */}
      <div className="flex w-80 flex-col border-r border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-base font-bold text-text-primary">Atendimentos</h1>
            <button
              onClick={carregarTickets}
              className="rounded-lg p-1.5 text-text-tertiary hover:bg-secondary"
              title="Atualizar"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              placeholder="Buscar conversa..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-lg border border-border-md bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-blue"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregando ? (
            <div className="p-4 text-center text-xs text-text-tertiary">Carregando...</div>
          ) : ticketsFiltrados.length === 0 ? (
            <div className="p-4 text-center text-xs text-text-tertiary">Nenhum atendimento encontrado</div>
          ) : (
            ticketsFiltrados.map((t) => {
              const ativa = ticketAtivo?.id === t.id;
              const ultimaMsg = t.mensagens[0];
              return (
                <button
                  key={t.id}
                  onClick={() => { setTicketAtivo(t); setMensagens([]); }}
                  className={`flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors ${ativa ? "bg-blue/5" : "hover:bg-secondary"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-text-primary truncate max-w-[160px]">
                      {nomeContato(t)}
                    </span>
                    <span className="text-xs text-text-tertiary shrink-0">
                      {formatData(t.updatedAt)}
                    </span>
                  </div>
                  {ultimaMsg && (
                    <span className="truncate text-xs text-text-secondary">
                      {ultimaMsg.direcao === "SAIDA" ? "Você: " : ""}{ultimaMsg.conteudo || "(mídia)"}
                    </span>
                  )}
                  <span className={`self-start rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLS[t.status] ?? "bg-secondary text-text-secondary"}`}>
                    #{t.protocolo} · {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Conversa aberta */}
      {ticketAtivo ? (
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border bg-card px-5 py-4">
            <div>
              <div className="text-sm font-bold text-text-primary">{nomeContato(ticketAtivo)}</div>
              <div className="text-xs text-text-tertiary">
                #{ticketAtivo.protocolo} · {ticketAtivo.contato.telefone}
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLS[ticketAtivo.status] ?? "bg-secondary text-text-secondary"}`}>
              {STATUS_LABEL[ticketAtivo.status] ?? ticketAtivo.status}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {mensagens.length === 0 ? (
              <div className="text-center text-xs text-text-tertiary pt-10">Carregando mensagens...</div>
            ) : (
              mensagens.map((m) => (
                <div key={m.id} className={`flex ${m.direcao === "SAIDA" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-md rounded-2xl px-4 py-2 text-sm ${m.direcao === "SAIDA" ? "rounded-tr-sm bg-blue text-white" : "rounded-tl-sm bg-secondary text-text-primary"}`}>
                    {m.conteudo || <span className="italic opacity-60">(mídia)</span>}
                    <div className={`mt-1 text-[11px] ${m.direcao === "SAIDA" ? "text-white/70" : "text-text-tertiary"}`}>
                      {formatHora(m.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
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
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && enviarMensagem()}
              className="flex-1 rounded-lg border border-border-md bg-card px-3 py-2 text-sm outline-none focus:border-blue"
            />
            <button
              onClick={enviarMensagem}
              disabled={enviando || !texto.trim()}
              className="flex items-center gap-2 rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Send size={16} />
              {enviando ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-text-tertiary">
          <div className="text-center">
            <div className="mb-2 text-4xl">💬</div>
            <div className="text-sm">Selecione uma conversa para começar</div>
          </div>
        </div>
      )}
    </div>
  );
}
