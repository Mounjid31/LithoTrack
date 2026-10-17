/**
 * LithoTrack — Geological Cross-Section (Side View) Renderer
 */
const GeologyView = {
  canvas: null,
  ctx: null,
  ve: 2.0,
  sectionAzimuth: 90,
  sectionLength: 5000,
  minDepth: 0,
  maxDepth: 3500,
  filterFrom: 0,
  filterTo: 3500,
  padding: { top: 40, right: 60, bottom: 40, left: 70 },
  hoverInfo: null,
  handMode: false,
  hOffset: 0, // horizontal pan along section (meters)
  _panning: false,
  _panStartY: 0,
  _panStartX: 0,
  _panStartMin: 0,
  _panStartMax: 0,
  _panStartH: 0,

  init() {
    this.canvas = document.getElementById("geology-canvas");
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.canvas.addEventListener("click", (e) => this.onClick(e));
    this.canvas.addEventListener("mousemove", (e) => this.onMove(e));
    this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    this.canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
    this.canvas.addEventListener("mouseleave", (e) => this.onMouseUp(e));
    this.canvas.addEventListener("wheel", (e) => this.onWheel(e), {
      passive: false,
    });
  },

  /**
   * Hard bounds for vertical scroll: data extent (layers + trajectory)
   * so the view never goes into empty negative / overscale space.
   */
  getScrollBounds() {
    let lo = Infinity;
    let hi = -Infinity;
    if (
      typeof LayersManager !== "undefined" &&
      LayersManager.layers &&
      LayersManager.layers.length
    ) {
      LayersManager.layers.forEach((l) => {
        if (l.top != null && isFinite(l.top)) lo = Math.min(lo, l.top);
        if (l.bottom != null && isFinite(l.bottom)) hi = Math.max(hi, l.bottom);
      });
    }
    if (
      typeof WellManager !== "undefined" &&
      WellManager.trajectory &&
      WellManager.trajectory.length
    ) {
      WellManager.trajectory.forEach((pt) => {
        if (pt.tvd != null && isFinite(pt.tvd)) {
          lo = Math.min(lo, pt.tvd);
          hi = Math.max(hi, pt.tvd);
        }
      });
    }
    if (!isFinite(lo) || !isFinite(hi) || hi <= lo) {
      // fallback: filter range or sensible defaults
      lo = 0;
      hi = Math.max(this.filterTo || 3500, this.maxDepth || 3500, 1000);
    }
    // small pad so edges are not flush
    const pad = Math.max(10, (hi - lo) * 0.02);
    return { lo: Math.max(0, lo - pad), hi: hi + pad };
  },

  /** Clamp a proposed [min,max] window inside scroll bounds */
  clampDepthWindow(minD, maxD) {
    const bounds = this.getScrollBounds();
    let windowSize = Math.max(50, maxD - minD);
    const maxWindow = Math.max(50, bounds.hi - bounds.lo);
    if (windowSize > maxWindow) windowSize = maxWindow;
    let newMin = minD;
    let newMax = minD + windowSize;
    if (newMin < bounds.lo) {
      newMin = bounds.lo;
      newMax = newMin + windowSize;
    }
    if (newMax > bounds.hi) {
      newMax = bounds.hi;
      newMin = newMax - windowSize;
    }
    if (newMin < bounds.lo) {
      newMin = bounds.lo;
      newMax = Math.min(bounds.hi, newMin + windowSize);
    }
    return { min: newMin, max: newMax };
  },

  syncDepthInputs() {
    const minEl = document.getElementById("min-depth");
    const maxEl = document.getElementById("max-depth");
    if (minEl) minEl.value = Math.round(this.minDepth);
    if (maxEl) maxEl.value = Math.round(this.maxDepth);
  },

  /** Shift depth viewport; stays inside data bounds */
  panViewport(deltaDepth) {
    const windowSize = this.maxDepth - this.minDepth;
    const clamped = this.clampDepthWindow(
      this.minDepth + deltaDepth,
      this.minDepth + deltaDepth + windowSize
    );
    this.minDepth = clamped.min;
    this.maxDepth = clamped.max;
    this.syncDepthInputs();
    this.draw();
  },

  /** Horizontal offset along section (follow high-angle trajectory) */
  panHorizontal(deltaMeters) {
    this.hOffset += deltaMeters;
    // soft clamp based on section length + trajectory extent
    const limit = this.sectionLength * 1.5;
    if (this.hOffset < -limit) this.hOffset = -limit;
    if (this.hOffset > limit) this.hOffset = limit;
    this.draw();
  },

  /** Convert along-section meters → canvas x (applies hOffset) */
  sectionToX(along, p, plotW) {
    return (
      p.left + plotW / 2 + ((along - this.hOffset) / this.sectionLength) * plotW
    );
  },

  onMouseDown(e) {
    if (!this.handMode) return;
    e.preventDefault();
    this._panning = true;
    this._panStartY = e.clientY;
    this._panStartX = e.clientX;
    this._panStartMin = this.minDepth;
    this._panStartMax = this.maxDepth;
    this._panStartH = this.hOffset;
    this.canvas.style.cursor = "grabbing";
  },

  onMouseUp() {
    if (this._panning) {
      this._panning = false;
      this.canvas.style.cursor = this.handMode ? "grab" : "crosshair";
    }
  },

  onWheel(e) {
    e.preventDefault();
    const depthRange = Math.max(1, this.maxDepth - this.minDepth);
    if (e.ctrlKey) {
      // Zoom depth window around center, then clamp to data bounds
      const center = (this.minDepth + this.maxDepth) / 2;
      const factor = e.deltaY > 0 ? 1.12 : 0.88;
      let half = (depthRange / 2) * factor;
      half = Math.max(50, Math.min(5000, half));
      const clamped = this.clampDepthWindow(center - half, center + half);
      this.minDepth = clamped.min;
      this.maxDepth = clamped.max;
      this.syncDepthInputs();
      this.draw();
    } else if (e.shiftKey) {
      // Shift + wheel → horizontal pan
      const deltaM = (e.deltaY > 0 ? 1 : -1) * this.sectionLength * 0.05;
      this.panHorizontal(deltaM);
    } else {
      const delta = (e.deltaY > 0 ? 1 : -1) * depthRange * 0.08;
      this.panViewport(delta);
    }
  },

  resize() {
    const container =
      document.getElementById("geology-wrap") ||
      document.getElementById("side-view-container");
    if (!container || !this.canvas) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.canvas.width = w * devicePixelRatio;
    this.canvas.height = h * devicePixelRatio;
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    this.draw();
  },

  setVE(ve) {
    this.ve = ve;
    this.draw();
  },

  setDepthRange(min, max) {
    const clamped = this.clampDepthWindow(min, max);
    this.minDepth = clamped.min;
    this.maxDepth = clamped.max;
    this.syncDepthInputs();
    this.draw();
  },

  setFilter(from, to) {
    this.filterFrom = from;
    this.filterTo = to;
    this.draw();
  },

  setSection(az, len) {
    this.sectionAzimuth = az;
    this.sectionLength = len;
    this.draw();
  },

  draw() {
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.width / devicePixelRatio;
    const h = this.canvas.height / devicePixelRatio;
    const ctx = this.ctx;
    const p = this.padding;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0a0e17";
    ctx.fillRect(0, 0, w, h);

    const plotW = w - p.left - p.right;
    const plotH = h - p.top - p.bottom;
    const depthRange = Math.max(1, this.maxDepth - this.minDepth);
    const displayRange = depthRange * this.ve;

    // Background grid
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    const major = 500;
    for (
      let d = Math.ceil(this.minDepth / major) * major;
      d <= this.maxDepth;
      d += major
    ) {
      const y = p.top + ((d - this.minDepth) / depthRange) * plotH;
      ctx.beginPath();
      ctx.moveTo(p.left, y);
      ctx.lineTo(p.left + plotW, y);
      ctx.stroke();
    }

    // Depth scale (left)
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px Segoe UI";
    ctx.textAlign = "right";
    for (
      let d = Math.ceil(this.minDepth / major) * major;
      d <= this.maxDepth;
      d += major
    ) {
      const y = p.top + ((d - this.minDepth) / depthRange) * plotH;
      ctx.fillText(d + " m", p.left - 8, y + 4);
      ctx.beginPath();
      ctx.strokeStyle = "#475569";
      ctx.moveTo(p.left - 4, y);
      ctx.lineTo(p.left, y);
      ctx.stroke();
    }

    // Title
    ctx.fillStyle = "#00d4ff";
    ctx.font = "bold 13px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(
      `Geological Cross-Section  |  Azimuth ${
        this.sectionAzimuth
      }°  |  VE ${this.ve.toFixed(1)}x`,
      w / 2,
      22
    );

    // Layers (straight contacts)
    const layers = LayersManager.getVisibleLayers();
    layers.forEach((layer) => {
      if (layer.bottom < this.filterFrom || layer.top > this.filterTo) return;
      const top = Math.max(layer.top, this.minDepth, this.filterFrom);
      const bot = Math.min(layer.bottom, this.maxDepth, this.filterTo);
      if (bot <= top) return;

      const y1 = p.top + ((top - this.minDepth) / depthRange) * plotH;
      const y2 = p.top + ((bot - this.minDepth) / depthRange) * plotH;

      ctx.globalAlpha = layer.opacity;
      ctx.fillStyle = layer.color;
      ctx.fillRect(p.left, y1, plotW, y2 - y1);
      this.drawPattern(
        ctx,
        p.left,
        y1,
        plotW,
        y2 - y1,
        layer.lithology,
        layer.color
      );
      ctx.globalAlpha = 1;

      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.left, y1);
      ctx.lineTo(p.left + plotW, y1);
      ctx.stroke();

      if (y2 - y1 > 18) {
        ctx.fillStyle = this.contrastColor(layer.color);
        ctx.font = "11px Segoe UI";
        ctx.textAlign = "left";
        ctx.fillText(
          layer.name + "  (" + layer.top + "–" + layer.bottom + " m)",
          p.left + 8,
          (y1 + y2) / 2 + 4
        );
      }
    });

    // Surface line
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.left, p.top);
    ctx.lineTo(p.left + plotW, p.top);
    ctx.stroke();
    ctx.fillStyle = "#10b981";
    ctx.font = "10px Segoe UI";
    ctx.textAlign = "left";
    ctx.fillText("Surface", p.left + 4, p.top - 6);

    // Well trajectory in section
    this.drawWellTrajectory(ctx, p, plotW, plotH, depthRange);

    // Casing strings
    this.drawCasings(ctx, p, plotW, plotH, depthRange);

    // Scale bar
    this.drawScaleBar(ctx, w, h, p);

    // Frame
    ctx.strokeStyle = "#2a3548";
    ctx.lineWidth = 1;
    ctx.strokeRect(p.left, p.top, plotW, plotH);

    // Axis labels
    ctx.fillStyle = "#64748b";
    ctx.font = "10px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText("Horizontal Distance along Section (m)", w / 2, h - 8);
    ctx.save();
    ctx.translate(14, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("True Vertical Depth (m)", 0, 0);
    ctx.restore();
  },

  drawPattern(ctx, x, y, w, h, lithId, color) {
    const lith = LithologyLibrary.getById(lithId);
    const pat = lith.pattern || "solid";
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    const step = 8;

    const linesH = () => {
      for (let i = y; i < y + h; i += step) {
        ctx.beginPath();
        ctx.moveTo(x, i);
        ctx.lineTo(x + w, i);
        ctx.stroke();
      }
    };
    const linesDiag = () => {
      for (let i = -h; i < w + h; i += step) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i + h, y + h);
        ctx.stroke();
      }
    };
    const linesDiag2 = () => {
      for (let i = -h; i < w + h; i += step) {
        ctx.beginPath();
        ctx.moveTo(x + i, y + h);
        ctx.lineTo(x + i + h, y);
        ctx.stroke();
      }
    };
    const dots = (gap) => {
      for (let iy = y + 3; iy < y + h; iy += gap) {
        for (let ix = x + 3; ix < x + w; ix += gap) {
          ctx.beginPath();
          ctx.arc(ix, iy, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    const brick = () => {
      for (let iy = y; iy < y + h; iy += step) {
        ctx.beginPath();
        ctx.moveTo(x, iy);
        ctx.lineTo(x + w, iy);
        ctx.stroke();
        const off = ((iy - y) / step) % 2 === 0 ? 0 : step;
        for (let ix = x + off; ix < x + w; ix += step * 2) {
          ctx.beginPath();
          ctx.moveTo(ix, iy);
          ctx.lineTo(ix, iy + step);
          ctx.stroke();
        }
      }
    };
    const crosses = () => {
      for (let iy = y + 4; iy < y + h; iy += step) {
        for (let ix = x + 4; ix < x + w; ix += step) {
          ctx.beginPath();
          ctx.moveTo(ix - 3, iy - 3);
          ctx.lineTo(ix + 3, iy + 3);
          ctx.moveTo(ix + 3, iy - 3);
          ctx.lineTo(ix - 3, iy + 3);
          ctx.stroke();
        }
      }
    };
    const vees = () => {
      for (let iy = y + 4; iy < y + h; iy += step) {
        for (let ix = x + 4; ix < x + w; ix += step) {
          ctx.beginPath();
          ctx.moveTo(ix - 3, iy - 2);
          ctx.lineTo(ix, iy + 3);
          ctx.lineTo(ix + 3, iy - 2);
          ctx.stroke();
        }
      }
    };
    const triangles = () => {
      for (let iy = y + 5; iy < y + h; iy += step + 2) {
        for (let ix = x + 5; ix < x + w; ix += step + 2) {
          ctx.beginPath();
          ctx.moveTo(ix, iy - 3);
          ctx.lineTo(ix + 3, iy + 2);
          ctx.lineTo(ix - 3, iy + 2);
          ctx.closePath();
          ctx.stroke();
        }
      }
    };
    const grid = () => {
      for (let i = y; i < y + h; i += step) {
        ctx.beginPath();
        ctx.moveTo(x, i);
        ctx.lineTo(x + w, i);
        ctx.stroke();
      }
      for (let i = x; i < x + w; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, y);
        ctx.lineTo(i, y + h);
        ctx.stroke();
      }
    };
    const waves = () => {
      for (let iy = y + 4; iy < y + h; iy += step) {
        ctx.beginPath();
        for (let ix = x; ix < x + w; ix += 2) {
          const yy = iy + Math.sin((ix - x) / 5) * 2;
          if (ix === x) ctx.moveTo(ix, yy);
          else ctx.lineTo(ix, yy);
        }
        ctx.stroke();
      }
    };
    const kmarks = () => {
      dots(10);
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      for (let iy = y + 10; iy < y + h; iy += 16) {
        for (let ix = x + 8; ix < x + w; ix += 20) {
          ctx.fillText("K", ix, iy);
        }
      }
    };
    const fossils = () => {
      for (let iy = y + 6; iy < y + h; iy += 12) {
        for (let ix = x + 6; ix < x + w; ix += 12) {
          ctx.strokeRect(ix - 3, iy - 2, 6, 4);
        }
      }
    };
    const lcm = () => {
      for (let iy = y + 4; iy < y + h; iy += 10) {
        for (let ix = x + 4; ix < x + w; ix += 10) {
          ctx.strokeRect(ix, iy, 5, 5);
        }
      }
    };
    const noReturn = () => {
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 4);
      ctx.lineTo(x + w - 4, y + h - 4);
      ctx.moveTo(x + w - 4, y + 4);
      ctx.lineTo(x + 4, y + h - 4);
      ctx.stroke();
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    };

    switch (pat) {
      case "conglomerate":
        triangles();
        dots(12);
        break;
      case "sand":
      case "dots":
      case "sandy":
        dots(7);
        break;
      case "sandstone":
        dots(9);
        break;
      case "kao_sandstone":
        kmarks();
        break;
      case "siltstone":
      case "silty":
        for (let i = y; i < y + h; i += 5) {
          ctx.beginPath();
          for (let ix = x; ix < x + w; ix += 4) {
            if ((ix / 4) % 2) ctx.lineTo(ix, i);
            else {
              ctx.moveTo(ix, i);
              ctx.lineTo(ix + 2, i);
            }
          }
          ctx.stroke();
        }
        break;
      case "clay":
      case "shale":
      case "lines":
        linesDiag();
        break;
      case "limestone":
      case "arg_limestone":
      case "chalky_limestone":
      case "sandy_lst":
      case "brick":
        brick();
        break;
      case "cherty_limestone":
        brick();
        triangles();
        break;
      case "dolomite":
      case "dolomitic":
      case "wavy":
        waves();
        break;
      case "salt":
      case "basement":
      case "cross":
      case "x":
        crosses();
        break;
      case "anhydrite":
        for (let iy = y + 3; iy < y + h; iy += step) {
          for (let ix = x + 3; ix < x + w; ix += step) {
            ctx.beginPath();
            ctx.moveTo(ix - 2, iy);
            ctx.lineTo(ix + 2, iy);
            ctx.moveTo(ix, iy - 3);
            ctx.lineTo(ix, iy + 3);
            ctx.moveTo(ix - 2, iy - 2);
            ctx.lineTo(ix + 2, iy + 2);
            ctx.stroke();
          }
        }
        break;
      case "gypsum":
      case "v":
        vees();
        break;
      case "no_return":
        noReturn();
        break;
      case "metal_junk":
      case "solid":
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(x, y, w, h);
        break;
      case "fossils":
        fossils();
        break;
      case "lcm":
      case "grid":
        lcm();
        break;
      case "cement":
        linesDiag();
        linesDiag2();
        break;
      case "dash":
        for (let i = y; i < y + h; i += step) {
          for (let ix = x; ix < x + w; ix += 12) {
            ctx.beginPath();
            ctx.moveTo(ix, i);
            ctx.lineTo(ix + 6, i);
            ctx.stroke();
          }
        }
        break;
      default:
        dots(8);
        break;
    }
    ctx.restore();
  },

  drawWellTrajectory(ctx, p, plotW, plotH, depthRange) {
    const traj = WellManager.trajectory;
    if (traj.length < 2) return;

    // Project well onto section plane using section azimuth
    const azRad = (this.sectionAzimuth * Math.PI) / 180;
    const halfLen = this.sectionLength / 2;

    // Well starts at center of section; hOffset allows following high-angle path
    const points = traj.map((pt) => {
      const along = pt.n * Math.cos(azRad) + pt.e * Math.sin(azRad);
      const x = this.sectionToX(along, p, plotW);
      const y = p.top + ((pt.tvd - this.minDepth) / depthRange) * plotH;
      return { x, y, md: pt.md, tvd: pt.tvd, inc: pt.inc, azi: pt.azi };
    });

    // Draw path
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    // Station markers
    ctx.fillStyle = "#fbbf24";
    points.forEach((pt, i) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, i === points.length - 1 ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
      if (i === points.length - 1) {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "9px Segoe UI";
        ctx.textAlign = "left";
        ctx.fillText("TD", pt.x + 8, pt.y + 3);
        ctx.fillStyle = "#fbbf24";
      }
    });

    // Inclination labels at key points
    ctx.fillStyle = "#fcd34d";
    ctx.font = "9px Segoe UI";
    ctx.textAlign = "left";
    [0, Math.floor(points.length / 2), points.length - 1].forEach((i) => {
      if (points[i]) {
        ctx.fillText(
          `${points[i].inc.toFixed(0)}°`,
          points[i].x + 6,
          points[i].y - 6
        );
      }
    });
  },

  /**
   * Paint probable lithology as a ribbon following the well trajectory.
   * Uses MD from MWD intervals mapped through survey (MD ≠ TVD).
   */
  drawMwdLithology(ctx, p, plotW, plotH, depthRange) {
    if (typeof MWDEngine === "undefined") return;
    if (!MWDEngine.settings || !MWDEngine.settings.showAlongWell) return;
    const ivs = MWDEngine.intervals;
    if (!ivs || !ivs.length) return;

    const azRad = (this.sectionAzimuth * Math.PI) / 180;
    const posAtMd = (md) => {
      let pt = null;
      if (typeof WellManager !== "undefined" && WellManager.getPositionAtMD) {
        pt = WellManager.getPositionAtMD(md);
      }
      if (!pt) {
        return {
          x: p.left + plotW / 2,
          y: p.top + ((md - this.minDepth) / depthRange) * plotH,
        };
      }
      const along = pt.n * Math.cos(azRad) + pt.e * Math.sin(azRad);
      return {
        x: p.left + plotW / 2 + (along / this.sectionLength) * plotW,
        y: p.top + ((pt.tvd - this.minDepth) / depthRange) * plotH,
        tvd: pt.tvd,
        md: pt.md,
      };
    };

    const strip = 16;
    ivs.forEach((iv) => {
      if (iv.bottom < this.minDepth || iv.top > this.maxDepth) return;
      const nSamp = Math.max(8, Math.ceil((iv.bottom - iv.top) / 12));
      const samples = [];
      for (let i = 0; i <= nSamp; i++) {
        const md = iv.top + (i / nSamp) * (iv.bottom - iv.top);
        samples.push(posAtMd(md));
      }
      if (samples.length < 2) return;

      const normals = samples.map((pt, i) => {
        let dx = 0,
          dy = 1;
        if (i < samples.length - 1) {
          dx = samples[i + 1].x - pt.x;
          dy = samples[i + 1].y - pt.y;
        } else if (i > 0) {
          dx = pt.x - samples[i - 1].x;
          dy = pt.y - samples[i - 1].y;
        }
        const len = Math.hypot(dx, dy) || 1;
        return { nx: -dy / len, ny: dx / len };
      });

      ctx.beginPath();
      samples.forEach((pt, i) => {
        const n = normals[i];
        const x = pt.x + strip * n.nx;
        const y = pt.y + strip * n.ny;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      for (let i = samples.length - 1; i >= 0; i--) {
        const n = normals[i];
        ctx.lineTo(samples[i].x + 5 * n.nx, samples[i].y + 5 * n.ny);
      }
      ctx.closePath();
      const col =
        typeof MWDEngine.colorOf === "function"
          ? MWDEngine.colorOf(iv.lithology)
          : "#888";
      ctx.fillStyle = col;
      ctx.globalAlpha = iv.manual ? 1 : 0.88;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (iv.manual) {
        ctx.setLineDash([4, 2]);
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const mid = samples[Math.floor(samples.length / 2)];
      const nm = normals[Math.floor(samples.length / 2)];
      const label =
        typeof MWDEngine.classById === "function"
          ? MWDEngine.classById(iv.lithology).short
          : iv.lithology;
      ctx.fillStyle = this.contrastColor(col);
      ctx.font = "bold 9px Segoe UI";
      ctx.textAlign = "left";
      ctx.fillStyle = col;
      ctx.fillText(label, mid.x + strip * Math.abs(nm.nx) + 8, mid.y + 3);

      // Boundary tick at top of interval
      const top = samples[0];
      const nt = normals[0];
      ctx.strokeStyle = "rgba(248,250,252,0.65)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(top.x - 6 * nt.nx, top.y - 6 * nt.ny);
      ctx.lineTo(top.x + (strip + 4) * nt.nx, top.y + (strip + 4) * nt.ny);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  },

  showComments: true,

  drawCasings(ctx, p, plotW, plotH, depthRange) {
    const traj =
      typeof WellManager !== "undefined" ? WellManager.trajectory : [];
    const azRad = (this.sectionAzimuth * Math.PI) / 180;
    const casings =
      typeof CasingManager !== "undefined" ? [...CasingManager.casings] : [];

    const posAtTvd = (tvdTarget) => {
      if (!traj.length) {
        return {
          x: p.left + plotW / 2,
          y: p.top + ((tvdTarget - this.minDepth) / depthRange) * plotH,
        };
      }
      let a = traj[0],
        b = traj[traj.length - 1];
      for (let i = 1; i < traj.length; i++) {
        if (tvdTarget <= traj[i].tvd) {
          a = traj[i - 1];
          b = traj[i];
          break;
        }
        a = traj[i - 1];
        b = traj[i];
      }
      const span = b.tvd - a.tvd || 1;
      const t = Math.max(0, Math.min(1, (tvdTarget - a.tvd) / span));
      const n = a.n + t * (b.n - a.n);
      const e = a.e + t * (b.e - a.e);
      const along = n * Math.cos(azRad) + e * Math.sin(azRad);
      const x = this.sectionToX(along, p, plotW);
      const y = p.top + ((tvdTarget - this.minDepth) / depthRange) * plotH;
      return { x, y };
    };

    // Open hole path (full well) — drawn first, then covered by casings
    if (traj.length >= 2) {
      const holePts = traj.map((pt) => {
        const along = pt.n * Math.cos(azRad) + pt.e * Math.sin(azRad);
        return {
          x: this.sectionToX(along, p, plotW),
          y: p.top + ((pt.tvd - this.minDepth) / depthRange) * plotH,
        };
      });
      // Open hole as dashed wide channel
      const holeW = 10;
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.55)";
      ctx.lineWidth = holeW;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      holePts.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (!casings.length) {
      // label open hole only
      if (traj.length) {
        const mid = traj[Math.floor(traj.length / 2)];
        const along = mid.n * Math.cos(azRad) + mid.e * Math.sin(azRad);
        const x = this.sectionToX(along, p, plotW);
        const y = p.top + ((mid.tvd - this.minDepth) / depthRange) * plotH;
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px Segoe UI";
        ctx.fillText("OPEN HOLE", x + 12, y);
      }
      return;
    }

    // Nested casings: larger OD outer, smaller inner — taper steps like real well schematic
    // Sort by OD descending (outer first)
    casings.sort((a, b) => (b.od || 0) - (a.od || 0));

    const palette = [
      "#e2e8f0",
      "#fbbf24",
      "#38bdf8",
      "#a78bfa",
      "#fb7185",
      "#34d399",
      "#f97316",
      "#c084fc",
    ];

    casings.forEach((csg, idx) => {
      let top = csg.type === "liner" ? csg.top : 0;
      let bot = csg.bottom;
      top = Math.max(top, this.minDepth);
      bot = Math.min(bot, this.maxDepth);
      if (bot <= top) return;

      const samples = [];
      const nSamp = Math.max(12, Math.ceil((bot - top) / 20));
      for (let i = 0; i <= nSamp; i++) {
        samples.push(posAtTvd(top + (i / nSamp) * (bot - top)));
      }

      // User wall thickness (inches) mapped to px; default from OD-ID
      const wallIn =
        csg.wallThick != null
          ? csg.wallThick
          : Math.max(0.2, ((csg.od || 10) - (csg.idIn || 9)) / 2);
      const scale = 2.5; // px per inch
      const odPx = Math.max(8, Math.min(70, (csg.od || 10) * scale));
      const wallPx = Math.max(1.5, Math.min(odPx * 0.35, wallIn * scale * 2.2));
      const idPx = Math.max(2, odPx - 2 * wallPx);
      const col = csg.color || palette[idx % palette.length];

      // Perpendicular direction from path for high angle (avoid overlap)
      const normals = samples.map((pt, i) => {
        let dx = 0,
          dy = 1;
        if (i < samples.length - 1) {
          dx = samples[i + 1].x - pt.x;
          dy = samples[i + 1].y - pt.y;
        } else if (i > 0) {
          dx = pt.x - samples[i - 1].x;
          dy = pt.y - samples[i - 1].y;
        }
        const len = Math.hypot(dx, dy) || 1;
        // perpendicular
        return { nx: -dy / len, ny: dx / len };
      });

      const strokeSide = (side, width, color, alpha) => {
        ctx.beginPath();
        samples.forEach((pt, i) => {
          const n = normals[i];
          const x = pt.x + side * (odPx / 2) * n.nx;
          const y = pt.y + side * (odPx / 2) * n.ny;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.globalAlpha = alpha;
        ctx.stroke();
      };

      // Outer steel wall both sides
      strokeSide(-1, wallPx, col, 0.95);
      strokeSide(1, wallPx, col, 0.95);

      // Inner edge (pipe bore)
      strokeSide(-1, 1, "rgba(10,14,23,0.5)", 0.7);
      // slight inset for inner
      ctx.beginPath();
      samples.forEach((pt, i) => {
        const n = normals[i];
        const x = pt.x + -1 * (idPx / 2) * n.nx;
        const y = pt.y + -1 * (idPx / 2) * n.ny;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      for (let i = samples.length - 1; i >= 0; i--) {
        const n = normals[i];
        ctx.lineTo(
          samples[i].x + (idPx / 2) * n.nx,
          samples[i].y + (idPx / 2) * n.ny
        );
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(10, 14, 23, 0.25)";
      ctx.globalAlpha = 1;
      ctx.fill();

      // Shoe
      const shoe = samples[samples.length - 1];
      const ns = normals[normals.length - 1];
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(
        shoe.x - (odPx / 2 + 2) * ns.nx,
        shoe.y - (odPx / 2 + 2) * ns.ny
      );
      ctx.lineTo(
        shoe.x + (odPx / 2 + 2) * ns.nx,
        shoe.y + (odPx / 2 + 2) * ns.ny
      );
      ctx.stroke();

      // Label
      const mid = samples[Math.floor(samples.length / 2)];
      const nm = normals[Math.floor(samples.length / 2)];
      ctx.fillStyle = col;
      ctx.font = "bold 9px Segoe UI";
      ctx.textAlign = "left";
      const tag = (csg.size || "") + (csg.type === "liner" ? " LNR" : " SRF");
      ctx.fillText(tag, mid.x + (odPx / 2 + 6) * Math.abs(nm.nx) + 4, mid.y);
    });

    // Formation tops markers
    if (typeof TopsManager !== "undefined" && TopsManager.tops) {
      TopsManager.tops.forEach((t) => {
        if (t.depth < this.minDepth || t.depth > this.maxDepth) return;
        const pt = posAtTvd(t.depth);
        ctx.strokeStyle = t.color || "#f472b6";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(p.left, pt.y);
        ctx.lineTo(p.left + plotW, pt.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = t.color || "#f472b6";
        ctx.font = "10px Segoe UI";
        ctx.textAlign = "right";
        ctx.fillText(
          (t.name || "Top") + " @ " + t.depth + "m",
          p.left + plotW - 6,
          pt.y - 3
        );
      });
    }

    // Layer comments (from layer properties)
    if (this.showComments && typeof LayersManager !== "undefined") {
      LayersManager.layers.forEach((layer) => {
        if (!layer.comment || !layer.visible) return;
        const mid = (layer.top + layer.bottom) / 2;
        if (mid < this.minDepth || mid > this.maxDepth) return;
        const y = p.top + ((mid - this.minDepth) / depthRange) * plotH;
        ctx.fillStyle = "rgba(251, 191, 36, 0.9)";
        ctx.font = "9px Segoe UI";
        ctx.textAlign = "left";
        ctx.fillText("💬 " + layer.comment, p.left + 10, y);
      });
    }

    // Free comments at specified depth + horizontal position
    if (this.showComments && typeof CommentsManager !== "undefined") {
      CommentsManager.items.forEach((c) => {
        if (c.depth < this.minDepth || c.depth > this.maxDepth) return;
        const y = p.top + ((c.depth - this.minDepth) / depthRange) * plotH;
        const x = p.left + (plotW * (c.position || 10)) / 100;
        ctx.fillStyle = c.color || "#fbbf24";
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "10px Segoe UI";
        ctx.textAlign = "left";
        ctx.fillText(c.text || "", x + 8, y + 3);
      });
    }

    ctx.globalAlpha = 1;
  },

  drawScaleBar(ctx, w, h, p) {
    const barLen = 100; // pixels
    const meters = (barLen / (w - p.left - p.right)) * this.sectionLength;
    const x = w - p.right - barLen - 10;
    const y = h - 28;
    ctx.strokeStyle = "#94a3b8";
    ctx.fillStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + barLen, y);
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y + 4);
    ctx.moveTo(x + barLen, y - 4);
    ctx.lineTo(x + barLen, y + 4);
    ctx.stroke();
    ctx.font = "10px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(`${meters.toFixed(0)} m`, x + barLen / 2, y - 8);
  },

  contrastColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.5 ? "#0a0e17" : "#e2e8f0";
  },

  onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const p = this.padding;
    const w = this.canvas.width / devicePixelRatio;
    const h = this.canvas.height / devicePixelRatio;
    const plotH = h - p.top - p.bottom;
    const depthRange = this.maxDepth - this.minDepth;

    if (x < p.left || x > w - p.right || y < p.top || y > h - p.bottom) return;

    const tvd = this.minDepth + ((y - p.top) / plotH) * depthRange;

    // Check if near well
    const traj = WellManager.trajectory;
    let nearest = null;
    let minDist = 20;
    traj.forEach((pt) => {
      const py = p.top + ((pt.tvd - this.minDepth) / depthRange) * plotH;
      const dist = Math.abs(py - y);
      if (dist < minDist) {
        minDist = dist;
        nearest = pt;
      }
    });

    if (nearest) {
      const form = WellManager.getFormationAtTVD(
        nearest.tvd,
        LayersManager.layers
      );
      this.showInfo(
        "Well Station",
        `
        <strong>MD:</strong> ${nearest.md.toFixed(1)} m<br>
        <strong>TVD:</strong> ${nearest.tvd.toFixed(1)} m<br>
        <strong>Inclination:</strong> ${nearest.inc.toFixed(1)}°<br>
        <strong>Azimuth:</strong> ${nearest.azi.toFixed(1)}°<br>
        <strong>Formation:</strong> ${form}
      `
      );
      return;
    }

    // Layer click
    const layer = LayersManager.layers.find(
      (l) => tvd >= l.top && tvd < l.bottom && l.visible
    );
    if (layer) {
      this.showInfo(
        layer.name,
        `
        <strong>Formation:</strong> ${layer.name}<br>
        <strong>Lithology:</strong> ${
          LithologyLibrary.getById(layer.lithology).name
        }<br>
        <strong>Top Depth:</strong> ${layer.top} m<br>
        <strong>Bottom Depth:</strong> ${layer.bottom} m<br>
        <strong>Thickness:</strong> ${LayersManager.getThickness(layer)} m<br>
        <strong>Description:</strong> ${layer.description || "—"}
      `
      );
    }
  },

  onMove(e) {
    if (this._panning && this.handMode) {
      const plotH =
        this.canvas.height / devicePixelRatio -
        this.padding.top -
        this.padding.bottom;
      const plotW =
        this.canvas.width / devicePixelRatio -
        this.padding.left -
        this.padding.right;
      const depthRange = Math.max(1, this._panStartMax - this._panStartMin);
      const dy = e.clientY - this._panStartY;
      const dx = e.clientX - this._panStartX;
      // Vertical: drag up → deeper
      const deltaDepth = (dy / Math.max(1, plotH)) * depthRange;
      const clamped = this.clampDepthWindow(
        this._panStartMin + deltaDepth,
        this._panStartMax + deltaDepth
      );
      this.minDepth = clamped.min;
      this.maxDepth = clamped.max;
      this.syncDepthInputs();
      // Horizontal: drag left/right follows trajectory off-scale
      const deltaM = -(dx / Math.max(1, plotW)) * this.sectionLength;
      this.hOffset = this._panStartH + deltaM;
      const limit = this.sectionLength * 1.5;
      if (this.hOffset < -limit) this.hOffset = -limit;
      if (this.hOffset > limit) this.hOffset = limit;
      this.draw();
      return;
    }
  },

  showInfo(title, body) {
    document.getElementById("info-title").textContent = title;
    document.getElementById("info-body").innerHTML = body;
    document.getElementById("modal-info").classList.remove("hidden");
  },
};
