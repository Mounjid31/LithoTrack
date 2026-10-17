/**
 * Lithology library matching GPC / ECS formation evaluation legend
 */
const LithologyLibrary = {
  patterns: [
    'conglomerate', 'sand', 'arg_limestone', 'cherty_limestone', 'shale',
    'clay', 'kao_sandstone', 'limestone', 'salt', 'gypsum',
    'basement', 'siltstone', 'sandstone', 'chalky_limestone', 'dolomite',
    'anhydrite', 'silty', 'sandy', 'sandy_lst', 'dolomitic',
    'no_return', 'metal_junk', 'fossils', 'lcm', 'cement',
    'solid', 'dots', 'lines', 'brick', 'cross', 'x', 'v', 'wavy', 'grid'
  ],

  items: [
    { id: 'conglomerate', name: 'Conglomerate', color: '#F5D76E', pattern: 'conglomerate', description: 'Conglomerate' },
    { id: 'sand', name: 'Sand', color: '#F4D03F', pattern: 'sand', description: 'Sand' },
    { id: 'arg_limestone', name: 'Arg. Limestone', color: '#5DADE2', pattern: 'arg_limestone', description: 'Argillaceous limestone' },
    { id: 'cherty_limestone', name: 'Cherty Limestone', color: '#48C9B0', pattern: 'cherty_limestone', description: 'Cherty limestone' },
    { id: 'shale', name: 'Shale', color: '#58D68D', pattern: 'shale', description: 'Shale' },
    { id: 'clay', name: 'Clay', color: '#2ECC71', pattern: 'clay', description: 'Clay' },
    { id: 'kao_sandstone', name: 'Kao Sandstone', color: '#F7DC6F', pattern: 'kao_sandstone', description: 'Kaolinitic sandstone' },
    { id: 'limestone', name: 'Limestone', color: '#5DADE2', pattern: 'limestone', description: 'Limestone' },
    { id: 'salt', name: 'Salt', color: '#E74C3C', pattern: 'salt', description: 'Salt' },
    { id: 'gypsum', name: 'Gypsum', color: '#F1948A', pattern: 'gypsum', description: 'Gypsum' },
    { id: 'basement', name: 'Basement', color: '#E74C3C', pattern: 'basement', description: 'Basement' },
    { id: 'siltstone', name: 'Siltstone', color: '#E67E22', pattern: 'siltstone', description: 'Siltstone' },
    { id: 'sandstone', name: 'Sandstone', color: '#F4D03F', pattern: 'sandstone', description: 'Sandstone' },
    { id: 'chalky_limestone', name: 'Chalky Limestone', color: '#5DADE2', pattern: 'chalky_limestone', description: 'Chalky limestone' },
    { id: 'dolomite', name: 'Dolomite', color: '#5DADE2', pattern: 'dolomite', description: 'Dolomite' },
    { id: 'anhydrite', name: 'Anhydrite', color: '#E91E8C', pattern: 'anhydrite', description: 'Anhydrite' },
    { id: 'silty', name: 'Silty', color: '#F9E79F', pattern: 'silty', description: 'Silty' },
    { id: 'sandy', name: 'Sandy', color: '#F7DC6F', pattern: 'sandy', description: 'Sandy' },
    { id: 'sandy_lst', name: 'Sandy LST', color: '#5DADE2', pattern: 'sandy_lst', description: 'Sandy limestone' },
    { id: 'dolomitic', name: 'Dolomitic', color: '#5DADE2', pattern: 'dolomitic', description: 'Dolomitic' },
    { id: 'no_return', name: 'No Return', color: '#FFFFFF', pattern: 'no_return', description: 'No return' },
    { id: 'metal_junk', name: 'Metal Junk', color: '#1C2833', pattern: 'metal_junk', description: 'Metal junk' },
    { id: 'fossils', name: 'Fossils', color: '#1C2833', pattern: 'fossils', description: 'Fossils' },
    { id: 'lcm', name: 'LCM CACO3', color: '#ECF0F1', pattern: 'lcm', description: 'LCM CaCO3' },
    { id: 'cement', name: 'Cement', color: '#BDC3C7', pattern: 'cement', description: 'Cement' },
    { id: 'topsoil', name: 'Top Soil', color: '#8B7355', pattern: 'sand', description: 'Surface' },
    { id: 'coal', name: 'Coal', color: '#1C2833', pattern: 'solid', description: 'Coal' },
    { id: 'marl', name: 'Marl', color: '#82E0AA', pattern: 'silty', description: 'Marl' }
  ],

  getById(id) {
    return this.items.find(l => l.id === id) || this.items[0];
  },

  getByName(name) {
    if (!name) return null;
    const n = name.toLowerCase().trim();
    return this.items.find(l =>
      l.name.toLowerCase() === n ||
      l.id === n.replace(/\s+/g, '_') ||
      l.name.toLowerCase().includes(n)
    ) || null;
  },

  addCustom(name, color, pattern, description) {
    const id = 'custom_' + Date.now();
    const item = { id, name, color: color || '#888888', pattern: pattern || 'solid', description: description || '', custom: true };
    this.items.push(item);
    this.saveCustom();
    return item;
  },

  update(id, props) {
    const item = this.items.find(l => l.id === id);
    if (!item) return;
    Object.assign(item, props);
    this.saveCustom();
    document.dispatchEvent(new CustomEvent('lithology-changed'));
  },

  removeCustom(id) {
    const item = this.items.find(l => l.id === id);
    if (!item || !item.custom) { alert('Can only delete custom lithologies'); return; }
    this.items = this.items.filter(l => l.id !== id);
    this.saveCustom();
    document.dispatchEvent(new CustomEvent('lithology-changed'));
  },

  saveCustom() {
    try {
      localStorage.setItem('geovision_lith_custom', JSON.stringify(this.items.filter(i => i.custom)));
    } catch (e) {}
  },

  loadCustom() {
    try {
      const raw = localStorage.getItem('geovision_lith_custom');
      if (!raw) return;
      JSON.parse(raw).forEach(c => {
        if (!this.items.find(i => i.id === c.id)) this.items.push(c);
      });
    } catch (e) {}
  },

  renderList(container, onSelect) {
    if (!container) return;
    container.innerHTML = '';
    this.items.forEach(lith => {
      const el = document.createElement('div');
      el.className = 'lith-item';
      el.innerHTML = '<span class="lith-swatch" style="background:' + lith.color + '"></span>' +
        '<span class="lith-name">' + lith.name + '</span>' +
        '<span class="lith-pat">' + lith.pattern + '</span>' +
        '<button class="lith-edit-btn" data-id="' + lith.id + '" title="Edit">✎</button>';
      el.title = lith.description || lith.name;
      el.querySelector('.lith-name').addEventListener('click', () => onSelect && onSelect(lith));
      el.querySelector('.lith-swatch').addEventListener('click', () => onSelect && onSelect(lith));
      el.querySelector('.lith-edit-btn').addEventListener('click', e => {
        e.stopPropagation();
        this.openEditor(lith.id);
      });
      container.appendChild(el);
    });
  },

  openEditor(id) {
    const lith = this.getById(id);
    if (!lith) return;
    const panel = document.getElementById('lith-editor');
    if (!panel) {
      const name = prompt('Name:', lith.name);
      if (name == null) return;
      const color = prompt('Color hex:', lith.color) || lith.color;
      const pattern = prompt('Pattern:', lith.pattern) || lith.pattern;
      this.update(id, { name, color, pattern });
      this.renderList(document.getElementById('lith-list'), null);
      if (typeof GeologyView !== 'undefined') GeologyView.draw();
      return;
    }
    panel.style.display = 'block';
    panel.dataset.editId = id;
    document.getElementById('lith-edit-name').value = lith.name;
    document.getElementById('lith-edit-color').value = lith.color;
    const sel = document.getElementById('lith-edit-pattern');
    sel.innerHTML = this.patterns.map(p =>
      '<option value="' + p + '"' + (p === lith.pattern ? ' selected' : '') + '>' + p + '</option>'
    ).join('');
    document.getElementById('lith-edit-desc').value = lith.description || '';
  },

  applyEditor() {
    const panel = document.getElementById('lith-editor');
    const id = panel && panel.dataset.editId;
    if (!id) return;
    this.update(id, {
      name: document.getElementById('lith-edit-name').value,
      color: document.getElementById('lith-edit-color').value,
      pattern: document.getElementById('lith-edit-pattern').value,
      description: document.getElementById('lith-edit-desc').value
    });
    panel.style.display = 'none';
    const onSelect = lith => {
      if (LayersManager.selectedId) {
        LayersManager.updateLayer(LayersManager.selectedId, { lithology: lith.id, color: lith.color });
        LayersManager.showProps(LayersManager.selectedId);
        GeologyView.draw();
      }
    };
    this.renderList(document.getElementById('lith-list'), onSelect);
    this.populateSelect(document.getElementById('prop-lithology'));
    if (typeof GeologyView !== 'undefined') GeologyView.draw();
  },

  populateSelect(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    this.items.forEach(lith => {
      const opt = document.createElement('option');
      opt.value = lith.id;
      opt.textContent = lith.name;
      selectEl.appendChild(opt);
    });
  }
};
LithologyLibrary.loadCustom();
