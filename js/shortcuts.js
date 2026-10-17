/** LithoTrack — configurable keyboard shortcuts */
const ShortcutManager = {
  storageKey: 'lithotrack_shortcuts_v1',
  defaults: {
    selectAll: { key: 'a', ctrl: true, shift: false, alt: false, label: 'Select all in focused field' },
    save: { key: 's', ctrl: true, shift: false, alt: false, label: 'Save project' },
    newProject: { key: 'n', ctrl: true, shift: true, alt: false, label: 'New project' },
    exportDlg: { key: 'e', ctrl: true, shift: false, alt: false, label: 'Export dialog' },
    saveImg: { key: 'i', ctrl: true, shift: true, alt: false, label: 'Save section image' },
    reload: { key: 'r', ctrl: true, shift: true, alt: false, label: 'Reload application' },
    toggleComments: { key: 'm', ctrl: true, shift: false, alt: false, label: 'Toggle comments' },
    applyGrid: { key: 'Enter', ctrl: true, shift: false, alt: false, label: 'Apply layers grid' }
  },
  map: {},
  init() {
    this.load();
    this.renderList();
    document.addEventListener('keydown', (e) => this.onKey(e), true);
  },
  load() {
    this.map = JSON.parse(JSON.stringify(this.defaults));
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      Object.keys(saved).forEach(k => { if (this.map[k]) Object.assign(this.map[k], saved[k]); });
    } catch (e) {}
  },
  save() {
    const out = {};
    Object.keys(this.map).forEach(k => {
      const d = this.map[k];
      out[k] = { key: d.key, ctrl: !!d.ctrl, shift: !!d.shift, alt: !!d.alt };
    });
    localStorage.setItem(this.storageKey, JSON.stringify(out));
  },
  reset() { this.map = JSON.parse(JSON.stringify(this.defaults)); this.save(); this.renderList(); },
  chord(d) {
    const p = [];
    if (d.ctrl) p.push('Ctrl');
    if (d.shift) p.push('Shift');
    if (d.alt) p.push('Alt');
    p.push(d.key && d.key.length === 1 ? d.key.toUpperCase() : d.key);
    return p.join('+');
  },
  match(e, d) {
    if (!d || !d.key) return false;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const dk = d.key.length === 1 ? d.key.toLowerCase() : d.key;
    return k === dk && !!e.ctrlKey === !!d.ctrl && !!e.shiftKey === !!d.shift && !!e.altKey === !!d.alt;
  },
  onKey(e) {
    if (!e.ctrlKey && !e.metaKey && !e.altKey) return;
    const click = (id) => document.getElementById(id)?.click();
    if (this.match(e, this.map.save)) { e.preventDefault(); click('btn-save'); }
    else if (this.match(e, this.map.newProject)) { e.preventDefault(); click('btn-new'); }
    else if (this.match(e, this.map.exportDlg)) { e.preventDefault(); click('btn-export'); }
    else if (this.match(e, this.map.saveImg)) { e.preventDefault(); click('btn-save-img'); }
    else if (this.match(e, this.map.reload)) { e.preventDefault(); location.reload(); }
    else if (this.match(e, this.map.toggleComments)) { e.preventDefault(); click('btn-toggle-comments'); }
    else if (this.match(e, this.map.applyGrid)) { e.preventDefault(); click('btn-paste-layers-apply'); }
  },
  renderList() {
    const el = document.getElementById('shortcuts-list');
    if (!el) return;
    el.innerHTML = '';
    Object.keys(this.map).forEach(id => {
      const d = this.map[id];
      const row = document.createElement('div');
      row.className = 'shortcut-row';
      row.innerHTML = '<span style="flex:1">' + d.label + '</span><button type="button" class="tool-btn sc-bind" data-id="' + id + '">' + this.chord(d) + '</button>';
      el.appendChild(row);
    });
    el.querySelectorAll('.sc-bind').forEach(btn => {
      btn.addEventListener('click', () => this.startRebind(btn.dataset.id, btn));
    });
  },
  startRebind(id, btn) {
    btn.textContent = 'Press keys…';
    const handler = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
      this.map[id].key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.map[id].ctrl = !!(e.ctrlKey || e.metaKey);
      this.map[id].shift = !!e.shiftKey;
      this.map[id].alt = !!e.altKey;
      this.save();
      document.removeEventListener('keydown', handler, true);
      this.renderList();
    };
    document.addEventListener('keydown', handler, true);
  }
};
