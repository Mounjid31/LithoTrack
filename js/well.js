/**
 * GeoVision 3D — Well Trajectory & Survey Manager
 * Uses Minimum Curvature method for trajectory calculation
 */
const WellManager = {
  stations: [],
  trajectory: [], // computed 3D points {md, tvd, n, e, z, inc, azi, dls}
  wellhead: { lat: 30.0444, lon: 31.2357 },

  defaultSurvey: [
    { md: 0, tvd: 0, inc: 0, azi: 90 },
    { md: 500, tvd: 499.2, inc: 10, azi: 90 },
    { md: 1000, tvd: 995.1, inc: 25, azi: 92 },
    { md: 1500, tvd: 1460.2, inc: 45, azi: 95 },
    { md: 2000, tvd: 1780.5, inc: 60, azi: 100 },
    { md: 2500, tvd: 1960.3, inc: 70, azi: 105 },
    { md: 3000, tvd: 2050.2, inc: 80, azi: 110 },
    { md: 3200, tvd: 2060.1, inc: 88, azi: 115 }
  ],

  init() {
    this.stations = JSON.parse(JSON.stringify(this.defaultSurvey));
    this.calculateTrajectory();
    this.renderTable();
    this.updateStats();
  },

  setWellhead(lat, lon) {
    this.wellhead = { lat, lon };
    this.calculateTrajectory();
  },

  addStation(data = {}) {
    const last = this.stations[this.stations.length - 1] || { md: 0, tvd: 0, inc: 0, azi: 0 };
    this.stations.push({
      md: data.md != null ? data.md : last.md + 100,
      tvd: data.tvd != null ? data.tvd : last.tvd + 100,
      inc: data.inc != null ? data.inc : last.inc,
      azi: data.azi != null ? data.azi : last.azi
    });
    this.stations.sort((a, b) => a.md - b.md);
    this.calculateTrajectory();
    this.renderTable();
    this.updateStats();
    document.dispatchEvent(new CustomEvent('well-changed'));
  },

  updateStation(index, props) {
    if (index < 0 || index >= this.stations.length) return;
    Object.assign(this.stations[index], props);
    this.stations.sort((a, b) => a.md - b.md);
    this.calculateTrajectory();
    this.renderTable();
    this.updateStats();
    document.dispatchEvent(new CustomEvent('well-changed'));
  },

  deleteStation(index) {
    if (this.stations.length <= 1) return;
    this.stations.splice(index, 1);
    this.calculateTrajectory();
    this.renderTable();
    this.updateStats();
    document.dispatchEvent(new CustomEvent('well-changed'));
  },

  clear() {
    this.stations = [{ md: 0, tvd: 0, inc: 0, azi: 0 }];
    this.calculateTrajectory();
    this.renderTable();
    this.updateStats();
    document.dispatchEvent(new CustomEvent('well-changed'));
  },

  setStations(arr) {
    this.stations = arr.map(s => ({
      md: parseFloat(s.md ?? s.MD ?? 0),
      tvd: parseFloat(s.tvd ?? s.TVD ?? 0),
      inc: parseFloat(s.inc ?? s.Inclination ?? s.Inc ?? 0),
      azi: parseFloat(s.azi ?? s.Azimuth ?? s.Azi ?? 0)
    })).sort((a, b) => a.md - b.md);
    if (this.stations.length === 0) this.stations = [{ md: 0, tvd: 0, inc: 0, azi: 0 }];
    this.calculateTrajectory();
    this.renderTable();
    this.updateStats();
    document.dispatchEvent(new CustomEvent('well-changed'));
  },

  /**
   * Minimum Curvature Method
   * Computes Northing, Easting, TVD from MD, Inc, Azi
   */
  calculateTrajectory() {
    this.trajectory = [];
    if (this.stations.length === 0) return;

    let n = 0, e = 0, tvd = 0;
    const first = this.stations[0];
    this.trajectory.push({
      md: first.md,
      tvd: first.tvd != null ? first.tvd : 0,
      n: 0, e: 0, z: 0,
      inc: first.inc, azi: first.azi, dls: 0
    });
    tvd = this.trajectory[0].tvd;

    for (let i = 1; i < this.stations.length; i++) {
      const prev = this.stations[i - 1];
      const curr = this.stations[i];
      const dMD = curr.md - prev.md;
      if (dMD <= 0) continue;

      const I1 = prev.inc * Math.PI / 180;
      const I2 = curr.inc * Math.PI / 180;
      const A1 = prev.azi * Math.PI / 180;
      const A2 = curr.azi * Math.PI / 180;

      // Dogleg angle
      const cosDL = Math.cos(I2 - I1) - Math.sin(I1) * Math.sin(I2) * (1 - Math.cos(A2 - A1));
      let DL = Math.acos(Math.min(1, Math.max(-1, cosDL)));
      const dls = (DL * 180 / Math.PI) / (dMD / 30); // deg/30m

      // Ratio factor
      const RF = DL < 1e-8 ? 1 : (2 / DL) * Math.tan(DL / 2);

      const dN = (dMD / 2) * (Math.sin(I1) * Math.cos(A1) + Math.sin(I2) * Math.cos(A2)) * RF;
      const dE = (dMD / 2) * (Math.sin(I1) * Math.sin(A1) + Math.sin(I2) * Math.sin(A2)) * RF;
      const dV = (dMD / 2) * (Math.cos(I1) + Math.cos(I2)) * RF;

      n += dN;
      e += dE;
      tvd += dV;

      // Prefer provided TVD if available and reasonable
      const useTvd = (curr.tvd != null && !isNaN(curr.tvd)) ? curr.tvd : tvd;

      this.trajectory.push({
        md: curr.md,
        tvd: useTvd,
        n, e, z: -useTvd,
        inc: curr.inc,
        azi: curr.azi,
        dls: isNaN(dls) ? 0 : dls
      });
    }

    // Update TVD in stations from calculated if needed
    this.stations.forEach((s, i) => {
      if (this.trajectory[i]) s.tvd = Math.round(this.trajectory[i].tvd * 10) / 10;
    });
  },

  /**
   * Interpolate position at a given MD
   */
  getPositionAtMD(md) {
    if (this.trajectory.length === 0) return null;
    if (md <= this.trajectory[0].md) return { ...this.trajectory[0] };
    if (md >= this.trajectory[this.trajectory.length - 1].md) {
      return { ...this.trajectory[this.trajectory.length - 1] };
    }
    for (let i = 1; i < this.trajectory.length; i++) {
      const a = this.trajectory[i - 1];
      const b = this.trajectory[i];
      if (md >= a.md && md <= b.md) {
        const t = (md - a.md) / (b.md - a.md);
        return {
          md,
          tvd: a.tvd + t * (b.tvd - a.tvd),
          n: a.n + t * (b.n - a.n),
          e: a.e + t * (b.e - a.e),
          z: a.z + t * (b.z - a.z),
          inc: a.inc + t * (b.inc - a.inc),
          azi: a.azi + t * (b.azi - a.azi),
          dls: a.dls
        };
      }
    }
    return null;
  },

  getStats() {
    if (this.trajectory.length === 0) {
      return { totalMD: 0, finalTVD: 0, maxInc: 0, maxDLS: 0, wellLength: 0, stations: 0 };
    }
    const last = this.trajectory[this.trajectory.length - 1];
    const maxInc = Math.max(...this.trajectory.map(t => t.inc));
    const maxDLS = Math.max(...this.trajectory.map(t => t.dls || 0));
    return {
      totalMD: last.md,
      finalTVD: last.tvd,
      maxInc,
      maxDLS,
      wellLength: last.md,
      stations: this.stations.length,
      horizontalDisplacement: Math.sqrt(last.n * last.n + last.e * last.e)
    };
  },

  updateStats() {
    const stats = this.getStats();
    const el = document.getElementById('stats-panel');
    if (el) {
      el.innerHTML = `
        <div><strong>Total MD:</strong> ${stats.totalMD.toFixed(1)} m</div>
        <div><strong>Final TVD:</strong> ${stats.finalTVD.toFixed(1)} m</div>
        <div><strong>Max Inclination:</strong> ${stats.maxInc.toFixed(1)}°</div>
        <div><strong>Max DLS:</strong> ${stats.maxDLS.toFixed(2)} °/30m</div>
        <div><strong>Horizontal Disp.:</strong> ${stats.horizontalDisplacement.toFixed(1)} m</div>
        <div><strong>Survey Stations:</strong> ${stats.stations}</div>
      `;
    }
    const info = document.getElementById('well-info');
    if (info) {
      info.innerHTML = `
        <div><strong>Wellhead:</strong> ${this.wellhead.lat.toFixed(4)}, ${this.wellhead.lon.toFixed(4)}</div>
        <div><strong>TD:</strong> ${stats.totalMD.toFixed(0)} m MD / ${stats.finalTVD.toFixed(0)} m TVD</div>
        <div><strong>Max Inc:</strong> ${stats.maxInc.toFixed(1)}°</div>
      `;
    }
  },

  renderTable() {
    const tbody = document.getElementById('survey-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    this.stations.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="number" value="${s.md}" data-field="md" data-idx="${i}" step="1" /></td>
        <td><input type="number" value="${s.tvd}" data-field="tvd" data-idx="${i}" step="0.1" /></td>
        <td><input type="number" value="${s.inc}" data-field="inc" data-idx="${i}" step="0.1" /></td>
        <td><input type="number" value="${s.azi}" data-field="azi" data-idx="${i}" step="0.1" /></td>
        <td><button class="small-btn" data-del="${i}" title="Delete">×</button></td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('change', e => {
        const idx = parseInt(e.target.dataset.idx);
        const field = e.target.dataset.field;
        const val = parseFloat(e.target.value);
        this.updateStation(idx, { [field]: val });
      });
    });
    tbody.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', e => {
        this.deleteStation(parseInt(e.target.dataset.del));
      });
    });
  },

  getFormationAtTVD(tvd, layers) {
    for (const l of layers) {
      if (tvd >= l.top && tvd < l.bottom) return l.name;
    }
    return '—';
  }
};
