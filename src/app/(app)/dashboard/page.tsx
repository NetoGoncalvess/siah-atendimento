'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts'

// ── Tipos ────────────────────────────────────────────────────────────────────

type Cards = {
  total: number
  resolvidos: number
  emAndamento: number
  cancelados: number
  aguardando: number
  tempoMedioAtendimento: number
  tempoMedio1aResposta: number
  tempoMedioResolucao: number
}

type Atendimento = {
  protocolo: string
  abertura: string
  tempoPrimeiraRespostaMin: number | null
  tempoSuporteMin: number | null
  fechamento: string | null
  solucao: string | null
  tempoResolucaoDias: string | null
  setor: string
  status: string
  criadoPor: string
  atendente: string
  contato: string
  empresa: string
}

type DashData = {
  cards: Cards
  graficos: {
    tempoPorSetor: { setor: string; media: number }[]
    fluxoPorHora: { hora: number; quantidade: number }[]
    topSolucoes: { motivo: string; quantidade: number }[]
  }
  lista: Atendimento[]
  filtros: { setores: string[]; atendentes: string[] }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDT(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  return (
    d.toLocaleDateString('pt-BR') +
    ' - ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
}

function fmtMin(min: number | null) {
  if (min == null) return '-'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h ${min % 60}min`
}

const STATUS_LABEL: Record<string, string> = {
  Atendendo: 'Atendendo',
  AguardandoAvaliacao: 'Ag. avaliação',
  Fechado: 'Fechado',
  FechadoCliente: 'FechadoCliente',
  Cancelado: 'Cancelado',
  FechadoAssistenteVirtualInatividade: 'Fechado (Inatividade)',
}

const STATUS_COLOR: Record<string, string> = {
  Atendendo: '#3b82f6',
  AguardandoAvaliacao: '#a855f7',
  Fechado: '#22c55e',
  FechadoCliente: '#22c55e',
  Cancelado: '#ef4444',
  FechadoAssistenteVirtualInatividade: '#6b7280',
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [atualizado, setAtualizado] = useState('')

  // Filtros
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [setor, setSetor] = useState('Todos')
  const [atendente, setAtendente] = useState('Todos')
  const [status, setStatus] = useState('Todos')
  const [prioridade, setPrioridade] = useState('Todas')

  // Tabela
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(15)
  const [busca, setBusca] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (dataInicio) params.set('dataInicio', dataInicio)
    if (dataFim) params.set('dataFim', dataFim)
    if (setor !== 'Todos') params.set('setor', setor)
    if (atendente !== 'Todos') params.set('atendente', atendente)
    if (status !== 'Todos') params.set('status', status)
    if (prioridade !== 'Todas') params.set('prioridade', prioridade)

    const res = await fetch(`/api/dashboard?${params.toString()}`)
    const json: DashData = await res.json()
    setData(json)
    setAtualizado(
      new Date().toLocaleDateString('pt-BR') +
        ', ' +
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    )
    setLoading(false)
    setPagina(1)
  }, [dataInicio, dataFim, setor, atendente, status, prioridade])

  useEffect(() => {
    fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function limparFiltros() {
    setDataInicio('')
    setDataFim('')
    setSetor('Todos')
    setAtendente('Todos')
    setStatus('Todos')
    setPrioridade('Todas')
  }

  function exportarCSV() {
    if (!data) return
    const headers = [
      'Protocolo','Data e Hora Abertura','Tempo 1ª Resposta','Tempo Suporte',
      'Fechamento','Solução/Motivo','Tempo Resolução','Setor','Status',
      'Criado Por','Atendente','Contato','Empresa',
    ]
    const rows = data.lista.map((t) => [
      t.protocolo, fmtDT(t.abertura), fmtMin(t.tempoPrimeiraRespostaMin),
      fmtMin(t.tempoSuporteMin), fmtDT(t.fechamento), t.solucao ?? '-',
      t.tempoResolucaoDias ?? '-', t.setor, STATUS_LABEL[t.status] ?? t.status,
      t.criadoPor, t.atendente, t.contato, t.empresa,
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `atendimentos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Lista filtrada pela busca
  const listaFiltrada = (data?.lista ?? []).filter((t) => {
    if (!busca) return true
    const b = busca.toLowerCase()
    return (
      t.protocolo.toLowerCase().includes(b) ||
      t.contato.toLowerCase().includes(b) ||
      t.empresa.toLowerCase().includes(b) ||
      t.atendente.toLowerCase().includes(b)
    )
  })

  const totalPaginas = Math.max(1, Math.ceil(listaFiltrada.length / porPagina))
  const listaPage = listaFiltrada.slice((pagina - 1) * porPagina, pagina * porPagina)

  const { cards, graficos, filtros } = data ?? {
    cards: { total:0, resolvidos:0, emAndamento:0, cancelados:0, aguardando:0,
             tempoMedioAtendimento:0, tempoMedio1aResposta:0, tempoMedioResolucao:0 },
    graficos: { tempoPorSetor:[], fluxoPorHora:[], topSolucoes:[] },
    filtros: { setores:[], atendentes:[] },
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0, display:'flex', alignItems:'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>📋</span> Dashboard de Atendimentos
          </h1>
          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 13 }}>Visão geral dos atendimentos registrados</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap: 12 }}>
          {atualizado && (
            <span style={{ fontSize: 12, color: '#94a3b8' }}>⏰ Atualizado: {atualizado}</span>
          )}
          <button onClick={exportarCSV} style={btnPrimary}>
            ⬇ Exportar
          </button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', marginBottom: 20, border: '1px solid #e2e8f0' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>
          FILTROS
        </p>
        <div style={{ display:'flex', gap: 12, flexWrap:'wrap', alignItems:'flex-end' }}>
          {/* Período */}
          <div>
            <label style={labelStyle}>Período</label>
            <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={inputStyle} />
              <span style={{ color:'#64748b', fontSize:12 }}>até</span>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Setor */}
          <div>
            <label style={labelStyle}>Setor</label>
            <select value={setor} onChange={(e) => setSetor(e.target.value)} style={selectStyle}>
              <option>Todos</option>
              {filtros.setores.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Atendente */}
          <div>
            <label style={labelStyle}>Atendente</label>
            <select value={atendente} onChange={(e) => setAtendente(e.target.value)} style={selectStyle}>
              <option>Todos</option>
              {filtros.atendentes.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
              <option>Todos</option>
              <option value="Atendendo">Atendendo</option>
              <option value="AguardandoAvaliacao">Ag. avaliação</option>
              <option value="Fechado">Fechado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>

          {/* Prioridade */}
          <div>
            <label style={labelStyle}>Prioridade</label>
            <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} style={selectStyle}>
              <option>Todas</option>
              <option value="Baixa">Baixa</option>
              <option value="Media">Média</option>
              <option value="Alta">Alta</option>
            </select>
          </div>

          {/* Botões */}
          <button onClick={fetchData} style={btnPrimary}>🔍 Filtrar</button>
          <button onClick={limparFiltros} style={btnSecondary}>↺ Limpar filtros</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding: 60, color:'#64748b' }}>Carregando...</div>
      ) : (
        <>
          {/* ── Cards ── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
            <Card icon="📞" value={cards.total} label="TOTAL DE CHAMADOS" sub={`100% do total`} color="#3b82f6" />
            <Card icon="✅" value={cards.resolvidos} label="RESOLVIDOS"
              sub={`${cards.total > 0 ? Math.round(cards.resolvidos / cards.total * 100) : 0}% do total`} color="#22c55e" />
            <Card icon="⏳" value={cards.emAndamento} label="EM ANDAMENTO"
              sub={`${cards.total > 0 ? Math.round(cards.emAndamento / cards.total * 100) : 0}% do total`} color="#f97316" />
            <Card icon="✖" value={cards.cancelados} label="CANCELADOS"
              sub={`${cards.total > 0 ? Math.round(cards.cancelados / cards.total * 100) : 0}% do total`} color="#ef4444" />
            <Card icon="⏱" value={`${cards.tempoMedioAtendimento} min`} label="TEMPO MÉDIO ATENDIMENTO" color="#8b5cf6" isTime />
            <Card icon="💬" value={`${cards.tempoMedio1aResposta} min`} label="TEMPO MÉDIO 1ª RESPOSTA" color="#06b6d4" isTime />
            <Card icon="📅" value={`${cards.tempoMedioResolucao} min`} label="TEMPO MÉDIO RESOLUÇÃO" color="#10b981" isTime />
          </div>

          {/* ── Gráficos ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Tempo 1ª resposta por setor */}
            <div style={cardBox}>
              <p style={chartTitle}>TEMPO DA 1ª RESPOSTA POR SETOR</p>
              <p style={chartSub}>(Média em minutos)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={graficos.tempoPorSetor} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="setor" tick={{ fontSize: 10 }} width={140}
                    tickFormatter={(v) => v.length > 22 ? v.slice(0, 22) + '…' : v} />
                  <Tooltip formatter={(v) => [`${v} min`, 'Média']} />
                  <Bar dataKey="media" fill="#22c55e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Horário com maior fluxo */}
            <div style={cardBox}>
              <p style={chartTitle}>HORÁRIO COM MAIOR FLUXO</p>
              <p style={chartSub}>(Quantidade de chamados)</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={graficos.fluxoPorHora} margin={{ left: -20, right: 10 }}>
                  <defs>
                    <linearGradient id="fluxoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hora" tickFormatter={(h) => `${h}h`} tick={{ fontSize: 9 }} interval={1} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Chamados']} labelFormatter={(h) => `${h}h`} />
                  <Area type="monotone" dataKey="quantidade" stroke="#3b82f6" fill="url(#fluxoGrad)" strokeWidth={2} dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Soluções / motivo cancelamento */}
            <div style={cardBox}>
              <p style={chartTitle}>SOLUÇÕES / MOTIVO CANCELAMENTO</p>
              <p style={chartSub}>(Top 7)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={graficos.topSolucoes} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="motivo" tick={{ fontSize: 10 }} width={140}
                    tickFormatter={(v) => v.length > 22 ? v.slice(0, 22) + '…' : v} />
                  <Tooltip />
                  <Bar dataKey="quantidade" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Tabela ── */}
          <div style={cardBox}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 14 }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', margin: 0, textTransform:'uppercase', letterSpacing: 0.5 }}>
                LISTA DE ATENDIMENTOS
              </p>
              <div style={{ display:'flex', gap: 10, alignItems:'center' }}>
                <span style={{ fontSize: 12, color:'#64748b' }}>Mostrar</span>
                <select value={porPagina} onChange={(e) => { setPorPagina(Number(e.target.value)); setPagina(1) }} style={{ ...selectStyle, width: 70 }}>
                  {[10, 15, 25, 50].map((n) => <option key={n}>{n}</option>)}
                </select>
                <span style={{ fontSize: 12, color:'#64748b' }}>registros</span>
                <input
                  placeholder="🔍 Buscar..."
                  value={busca}
                  onChange={(e) => { setBusca(e.target.value); setPagina(1) }}
                  style={{ ...inputStyle, width: 180 }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    {['PROTOCOLO','DATA E HORA DA ABERTURA','TEMPO 1ª RESPOSTA','TEMPO SUPORTE',
                      'FECHAMENTO/CANCELAMENTO','SOLUÇÃO / MOTIVO CANCELAMENTO','TEMPO RESOLUÇÃO',
                      'SETOR','STATUS','CRIADO POR','ATENDENTE','CONTATO / EMPRESA'].map((h) => (
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontWeight: 600,
                        fontSize: 11, color:'#64748b', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listaPage.length === 0 ? (
                    <tr><td colSpan={12} style={{ padding: 30, textAlign:'center', color:'#94a3b8' }}>Nenhum atendimento encontrado.</td></tr>
                  ) : listaPage.map((t, i) => (
                    <tr key={t.protocolo} style={{ borderBottom:'1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={tdStyle}><strong>{t.protocolo}</strong></td>
                      <td style={tdStyle}>{fmtDT(t.abertura)}</td>
                      <td style={tdStyle}>{fmtMin(t.tempoPrimeiraRespostaMin)}</td>
                      <td style={tdStyle}>{fmtMin(t.tempoSuporteMin)}</td>
                      <td style={tdStyle}>{fmtDT(t.fechamento)}</td>
                      <td style={{ ...tdStyle, maxWidth: 200 }}>{t.solucao ?? '-'}</td>
                      <td style={tdStyle}>{t.tempoResolucaoDias ? `${t.tempoResolucaoDias} ${t.tempoResolucaoDias === '<1' ? 'dia' : 'dias'}` : '-'}</td>
                      <td style={{ ...tdStyle, maxWidth: 160 }}>{t.setor}</td>
                      <td style={tdStyle}>
                        <span style={{
                          background: (STATUS_COLOR[t.status] ?? '#64748b') + '20',
                          color: STATUS_COLOR[t.status] ?? '#64748b',
                          padding: '2px 8px', borderRadius: 20, fontWeight: 600, fontSize: 11, whiteSpace:'nowrap'
                        }}>
                          {STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </td>
                      <td style={tdStyle}>{t.criadoPor}</td>
                      <td style={tdStyle}>{t.atendente}</td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{t.contato}</div>
                        <div style={{ color:'#94a3b8', fontSize: 11 }}>{t.empresa}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 14 }}>
              <span style={{ fontSize: 12, color:'#64748b' }}>
                Mostrando {listaFiltrada.length === 0 ? 0 : (pagina - 1) * porPagina + 1} a{' '}
                {Math.min(pagina * porPagina, listaFiltrada.length)} de {listaFiltrada.length} registros
              </span>
              <div style={{ display:'flex', gap: 6 }}>
                <button onClick={() => setPagina(1)} disabled={pagina === 1} style={btnPag}>«</button>
                <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1} style={btnPag}>‹</button>
                {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                  const p = Math.max(1, Math.min(totalPaginas - 4, pagina - 2)) + i
                  return (
                    <button key={p} onClick={() => setPagina(p)}
                      style={{ ...btnPag, background: p === pagina ? '#3b82f6' : undefined, color: p === pagina ? '#fff' : undefined }}>
                      {p}
                    </button>
                  )
                })}
                <button onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} style={btnPag}>›</button>
                <button onClick={() => setPagina(totalPaginas)} disabled={pagina === totalPaginas} style={btnPag}>»</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-componente Card ───────────────────────────────────────────────────────

function Card({ icon, value, label, sub, color, isTime }: {
  icon: string; value: string | number; label: string; sub?: string; color: string; isTime?: boolean
}) {
  return (
    <div style={{ background:'#fff', borderRadius: 10, padding: '16px 18px', border:'1px solid #e2e8f0' }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: color + '15',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize: 18, marginBottom: 10 }}>
        {icon}
      </div>
      <div style={{ fontSize: isTime ? 22 : 28, fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginTop: 4, textTransform:'uppercase', letterSpacing: 0.5 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color:'#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Estilos base ─────────────────────────────────────────────────────────────

const cardBox: React.CSSProperties = {
  background: '#fff', borderRadius: 10, padding: 20, border: '1px solid #e2e8f0',
}
const chartTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: '#1e293b', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: 0.5,
}
const chartSub: React.CSSProperties = { fontSize: 11, color: '#94a3b8', margin: '0 0 12px' }
const labelStyle: React.CSSProperties = { display:'block', fontSize: 11, fontWeight: 600, color:'#64748b', marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: '#1e293b',
  background:'#fff', outline:'none',
}
const selectStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: '#1e293b',
  background:'#fff', outline:'none', minWidth: 140, cursor:'pointer',
}
const btnPrimary: React.CSSProperties = {
  background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6,
  padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor:'pointer',
}
const btnSecondary: React.CSSProperties = {
  background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6,
  padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor:'pointer',
}
const tdStyle: React.CSSProperties = { padding: '10px 10px', color: '#374151', verticalAlign:'top' }
const btnPag: React.CSSProperties = {
  border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 12,
  cursor:'pointer', background:'#fff', color:'#374151',
}
