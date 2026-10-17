/**
 * GeoVision 3D — Excel / CSV Import
 */
const ImportManager = {
  pendingData: null,
  type: 'layers', // 'layers' | 'survey'

  init() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length) this.handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', e => {
      if (e.target.files.length) this.handleFile(e.target.files[0]);
    });

    document.getElementById('btn-import-cancel').addEventListener('click', () => this.close());
    document.getElementById('btn-import-apply').addEventListener('click', () => this.apply(false));
    document.getElementById('btn-import-replace').addEventListener('click', () => this.apply(true));
  },

  open(type = 'layers') {
    this.type = type;
    this.pendingData = null;
    document.getElementById('import-preview').classList.add('hidden');
    document.getElementById('import-preview').innerHTML = '';
    document.getElementById('btn-import-apply').disabled = true;
    document.getElementById('btn-import-replace').disabled = true;
    document.getElementById('modal-import').classList.remove('hidden');
    document.querySelector('#modal-import h2').textContent =
      type === 'survey' ? 'Import Well Survey Data' : 'Import Geological Data';
  },

  close() {
    document.getElementById('modal-import').classList.add('hidden');
  },

  handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      alert('Please upload .xlsx, .xls or .csv file');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      try {
        let rows;
        if (ext === 'csv') {
          rows = this.parseCSV(e.target.result);
        } else {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        }
        this.validateAndPreview(rows);
      } catch (err) {
        alert('Error reading file: ' + err.message);
      }
    };
    if (ext === 'csv') reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  },

  parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj = {};
      headers.forEach((h, i) => obj[h] = vals[i] || '');
      return obj;
    });
  },

  validateAndPreview(rows) {
    if (!rows || rows.length === 0) {
      alert('No data found in file');
      return;
    }

    const preview = document.getElementById('import-preview');
    preview.classList.remove('hidden');

    if (this.type === 'layers') {
      const required = ['Formation', 'Top Depth', 'Bottom Depth'];
      const keys = Object.keys(rows[0]);
      const mapped = rows.map((r, i) => {
        const form = r.Formation || r.Name || r.name || r['Layer Name'] || `Layer ${i + 1}`;
        const top = parseFloat(r['Top Depth'] ?? r.Top ?? r.top ?? r.From);
        const bot = parseFloat(r['Bottom Depth'] ?? r.Bottom ?? r.bottom ?? r.To);
        const lith = r.Lithology || r.lithology || 'Sandstone';
        const color = r.Color || r.color || '';
        const opacity = parseFloat(r.Opacity ?? r.opacity ?? 0.85);
        const desc = r.Description || r.description || '';
        const valid = !isNaN(top) && !isNaN(bot) && bot > top;
        return { name: form, top, bottom: bot, lithology: lith, color, opacity, description: desc, valid, _raw: r };
      });

      this.pendingData = mapped;

      let html = `<p>${mapped.length} rows found. <span style="color:#f59e0b">${mapped.filter(m => !m.valid).length} invalid</span></p>`;
      html += `<div class="table-wrap"><table id="survey-table"><thead><tr>
        <th>Formation</th><th>Top</th><th>Bottom</th><th>Lithology</th><th>Status</th>
      </tr></thead><tbody>`;
      mapped.forEach(m => {
        html += `<tr style="${m.valid ? '' : 'background:rgba(239,68,68,0.15)'}">
          <td>${m.name}</td><td>${m.top}</td><td>${m.bottom}</td><td>${m.lithology}</td>
          <td>${m.valid ? '✓' : '✗ Invalid depths'}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
      preview.innerHTML = html;
    } else {
      // Survey
      const mapped = rows.map(r => {
        const md = parseFloat(r.MD ?? r.md ?? r['Measured Depth']);
        const tvd = parseFloat(r.TVD ?? r.tvd ?? 0);
        const inc = parseFloat(r.Inclination ?? r.Inc ?? r.inc ?? r['Inclination (°)'] ?? 0);
        const azi = parseFloat(r.Azimuth ?? r.Azi ?? r.azi ?? r['Azimuth (°)'] ?? 0);
        const valid = !isNaN(md);
        return { md, tvd, inc, azi, valid };
      }).filter(m => m.valid);

      this.pendingData = mapped;

      let html = `<p>${mapped.length} survey stations found.</p>`;
      html += `<div class="table-wrap"><table id="survey-table"><thead><tr>
        <th>MD</th><th>TVD</th><th>Inc°</th><th>Azi°</th>
      </tr></thead><tbody>`;
      mapped.forEach(m => {
        html += `<tr><td>${m.md}</td><td>${m.tvd}</td><td>${m.inc}</td><td>${m.azi}</td></tr>`;
      });
      html += '</tbody></table></div>';
      preview.innerHTML = html;
    }

    document.getElementById('btn-import-apply').disabled = false;
    document.getElementById('btn-import-replace').disabled = false;
  },

  apply(replace) {
    if (!this.pendingData) return;
    if (this.type === 'layers') {
      const valid = this.pendingData.filter(d => d.valid);
      const prepared = valid.map(d => ({
        name: d.name,
        top: d.top,
        bottom: d.bottom,
        lithology: LithologyLibrary.getByName(d.lithology)?.id || 'sandstone',
        color: d.color || LithologyLibrary.getByName(d.lithology)?.color || '#888',
        opacity: d.opacity,
        description: d.description
      }));
      LayersManager.setLayers(prepared, replace);
    } else {
      WellManager.setStations(this.pendingData);
      ChartsManager.update();
      GlobeManager.updateWellOnGlobe();
    }
    this.close();
    GeologyView.draw();
  },

  /**
   * Parse pasted text from Excel (tab or comma separated)
   */
  parsePasteText(text, type) {
    if (!text || !text.trim()) return [];
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return [];

    const first = lines[0];
    const delim = first.includes('\t') ? '\t' : ',';

    const headerWords = /formation|top|bottom|lithology|md|tvd|inclination|azimuth|name|depth|inc|azi/i;
    let start = 0;
    let headers = null;
    if (headerWords.test(first)) {
      headers = first.split(delim).map(h => h.trim().toLowerCase());
      start = 1;
    }

    const rows = [];
    for (let i = start; i < lines.length; i++) {
      const cols = lines[i].split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 2) continue;

      if (type === 'layers') {
        let name, top, bottom, lith, color, opacity, desc;
        if (headers) {
          const get = (keys) => {
            for (const k of keys) {
              const idx = headers.findIndex(h => h.includes(k));
              if (idx >= 0 && cols[idx] !== undefined) return cols[idx];
            }
            return '';
          };
          name = get(['formation', 'name', 'layer']) || cols[0];
          top = parseFloat(get(['top', 'from', 'start']) || cols[1]);
          bottom = parseFloat(get(['bottom', 'to', 'end']) || cols[2]);
          lith = get(['lithology', 'lith', 'rock']) || cols[3] || 'Sandstone';
          color = get(['color', 'colour']) || '';
          opacity = parseFloat(get(['opacity', 'alpha']) || '0.85') || 0.85;
          desc = get(['description', 'desc', 'note']) || '';
        } else {
          name = cols[0] || 'Layer';
          top = parseFloat(cols[1]);
          bottom = parseFloat(cols[2]);
          lith = cols[3] || 'Sandstone';
          color = cols[4] || '';
          opacity = parseFloat(cols[5]) || 0.85;
          desc = cols[6] || '';
        }
        const valid = !isNaN(top) && !isNaN(bottom) && bottom > top;
        rows.push({ name, top, bottom, lithology: lith, color, opacity, description: desc, valid });
      } else {
        let md, tvd, inc, azi;
        if (headers) {
          const get = (keys) => {
            for (const k of keys) {
              const idx = headers.findIndex(h => h.includes(k));
              if (idx >= 0 && cols[idx] !== undefined) return cols[idx];
            }
            return '';
          };
          md = parseFloat(get(['md', 'measured']) || cols[0]);
          tvd = parseFloat(get(['tvd', 'vertical']) || cols[1] || '0');
          inc = parseFloat(get(['inc', 'inclination', 'dip']) || cols[2] || '0');
          azi = parseFloat(get(['azi', 'azimuth', 'direction']) || cols[3] || '0');
        } else {
          md = parseFloat(cols[0]);
          tvd = parseFloat(cols[1]) || 0;
          inc = parseFloat(cols[2]) || 0;
          azi = parseFloat(cols[3]) || 0;
        }
        const valid = !isNaN(md);
        rows.push({ md, tvd: isNaN(tvd) ? 0 : tvd, inc: isNaN(inc) ? 0 : inc, azi: isNaN(azi) ? 0 : azi, valid });
      }
    }
    return rows;
  },

  applyPaste(type, replace) {
    const textareaId = type === 'layers' ? 'paste-layers' : 'paste-survey';
    const previewId = type === 'layers' ? 'paste-layers-preview' : 'paste-survey-preview';
    const text = document.getElementById(textareaId).value;
    const rows = this.parsePasteText(text, type);

    if (rows.length === 0) {
      alert('No valid data. Copy from Excel and paste again.');
      return;
    }

    const valid = rows.filter(r => r.valid);
    if (valid.length === 0) {
      alert('All rows have errors. Check columns and numbers.');
      return;
    }

    const prev = document.getElementById(previewId);
    if (prev) {
      prev.classList.remove('hidden');
      prev.innerHTML = '<span class="ok">' + valid.length + ' valid rows</span>' +
        (rows.length > valid.length ? ' — <span class="bad">' + (rows.length - valid.length) + ' rejected</span>' : '') +
        '<br>' + valid.slice(0, 6).map(r => {
          if (type === 'layers') return r.name + ': ' + r.top + '–' + r.bottom + ' m';
          return 'MD ' + r.md + ' / Inc ' + r.inc + '°';
        }).join('<br>');
    }

    if (type === 'layers') {
      const prepared = valid.map(d => ({
        name: d.name,
        top: d.top,
        bottom: d.bottom,
        lithology: (typeof LithologyLibrary !== 'undefined' && LithologyLibrary.getByName(d.lithology)?.id) || 'sandstone',
        color: d.color || (typeof LithologyLibrary !== 'undefined' && LithologyLibrary.getByName(d.lithology)?.color) || '#888888',
        opacity: d.opacity,
        description: d.description
      }));
      LayersManager.setLayers(prepared, replace);
    } else {
      WellManager.setStations(valid);
      if (typeof ChartsManager !== 'undefined') ChartsManager.update();
      if (typeof GlobeManager !== 'undefined' && GlobeManager.viewer) GlobeManager.updateWellOnGlobe();
    }
    if (typeof GeologyView !== 'undefined') GeologyView.draw();
  }
};
