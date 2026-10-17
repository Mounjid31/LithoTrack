/**
 * Drilling parameters, gases, formation tops, comments helpers
 */
const TopsManager = {
  tops: [],
  generateId() { return 'top_' + Date.now() + Math.floor(Math.random() * 99); },
  add(name, depth, thickness, color) {
    this.tops.push({
      id: this.generateId(),
      name: name || 'Top',
      depth: parseFloat(depth) || 0,
      thickness: parseFloat(thickness) || 0,
      color: color || '#f472b6'
    });
    this.tops.sort((a, b) => a.depth - b.depth);
    this.render();
    document.dispatchEvent(new CustomEvent('tops-changed'));
  },
  remove(id) {
    this.tops = this.tops.filter(t => t.id !== id);
    this.render();
    document.dispatchEvent(new CustomEvent('tops-changed'));
  },
  clear() {
    this.tops = [];
    this.render();
    document.dispatchEvent(new CustomEvent('tops-changed'));
  },
  set(arr) {
    this.tops = arr || [];
    this.render();
  },
  render() {
    const el = document.getElementById('tops-list');
    if (!el) return;
    el.innerHTML = this.tops.map(t =>
      '<div class="casing-item"><span>' + t.name + '</span><span>' + t.depth + ' m</span>' +
      (t.thickness ? '<span>th ' + t.thickness + '</span>' : '') +
      '<button class="small-btn" data-tdel="' + t.id + '">×</button></div>'
    ).join('');
    el.querySelectorAll('[data-tdel]').forEach(b =>
      b.addEventListener('click', () => this.remove(b.dataset.tdel))
    );
  }
};

const DrillingParams = {
  rows: [], // {depth, rop, wob, rpm, tq, spp, gpm}
  clear() { this.rows = []; this.render(); this.updateChart(); },
  set(rows) { this.rows = rows || []; this.render(); this.updateChart(); },
  parsePaste(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    const out = [];
    lines.forEach((line, i) => {
      if (/depth|rop|wob/i.test(line) && i === 0) return;
      const c = line.split(/[\t,;]+/).map(x => x.trim());
      if (c.length < 2) return;
      out.push({
        depth: parseFloat(c[0]) || 0,
        rop: parseFloat(c[1]) || 0,
        wob: parseFloat(c[2]) || 0,
        rpm: parseFloat(c[3]) || 0,
        tq: parseFloat(c[4]) || 0,
        spp: parseFloat(c[5]) || 0,
        gpm: parseFloat(c[6]) || 0
      });
    });
    this.rows = out;
    this.render();
    this.updateChart();
  },
  render() {
    const tb = document.getElementById('drill-params-body');
    if (!tb) return;
    tb.innerHTML = '';
    if (!this.rows.length) {
      for (let i = 0; i < 4; i++) this.addEmptyRow(tb);
      return;
    }
    this.rows.forEach(r => this.addEmptyRow(tb, r));
  },
  addEmptyRow(tb, r) {
    r = r || {};
    const tr = document.createElement('tr');
    ['depth', 'rop', 'wob', 'rpm', 'tq', 'spp', 'gpm'].forEach(k => {
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.step = 'any';
      inp.value = r[k] != null ? r[k] : '';
      inp.dataset.col = k;
      inp.addEventListener('change', () => this.readFromGrid());
      td.appendChild(inp);
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  },
  readFromGrid() {
    const tb = document.getElementById('drill-params-body');
    if (!tb) return;
    this.rows = [];
    tb.querySelectorAll('tr').forEach(tr => {
      const o = {};
      tr.querySelectorAll('input').forEach(inp => { o[inp.dataset.col] = parseFloat(inp.value) || 0; });
      if (o.depth || o.rop) this.rows.push(o);
    });
    this.updateChart();
  },
  chart: null,
  updateChart() {
    const canvas = document.getElementById('chart-drill');
    if (!canvas || typeof Chart === 'undefined') return;
    const labels = this.rows.map(r => r.depth);
    const mk = (key, color) => ({
      label: key.toUpperCase(),
      data: this.rows.map(r => r[key]),
      borderColor: color,
      tension: 0.2,
      pointRadius: 0,
      borderWidth: 1.5
    });
    const datasets = [
      mk('rop', '#00d4ff'), mk('wob', '#f59e0b'), mk('rpm', '#10b981'),
      mk('tq', '#a78bfa'), mk('spp', '#fb7185'), mk('gpm', '#38bdf8')
    ];
    if (this.chart) {
      this.chart.data.labels = labels;
      this.chart.data.datasets = datasets;
      this.chart.update('none');
      return;
    }
    this.chart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8', font: { size: 9 } }, title: { display: true, text: 'Drilling Parameters', color: '#00d4ff' } } },
        scales: {
          x: { title: { display: true, text: 'Depth', color: '#64748b' }, ticks: { color: '#64748b', font: { size: 8 } }, grid: { color: '#1e293b' } },
          y: { ticks: { color: '#64748b', font: { size: 8 } }, grid: { color: '#1e293b' } }
        }
      }
    });
  }
};

const GasParams = {
  rows: [], // depth, tgas, c1, c2, c3, ic4, nc4, ic5, nc5
  clear() { this.rows = []; this.render(); this.updateChart(); },
  set(rows) { this.rows = rows || []; this.render(); this.updateChart(); },
  parsePaste(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    const out = [];
    lines.forEach((line, i) => {
      if (/t\.?gas|c1|depth/i.test(line) && i === 0) return;
      const c = line.split(/[\t,;]+/).map(x => x.trim());
      if (c.length < 2) return;
      out.push({
        depth: parseFloat(c[0]) || 0,
        tgas: parseFloat(c[1]) || 0,
        c1: parseFloat(c[2]) || 0,
        c2: parseFloat(c[3]) || 0,
        c3: parseFloat(c[4]) || 0,
        ic4: parseFloat(c[5]) || 0,
        nc4: parseFloat(c[6]) || 0,
        ic5: parseFloat(c[7]) || 0,
        nc5: parseFloat(c[8]) || 0
      });
    });
    this.rows = out;
    this.render();
    this.updateChart();
  },
  render() {
    const tb = document.getElementById('gas-params-body');
    if (!tb) return;
    tb.innerHTML = '';
    if (!this.rows.length) {
      for (let i = 0; i < 4; i++) this.addEmptyRow(tb);
      return;
    }
    this.rows.forEach(r => this.addEmptyRow(tb, r));
  },
  addEmptyRow(tb, r) {
    r = r || {};
    const tr = document.createElement('tr');
    ['depth', 'tgas', 'c1', 'c2', 'c3', 'ic4', 'nc4', 'ic5', 'nc5'].forEach(k => {
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.step = 'any';
      inp.value = r[k] != null ? r[k] : '';
      inp.dataset.col = k;
      inp.addEventListener('change', () => this.readFromGrid());
      td.appendChild(inp);
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  },
  readFromGrid() {
    const tb = document.getElementById('gas-params-body');
    if (!tb) return;
    this.rows = [];
    tb.querySelectorAll('tr').forEach(tr => {
      const o = {};
      tr.querySelectorAll('input').forEach(inp => { o[inp.dataset.col] = parseFloat(inp.value) || 0; });
      if (o.depth || o.tgas || o.c1) this.rows.push(o);
    });
    this.updateChart();
  },
  chart: null,
  updateChart() {
    const canvas = document.getElementById('chart-gas');
    if (!canvas || typeof Chart === 'undefined') return;
    const labels = this.rows.map(r => r.depth);
    const colors = { tgas: '#f59e0b', c1: '#00d4ff', c2: '#10b981', c3: '#a78bfa', ic4: '#fb7185', nc4: '#38bdf8', ic5: '#eab308', nc5: '#c084fc' };
    const datasets = Object.keys(colors).map(k => ({
      label: k === 'tgas' ? 'T.Gas' : k.toUpperCase(),
      data: this.rows.map(r => r[k]),
      borderColor: colors[k],
      tension: 0.2,
      pointRadius: 0,
      borderWidth: 1.5
    }));
    if (this.chart) {
      this.chart.data.labels = labels;
      this.chart.data.datasets = datasets;
      this.chart.update('none');
      return;
    }
    this.chart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8', font: { size: 8 } }, title: { display: true, text: 'Gases', color: '#f59e0b' } } },
        scales: {
          x: { title: { display: true, text: 'Depth', color: '#64748b' }, ticks: { color: '#64748b', font: { size: 8 } }, grid: { color: '#1e293b' } },
          y: { ticks: { color: '#64748b', font: { size: 8 } }, grid: { color: '#1e293b' } }
        }
      }
    });
  }
};

/** Free comments at depth + horizontal position */
const CommentsManager = {
  items: [],
  generateId() { return 'cmt_' + Date.now() + Math.floor(Math.random() * 99); },
  add(text, depth, positionPct, color) {
    this.items.push({
      id: this.generateId(),
      text: text || '',
      depth: parseFloat(depth) || 0,
      position: Math.max(0, Math.min(100, parseFloat(positionPct) || 10)), // % across section width
      color: color || '#fbbf24'
    });
    this.render();
    document.dispatchEvent(new CustomEvent('comments-changed'));
  },
  remove(id) {
    this.items = this.items.filter(c => c.id !== id);
    this.render();
    document.dispatchEvent(new CustomEvent('comments-changed'));
  },
  clear() {
    this.items = [];
    this.render();
    document.dispatchEvent(new CustomEvent('comments-changed'));
  },
  set(arr) {
    this.items = arr || [];
    this.render();
  },
  render() {
    const el = document.getElementById('comments-list');
    if (!el) return;
    el.innerHTML = this.items.map(c =>
      '<div class="casing-item"><span>@' + c.depth + 'm</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis">' +
      (c.text || '') + '</span><button class="small-btn" data-cdel="' + c.id + '">×</button></div>'
    ).join('');
    el.querySelectorAll('[data-cdel]').forEach(b =>
      b.addEventListener('click', () => this.remove(b.dataset.cdel))
    );
  }
};

/** User-defined templates */
const TemplateManager = {
  saveTemplate(name, options) {
    // options: which parts to include
    const data = {
      version: 4,
      type: 'geovision_template',
      name: name || 'My Template',
      createdAt: new Date().toISOString(),
      include: options || {
        layers: true, survey: true, casings: true, tops: true,
        comments: true, header: true, drilling: true, gases: true
      },
      payload: {}
    };
    const inc = data.include;
    if (inc.layers) data.payload.layers = JSON.parse(JSON.stringify(LayersManager.layers));
    if (inc.survey) data.payload.survey = JSON.parse(JSON.stringify(WellManager.stations));
    if (inc.casings && typeof CasingManager !== 'undefined')
      data.payload.casings = JSON.parse(JSON.stringify(CasingManager.casings));
    if (inc.tops && typeof TopsManager !== 'undefined')
      data.payload.tops = JSON.parse(JSON.stringify(TopsManager.tops));
    if (inc.comments && typeof CommentsManager !== 'undefined')
      data.payload.comments = JSON.parse(JSON.stringify(CommentsManager.items));
    if (inc.header && typeof ExportHeader !== 'undefined')
      data.payload.header = JSON.parse(JSON.stringify(ExportHeader.fields));
    if (inc.drilling && typeof DrillingParams !== 'undefined')
      data.payload.drilling = JSON.parse(JSON.stringify(DrillingParams.rows));
    if (inc.gases && typeof GasParams !== 'undefined')
      data.payload.gases = JSON.parse(JSON.stringify(GasParams.rows));
    if (typeof WellsManager !== 'undefined') {
      WellsManager.captureCurrentIntoActive();
      data.payload.activeWell = WellsManager.getActive();
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (name || 'template').replace(/\s+/g, '_') + '.gvtemplate.json';
    a.click();
    // also store last template name in localStorage list
    try {
      const list = JSON.parse(localStorage.getItem('geovision_templates') || '[]');
      list.unshift({ name: data.name, savedAt: data.createdAt });
      localStorage.setItem('geovision_templates', JSON.stringify(list.slice(0, 20)));
    } catch (e) {}
    return data;
  },

  loadTemplate(data) {
    if (!data || !data.payload) throw new Error('Invalid template');
    const p = data.payload;
    const inc = data.include || {};
    if (p.layers && inc.layers !== false) LayersManager.setLayers(p.layers, true);
    if (p.survey && inc.survey !== false) WellManager.setStations(p.survey);
    if (p.casings && typeof CasingManager !== 'undefined') CasingManager.setCasings(p.casings);
    if (p.tops && typeof TopsManager !== 'undefined') TopsManager.set(p.tops);
    if (p.comments && typeof CommentsManager !== 'undefined') CommentsManager.set(p.comments);
    if (p.header && typeof ExportHeader !== 'undefined') {
      Object.assign(ExportHeader.fields, p.header);
      // push to UI inputs
      const map = {
        company: 'hdr-company', wellName: 'hdr-well', field: 'hdr-field', area: 'hdr-area',
        country: 'hdr-country', rig: 'hdr-rig', airGap: 'hdr-airgap', wd: 'hdr-wd', rkb: 'hdr-rkb',
        spudDate: 'hdr-spud', tdDate: 'hdr-tddate', tdDepth: 'hdr-td', wellStatus: 'hdr-status',
        coordX: 'hdr-x', coordY: 'hdr-y', latitude: 'hdr-lat', longitude: 'hdr-lon',
        geologist: 'hdr-geo', crew: 'hdr-crew', wellConfig: 'hdr-wellconfig', scale: 'hdr-scale'
      };
      Object.keys(map).forEach(k => {
        const el = document.getElementById(map[k]);
        if (el && p.header[k] != null) el.value = p.header[k];
      });
    }
    if (p.drilling && typeof DrillingParams !== 'undefined') DrillingParams.set(p.drilling);
    if (p.gases && typeof GasParams !== 'undefined') GasParams.set(p.gases);
    if (typeof GeologyView !== 'undefined') GeologyView.draw();
    if (typeof ChartsManager !== 'undefined') ChartsManager.update();
    if (typeof WellsManager !== 'undefined') WellsManager.persist();
  }
};

/**
 * Multi-page lithology PDF-like export via print window
 * pages: number of pages to split depth range across
 */

/**
 * Scale-based lithology export
 * scale: meters of depth per page (PDF) OR pixels per meter (PNG long image)
 * mode: 'pdf' | 'png'
 */

/**
 * Scale-based lithology export — real PDF file via jsPDF (offline)
 */
function exportLithologyByScale(opts) {
  opts = opts || {};
  const mode = opts.mode || 'pdf';
  const metersPerPage = Math.max(50, parseFloat(opts.metersPerPage) || 500);
  const pxPerMeter = Math.max(0.5, parseFloat(opts.pxPerMeter) || 2);
  const withTracks = false; // lithology only
  const withComments = opts.withComments !== false;

  const minD = GeologyView.minDepth;
  const maxD = GeologyView.maxDepth;
  const total = Math.max(1, maxD - minD);
  const prevMin = minD;
  const prevMax = maxD;
  const prevShow = GeologyView.showComments;
  GeologyView.showComments = withComments;

  if (mode === 'png') {
    setTimeout(function () {
      try {
        const canvas = renderScaledSection(minD, maxD, pxPerMeter, false);
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = ((ExportHeader.fields && ExportHeader.fields.wellName) || 'well') + '_scale.png';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { a.remove(); }, 300);
      } catch (e) {
        alert('PNG export failed: ' + e.message);
      } finally {
        GeologyView.setDepthRange(prevMin, prevMax);
        GeologyView.setFilter(prevMin, prevMax);
        GeologyView.showComments = prevShow;
        GeologyView.draw();
      }
    }, 80);
    return;
  }

  // continuous = one long log page (default look user wants)
  if (opts.continuous) {
    setTimeout(function () {
      try {
        // denser vertical resolution for a readable continuous log
        const px = Math.max(1.5, parseFloat(opts.pxPerMeter) || Math.min(3, 1500 / total));
        const canvas = renderScaledSection(minD, maxD, px, false);
        buildContinuousPdf(canvas);
      } catch (e) {
        console.error(e);
        alert('Continuous PDF failed: ' + e.message);
      } finally {
        GeologyView.setDepthRange(prevMin, prevMax);
        GeologyView.setFilter(prevMin, prevMax);
        GeologyView.showComments = prevShow;
        GeologyView.draw();
      }
    }, 60);
    return;
  }

  // Multi-page PDF — full-bleed pages (no margins), continuous depth strips
  const pageCount = Math.max(1, Math.ceil(total / metersPerPage));
  const pages = [];
  let i = 0;

  function nextPage() {
    if (i >= pageCount) {
      GeologyView.setDepthRange(prevMin, prevMax);
      GeologyView.setFilter(prevMin, prevMax);
      GeologyView.showComments = prevShow;
      GeologyView.draw();
      buildRealPdf(pages);
      return;
    }
    const from = minD + i * metersPerPage;
    const to = Math.min(maxD, minD + (i + 1) * metersPerPage);
    try {
      // Fill page height: scale px so strip is tall and fills A4 when stretched
      const c = renderScaledSection(from, to, Math.max(2, 900 / Math.max(1, to - from)), false);
      pages.push({ dataUrl: c.toDataURL('image/jpeg', 0.72), from: from, to: to, page: i + 1 });
    } catch (e) {
      console.error('page', i, e);
    }
    i++;
    setTimeout(nextPage, 50);
  }
  setTimeout(nextPage, 40);
}

function getJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
  if (window.jsPDF) return window.jsPDF;
  return null;
}


function buildRealPdf(pages) {
  const JsPDF = getJsPDF();
  const well = (ExportHeader.fields && ExportHeader.fields.wellName) || 'WELL';
  if (!JsPDF) {
    alert('PDF library missing — downloading HTML for print');
    openPrintWindow(pages, pages.length);
    return;
  }
  try {
    // Full-bleed multi-page: image fills entire page, no white/black margins
    const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    pages.forEach(function (pg, idx) {
      if (idx > 0) doc.addPage();
      // Stretch section to full page (edge to edge)
      doc.addImage(pg.dataUrl, 'JPEG', 0, 0, pageW, pageH, undefined, 'MEDIUM');
    });
    doc.save((well.replace(/\s+/g, '_') || 'lithology') + '_scale.pdf');
  } catch (e) {
    console.error(e);
    alert('PDF build failed: ' + e.message);
    openPrintWindow(pages, pages.length);
  }
}

/** One continuous log page — full depth, no page breaks, fills full page width */
function buildContinuousPdf(canvas) {
  const JsPDF = getJsPDF();
  const well = (ExportHeader.fields && ExportHeader.fields.wellName) || 'WELL';
  if (!JsPDF) {
    alert('PDF library missing');
    return;
  }
  try {
    const pageW = 210; // mm (A4 width)
    const aspect = canvas.height / Math.max(1, canvas.width);
    // Cap extreme height for PDF engines (~5 meters of paper max practical)
    let pageH = pageW * aspect;
    pageH = Math.max(297, Math.min(pageH, 1200));
    const doc = new JsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pageW, pageH],
      compress: true
    });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    doc.addImage(dataUrl, 'JPEG', 0, 0, pageW, pageH, undefined, 'MEDIUM');
    doc.save((well.replace(/\s+/g, '_') || 'lithology') + '_continuous.pdf');
  } catch (e) {
    console.error(e);
    alert('Continuous PDF failed: ' + e.message);
  }
}

function renderScaledSection(from, to, pxPerMeter, withTracks) {
  GeologyView.setDepthRange(from, to);
  GeologyView.setFilter(from, to);
  GeologyView.draw();
  const src = document.getElementById('geology-canvas');
  const depthSpan = Math.max(1, to - from);
  // Balanced size: readable but small PDF (~0.5–2 MB typical)
  const midH = Math.max(400, Math.min(3500, Math.round(depthSpan * pxPerMeter)));
  const midW = Math.min(src.width || 900, 900);
  const out = document.createElement('canvas');
  out.width = midW;
  out.height = midH;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.fillStyle = '#0a0e17';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, midW, midH);
  return out;
}

function openPrintWindow(pages, pageCount) {
  const well = (ExportHeader.fields && ExportHeader.fields.wellName) || 'WELL';
  let html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lithology</title><style>' +
    '@page{size:A4 portrait;margin:10mm}body{font-family:sans-serif;margin:0}' +
    '.page{page-break-after:always;padding:6px}.page:last-child{page-break-after:auto}' +
    'img{width:100%;height:auto}</style></head><body>';
  pages.forEach(function (pg) {
    html += '<div class="page"><h2>' + well + ' p' + pg.page + ' ' + pg.from.toFixed(0) + '-' + pg.to.toFixed(0) +
      'm</h2><img src="' + pg.dataUrl + '"/></div>';
  });
  html += '</body></html>';
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = well + '_print.html';
  a.click();
}

/** legacy wrapper */
function exportLithologyPages(pageCount, asPdf) {
  const minD = GeologyView.minDepth;
  const maxD = GeologyView.maxDepth;
  const total = Math.max(1, maxD - minD);
  const n = Math.max(1, parseInt(pageCount) || 1);
  exportLithologyByScale({
    mode: 'pdf',
    metersPerPage: total / n,
    withTracks: false,
    withComments: true
  });
}

