'use strict';

let allData = [];
let chartStatus = null;
let chartHoras = null;
let currentPage = 1;
const PAGE_SIZE = 15;

const STATUS_MAP = {
  'Fechado':                             { label: 'Fechado',        cls: 'b-Fechado',    color: '#639922' },
  'Cancelado':                           { label: 'Cancelado',      cls: 'b-Cancelado',  color: '#A32D2D' },
  'FechadoAssistenteVirtualInatividade': { label: 'Bot/Inativ.',    cls: 'b-Bot',        color: '#BA7517' },
  'Atendendo':                           { label: 'Atendendo',      cls: 'b-Atendendo',  color: '#378ADD' },
  'AguardandoAvaliacao':                 { label: 'Ag. avaliação',  cls: 'b-Aguardando', color: '#534AB7' },
};

// ── File parsing ─────────────────────────────────────────────────────────────

function parseXLSX(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });

      allData = json.map(r => ({
        protocolo: r['Protocolo'] || '',
        abertura:  r['Data e Hora da Abertura'] || '',
        canal:     r['Canal de Abertura'] || '',
        detalhes:  r['Detalhes do canal de Abertura'] || '',
        atendente: r['Atendente'] || '',
        setor:     r['Setor'] || '',
        status:    r['Status'] || '',
        empresa:   r['Empresa'] || '',
        resposta:  parseFloat(r['Tempo da Primeira Resposta (minutos)']) || 0,
        solucao:   r['Solução do Problema/Motivo Cancelamento'] || '',
        descricao: r['Descrição do Problema'] || '',
      }));

      populateFilters();
      document.getElementById('uploadSection').style.display = 'none';
      document.getElementById('dashSection').style.display = 'block';
      document.getElementById('lastUpdate').textContent =
        'Atualizado: ' + new Date().toLocaleString('pt-BR');
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

  const fill = (id, placeholder, values) => {
    const el = document.getElementById(id);
    el.innerHTML = `<option value="">${placeholder}</option>` +
      values.map(v => {
        const label = id === 'fStatus' ? (STATUS_MAP[v]?.label || v) : v;
        return `<option value="${v}">${label}</option>`;
      }).join('');
    el.onchange = () => { currentPage = 1; update(); };
  };

  fill('fStatus',    'Status: Todos',    [...new Set(allData.map(r => r.status).filter(Boolean))]);
  fill('fAtendente', 'Atendente: Todos', unique('atendente'));
  fill('fSetor',     'Setor: Todos',     unique('setor'));
}

function getFiltered() {
  const fS  = document.getElementById('fStatus').value;
  const fA  = document.getElementById('fAtendente').value;
  const fSt = document.getElementById('fSetor').value;
  const q   = (document.getElementById('tblSearch')?.value || '').toLowerCase().trim();

  return allData.filter(r =>
    (!fS  || r.status    === fS) &&
    (!fA  || r.atendente === fA) &&
    (!fSt || r.setor     === fSt) &&
    (!q   || Object.values(r).join(' ').toLowerCase().includes(q))
  );
}

function clearFilters() {
  ['fStatus', 'fAtendente', 'fSetor'].forEach(id => {
    document.getElementById(id).value = '';
  });
  const s = document.getElementById('tblSearch');
  if (s) s.value = '';
  currentPage = 1;
  update();
}

// ── Main update ───────────────────────────────────────────────────────────────

function update() {
  const data = getFiltered();
  renderMetrics(data);
  renderChartStatus(data);
  renderChartHoras(data);
  renderBars(data);
  renderTable();
}

// ── Metrics ───────────────────────────────────────────────────────────────────

function renderMetrics(data) {
  const total     = data.length;
  const fechados  = data.filter(r => r.status === 'Fechado').length;
  const atendendo = data.filter(r => r.status === 'Atendendo').length;
  const cancelados = data.filter(r => r.status === 'Cancelado').length;
  const respostas = data.filter(r => r.resposta > 0).map(r => r.resposta);
  const avgResp   = respostas.length
    ? Math.round(respostas.reduce((a, b) => a + b, 0) / respostas.length)
    : 0;
  const pct = v => total ? Math.round(v / total * 100) + '%' : '0%';

  document.getElementById('metrics').innerHTML = `
    <div class="mc">
      <div class="mc-icon" style="color:#378ADD"><i class="ti ti-headset"></i></div>
      <div class="mc-val">${total}</div>
      <div class="mc-lbl">Total de chamados</div>
    </div>
    <div class="mc">
      <div class="mc-icon" style="color:#639922"><i class="ti ti-circle-check"></i></div>
      <div class="mc-val">${fechados}</div>
      <div class="mc-lbl">Fechados</div>
      <div class="mc-sub">${pct(fechados)} do total</div>
    </div>
    <div class="mc">
      <div class="mc-icon" style="color:#378ADD"><i class="ti ti-clock-pause"></i></div>
      <div class="mc-val">${atendendo}</div>
      <div class="mc-lbl">Em atendimento</div>
    </div>
    <div class="mc">
      <div class="mc-icon" style="color:#A32D2D"><i class="ti ti-x"></i></div>
      <div class="mc-val">${cancelados}</div>
      <div class="mc-lbl">Cancelados</div>
      <div class="mc-sub">${pct(cancelados)} do total</div>
    </div>
    <div class="mc">
      <div class="mc-icon" style="color:#534AB7"><i class="ti ti-clock"></i></div>
      <div class="mc-val">${avgResp} min</div>
      <div class="mc-lbl">Tempo médio 1ª resp.</div>
    </div>
  `;
}

// ── Charts ────────────────────────────────────────────────────────────────────

function renderChartStatus(data) {
  const counts = {};
  data.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
  const keys   = Object.keys(counts);
  const vals   = keys.map(k => counts[k]);
  const colors = keys.map(k => STATUS_MAP[k]?.color || '#888888');
  const labels = keys.map(k => STATUS_MAP[k]?.label || k);

  document.getElementById('legendStatus').innerHTML = keys.map((k, i) =>
    `<span class="leg-item">
       <span class="leg-sq" style="background:${colors[i]}"></span>
       ${labels[i]} (${vals[i]})
     </span>`
  ).join('');

  if (chartStatus) chartStatus.destroy();
  chartStatus = new Chart(document.getElementById('chartStatus'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: vals, backgroundColor: colors, borderWidth: 2, borderColor: 'transparent' }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

function renderChartHoras(data) {
  const hours = {};
  for (let h = 6; h <= 23; h++) hours[h] = 0;

  data.forEach(r => {
    const s = String(r.abertura);
    const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s*[-–]\s*(\d{2}):(\d{2})/) ||
              s.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (m) {
      const h = parseInt(m[4] !== undefined ? m[4] : m[4]);
      if (h >= 0 && h <= 23) hours[h] = (hours[h] || 0) + 1;
    }
  });

  const hKeys = Object.keys(hours).map(Number).sort((a, b) => a - b);
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (chartHoras) chartHoras.destroy();
  chartHoras = new Chart(document.getElementById('chartHoras'), {
    type: 'line',
    data: {
      labels: hKeys.map(h => h + 'h'),
      datasets: [{
        label: 'Chamados',
        data: hKeys.map(h => hours[h]),
        borderColor: '#378ADD',
        backgroundColor: 'rgba(55,138,221,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#378ADD',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, font: { size: 11 }, color: isDark ? '#a0a09a' : '#6b6b68' },
          grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
        },
        x: {
          ticks: { font: { size: 10 }, autoSkip: false, maxRotation: 0, color: isDark ? '#a0a09a' : '#6b6b68' },
          grid: { display: false },
        },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function renderBars(data) {
  const atdCount   = {};
  const setorCount = {};
  data.forEach(r => {
    if (r.atendente) atdCount[r.atendente]   = (atdCount[r.atendente]   || 0) + 1;
    if (r.setor)     setorCount[r.setor]     = (setorCount[r.setor]     || 0) + 1;
  });

  const buildBars = (obj, color) => {
    const max = Math.max(...Object.values(obj), 1);
    return Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .map(([lbl, val]) => `
        <div class="bar-wrap">
          <div class="bar-lbl"><span>${lbl}</span><span>${val}</span></div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${Math.round(val / max * 100)}%;background:${color}"></div>
          </div>
        </div>
      `).join('');
  };

  document.getElementById('barAtend').innerHTML =
    Object.keys(atdCount).length ? buildBars(atdCount, '#378ADD') : '<p class="empty-state">Sem dados</p>';
  document.getElementById('barSetor').innerHTML =
    Object.keys(setorCount).length ? buildBars(setorCount, '#534AB7') : '<p class="empty-state">Sem dados</p>';
}

// ── Table ─────────────────────────────────────────────────────────────────────

function renderTable() {
  const data = getFiltered();
  const total = data.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPage > pages) currentPage = 1;

  const slice = data.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const canalIcon = r => {
    const d = (r.detalhes || '').toLowerCase() + (r.canal || '').toLowerCase();
    if (d.includes('whatsapp')) return '<i class="ti ti-brand-whatsapp" style="color:#25D366;font-size:14px;vertical-align:-2px"></i> WhatsApp';
    if (d.includes('email') || d.includes('e-mail')) return '<i class="ti ti-mail" style="font-size:14px;vertical-align:-2px"></i> E-mail';
    if (d.includes('telefone') || d.includes('phone')) return '<i class="ti ti-phone" style="font-size:14px;vertical-align:-2px"></i> Telefone';
    if (d.includes('portal')) return '<i class="ti ti-world" style="font-size:14px;vertical-align:-2px"></i> Portal';
    return r.canal || '-';
  };

  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  document.getElementById('tblBody').innerHTML = slice.length
    ? slice.map(r => `
        <tr>
          <td style="font-weight:500">${esc(r.protocolo)}</td>
          <td>${esc(r.abertura)}</td>
          <td>${canalIcon(r)}</td>
          <td>${esc(r.atendente) || '-'}</td>
          <td>${esc(r.empresa) || '-'}</td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">${esc(r.setor) || '-'}</td>
          <td style="text-align:center">${r.resposta || '-'}</td>
          <td><span class="badge ${STATUS_MAP[r.status]?.cls || ''}">${STATUS_MAP[r.status]?.label || esc(r.status)}</span></td>
        </tr>
      `).join('')
    : `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-tertiary)">Nenhum resultado encontrado</td></tr>`;

  // Pagination
  const pg = document.getElementById('pagination');
  if (pages <= 1) { pg.innerHTML = ''; return; }

  let html = `<span>${total} registros</span>
    <button class="pg-btn" onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹ Anterior</button>`;

  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - currentPage) <= 1) {
      html += `<button class="pg-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
    } else if (Math.abs(i - currentPage) === 2) {
      html += `<span class="pg-ellipsis">…</span>`;
    }
  }

  html += `<button class="pg-btn" onclick="goPage(${currentPage + 1})" ${currentPage === pages ? 'disabled' : ''}>Próximo ›</button>`;
  pg.innerHTML = html;
}

function goPage(p) { currentPage = p; renderTable(); }

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
