import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const dataInicio = searchParams.get('dataInicio')
  const dataFim = searchParams.get('dataFim')
  const setor = searchParams.get('setor')
  const atendente = searchParams.get('atendente')
  const status = searchParams.get('status')
  const prioridade = searchParams.get('prioridade')
  const canal = searchParams.get('canal') // não temos no schema, mas deixa preparado

  // Monta o filtro dinâmico
  const where: Record<string, unknown> = {}

  if (dataInicio || dataFim) {
    where.abertura = {
      ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
      ...(dataFim ? { lte: new Date(dataFim + 'T23:59:59') } : {}),
    }
  }

  if (setor && setor !== 'Todos') {
    where.setor = { nome: setor }
  }

  if (atendente && atendente !== 'Todos') {
    where.atendente = { nome: atendente }
  }

  if (status && status !== 'Todos') {
    where.status = status
  }

  if (prioridade && prioridade !== 'Todas') {
    where.prioridade = prioridade
  }

  // Busca tickets com relações
  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      setor: { select: { nome: true } },
      atendente: { select: { nome: true } },
      contato: { select: { nome: true, empresa: true, telefone: true } },
    },
    orderBy: { abertura: 'desc' },
  })

  // ── Cards de totais ──────────────────────────────────────────────────────────
  const total = tickets.length
  const resolvidos = tickets.filter(
    (t) => t.status === 'Fechado' || t.status === 'FechadoAssistenteVirtualInatividade'
  ).length
  const emAndamento = tickets.filter((t) => t.status === 'Atendendo').length
  const cancelados = tickets.filter((t) => t.status === 'Cancelado').length
  const aguardando = tickets.filter((t) => t.status === 'AguardandoAvaliacao').length

  // ── Tempo médio 1ª resposta (min) ────────────────────────────────────────────
  const comResposta = tickets.filter((t) => t.tempoPrimeiraRespostaSeg != null)
  const tempoMedio1aResposta =
    comResposta.length > 0
      ? Math.round(
          comResposta.reduce((acc, t) => acc + (t.tempoPrimeiraRespostaSeg ?? 0), 0) /
            comResposta.length /
            60
        )
      : 0

  // ── Tempo médio de atendimento (min) (abertura até fechamento) ───────────────
  const fechados = tickets.filter((t) => t.fechamento != null)
  const tempoMedioAtendimento =
    fechados.length > 0
      ? Math.round(
          fechados.reduce((acc, t) => {
            const diff = (t.fechamento!.getTime() - t.abertura.getTime()) / 1000 / 60
            return acc + diff
          }, 0) / fechados.length
        )
      : 0

  // ── Tempo médio de resolução (min) ───────────────────────────────────────────
  // Igual ao atendimento por hora (pode diferenciar depois com SLA)
  const tempoMedioResolucao = tempoMedioAtendimento

  // ── Tempo 1ª resposta por setor ──────────────────────────────────────────────
  const setorMap: Record<string, { total: number; count: number }> = {}
  for (const t of tickets) {
    if (t.tempoPrimeiraRespostaSeg == null || !t.setor) continue
    const nome = t.setor.nome
    if (!setorMap[nome]) setorMap[nome] = { total: 0, count: 0 }
    setorMap[nome].total += t.tempoPrimeiraRespostaSeg / 60
    setorMap[nome].count += 1
  }
  const tempoPorSetor = Object.entries(setorMap)
    .map(([nome, { total, count }]) => ({
      setor: nome,
      media: Math.round(total / count),
    }))
    .sort((a, b) => b.media - a.media)

  // ── Horário com maior fluxo (0-23h) ──────────────────────────────────────────
  const fluxoPorHora = Array.from({ length: 24 }, (_, h) => ({
    hora: h,
    quantidade: tickets.filter((t) => new Date(t.abertura).getHours() === h).length,
  }))

  // ── Top 7 soluções / motivos cancelamento ────────────────────────────────────
  const solucaoMap: Record<string, number> = {}
  for (const t of tickets) {
    if (!t.solucao) continue
    solucaoMap[t.solucao] = (solucaoMap[t.solucao] ?? 0) + 1
  }
  const topSolucoes = Object.entries(solucaoMap)
    .map(([motivo, quantidade]) => ({ motivo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 7)

  // ── Lista de atendimentos (tabela) ───────────────────────────────────────────
  const lista = tickets.map((t) => {
    const tempoSuporteMin = t.fechamento
      ? Math.round((t.fechamento.getTime() - t.abertura.getTime()) / 1000 / 60)
      : null

    const tempoResolucaoDias = t.fechamento
      ? (t.fechamento.getTime() - t.abertura.getTime()) / 1000 / 60 / 60 / 24
      : null

    return {
      protocolo: t.protocolo,
      abertura: t.abertura,
      tempoPrimeiraRespostaMin: t.tempoPrimeiraRespostaSeg != null
        ? Math.round(t.tempoPrimeiraRespostaSeg / 60)
        : null,
      tempoSuporteMin,
      fechamento: t.fechamento,
      solucao: t.solucao,
      tempoResolucaoDias:
        tempoResolucaoDias != null
          ? tempoResolucaoDias < 1
            ? '<1'
            : String(Math.round(tempoResolucaoDias))
          : null,
      setor: t.setor?.nome ?? '-',
      status: t.status,
      criadoPor: t.criadoPor ?? t.contato?.nome ?? '-',
      atendente: t.atendente?.nome ?? '-',
      contato: t.contato?.nome ?? t.contato?.telefone ?? '-',
      empresa: t.contato?.empresa ?? t.contato?.nome ?? '-',
    }
  })

  // ── Listas para os filtros ───────────────────────────────────────────────────
  const [setores, atendentes] = await Promise.all([
    prisma.setor.findMany({ select: { nome: true }, where: { ativo: true }, orderBy: { nome: 'asc' } }),
    prisma.atendente.findMany({ select: { nome: true }, where: { ativo: true }, orderBy: { nome: 'asc' } }),
  ])

  return NextResponse.json({
    cards: {
      total,
      resolvidos,
      emAndamento,
      cancelados,
      aguardando,
      tempoMedioAtendimento,
      tempoMedio1aResposta,
      tempoMedioResolucao,
    },
    graficos: {
      tempoPorSetor,
      fluxoPorHora,
      topSolucoes,
    },
    lista,
    filtros: {
      setores: setores.map((s) => s.nome),
      atendentes: atendentes.map((a) => a.nome),
    },
  })
}
