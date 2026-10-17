/**
 * LithoTrack — Workspace / Panel Manager
 * Collapsible + resizable left/right panels and bottom charts drawer.
 * Preserves geological data, depth, zoom, lithology.
 */
const Workspace = {
  leftOpen: true,
  rightOpen: true,
  chartsOpen: false,
  leftWidth: 260,
  rightWidth: 320,
  chartsHeight: 160,
  minLeft: 180,
  maxLeft: 420,
  minRight: 240,
  maxRight: 560,
  minCharts: 80,
  maxCharts: 360,
  currentTool: 'select', // select | hand
  _resizing: null,

  init() {
    this.loadState();
    this.injectHandles();
    this.apply();
    this.bind();
  },

  loadState() {
    try {
      const s = JSON.parse(localStorage.getItem('lithotrack_ws') || '{}');
      if (typeof s.leftOpen === 'boolean') this.leftOpen = s.leftOpen;
      if (typeof s.rightOpen === 'boolean') this.rightOpen = s.rightOpen;
      if (typeof s.chartsOpen === 'boolean') this.chartsOpen = s.chartsOpen;
      if (s.leftWidth) this.leftWidth = s.leftWidth;
      if (s.rightWidth) this.rightWidth = s.rightWidth;
      if (s.chartsHeight) this.chartsHeight = s.chartsHeight;
    } catch (e) {}
  },

  saveState() {
    try {
      localStorage.setItem('lithotrack_ws', JSON.stringify({
        leftOpen: this.leftOpen,
        rightOpen: this.rightOpen,
        chartsOpen: this.chartsOpen,
        leftWidth: this.leftWidth,
        rightWidth: this.rightWidth,
        chartsHeight: this.chartsHeight
      }));
    } catch (e) {}
  },

  injectHandles() {
    const main = document.getElementById('main-layout');
    if (!main) return;

    // Left collapse tab
    if (!document.getElementById('ws-left-tab')) {
      const tab = document.createElement('button');
      tab.id = 'ws-left-tab';
      tab.className = 'ws-collapse-tab left';
      tab.title = 'Toggle left panel';
      tab.innerHTML = this.leftOpen ? '‹' : '›';
      tab.addEventListener('click', () => this.toggleLeft());
      document.getElementById('app').appendChild(tab);
    }

    // Right collapse tab
    if (!document.getElementById('ws-right-tab')) {
      const tab = document.createElement('button');
      tab.id = 'ws-right-tab';
      tab.className = 'ws-collapse-tab right';
      tab.title = 'Toggle right panel';
      tab.innerHTML = this.rightOpen ? '›' : '‹';
      tab.addEventListener('click', () => this.toggleRight());
      document.getElementById('app').appendChild(tab);
    }

    // Left resize handle
    if (!document.getElementById('ws-left-resize')) {
      const h = document.createElement('div');
      h.id = 'ws-left-resize';
      h.className = 'ws-resize-handle vertical';
      h.dataset.side = 'left';
      main.insertBefore(h, document.getElementById('viewport'));
    }

    // Right resize handle
    if (!document.getElementById('ws-right-resize')) {
      const h = document.createElement('div');
      h.id = 'ws-right-resize';
      h.className = 'ws-resize-handle vertical';
      h.dataset.side = 'right';
      const right = document.getElementById('right-panel');
      if (right) main.insertBefore(h, right);
    }

    // Charts toggle + resize
    const charts = document.getElementById('charts-panel');
    if (charts && !document.getElementById('ws-charts-bar')) {
      const bar = document.createElement('div');
      bar.id = 'ws-charts-bar';
      bar.innerHTML =
        '<button type="button" id="btn-charts-toggle" class="charts-toggle-btn">' +
        (this.chartsOpen ? '▼ Charts' : '▲ Charts') +
        '</button>' +
        '<div id="ws-charts-resize" class="ws-resize-handle horizontal"></div>';
      charts.parentNode.insertBefore(bar, charts);
    }
  },

  apply() {
    const left = document.getElementById('left-panel');
    const right = document.getElementById('right-panel');
    const charts = document.getElementById('charts-panel');
    const app = document.getElementById('app');
    const leftTab = document.getElementById('ws-left-tab');
    const rightTab = document.getElementById('ws-right-tab');
    const leftResize = document.getElementById('ws-left-resize');
    const rightResize = document.getElementById('ws-right-resize');
    const chartsBtn = document.getElementById('btn-charts-toggle');

    if (left) {
      left.style.width = this.leftWidth + 'px';
      left.classList.toggle('ws-collapsed', !this.leftOpen);
      left.style.display = this.leftOpen ? '' : 'none';
    }
    if (right) {
      right.style.width = this.rightWidth + 'px';
      right.classList.toggle('ws-collapsed', !this.rightOpen);
      right.style.display = this.rightOpen ? '' : 'none';
    }
    if (leftResize) leftResize.style.display = this.leftOpen ? '' : 'none';
    if (rightResize) rightResize.style.display = this.rightOpen ? '' : 'none';

    if (leftTab) {
      leftTab.innerHTML = this.leftOpen ? '‹' : '›';
      leftTab.classList.toggle('collapsed', !this.leftOpen);
    }
    if (rightTab) {
      rightTab.innerHTML = this.rightOpen ? '›' : '‹';
      rightTab.classList.toggle('collapsed', !this.rightOpen);
    }

    if (charts) {
      charts.classList.toggle('ws-collapsed', !this.chartsOpen);
      charts.style.height = this.chartsOpen ? this.chartsHeight + 'px' : '0';
      charts.style.display = this.chartsOpen ? 'flex' : 'none';
    }
    if (chartsBtn) {
      chartsBtn.textContent = this.chartsOpen ? '▼ Charts' : '▲ Charts';
    }

    if (app) {
      app.classList.toggle('ws-left-closed', !this.leftOpen);
      app.classList.toggle('ws-right-closed', !this.rightOpen);
      app.classList.toggle('ws-charts-open', this.chartsOpen);
    }

    // Trigger geology resize
    if (typeof GeologyView !== 'undefined' && GeologyView.resize) {
      requestAnimationFrame(() => GeologyView.resize());
    }
    if (typeof MWDLogViewer !== 'undefined' && MWDLogViewer.resize) {
      requestAnimationFrame(() => MWDLogViewer.resize());
    }
  },

  toggleLeft() {
    this.leftOpen = !this.leftOpen;
    this.apply();
    this.saveState();
  },

  toggleRight() {
    this.rightOpen = !this.rightOpen;
    this.apply();
    this.saveState();
  },

  toggleCharts() {
    this.chartsOpen = !this.chartsOpen;
    this.apply();
    this.saveState();
    if (this.chartsOpen && typeof ChartsManager !== 'undefined' && ChartsManager.redraw) {
      setTimeout(() => ChartsManager.redraw(), 50);
    }
  },

  setTool(tool) {
    this.currentTool = tool;
    document.querySelectorAll('.ws-tool').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
    const canvas = document.getElementById('geology-canvas');
    if (canvas) {
      canvas.style.cursor = tool === 'hand' ? 'grab' : 'crosshair';
    }
    if (typeof GeologyView !== 'undefined') {
      GeologyView.handMode = tool === 'hand';
    }
  },

  bind() {
    document.getElementById('btn-charts-toggle')?.addEventListener('click', () => this.toggleCharts());

    // Resize drag
    const onMove = (e) => {
      if (!this._resizing) return;
      const side = this._resizing.side;
      if (side === 'left') {
        const x = e.clientX;
        this.leftWidth = Math.max(this.minLeft, Math.min(this.maxLeft, x));
        document.getElementById('left-panel').style.width = this.leftWidth + 'px';
      } else if (side === 'right') {
        const x = window.innerWidth - e.clientX;
        this.rightWidth = Math.max(this.minRight, Math.min(this.maxRight, x));
        document.getElementById('right-panel').style.width = this.rightWidth + 'px';
      } else if (side === 'charts') {
        const bottom = window.innerHeight - e.clientY;
        this.chartsHeight = Math.max(this.minCharts, Math.min(this.maxCharts, bottom - 36));
        const charts = document.getElementById('charts-panel');
        if (charts) charts.style.height = this.chartsHeight + 'px';
      }
      if (typeof GeologyView !== 'undefined') GeologyView.resize();
    };
    const onUp = () => {
      if (this._resizing) {
        this._resizing = null;
        document.body.classList.remove('ws-resizing');
        this.saveState();
        if (typeof GeologyView !== 'undefined') GeologyView.resize();
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    document.getElementById('ws-left-resize')?.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this._resizing = { side: 'left' };
      document.body.classList.add('ws-resizing');
    });
    document.getElementById('ws-right-resize')?.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this._resizing = { side: 'right' };
      document.body.classList.add('ws-resizing');
    });
    document.getElementById('ws-charts-resize')?.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this._resizing = { side: 'charts' };
      document.body.classList.add('ws-resizing');
    });

    // Tool buttons
    document.querySelectorAll('.ws-tool').forEach(btn => {
      btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
    });
  }
};
