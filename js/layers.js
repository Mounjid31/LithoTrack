/**
 * GeoVision 3D — Geological Layers Manager
 */
const LayersManager = {
  layers: [],
  selectedId: null,
  history: [],
  historyIndex: -1,
  maxHistory: 30,

  defaultLayers: [
    { id: 'l1', name: 'Top Soil', top: 0, bottom: 20, lithology: 'topsoil', color: '#8B7355', opacity: 0.9, visible: true, locked: false, description: 'Surface soil cover' },
    { id: 'l2', name: 'Sand', top: 20, bottom: 200, lithology: 'sand', color: '#F4D03F', opacity: 0.85, visible: true, locked: false, description: 'Unconsolidated sand' },
    { id: 'l3', name: 'Sandstone', top: 200, bottom: 850, lithology: 'sandstone', color: '#E67E22', opacity: 0.85, visible: true, locked: false, description: 'Reservoir sandstone' },
    { id: 'l4', name: 'Shale', top: 850, bottom: 1600, lithology: 'shale', color: '#5D6D7E', opacity: 0.85, visible: true, locked: false, description: 'Seal shale' },
    { id: 'l5', name: 'Limestone', top: 1600, bottom: 2500, lithology: 'limestone', color: '#AED6F1', opacity: 0.85, visible: true, locked: false, description: 'Carbonate formation' },
    { id: 'l6', name: 'Dolomite', top: 2500, bottom: 3200, lithology: 'dolomite', color: '#5DADE2', opacity: 0.85, visible: true, locked: false, description: 'Dolomitized carbonate' },
    { id: 'l7', name: 'Basement', top: 3200, bottom: 4000, lithology: 'basement', color: '#6C3483', opacity: 0.9, visible: true, locked: false, description: 'Crystalline basement' }
  ],

  init() {
    this.layers = JSON.parse(JSON.stringify(this.defaultLayers));
    this.pushHistory();
    this.renderList();
  },

  getThickness(layer) {
    return Math.max(0, layer.bottom - layer.top);
  },

  generateId() {
    return 'l' + Date.now() + Math.floor(Math.random() * 1000);
  },

  addLayer(data = {}) {
    const last = this.layers[this.layers.length - 1];
    const top = data.top != null ? data.top : (last ? last.bottom : 0);
    const bottom = data.bottom != null ? data.bottom : top + 100;
    const lith = LithologyLibrary.getById(data.lithology || 'sandstone');
    const layer = {
      id: this.generateId(),
      name: data.name || 'New Layer',
      top,
      bottom,
      lithology: lith.id,
      color: data.color || lith.color,
      opacity: data.opacity != null ? data.opacity : 0.85,
      visible: data.visible != null ? data.visible : true,
      locked: false,
      description: data.description || '',
      comment: data.comment || ''
    };
    this.layers.push(layer);
    this.sortByDepth();
    this.pushHistory();
    this.renderList();
    this.select(layer.id);
    return layer;
  },

  deleteLayer(id) {
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx === -1) return;
    if (this.layers[idx].locked) return alert('Layer is locked');
    this.layers.splice(idx, 1);
    if (this.selectedId === id) this.selectedId = null;
    this.pushHistory();
    this.renderList();
    this.hideProps();
    document.dispatchEvent(new CustomEvent('layers-changed'));
  },

  updateLayer(id, props) {
    const layer = this.layers.find(l => l.id === id);
    if (!layer || layer.locked) return;
    Object.assign(layer, props);
    if (props.top != null || props.bottom != null) {
      layer.top = Math.min(layer.top, layer.bottom);
      layer.bottom = Math.max(layer.top, layer.bottom);
    }
    if (props.lithology) {
      const lith = LithologyLibrary.getById(props.lithology);
      if (!props.color) layer.color = lith.color;
    }
    this.sortByDepth();
    this.pushHistory();
    this.renderList();
    document.dispatchEvent(new CustomEvent('layers-changed'));
  },

  duplicateLayer(id) {
    const src = this.layers.find(l => l.id === id);
    if (!src) return;
    const copy = { ...src, id: this.generateId(), name: src.name + ' (copy)', locked: false };
    this.layers.push(copy);
    this.sortByDepth();
    this.pushHistory();
    this.renderList();
    this.select(copy.id);
    document.dispatchEvent(new CustomEvent('layers-changed'));
  },

  sortByDepth() {
    this.layers.sort((a, b) => a.top - b.top);
  },

  reset() {
    this.layers = JSON.parse(JSON.stringify(this.defaultLayers));
    this.selectedId = null;
    this.pushHistory();
    this.renderList();
    this.hideProps();
    document.dispatchEvent(new CustomEvent('layers-changed'));
  },

  setLayers(arr, replace = true) {
    if (replace) {
      this.layers = arr.map(l => ({
        id: l.id || this.generateId(),
        name: l.name || l.Formation || 'Layer',
        top: parseFloat(l.top ?? l['Top Depth'] ?? 0),
        bottom: parseFloat(l.bottom ?? l['Bottom Depth'] ?? 100),
        lithology: l.lithology || (LithologyLibrary.getByName(l.Lithology)?.id) || 'sandstone',
        color: l.color || l.Color || LithologyLibrary.getByName(l.Lithology)?.color || '#888888',
        opacity: parseFloat(l.opacity ?? l.Opacity ?? 0.85),
        visible: l.visible !== false,
        locked: false,
        description: l.description || l.Description || ''
      }));
    } else {
      arr.forEach(l => this.addLayer(l));
    }
    this.sortByDepth();
    this.pushHistory();
    this.renderList();
    document.dispatchEvent(new CustomEvent('layers-changed'));
  },

  select(id) {
    this.selectedId = id;
    this.renderList();
    this.showProps(id);
  },

  renderList() {
    const container = document.getElementById('layers-list');
    if (!container) return;
    container.innerHTML = '';
    this.layers.forEach(layer => {
      const el = document.createElement('div');
      el.className = 'layer-item' + (layer.id === this.selectedId ? ' selected' : '');
      el.innerHTML = `
        <input type="checkbox" class="layer-vis" ${layer.visible ? 'checked' : ''} title="Visibility" />
        <span class="layer-color" style="background:${layer.color};opacity:${layer.opacity}"></span>
        <span class="layer-name">${layer.name}${layer.locked ? ' 🔒' : ''}</span>
        <span class="layer-depth">${layer.top}–${layer.bottom} m</span>
      `;
      el.querySelector('.layer-vis').addEventListener('click', e => {
        e.stopPropagation();
        layer.visible = e.target.checked;
        document.dispatchEvent(new CustomEvent('layers-changed'));
      });
      el.addEventListener('click', () => this.select(layer.id));
      container.appendChild(el);
    });
  },

  showProps(id) {
    const layer = this.layers.find(l => l.id === id);
    const panel = document.getElementById('layer-props');
    if (!layer || !panel) return;
    panel.style.display = 'block';
    document.getElementById('prop-name').value = layer.name;
    document.getElementById('prop-top').value = layer.top;
    document.getElementById('prop-bottom').value = layer.bottom;
    document.getElementById('prop-thickness').value = this.getThickness(layer);
    document.getElementById('prop-color').value = layer.color;
    document.getElementById('prop-opacity').value = layer.opacity;
    document.getElementById('prop-visible').checked = layer.visible;
    document.getElementById('prop-locked').checked = layer.locked;
    document.getElementById('prop-desc').value = layer.description || '';
    const pc = document.getElementById('prop-comment');
    if (pc) pc.value = layer.comment || '';
    LithologyLibrary.populateSelect(document.getElementById('prop-lithology'));
    document.getElementById('prop-lithology').value = layer.lithology;
  },

  hideProps() {
    const panel = document.getElementById('layer-props');
    if (panel) panel.style.display = 'none';
  },

  applyPropsFromUI() {
    if (!this.selectedId) return;
    const top = parseFloat(document.getElementById('prop-top').value);
    const bottom = parseFloat(document.getElementById('prop-bottom').value);
    this.updateLayer(this.selectedId, {
      name: document.getElementById('prop-name').value,
      top,
      bottom,
      lithology: document.getElementById('prop-lithology').value,
      color: document.getElementById('prop-color').value,
      opacity: parseFloat(document.getElementById('prop-opacity').value),
      visible: document.getElementById('prop-visible').checked,
      locked: document.getElementById('prop-locked').checked,
      description: document.getElementById('prop-desc').value,
      comment: (document.getElementById('prop-comment') || {}).value || ''
    });
    this.showProps(this.selectedId);
  },

  pushHistory() {
    const snap = JSON.stringify(this.layers);
    if (this.historyIndex >= 0 && this.history[this.historyIndex] === snap) return;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(snap);
    if (this.history.length > this.maxHistory) this.history.shift();
    else this.historyIndex++;
  },

  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this.layers = JSON.parse(this.history[this.historyIndex]);
    this.renderList();
    this.hideProps();
    document.dispatchEvent(new CustomEvent('layers-changed'));
  },

  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this.layers = JSON.parse(this.history[this.historyIndex]);
    this.renderList();
    this.hideProps();
    document.dispatchEvent(new CustomEvent('layers-changed'));
  },

  getVisibleLayers() {
    return this.layers.filter(l => l.visible);
  },

  exportCSV() {
    const headers = ['Formation', 'Top Depth', 'Bottom Depth', 'Thickness', 'Lithology', 'Color', 'Opacity', 'Description'];
    const rows = this.layers.map(l => [
      l.name, l.top, l.bottom, this.getThickness(l),
      LithologyLibrary.getById(l.lithology).name, l.color, l.opacity, l.description
    ]);
    return [headers, ...rows].map(r => r.join(',')).join('\n');
  }
};
