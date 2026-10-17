/**
 * LithoTrack — Survey charts: Inclination, Azimuth, DLS (Dogleg)
 */
const ChartsManager = {
  chartInc: null,
  chartAzi: null,
  chartDls: null,

  init() {
    // Destroy previous instances if any
    try {
      if (this.chartInc) { this.chartInc.destroy(); this.chartInc = null; }
      if (this.chartAzi) { this.chartAzi.destroy(); this.chartAzi = null; }
      if (this.chartDls) { this.chartDls.destroy(); this.chartDls = null; }
    } catch (e) {}

    const elInc = document.getElementById('chart-inc');
    const elAzi = document.getElementById('chart-azi');
    const elDls = document.getElementById('chart-dls');
    if (!elInc || !elAzi || !elDls) {
      console.warn('Survey chart canvases missing');
      return;
    }
    if (typeof Chart === 'undefined') {
      console.error('Chart.js library not loaded');
      return;
    }

    // Ensure visible size before Chart.js measures
    [elInc, elAzi, elDls].forEach(el => {
      const parent = el.parentElement;
      if (parent) {
        parent.style.minHeight = '140px';
        parent.style.height = parent.clientHeight > 40 ? parent.clientHeight + 'px' : '140px';
      }
      el.style.width = '100%';
      el.style.height = '140px';
    });

    const common = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        title: { display: false }
      },
      scales: {
        x: {
          title: { display: true, text: 'MD (m)', color: '#94a3b8', font: { size: 10 } },
          ticks: { color: '#94a3b8', font: { size: 9 }, maxTicksLimit: 8 },
          grid: { color: 'rgba(30,41,59,0.9)' }
        },
        y: {
          ticks: { color: '#94a3b8', font: { size: 9 } },
          grid: { color: 'rgba(30,41,59,0.9)' }
        }
      }
    };

    try {
      this.chartInc = new Chart(elInc, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Inc',
            data: [],
            borderColor: '#22d3ee',
            backgroundColor: 'rgba(34,211,238,0.12)',
            fill: true,
            tension: 0.25,
            pointRadius: 2,
            borderWidth: 2
          }]
        },
        options: {
          ...common,
          scales: {
            ...common.scales,
            y: { ...common.scales.y, title: { display: true, text: 'Inc (°)', color: '#94a3b8', font: { size: 10 } } }
          }
        }
      });

      this.chartAzi = new Chart(elAzi, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Azi',
            data: [],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,0.12)',
            fill: true,
            tension: 0.25,
            pointRadius: 2,
            borderWidth: 2
          }]
        },
        options: {
          ...common,
          scales: {
            ...common.scales,
            y: { ...common.scales.y, title: { display: true, text: 'Azi (°)', color: '#94a3b8', font: { size: 10 } } }
          }
        }
      });

      this.chartDls = new Chart(elDls, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'DLS',
            data: [],
            borderColor: '#a78bfa',
            backgroundColor: 'rgba(167,139,250,0.12)',
            fill: true,
            tension: 0.25,
            pointRadius: 2,
            borderWidth: 2
          }]
        },
        options: {
          ...common,
          scales: {
            ...common.scales,
            y: { ...common.scales.y, title: { display: true, text: 'DLS °/30m', color: '#94a3b8', font: { size: 10 } } }
          }
        }
      });

      this.update();
      // Second layout pass after flex settles
      setTimeout(() => {
        try {
          this.chartInc && this.chartInc.resize();
          this.chartAzi && this.chartAzi.resize();
          this.chartDls && this.chartDls.resize();
          this.update();
        } catch (e) {}
      }, 200);
    } catch (err) {
      console.error('Charts init failed:', err);
    }
  },

  update() {
    if (!this.chartInc) return;
    const st = (typeof WellManager !== 'undefined' && Array.isArray(WellManager.stations))
      ? WellManager.stations
      : [];

    // Need at least one point for a visible chart; show zeros if empty
    const labels = st.length ? st.map(s => +s.md || 0) : [0, 100, 200];
    const inc = st.length ? st.map(s => +s.inc || 0) : [0, 0, 0];
    const azi = st.length ? st.map(s => +s.azi || 0) : [0, 0, 0];
    const dls = st.length
      ? st.map((s, i) => {
          if (i === 0) return 0;
          const dmd = (s.md - st[i - 1].md) || 1;
          const dinc = (s.inc - st[i - 1].inc) || 0;
          const dazi = (s.azi - st[i - 1].azi) || 0;
          return Math.sqrt(dinc * dinc + dazi * dazi) * (30 / Math.abs(dmd));
        })
      : [0, 0, 0];

    this.chartInc.data.labels = labels;
    this.chartInc.data.datasets[0].data = inc;
    this.chartInc.update('none');

    this.chartAzi.data.labels = labels;
    this.chartAzi.data.datasets[0].data = azi;
    this.chartAzi.update('none');

    this.chartDls.data.labels = labels;
    this.chartDls.data.datasets[0].data = dls;
    this.chartDls.update('none');
  }
};
