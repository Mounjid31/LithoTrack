/**
 * GeoVision 3D — Multi-Well Project Manager
 */
const WellsManager = {
  wells: [],
  activeId: null,
  autoSaveKey: 'geovision_autosave',

  generateId() {
    return 'well_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  },

  createWell(name) {
    const id = this.generateId();
    const well = {
      id,
      name: name || ('Well-' + (this.wells.length + 1)),
      lat: 30.0444,
      lon: 31.2357,
      layers: null, // null = use global LayersManager defaults on first load
      survey: null,
      casings: [
        // example empty; user fills
      ],
      sectionAzimuth: 90,
      ve: 2,
      minDepth: 0,
      maxDepth: 3500,
      mwd: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.wells.push(well);
    this.activeId = id;
    this.persist();
    this.renderSelector();
    return well;
  },

  getActive() {
    return this.wells.find(w => w.id === this.activeId) || null;
  },

  switchTo(id) {
    if (this.activeId === id) return;
    // Save current state into active well first
    this.captureCurrentIntoActive();
    this.activeId = id;
    this.loadActiveIntoUI();
    this.persist();
    this.renderSelector();
    document.dispatchEvent(new CustomEvent('well-switched'));
  },

  captureCurrentIntoActive() {
    const w = this.getActive();
    if (!w) return;
    w.lat = parseFloat(document.getElementById('input-lat')?.value) || w.lat;
    w.lon = parseFloat(document.getElementById('input-lon')?.value) || w.lon;
    w.layers = JSON.parse(JSON.stringify(LayersManager.layers));
    w.survey = JSON.parse(JSON.stringify(WellManager.stations));
    w.casings = JSON.parse(JSON.stringify(CasingManager?.casings || w.casings || []));
    w.sectionAzimuth = parseFloat(document.getElementById('section-azimuth')?.value) || 90;
    w.ve = parseFloat(document.getElementById('ve-slider')?.value) || 2;
    w.minDepth = parseFloat(document.getElementById('min-depth')?.value) || 0;
    w.maxDepth = parseFloat(document.getElementById('max-depth')?.value) || 3500;
    if (typeof MWDEngine !== 'undefined') w.mwd = MWDEngine.snapshot();
    w.updatedAt = new Date().toISOString();
  },

  loadActiveIntoUI() {
    const w = this.getActive();
    if (!w) return;
    const latEl = document.getElementById('input-lat');
    const lonEl = document.getElementById('input-lon');
    if (latEl) latEl.value = w.lat;
    if (lonEl) lonEl.value = w.lon;
    if (w.layers && w.layers.length) {
      LayersManager.setLayers(w.layers, true);
    } else {
      LayersManager.reset();
    }
    if (w.survey && w.survey.length) {
      WellManager.setStations(w.survey);
    } else {
      WellManager.init();
    }
    if (typeof CasingManager !== 'undefined') {
      CasingManager.setCasings(w.casings || []);
    }
    const az = document.getElementById('section-azimuth');
    const ve = document.getElementById('ve-slider');
    const minD = document.getElementById('min-depth');
    const maxD = document.getElementById('max-depth');
    if (az) az.value = w.sectionAzimuth;
    if (ve) {
      ve.value = w.ve;
      const disp = document.getElementById('ve-display');
      if (disp) disp.textContent = Number(w.ve).toFixed(1);
    }
    if (minD) minD.value = w.minDepth;
    if (maxD) maxD.value = w.maxDepth;
    WellManager.setWellhead(w.lat, w.lon);
    if (typeof GeologyView !== 'undefined') {
      GeologyView.setSection(w.sectionAzimuth, GeologyView.sectionLength);
      GeologyView.setVE(w.ve);
      GeologyView.setDepthRange(w.minDepth, w.maxDepth);
      GeologyView.draw();
    }
    if (typeof MWDEngine !== 'undefined') {
      MWDEngine.restore(w.mwd || null);
      if (typeof MWDUI !== 'undefined') MWDUI.renderAll();
      if (typeof MWDLogViewer !== 'undefined') {
        MWDLogViewer.show(!!(w.mwd && w.mwd.samples && w.mwd.samples.length));
        MWDLogViewer.resize();
      }
    }
    if (typeof ChartsManager !== 'undefined') ChartsManager.update();
    WellManager.updateStats();
  },

  renameActive(name) {
    const w = this.getActive();
    if (!w || !name) return;
    w.name = name;
    w.updatedAt = new Date().toISOString();
    this.persist();
    this.renderSelector();
  },

  deleteActive() {
    if (this.wells.length <= 1) {
      alert('Must keep at least one well');
      return;
    }
    const idx = this.wells.findIndex(w => w.id === this.activeId);
    if (idx < 0) return;
    this.wells.splice(idx, 1);
    this.activeId = this.wells[Math.max(0, idx - 1)].id;
    this.loadActiveIntoUI();
    this.persist();
    this.renderSelector();
  },

  newProject() {
    this.wells = [];
    const id = this.generateId();
    this.wells.push({
      id, name: 'Well-1', lat: 0, lon: 0,
      layers: [], survey: [{ md: 0, tvd: 0, inc: 0, azi: 0 }],
      casings: [], sectionAzimuth: 90, ve: 2, minDepth: 0, maxDepth: 3500,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    this.activeId = id;
    LayersManager.layers = [];
    LayersManager.renderList();
    LayersManager.hideProps && LayersManager.hideProps();
    WellManager.stations = [{ md: 0, tvd: 0, inc: 0, azi: 0 }];
    WellManager.calculateTrajectory();
    WellManager.renderTable();
    WellManager.updateStats();
    if (typeof CasingManager !== 'undefined') CasingManager.setCasings([]);
    if (typeof TopsManager !== 'undefined') TopsManager.clear();
    if (typeof DrillingParams !== 'undefined') DrillingParams.clear();
    if (typeof GasParams !== 'undefined') GasParams.clear();
    if (typeof MWDEngine !== 'undefined') {
      MWDEngine.restore(null);
      if (typeof MWDUI !== 'undefined') MWDUI.renderAll();
      if (typeof MWDLogViewer !== 'undefined') MWDLogViewer.show(false);
    }
    const lat = document.getElementById('input-lat');
    const lon = document.getElementById('input-lon');
    if (lat) lat.value = 0;
    if (lon) lon.value = 0;
    this.loadActiveIntoUI();
    this.persist();
    this.renderSelector();
  },

  persist() {
    this.captureCurrentIntoActive();
    try {
      const payload = {
        version: 4,
        activeId: this.activeId,
        wells: this.wells,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(this.autoSaveKey, JSON.stringify(payload));
    } catch (e) {
      console.warn('Autosave failed', e);
    }
  },

  restoreAutosave() {
    try {
      const raw = localStorage.getItem(this.autoSaveKey);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data.wells || !data.wells.length) return false;
      this.wells = data.wells;
      this.activeId = data.activeId || this.wells[0].id;
      this.loadActiveIntoUI();
      this.renderSelector();
      return true;
    } catch (e) {
      return false;
    }
  },

  exportProject(editable) {
    this.captureCurrentIntoActive();
    const payload = {
      version: 3,
      editable: !!editable,
      activeId: this.activeId,
      wells: this.wells,
      exportedAt: new Date().toISOString()
    };
    if (!editable) {
      // freeze: strip edit hints, mark read-only
      payload.readOnly = true;
      payload.wells = JSON.parse(JSON.stringify(this.wells));
    }
    const blob = new Blob([JSON.stringify(payload, null, editable ? 2 : 0)], {
      type: 'application/json'
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = editable ? 'geovision_project_editable.json' : 'geovision_project_locked.json';
    a.click();
  },

  importProject(data) {
    if (!data.wells || !data.wells.length) throw new Error('Invalid project');
    if (data.readOnly && data.editable === false) {
      // still load but warn
      console.log('Loading read-only export');
    }
    this.wells = data.wells;
    this.activeId = data.activeId || this.wells[0].id;
    this.loadActiveIntoUI();
    this.persist();
    this.renderSelector();
  },

  renderSelector() {
    const sel = document.getElementById('well-selector');
    if (!sel) return;
    sel.innerHTML = '';
    this.wells.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w.id;
      opt.textContent = w.name + (w.id === this.activeId ? ' ●' : '');
      if (w.id === this.activeId) opt.selected = true;
      sel.appendChild(opt);
    });
    const label = document.getElementById('active-well-label');
    if (label) {
      const w = this.getActive();
      label.textContent = w ? w.name : '—';
    }
  },

  init() {
    if (!this.restoreAutosave()) {
      this.createWell('Well-1');
      // capture initial default layers/survey after UI inits
      setTimeout(() => {
        this.captureCurrentIntoActive();
        this.persist();
      }, 300);
    }
    this.renderSelector();
  }
};

/**
 * Casing strings around the wellbore
 */
const CasingManager = {
  casings: [],

  sizes: [
    { label: '26"', od: 26, id: 24.5 },
    { label: '20"', od: 20, id: 18.75 },
    { label: '17½"', od: 17.5, id: 16.0 },
    { label: '13⅜"', od: 13.375, id: 12.415 },
    { label: '12¼"', od: 12.25, id: 11.0 },
    { label: '9⅝"', od: 9.625, id: 8.681 },
    { label: '7"', od: 7, id: 6.184 },
    { label: '4½"', od: 4.5, id: 3.92 }
  ],

  generateId() {
    return 'csg_' + Date.now() + Math.floor(Math.random() * 100);
  },

  add(data = {}) {
    const size = this.sizes.find(s => s.label === data.size) || this.sizes[4];
    // Default: 7" and smaller = liner; larger = surface (to surface)
    let ctype = data.type;
    if (!ctype) {
      ctype = (size.od <= 7) ? 'liner' : 'surface';
    }
    let top = data.top != null ? data.top : 0;
    if (ctype === 'surface') top = 0;
    this.casings.push({
      id: this.generateId(),
      name: data.name || (size.label + (ctype === 'liner' ? ' Liner' : ' Casing')),
      size: size.label,
      od: data.od != null ? data.od : size.od,
      idIn: data.idIn != null ? data.idIn : size.id,
      top: top,
      bottom: data.bottom != null ? data.bottom : 500,
      sequence: data.sequence != null ? data.sequence : this.casings.length + 1,
      type: ctype,
      wallThick: data.wallThick != null ? data.wallThick : Math.max(0.15, (size.od - size.id) / 2),
      color: data.color || '#94a3b8'
    });
    this.sort();
    this.render();
    document.dispatchEvent(new CustomEvent('casings-changed'));
  },

  update(id, props) {
    const c = this.casings.find(x => x.id === id);
    if (!c) return;
    Object.assign(c, props);
    if (props.size) {
      const size = this.sizes.find(s => s.label === props.size);
      if (size) {
        c.od = size.od;
        c.idIn = size.id;
        if (!props.name) c.name = size.label + ' Casing';
      }
    }
    this.sort();
    this.render();
    document.dispatchEvent(new CustomEvent('casings-changed'));
  },

  remove(id) {
    this.casings = this.casings.filter(c => c.id !== id);
    this.render();
    document.dispatchEvent(new CustomEvent('casings-changed'));
  },

  setCasings(arr) {
    this.casings = (arr || []).map(c => ({ ...c, id: c.id || this.generateId() }));
    this.sort();
    this.render();
  },

  sort() {
    this.casings.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  },

  render() {
    const list = document.getElementById('casing-list');
    if (!list) return;
    list.innerHTML = '';
    this.casings.forEach(c => {
      const el = document.createElement('div');
      el.className = 'casing-item';
      const typ = c.type === 'liner' ? 'Liner' : 'Surface';
      el.innerHTML = `
        <span class="casing-seq">#${c.sequence}</span>
        <span class="casing-name">${c.name}</span>
        <span class="casing-type">${typ}</span>
        <span class="casing-depth">${c.top}–${c.bottom} m</span>
        <span class="casing-od">OD ${c.od}" / ID ${c.idIn}"</span>
        <button class="small-btn" data-edit="${c.id}">Edit</button>
        <button class="small-btn" data-del="${c.id}">×</button>
      `;
      list.appendChild(el);
    });
    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => this.remove(btn.dataset.del));
    });
    list.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => this.openEdit(btn.dataset.edit));
    });
  },

  openEdit(id) {
    const c = this.casings.find(x => x.id === id);
    if (!c) return;
    const name = prompt('Name:', c.name);
    if (name == null) return;
    const typ = prompt('Type: surface or liner', c.type || 'surface');
    let top = parseFloat(prompt('Top depth (m) — surface usually 0:', c.top));
    const bottom = parseFloat(prompt('Bottom / shoe depth (m):', c.bottom));
    const seq = parseInt(prompt('Sequence:', c.sequence));
    const type = (typ || c.type || 'surface').toLowerCase().includes('lin') ? 'liner' : 'surface';
    if (type === 'surface') top = 0;
    this.update(id, {
      name: name || c.name,
      type,
      top: isNaN(top) ? c.top : top,
      bottom: isNaN(bottom) ? c.bottom : bottom,
      sequence: isNaN(seq) ? c.sequence : seq
    });
  }
};
