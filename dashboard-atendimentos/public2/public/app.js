'use strict';

let allData = [];
let filteredData = [];
let chartSetor = null;
let chartHoras = null;
let chartMotivos = null;
let currentPage = 1;
let pageSize = 15;

const STATUS_MAP = {
  'Fechado':                             { label: 'Fechado',        cls: 'b-Fechado',    color: '#1E9E3D' },
  'Cancelado':                           { label: 'Cancelado',      cls: 'b-Cancelado',  color: '#E5484D' },
  'FechadoAssistenteVirtualInatividade': { label: 'Bot/Inativ.',    cls: 'b-Bot',        color: '#F2994A' },
  'Atendendo':                           { label: 'Atendendo',      cls: 'b-Atendendo',  color: '#2F6FED' },
  'AguardandoAvaliacao':                 { label: 'Ag. avaliação',  cls: 'b-Aguardando', color: '#7C5CFC' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// Picks the first non-empty value among several possible Excel header names
function pick(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
  }
  return '';
}

function pickNum(row, keys) {
  const v = pick(row, keys);
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// Parses dates like "31/05/2024 - 08:15", "31/05/2024 08:15", "2024-05-31 08:15"
function parseDateStr(s) {
  if (!s) return null;
  const str = String(s);
  let m = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}

function getHour(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{2}):(\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function prioClass(p) {
  const norm = String(p || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (norm.includes('alta')) return 'b-prio-Alta';
  if (norm.includes('media')) return 'b-prio-Media';
  if (norm.includes('baixa')) return 'b-prio-Baixa';
  return 'b-prio-default';
}

// ── File parsing ─────────────────────────────────────────────────────────────

function parseXLSX(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });

      allData = json.map(r => ({
        protocolo:    pick(r, ['Protocolo']),
        abertura:     pick(r, ['Data e Hora da Abertura', 'Data e Hora de Abertura', 'Abertura']),
        canal:        pick(r, ['Canal de Abertura', 'Canal']),
        detalhes:     pick(r, ['Detalhes do canal de Abertura', 'Detalhes do Canal de Abertura']),
        atendente:    pick(r, ['Atendente']),
        setor:        pick(r, ['Setor']),
        status:       pick(r, ['Status']),
        prioridade:   pick(r, ['Prioridade']),
        criadoPor:    pick(r, ['Atendimento Criado Por', 'Criado Por']),
        contato:      pick(r, ['Nome do Contato', 'Contato']),
        empresa:      pick(r, ['Empresa']),
        resposta:     pickNum(r, ['Tempo da Primeira Resposta (minutos)', 'Tempo da 1ª Resposta (minutos)', 'Tempo da 1ª Resposta (min)']),
        tempoAtend:   pickNum(r, ['Tempo Gasto no Atendimento (minutos)', 'Tempo Gasto no Atendimento (min)', 'Tempo de Atendimento (minutos)']),
        fechamento:   pick(r, ['Data e Hora do Fechamento/Cancelamento', 'Data e Hora de Fechamento/Cancelamento', 'Fechamento']),
        tempoResol:   pickNum(r, ['Tempo Resolução do Chamado (dias)', 'Tempo de Resolução do Chamado (dias)', 'Tempo Resolução (dias)']),
        solucao:      pick(r, ['Solução do Problema/Motivo Cancelamento', 'Solução do Problema / Motivo Cancelamento']),
        descricao:    pick(r, ['Descrição do Problema']),
      }));

      populateFilters();
      document.getElementById('uploadSection').style.display = 'none';
      document.getElementById('dashSection').style.display = 'block';
      document.getElementById('exportWrap').style.display = 'block';
      document.getElementById('lastUpdate').innerHTML =
        '<i class="ti ti-clock"></i> Atualizado: ' + new Date().toLocaleString('pt-BR');
      currentPage = 1;
      update();
    } catch (err) {
      alert('Erro ao ler o arquivo. Verifique se é um Excel válido.\n' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ── Filters ───────────────────────────────────────────────────────────────────

function populateFilters() {
  const unique = key => [...new Set(allData.map(r => r[key]).filter(Boolean))].sort();

  const fill = (id, placeholder, values, labelFn) => {
    const el = document.getElementById(id);
    el.innerHTML = `<option value="">${placeholder}</option>` +
      values.map(v => `<option value="${esc(v)}">${esc(labelFn ? labelFn(v) : v)}</option>`).join('');
  };

  fill('fStatus',     'Todos', [...new Set(allData.map(r => r.status).filter(Boolean))], v => STATUS_MAP[v]?.label || v);
  fill('fAtendente',  'Todos', unique('atendente'));
  fill('fSetor',      'Todos', unique('setor'));
  fill('fPrioridade', 'Todas', unique('prioridade'));
  fill('fCanal',      'Todos', unique('canal'));
}

function getFiltered() {
  const fS    = document.getElementById('fStatus').value;
  const fA    = document.getElementById('fAtendente').value;
  const fSt   = document.getElementById('fSetor').value;
  const fP    = document.getElementById('fPrioridade').value;
  const fC    = document.getElementById('fCanal').value;
  const dIni  = document.getElementById('fDataIni').value;
  const dFim  = document.getElementById('fDataFim').value;
  const q     = (document.getElementById('tblSearch')?.value || '').toLowerCase().trim();

  const dataIni = dIni ? new Date(dIni + 'T00:00:00') : null;
  const dataFim = dFim ? new Date(dFim + 'T23:59:59') : null;

  return allData.filter(r => {
    if (fS  && r.status     !== fS)  return false;
    if (fA  && r.atendente  !== fA)  return false;
    if (fSt && r.setor      !== fSt) return false;
    if (fP  && r.prioridade !== fP)  return false;
    if (fC  && r.canal      !== fC)  return false;

    if (dataIni || dataFim) {
      const d = parseDateStr(r.abertura);
      if (!d) return false;
      if (dataIni && d < dataIni) return false;
      if (dataFim && d > dataFim) return false;
    }

    if (q && !Object.values(r).join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
}

function applyFilters() {
  currentPage = 1;
  update();
}

function clearFilters() {
  ['fStatus', 'fAtendente', 'fSetor', 'fPrioridade', 'fCanal'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('fDataIni').value = '';
  document.getElementById('fDataFim').value = '';
  const s = document.getElementById('tblSearch');
  if (s) s.value = '';
  currentPage = 1;
  update();
}

function changePageSize() {
  pageSize = parseInt(document.getElementById('pageSize').value, 10) || 15;
  currentPage = 1;
  renderTable();
}

// ── Main update ───────────────────────────────────────────────────────────────

function update() {
  filteredData = getFiltered();
  renderMetrics(filteredData);
  renderChartSetor(filteredData);
  renderChartHoras(filteredData);
  renderChartMotivos(filteredData);
  renderTable();
}

// ── Metrics ───────────────────────────────────────────────────────────────────

function renderMetrics(data) {
  const total      = data.length;
  const resolvidos = data.filter(r => r.status === 'Fechado' || r.status === 'FechadoAssistenteVirtualInatividade').length;
  const emAndamento = data.filter(r => r.status === 'Atendendo' || r.status === 'AguardandoAvaliacao').length;
  const cancelados = data.filter(r => r.status === 'Cancelado').length;

  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const tempoAtendVals = data.map(r => r.tempoAtend).filter(v => v > 0);
  const respVals       = data.map(r => r.resposta).filter(v => v > 0);
  const resolVals      = data.map(r => r.tempoResol).filter(v => v > 0);

  const tempoAtendAvg = Math.round(avg(tempoAtendVals));
  const respAvg       = Math.round(avg(respVals));
  const resolAvg      = avg(resolVals);

  const pct = v => total ? Math.round(v / total * 100) + '%' : '0%';

  document.getElementById('metrics').innerHTML = `
    <div class="mc c-blue">
      <div class="mc-icon"><i class="ti ti-headset"></i></div>
      <div class="mc-val">${total}</div>
      <div class="mc-lbl">Total de chamados</div>
      <div class="mc-sub">100% do total</div>
    </div>
    <div class="mc c-green">
      <div class="mc-icon"><i class="ti ti-circle-check"></i></div>
      <div class="mc-val">${resolvidos}</div>
      <div class="mc-lbl">Resolvidos</div>
      <div class="mc-sub">${pct(resolvidos)} do total</div>
    </div>
    <div class="mc c-orange">
      <div class="mc-icon"><i class="ti ti-clock-pause"></i></div>
      <div class="mc-val">${emAndamento}</div>
      <div class="mc-lbl">Em andamento</div>
      <div class="mc-sub">${pct(emAndamento)} do total</div>
    </div>
    <div class="mc c-red">
      <div class="mc-icon"><i class="ti ti-x"></i></div>
      <div class="mc-val">${cancelados}</div>
      <div class="mc-lbl">Cancelados</div>
      <div class="mc-sub">${pct(cancelados)} do total</div>
    </div>
    <div class="mc c-purple">
      <div class="mc-icon"><i class="ti ti-stopwatch"></i></div>
      <div class="mc-val">${tempoAtendVals.length ? tempoAtendAvg + ' min' : '-'}</div>
      <div class="mc-lbl">Tempo médio atendimento</div>
    </div>
    <div class="mc c-cyan">
      <div class="mc-icon"><i class="ti ti-message-circle"></i></div>
      <div class="mc-val">${respVals.length ? respAvg + ' min' : '-'}</div>
      <div class="mc-lbl">Tempo médio 1ª resposta</div>
    </div>
    <div class="mc c-indigo">
      <div class="mc-icon"><i class="ti ti-calendar-time"></i></div>
      <div class="mc-val">${resolVals.length ? resolAvg.toFixed(1).replace('.', ',') + ' dias' : '-'}</div>
      <div class="mc-lbl">Tempo médio resolução</div>
    </div>
  `;
}

// ── Charts ────────────────────────────────────────────────────────────────────

function isDarkMode() {
  return false; // dashboard always uses the light theme
}

function gridColors() {
  return { tick: '#6b7280', grid: 'rgba(0,0,0,0.06)' };
}

function renderChartSetor(data) {
  const sums = {}, counts = {};
  data.forEach(r => {
    if (!r.setor || r.resposta <= 0) return;
    sums[r.setor] = (sums[r.setor] || 0) + r.resposta;
    counts[r.setor] = (counts[r.setor] || 0) + 1;
  });

  const entries = Object.keys(sums)
    .map(k => ({ setor: k, avg: sums[k] / counts[k] }))
    .sort((a, b) => b.avg - a.avg);

  const labels = entries.map(e => e.setor);
  const vals   = entries.map(e => Math.round(e.avg * 10) / 10);
  const { tick, grid } = gridColors();

  if (chartSetor) chartSetor.destroy();
  chartSetor = new Chart(document.getElementById('chartSetor'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Minutos',
        data: vals,
        backgroundColor: '#1E9E3D',
        borderRadius: 4,
        barThickness: 14,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true, ticks: { color: tick, font: { size: 11 } }, grid: { color: grid } },
        y: { ticks: { color: tick, font: { size: 11 } }, grid: { display: false } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function renderChartHoras(data) {
  const hours = {};
  for (let h = 0; h <= 23; h++) hours[h] = 0;

  data.forEach(r => {
    const h = getHour(r.abertura);
    if (h !== null && h >= 0 && h <= 23) hours[h] = (hours[h] || 0) + 1;
  });

  const hKeys = Object.keys(hours).map(Number).sort((a, b) => a - b);
  const { tick, grid } = gridColors();

  if (chartHoras) chartHoras.destroy();
  chartHoras = new Chart(document.getElementById('chartHoras'), {
    type: 'line',
    data: {
      labels: hKeys.map(h => h + 'h'),
      datasets: [{
        label: 'Chamados',
        data: hKeys.map(h => hours[h]),
        borderColor: '#2F6FED',
        backgroundColor: 'rgba(47,111,237,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#2F6FED',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, font: { size: 11 }, color: tick },
          grid: { color: grid },
        },
        x: {
          ticks: { font: { size: 10 }, autoSkip: true, maxRotation: 0, color: tick },
          grid: { display: false },
        },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function renderChartMotivos(data) {
  const counts = {};
  data.forEach(r => {
    const m = (r.solucao || '').trim();
    if (!m) return;
    counts[m] = (counts[m] || 0) + 1;
  });

  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);

  const labels = entries.map(([k]) => k.length > 28 ? k.slice(0, 26) + '…' : k);
  const vals   = entries.map(([, v]) => v);
  const { tick, grid } = gridColors();

  if (chartMotivos) chartMotivos.destroy();
  chartMotivos = new Chart(document.getElementById('chartMotivos'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Chamados',
        data: vals,
        backgroundColor: '#7C5CFC',
        borderRadius: 4,
        barThickness: 14,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true, ticks: { color: tick, font: { size: 11 } }, grid: { color: grid } },
        y: { ticks: { color: tick, font: { size: 11 } }, grid: { display: false } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

// ── Table ─────────────────────────────────────────────────────────────────────

function renderTable() {
  filteredData = getFiltered();
  const data = filteredData;
  const total = data.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > pages) currentPage = 1;

  const slice = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const canalIcon = r => {
    const d = (r.detalhes || '').toLowerCase() + ' ' + (r.canal || '').toLowerCase();
    if (d.includes('whatsapp')) return '<i class="ti ti-brand-whatsapp" style="color:#25D366;font-size:14px;vertical-align:-2px"></i> WhatsApp';
    if (d.includes('email') || d.includes('e-mail')) return '<i class="ti ti-mail" style="font-size:14px;vertical-align:-2px"></i> E-mail';
    if (d.includes('telefone') || d.includes('phone')) return '<i class="ti ti-phone" style="font-size:14px;vertical-align:-2px"></i> Telefone';
    if (d.includes('portal')) return '<i class="ti ti-world" style="font-size:14px;vertical-align:-2px"></i> Portal';
    return esc(r.canal) || '-';
  };

  document.getElementById('tblBody').innerHTML = slice.length
    ? slice.map(r => `
        <tr>
          <td style="font-weight:600">${esc(r.protocolo)}</td>
          <td>${esc(r.abertura)}</td>
          <td>${canalIcon(r)}</td>
          <td style="text-align:center">${r.tempoAtend || '-'}</td>
          <td style="text-align:center">${r.resposta || '-'}</td>
          <td>${esc(r.fechamento) || '-'}</td>
          <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">${esc(r.solucao) || '-'}</td>
          <td style="text-align:center">${r.tempoResol || '-'}</td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">${esc(r.setor) || '-'}</td>
          <td><span class="badge ${prioClass(r.prioridade)}">${esc(r.prioridade) || '-'}</span></td>
          <td><span class="badge ${STATUS_MAP[r.status]?.cls || ''}">${STATUS_MAP[r.status]?.label || esc(r.status)}</span></td>
          <td>${esc(r.criadoPor) || '-'}</td>
          <td>${esc(r.atendente) || '-'}</td>
          <td>${esc(r.contato) || '-'}${r.empresa ? `<span class="cell-sub">${esc(r.empresa)}</span>` : ''}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="14" style="text-align:center;padding:40px;color:var(--text-tertiary)">Nenhum resultado encontrado</td></tr>`;

  // Pagination
  const pg = document.getElementById('pagination');
  const start = total ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, total);
  let html = `<span class="pg-info">Mostrando ${start} a ${end} de ${total} registros</span>`;

  if (pages > 1) {
    html += `<button class="pg-btn" onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹ Anterior</button>`;
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - currentPage) <= 1) {
        html += `<button class="pg-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
      } else if (Math.abs(i - currentPage) === 2) {
        html += `<span class="pg-ellipsis">…</span>`;
      }
    }
    html += `<button class="pg-btn" onclick="goPage(${currentPage + 1})" ${currentPage === pages ? 'disabled' : ''}>Próximo ›</button>`;
  }

  pg.innerHTML = html;
}

function goPage(p) { currentPage = p; renderTable(); }

// ── Export ────────────────────────────────────────────────────────────────────

function buildExportRows() {
  return filteredData.map(r => ({
    'Protocolo': r.protocolo,
    'Data e Hora da Abertura': r.abertura,
    'Canal de Abertura': r.canal,
    'Tempo Gasto no Atendimento (min)': r.tempoAtend,
    'Tempo da 1ª Resposta (min)': r.resposta,
    'Data e Hora do Fechamento/Cancelamento': r.fechamento,
    'Solução do Problema/Motivo Cancelamento': r.solucao,
    'Tempo Resolução do Chamado (dias)': r.tempoResol,
    'Setor': r.setor,
    'Prioridade': r.prioridade,
    'Status': STATUS_MAP[r.status]?.label || r.status,
    'Atendimento Criado Por': r.criadoPor,
    'Atendente': r.atendente,
    'Contato': r.contato,
    'Empresa': r.empresa,
  }));
}

function exportData(type) {
  document.getElementById('exportMenu').classList.remove('open');
  const rows = buildExportRows();
  if (!rows.length) { alert('Não há dados para exportar.'); return; }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Atendimentos');

  const filename = 'atendimentos_' + new Date().toISOString().slice(0, 10);
  if (type === 'csv') {
    XLSX.writeFile(wb, filename + '.csv', { bookType: 'csv' });
  } else {
    XLSX.writeFile(wb, filename + '.xlsx', { bookType: 'xlsx' });
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.getElementById('fileInput').addEventListener('change', e => {
  if (e.target.files[0]) parseXLSX(e.target.files[0]);
});
document.getElementById('fileInput2').addEventListener('change', e => {
  if (e.target.files[0]) parseXLSX(e.target.files[0]);
});

const dz = document.getElementById('dropZone');
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
dz.addEventListener('drop', e => {
  e.preventDefault();
  dz.classList.remove('drag');
  if (e.dataTransfer.files[0]) parseXLSX(e.dataTransfer.files[0]);
});

document.getElementById('btnExport').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('exportMenu').classList.toggle('open');
});
document.addEventListener('click', () => {
  document.getElementById('exportMenu').classList.remove('open');
});
