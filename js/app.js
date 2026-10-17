/**
 * LithoTrack 3D — Main Application Controller
 * Supports ONLINE (with Cesium globe) and OFFLINE (Side View only) modes
 */
const AppMode = {
  current: "offline",
  cesiumLoaded: false,
  cesiumLoading: false,

  isOnline() {
    return this.current === "online";
  },

  setMode(mode) {
    if (mode === this.current && mode === "offline") {
      this.applyOfflineUI();
      return;
    }
    this.current = mode;

    const offlineBtn = document.getElementById("btn-mode-offline");
    const onlineBtn = document.getElementById("btn-mode-online");
    const status = document.getElementById("connection-status");
    const globeBtn = document.getElementById("btn-view-globe");
    const birdBtn = document.getElementById("btn-view-bird");
    const basemapHint = document.getElementById("basemap-hint");

    if (mode === "offline") {
      offlineBtn.classList.add("active");
      onlineBtn.classList.remove("active");
      status.textContent = "OFFLINE";
      status.className = "status-badge offline";
      globeBtn.disabled = true;
      birdBtn.disabled = true;
      if (basemapHint) basemapHint.style.display = "block";
      this.applyOfflineUI();
      document.getElementById("location-info").innerHTML =
        "Offline mode — Side View active<br>Import Excel for full geology";
    } else {
      offlineBtn.classList.remove("active");
      onlineBtn.classList.add("active");
      status.textContent = "ONLINE";
      status.className = "status-badge online";
      globeBtn.disabled = false;
      birdBtn.disabled = false;
      if (basemapHint) basemapHint.style.display = "none";
      // Show globe container immediately
      const cesiumEl = document.getElementById("cesium-container");
      const sideEl = document.getElementById("side-view-container");
      const placeholder = document.getElementById("offline-placeholder");
      if (sideEl) {
        sideEl.classList.add("hidden");
        sideEl.style.display = "none";
      }
      if (placeholder) placeholder.classList.add("hidden");
      if (cesiumEl) {
        cesiumEl.classList.remove("hidden");
        cesiumEl.style.display = "block";
        cesiumEl.style.width = "100%";
        cesiumEl.style.height = "100%";
      }
      document
        .querySelectorAll(".view-btn")
        .forEach((b) => b.classList.remove("active"));
      const gb = document.getElementById("btn-view-globe");
      if (gb) gb.classList.add("active");
      const label = document.getElementById("view-label");
      if (label) label.textContent = "GLOBE VIEW";
      this.loadCesiumAndInit();
    }
    try {
      localStorage.setItem("lithotrack_mode", mode);
    } catch (e) {}
  },

  applyOfflineUI() {
    document
      .querySelectorAll(".view-btn")
      .forEach((b) => b.classList.remove("active"));
    const sideBtn = document.getElementById("btn-view-side");
    if (sideBtn) sideBtn.classList.add("active");
    this.showSideView();
  },

  showSideView() {
    const cesiumEl = document.getElementById("cesium-container");
    const sideEl = document.getElementById("side-view-container");
    const placeholder = document.getElementById("offline-placeholder");
    const label = document.getElementById("view-label");
    const compass = document.getElementById("compass");
    const homeBtn = document.getElementById("btn-home");

    if (cesiumEl) cesiumEl.classList.add("hidden");
    if (placeholder) placeholder.classList.add("hidden");
    if (sideEl) {
      sideEl.classList.remove("hidden");
      sideEl.style.display = "flex";
    }
    if (label) label.textContent = "SIDE VIEW — Geological Cross-Section";
    if (compass) compass.classList.add("hidden");
    if (homeBtn) homeBtn.classList.add("hidden");

    if (typeof GeologyView !== "undefined") {
      GeologyView.resize();
      GeologyView.draw();
    }
  },

  async loadCesiumAndInit() {
    if (
      this.cesiumLoaded &&
      typeof GlobeManager !== "undefined" &&
      GlobeManager.viewer
    ) {
      const cesiumEl = document.getElementById("cesium-container");
      if (cesiumEl) {
        cesiumEl.classList.remove("hidden");
        cesiumEl.style.display = "block";
      }
      try {
        GlobeManager.viewer.resize();
      } catch (e) {}
      this.enableGlobeUI();
      return;
    }
    if (this.cesiumLoading) return;
    this.cesiumLoading = true;

    const status = document.getElementById("connection-status");
    const info = document.getElementById("location-info");
    const setMsg = (t) => {
      if (info) info.innerHTML = t;
    };
    if (status) status.textContent = "LOADING…";
    setMsg("جاري تحميل الكرة الأرضية… انتظر");

    const timeoutMs = 25000;
    try {
      if (!document.querySelector("link[data-cesium]")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href =
          "https://cdn.jsdelivr.net/npm/cesium@1.118/Build/Cesium/Widgets/widgets.css";
        link.dataset.cesium = "1";
        document.head.appendChild(link);
      }

      await new Promise((resolve, reject) => {
        if (window.Cesium) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/cesium@1.118/Build/Cesium/Cesium.js";
        script.onload = resolve;
        script.onerror = () =>
          reject(new Error("Failed to load Cesium — check internet"));
        document.head.appendChild(script);
        setTimeout(
          () => reject(new Error("Cesium load timeout (25s)")),
          timeoutMs
        );
      });

      if (typeof GlobeManager !== "undefined") {
        if (!GlobeManager.viewer) await GlobeManager.init();
        const cesiumEl = document.getElementById("cesium-container");
        if (cesiumEl) {
          cesiumEl.classList.remove("hidden");
          cesiumEl.style.display = "block";
        }
        if (GlobeManager.viewer) {
          GlobeManager.viewer.resize();
          const lat =
            parseFloat(document.getElementById("input-lat").value) || 30.0444;
          const lon =
            parseFloat(document.getElementById("input-lon").value) || 31.2357;
          GlobeManager.goToLocation(lat, lon, 8000000);
          setTimeout(() => {
            try {
              GlobeManager.viewer.resize();
              GlobeManager.updateWellOnGlobe();
            } catch (e) {}
          }, 800);
        }
      }

      this.cesiumLoaded = true;
      this.cesiumLoading = false;
      this.enableGlobeUI();
      if (status) {
        status.textContent = "ONLINE";
        status.className = "status-badge online";
      }
      setMsg("Globe ready — استخدم GO TO LOCATION");
    } catch (err) {
      this.cesiumLoading = false;
      console.error(err);
      if (status) {
        status.textContent = "OFFLINE";
        status.className = "status-badge offline";
      }
      setMsg("تعذر تحميل الكرة. تم الرجوع Offline.<br>" + (err.message || ""));
      alert(
        "الكرة محتاجة إنترنت مستقر.\n" +
          (err.message || "") +
          "\nتم التحويل لوضع Offline."
      );
      this.setMode("offline");
    }
  },

  enableGlobeUI() {
    document.getElementById("btn-view-globe").disabled = false;
    document.getElementById("btn-view-bird").disabled = false;
    document.getElementById("compass").classList.remove("hidden");
    document.getElementById("btn-home").classList.remove("hidden");
  },
};

document.addEventListener("DOMContentLoaded", () => {
  LayersManager.init();
  WellManager.init();
  GeologyView.init();
  ChartsManager.init();
  setTimeout(function () {
    try {
      ChartsManager.init();
      ChartsManager.update();
    } catch (e) {}
  }, 300);
  ImportManager.init();
  if (typeof WellsManager !== "undefined") WellsManager.init();
  if (typeof CasingManager !== "undefined") CasingManager.render();
  initLayersSpreadsheet();

  if (typeof Workspace !== "undefined") Workspace.init();

  // Depth zoom / fit / reset tools
  document.getElementById("btn-zoom-in")?.addEventListener("click", () => {
    if (typeof GeologyView === "undefined") return;
    const c = (GeologyView.minDepth + GeologyView.maxDepth) / 2;
    const half = Math.max(
      40,
      ((GeologyView.maxDepth - GeologyView.minDepth) / 2) * 0.8
    );
    GeologyView.setDepthRange(c - half, c + half);
    const minEl = document.getElementById("min-depth");
    const maxEl = document.getElementById("max-depth");
    if (minEl) minEl.value = Math.round(c - half);
    if (maxEl) maxEl.value = Math.round(c + half);
  });
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => {
    if (typeof GeologyView === "undefined") return;
    const c = (GeologyView.minDepth + GeologyView.maxDepth) / 2;
    const half = Math.min(
      4000,
      ((GeologyView.maxDepth - GeologyView.minDepth) / 2) * 1.25
    );
    GeologyView.setDepthRange(c - half, c + half);
    const minEl = document.getElementById("min-depth");
    const maxEl = document.getElementById("max-depth");
    if (minEl) minEl.value = Math.round(c - half);
    if (maxEl) maxEl.value = Math.round(c + half);
  });
  document.getElementById("btn-fit-depth")?.addEventListener("click", () => {
    if (typeof GeologyView === "undefined") return;
    let top = 0,
      bot = 3500;
    if (typeof LayersManager !== "undefined" && LayersManager.layers?.length) {
      top = Math.min(...LayersManager.layers.map((l) => l.top));
      bot = Math.max(...LayersManager.layers.map((l) => l.bottom));
    }
    GeologyView.setDepthRange(top, bot);
    const minEl = document.getElementById("min-depth");
    const maxEl = document.getElementById("max-depth");
    if (minEl) minEl.value = Math.round(top);
    if (maxEl) maxEl.value = Math.round(bot);
  });
  document.getElementById("btn-reset-view")?.addEventListener("click", () => {
    if (typeof GeologyView === "undefined") return;
    GeologyView.hOffset = 0;
    GeologyView.setDepthRange(0, 3500);
    GeologyView.setVE(2);
    const minEl = document.getElementById("min-depth");
    const maxEl = document.getElementById("max-depth");
    const ve = document.getElementById("ve-slider");
    if (minEl) minEl.value = 0;
    if (maxEl) maxEl.value = 3500;
    if (ve) {
      ve.value = 2;
      document.getElementById("ve-display").textContent = "2.0";
    }
  });

  document.getElementById("btn-mob-left")?.addEventListener("click", () => {
    document.getElementById("left-panel")?.classList.toggle("open");
    document.getElementById("right-panel")?.classList.remove("open");
  });
  document.getElementById("btn-mob-right")?.addEventListener("click", () => {
    document.getElementById("right-panel")?.classList.toggle("open");
    document.getElementById("left-panel")?.classList.remove("open");
  });

  let savedMode = "offline";
  try {
    savedMode = localStorage.getItem("lithotrack_mode") || "offline";
  } catch (e) {}
  AppMode.setMode(savedMode);

  setTimeout(() => {
    GeologyView.resize();
    GeologyView.draw();
    ChartsManager.update();
    WellManager.updateStats();
  }, 150);

  document
    .getElementById("btn-mode-offline")
    ?.addEventListener("click", () => AppMode.setMode("offline"));
  document
    .getElementById("btn-mode-online")
    ?.addEventListener("click", () => AppMode.setMode("online"));

  document.getElementById("btn-switch-side")?.addEventListener("click", () => {
    document
      .querySelectorAll(".view-btn")
      .forEach((b) => b.classList.remove("active"));
    document.getElementById("btn-view-side").classList.add("active");
    AppMode.showSideView();
  });

  document.getElementById("btn-goto")?.addEventListener("click", () => {
    const lat = parseFloat(document.getElementById("input-lat").value);
    const lon = parseFloat(document.getElementById("input-lon").value);
    if (
      isNaN(lat) ||
      isNaN(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      alert("Invalid coordinates");
      return;
    }
    WellManager.setWellhead(lat, lon);
    document.getElementById("location-info").innerHTML =
      "<strong>Lat:</strong> " +
      lat.toFixed(5) +
      "°<br><strong>Lon:</strong> " +
      lon.toFixed(5) +
      "°";
    if (AppMode.isOnline() && GlobeManager.viewer) {
      GlobeManager.goToLocation(lat, lon, 40000);
      setTimeout(() => GlobeManager.updateWellOnGlobe(), 2600);
    }
    GeologyView.draw();
  });

  document.getElementById("basemap-select")?.addEventListener("change", (e) => {
    if (AppMode.isOnline() && GlobeManager.viewer)
      GlobeManager.setBasemap(e.target.value);
  });

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      document
        .querySelectorAll(".view-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.dataset.mode;
      if (mode === "side") {
        AppMode.showSideView();
      } else if (AppMode.isOnline() && GlobeManager.viewer) {
        document.getElementById("side-view-container").classList.add("hidden");
        document.getElementById("side-view-container").style.display = "none";
        document.getElementById("cesium-container").classList.remove("hidden");
        document.getElementById("offline-placeholder").classList.add("hidden");
        document.getElementById("view-label").textContent =
          mode === "globe" ? "GLOBE VIEW" : "BIRD VIEW";
        document.getElementById("compass").classList.remove("hidden");
        document.getElementById("btn-home").classList.remove("hidden");
        GlobeManager.setMode(mode);
      }
    });
  });

  ["section-azimuth", "section-length"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      GeologyView.setSection(
        parseFloat(document.getElementById("section-azimuth").value),
        parseFloat(document.getElementById("section-length").value)
      );
    });
  });

  function updateDepth() {
    GeologyView.setDepthRange(
      parseFloat(document.getElementById("min-depth").value) || 0,
      parseFloat(document.getElementById("max-depth").value) || 3500
    );
    GeologyView.setFilter(
      parseFloat(document.getElementById("filter-from").value) || 0,
      parseFloat(document.getElementById("filter-to").value) || 3500
    );
  }
  ["min-depth", "max-depth", "filter-from", "filter-to"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", updateDepth);
  });

  document.getElementById("ve-slider")?.addEventListener("input", (e) => {
    const ve = parseFloat(e.target.value);
    document.getElementById("ve-display").textContent = ve.toFixed(1);
    GeologyView.setVE(ve);
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });

  document.getElementById("btn-add-layer")?.addEventListener("click", () => {
    LayersManager.addLayer();
    GeologyView.draw();
  });
  document.getElementById("btn-reset-layers")?.addEventListener("click", () => {
    if (confirm("Reset all layers to defaults?")) {
      LayersManager.reset();
      GeologyView.draw();
    }
  });
  document
    .getElementById("btn-import-layers")
    ?.addEventListener("click", () => ImportManager.open("layers"));
  document
    .getElementById("btn-paste-layers-apply")
    ?.addEventListener("click", () =>
      ImportManager.applyPaste("layers", false)
    );
  document
    .getElementById("btn-paste-layers-replace")
    ?.addEventListener("click", () => ImportManager.applyPaste("layers", true));
  document.getElementById("paste-layers")?.addEventListener("paste", () => {
    setTimeout(() => {
      const rows = ImportManager.parsePasteText(
        document.getElementById("paste-layers").value,
        "layers"
      );
      const valid = rows.filter((r) => r.valid);
      const prev = document.getElementById("paste-layers-preview");
      if (prev && rows.length) {
        prev.classList.remove("hidden");
        prev.innerHTML =
          '<span class="ok">' +
          valid.length +
          " rows ready</span> — press Apply or Replace";
      }
    }, 50);
  });
  document.getElementById("btn-apply-layer")?.addEventListener("click", () => {
    LayersManager.applyPropsFromUI();
    GeologyView.draw();
  });
  document.getElementById("btn-delete-layer")?.addEventListener("click", () => {
    if (LayersManager.selectedId && confirm("Delete this layer?")) {
      LayersManager.deleteLayer(LayersManager.selectedId);
      GeologyView.draw();
    }
  });
  document.getElementById("btn-dup-layer")?.addEventListener("click", () => {
    if (LayersManager.selectedId) {
      LayersManager.duplicateLayer(LayersManager.selectedId);
      GeologyView.draw();
    }
  });

  ["prop-top", "prop-bottom"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      const t = parseFloat(document.getElementById("prop-top").value) || 0;
      const b = parseFloat(document.getElementById("prop-bottom").value) || 0;
      document.getElementById("prop-thickness").value = Math.max(0, b - t);
    });
  });

  document.getElementById("btn-add-station")?.addEventListener("click", () => {
    WellManager.addStation();
    ChartsManager.update();
    if (AppMode.isOnline() && GlobeManager.viewer)
      GlobeManager.updateWellOnGlobe();
    GeologyView.draw();
  });
  document.getElementById("btn-calc-traj")?.addEventListener("click", () => {
    WellManager.calculateTrajectory();
    WellManager.renderTable();
    WellManager.updateStats();
    ChartsManager.update();
    if (AppMode.isOnline() && GlobeManager.viewer)
      GlobeManager.updateWellOnGlobe();
    GeologyView.draw();
  });
  document.getElementById("btn-clear-survey")?.addEventListener("click", () => {
    if (confirm("Clear all survey stations?")) {
      WellManager.clear();
      ChartsManager.update();
      if (AppMode.isOnline() && GlobeManager.viewer)
        GlobeManager.updateWellOnGlobe();
      GeologyView.draw();
    }
  });
  document
    .getElementById("btn-import-survey")
    ?.addEventListener("click", () => ImportManager.open("survey"));
  document
    .getElementById("btn-paste-survey-apply")
    ?.addEventListener("click", () =>
      ImportManager.applyPaste("survey", false)
    );
  document
    .getElementById("btn-paste-survey-replace")
    ?.addEventListener("click", () => ImportManager.applyPaste("survey", true));
  document.getElementById("paste-survey")?.addEventListener("paste", () => {
    setTimeout(() => {
      const rows = ImportManager.parsePasteText(
        document.getElementById("paste-survey").value,
        "survey"
      );
      const valid = rows.filter((r) => r.valid);
      const prev = document.getElementById("paste-survey-preview");
      if (prev && rows.length) {
        prev.classList.remove("hidden");
        prev.innerHTML =
          '<span class="ok">' +
          valid.length +
          " stations ready</span> — press Apply or Replace";
      }
    }, 50);
  });

  LithologyLibrary.renderList(document.getElementById("lith-list"), (lith) => {
    if (LayersManager.selectedId) {
      if (lith && lith.id)
        LayersManager.updateLayer(LayersManager.selectedId, {
          lithology: lith.id,
          color: lith.color,
        });
      LayersManager.showProps(LayersManager.selectedId);
      GeologyView.draw();
    }
  });
  document.getElementById("btn-add-lith")?.addEventListener("click", () => {
    const name = prompt("Lithology name:");
    if (!name) return;
    const color = prompt("Color (hex):", "#888888") || "#888888";
    LithologyLibrary.addCustom(name, color);
    LithologyLibrary.renderList(
      document.getElementById("lith-list"),
      (lith) => {
        if (LayersManager.selectedId) {
          if (lith && lith.id)
            LayersManager.updateLayer(LayersManager.selectedId, {
              lithology: lith.id,
              color: lith.color,
            });
          LayersManager.showProps(LayersManager.selectedId);
          GeologyView.draw();
        }
      }
    );
    LithologyLibrary.populateSelect(document.getElementById("prop-lithology"));
  });

  
  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    try {
      if (typeof LithoAuth !== "undefined") await LithoAuth.logout();
    } catch (e) {}
    location.replace("login.html");
  });

  document.getElementById("btn-new")?.addEventListener("click", () => {
    if (confirm("New project? ALL data will be wiped (empty).")) {
      WellsManager.newProject();
      ChartsManager.update();
      GeologyView.draw();
      initLayersSpreadsheet();
      if (typeof DrillingParams !== "undefined") DrillingParams.render();
      if (typeof GasParams !== "undefined") GasParams.render();
    }
  });

  document.getElementById("btn-save")?.addEventListener("click", () => {
    WellsManager.persist();
    WellsManager.exportProject(true);
    alert("Saved (autosave + downloaded editable JSON)");
  });

  document.getElementById("btn-load")?.addEventListener("click", () => {
    document.getElementById("load-project-input").click();
  });
  document
    .getElementById("load-project-input")
    ?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const project = JSON.parse(ev.target.result);
          if (project.wells) {
            WellsManager.importProject(project);
            initLayersSpreadsheet();
            alert("Multi-well project loaded");
          } else {
            // legacy single-well
            if (project.location) {
              document.getElementById("input-lat").value = project.location.lat;
              document.getElementById("input-lon").value = project.location.lon;
              WellManager.setWellhead(
                project.location.lat,
                project.location.lon
              );
            }
            if (project.layers) LayersManager.setLayers(project.layers, true);
            if (project.survey) WellManager.setStations(project.survey);
            ChartsManager.update();
            GeologyView.draw();
            WellsManager.persist();
            alert("Project loaded");
          }
          initLayersSpreadsheet();
        } catch (err) {
          alert("Invalid project file: " + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });

  /* old export replaced by enhanced handler */

  document.getElementById("btn-undo")?.addEventListener("click", () => {
    LayersManager.undo();
    GeologyView.draw();
  });
  document.getElementById("btn-redo")?.addEventListener("click", () => {
    LayersManager.redo();
    GeologyView.draw();
  });
  document.getElementById("btn-fullscreen")?.addEventListener("click", () => {
    if (!document.fullscreenElement)
      document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  });
  document.getElementById("btn-home")?.addEventListener("click", () => {
    if (AppMode.isOnline() && GlobeManager.viewer) GlobeManager.home();
  });
  document.getElementById("compass")?.addEventListener("click", () => {
    if (AppMode.isOnline() && GlobeManager.viewer) GlobeManager.resetNorth();
  });

  document.addEventListener("layers-changed", () => GeologyView.draw());
  document.addEventListener("well-changed", () => {
    ChartsManager.update();
    if (AppMode.isOnline() && GlobeManager.viewer)
      GlobeManager.updateWellOnGlobe();
    GeologyView.draw();
  });

  window.addEventListener("resize", () => {
    if (document.getElementById("btn-view-side")?.classList.contains("active"))
      GeologyView.resize();
  });

  // ——— Multi-well ———
  document.getElementById("well-selector")?.addEventListener("change", (e) => {
    if (typeof WellsManager !== "undefined")
      WellsManager.switchTo(e.target.value);
  });
  document.getElementById("btn-add-well")?.addEventListener("click", () => {
    const name = prompt(
      "New well name:",
      "Well-" + ((WellsManager.wells.length || 0) + 1)
    );
    if (!name) return;
    WellsManager.captureCurrentIntoActive();
    WellsManager.createWell(name);
    WellsManager.loadActiveIntoUI();
    initLayersSpreadsheet();
  });
  document.getElementById("btn-rename-well")?.addEventListener("click", () => {
    const w = WellsManager.getActive();
    if (!w) return;
    const name = prompt("Rename well:", w.name);
    if (name) WellsManager.renameActive(name);
  });
  document.getElementById("btn-del-well")?.addEventListener("click", () => {
    if (confirm("Delete active well?")) {
      WellsManager.deleteActive();
      initLayersSpreadsheet();
    }
  });

  // ——— Casing ———
  document
    .getElementById("btn-casing-add-confirm")
    ?.addEventListener("click", () => {
      CasingManager.add({
        size: document.getElementById("casing-size").value,
        top: parseFloat(document.getElementById("casing-top").value) || 0,
        bottom:
          parseFloat(document.getElementById("casing-bottom").value) || 500,
        sequence: parseInt(document.getElementById("casing-seq").value) || 1,
        type: document.getElementById("casing-type")?.value || "surface",
        wallThick:
          parseFloat(document.getElementById("casing-wall")?.value) || 0.5,
        color: document.getElementById("casing-color")?.value || "#e2e8f0",
      });
      document.getElementById("casing-seq").value =
        CasingManager.casings.length + 1;
      GeologyView.draw();
      WellsManager.persist();
    });
  document.getElementById("btn-add-casing")?.addEventListener("click", () => {
    document.getElementById("casing-top")?.focus();
  });
  document.getElementById("casing-size")?.addEventListener("change", (e) => {
    const label = e.target.value;
    const size = CasingManager.sizes.find((x) => x.label === label);
    const typ = document.getElementById("casing-type");
    if (typ && size) typ.value = size.od <= 7 ? "liner" : "surface";
  });

  // ——— Lithology editor ———
  document
    .getElementById("btn-lith-apply")
    ?.addEventListener("click", () => LithologyLibrary.applyEditor());
  document.getElementById("btn-lith-cancel")?.addEventListener("click", () => {
    const p = document.getElementById("lith-editor");
    if (p) p.style.display = "none";
  });

  // Spreadsheet apply from grid
  document
    .getElementById("btn-ss-add-row")
    ?.addEventListener("click", () => addSSRow());

  document.addEventListener("casings-changed", () => {
    GeologyView.draw();
    WellsManager.persist();
  });
  document.addEventListener("well-switched", () => {
    initLayersSpreadsheet();
    CasingManager.render();
  });
  document.addEventListener("lithology-changed", () => {
    LithologyLibrary.renderList(
      document.getElementById("lith-list"),
      (lith) => {
        if (LayersManager.selectedId) {
          if (lith && lith.id)
            LayersManager.updateLayer(LayersManager.selectedId, {
              lithology: lith.id,
              color: lith.color,
            });
          GeologyView.draw();
        }
      }
    );
  });

  // Autosave on layer/well changes
  document.addEventListener("layers-changed", () => {
    WellManager.updateStats();
    if (typeof WellsManager !== "undefined") WellsManager.persist();
  });
  document.addEventListener("well-changed", () => {
    WellManager.updateStats();
    if (typeof WellsManager !== "undefined") WellsManager.persist();
  });

  // Clear buttons
  document.getElementById("btn-clear-layers")?.addEventListener("click", () => {
    if (confirm("Clear all layers?")) {
      LayersManager.layers = [];
      LayersManager.selectedId = null;
      LayersManager.renderList();
      if (LayersManager.hideProps) LayersManager.hideProps();
      GeologyView.draw();
      if (typeof WellsManager !== "undefined") WellsManager.persist();
      if (typeof initLayersSpreadsheet === "function") initLayersSpreadsheet();
    }
  });
  document
    .getElementById("btn-clear-casings")
    ?.addEventListener("click", () => {
      if (confirm("Clear all casings?")) {
        CasingManager.setCasings([]);
        GeologyView.draw();
        WellsManager.persist();
      }
    });
  document.getElementById("btn-clear-lith")?.addEventListener("click", () => {
    if (confirm("Remove custom lithologies only?")) {
      LithologyLibrary.items = LithologyLibrary.items.filter((i) => !i.custom);
      LithologyLibrary.saveCustom();
      LithologyLibrary.renderList(document.getElementById("lith-list"), null);
    }
  });
  document
    .getElementById("btn-clear-tops")
    ?.addEventListener("click", () => TopsManager.clear());
  document
    .getElementById("btn-clear-drill")
    ?.addEventListener("click", () => DrillingParams.clear());
  document
    .getElementById("btn-clear-gas")
    ?.addEventListener("click", () => GasParams.clear());

  document.getElementById("btn-add-top")?.addEventListener("click", () => {
    TopsManager.add(
      document.getElementById("top-name").value,
      document.getElementById("top-depth").value,
      document.getElementById("top-thick").value,
      document.getElementById("top-color").value
    );
    GeologyView.draw();
  });
  document.addEventListener("tops-changed", () => GeologyView.draw());

  document.getElementById("btn-drill-row")?.addEventListener("click", () => {
    const _db = document.getElementById("drill-params-body");
    if (_db && typeof DrillingParams !== "undefined")
      DrillingParams.addEmptyRow(_db);
  });
  document.getElementById("btn-gas-row")?.addEventListener("click", () => {
    const _gb = document.getElementById("gas-params-body");
    if (_gb && typeof GasParams !== "undefined") GasParams.addEmptyRow(_gb);
  });

  // Paste into drill/gas tables
  document.getElementById("drill-wrap")?.addEventListener("paste", (e) => {
    const t = (e.clipboardData || window.clipboardData).getData("text");
    if (t && (t.includes("\t") || t.includes("\n"))) {
      e.preventDefault();
      DrillingParams.parsePaste(t);
    }
  });
  document.getElementById("gas-wrap")?.addEventListener("paste", (e) => {
    const t = (e.clipboardData || window.clipboardData).getData("text");
    if (t && (t.includes("\t") || t.includes("\n"))) {
      e.preventDefault();
      GasParams.parsePaste(t);
    }
  });

  // Keyboard Ctrl+A select all inputs in focused grid
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const wrap = e.target.closest(
      ".ss-wrap, .paste-section, #survey-table, .table-wrap"
    );
    if (!wrap) return;
    if (e.key === "a") {
      e.preventDefault();
      const inputs = wrap.querySelectorAll("input, textarea");
      if (inputs.length && e.target.tagName === "INPUT") {
        e.target.select();
      } else if (wrap.querySelector("textarea")) {
        wrap.querySelector("textarea").select();
      }
    }
  });

  // Comments toggle
  document
    .getElementById("btn-toggle-comments")
    ?.addEventListener("click", () => {
      GeologyView.showComments = !GeologyView.showComments;
      GeologyView.draw();
    });
  document.getElementById("btn-toggle-logs")?.addEventListener("click", () => {
    ExportHeader.showDrillCharts = !ExportHeader.showDrillCharts;
    ExportHeader.showGasCharts = !ExportHeader.showGasCharts;
    document.getElementById("box-drill").style.display =
      ExportHeader.showDrillCharts ? "" : "none";
    document.getElementById("box-gas").style.display =
      ExportHeader.showGasCharts ? "" : "none";
  });

  // Color palette
  const palette = document.getElementById("color-palette");
  if (palette) {
    const mains = [
      "#e74c3c",
      "#e67e22",
      "#f1c40f",
      "#2ecc71",
      "#1abc9c",
      "#3498db",
      "#9b59b6",
      "#34495e",
      "#c0392b",
      "#d35400",
      "#f39c12",
      "#27ae60",
      "#16a085",
      "#2980b9",
      "#8e44ad",
      "#2c3e50",
      "#ffcccc",
      "#ffe0b2",
      "#fff9c4",
      "#c8e6c9",
      "#b2dfdb",
      "#bbdefb",
      "#e1bee7",
      "#cfd8dc",
      "#8B7355",
      "#F4D03F",
      "#5D6D7E",
      "#AED6F1",
      "#5DADE2",
      "#6C3483",
      "#1C2833",
      "#F5B7B1",
    ];
    mains.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.style.background = c;
      b.title = c;
      b.addEventListener("click", () => {
        const el = document.getElementById("lith-edit-color");
        if (el) el.value = c;
      });
      palette.appendChild(b);
    });
  }

  // Sync header fields
  function syncHeaderFromUI() {
    const map = {
      company: "hdr-company",
      wellName: "hdr-well",
      field: "hdr-field",
      area: "hdr-area",
      country: "hdr-country",
      rig: "hdr-rig",
      airGap: "hdr-airgap",
      wd: "hdr-wd",
      rkb: "hdr-rkb",
      spudDate: "hdr-spud",
      tdDate: "hdr-tddate",
      tdDepth: "hdr-td",
      wellStatus: "hdr-status",
      coordX: "hdr-x",
      coordY: "hdr-y",
      latitude: "hdr-lat",
      longitude: "hdr-lon",
      geologist: "hdr-geo",
      crew: "hdr-crew",
      wellConfig: "hdr-wellconfig",
      scale: "hdr-scale",
    };
    Object.keys(map).forEach((k) => {
      const el = document.getElementById(map[k]);
      if (el) ExportHeader.fields[k] = el.value;
    });
  }

  // Save As — deferred with setTimeout to avoid browser freeze after prompt
  document.getElementById("btn-save-as")?.addEventListener("click", () => {
    try {
      syncHeaderFromUI();
    } catch (e) {}
    const choice = prompt(
      "Save As:\n" +
        "1 = Project JSON (كل الداتا)\n" +
        "2 = Template (تختار إيه يتحفظ)\n" +
        "3 = Layers CSV\n" +
        "4 = Survey CSV"
    );
    if (choice == null || choice === "") return;
    const c = String(choice).trim();
    setTimeout(function () {
      try {
        if (c === "1") {
          if (typeof WellsManager !== "undefined")
            WellsManager.exportProject(true);
        } else if (c === "2") {
          document.getElementById("btn-create-template")?.click();
        } else if (c === "3") {
          downloadText(LayersManager.exportCSV(), "layers.csv", "text/csv");
        } else if (c === "4") {
          const rows = WellManager.stations
            .map(function (x) {
              return x.md + "," + x.tvd + "," + x.inc + "," + x.azi;
            })
            .join("\n");
          downloadText("MD,TVD,Inc,Azi\n" + rows, "survey.csv", "text/csv");
        }
      } catch (err) {
        console.error("Save As error:", err);
        alert("Save As failed: " + (err && err.message ? err.message : err));
      }
    }, 50);
  });

  // Export — scale + tracks + deferred
  document.getElementById("btn-export")?.addEventListener("click", () => {
    try {
      if (typeof syncHeaderFromUI === "function") syncHeaderFromUI();
    } catch (e) {}
    const choice = prompt(
      "Export:\n" +
      "1 = Export data (JSON)\n" +
      "2 = Layers CSV\n" +
      "3 = Survey CSV"
    );
    if (choice == null || choice === "") return;
    const c = String(choice).trim();
    setTimeout(function () {
      try {
        if (c === "1") {
          if (typeof WellsManager !== "undefined")
            WellsManager.exportProject(true);
        } else if (c === "2") {
          downloadText(LayersManager.exportCSV(), "layers.csv", "text/csv");
        } else if (c === "3") {
          const rows = WellManager.stations
            .map((x) => x.md + "," + x.tvd + "," + x.inc + "," + x.azi)
            .join("\n");
          downloadText("MD,TVD,Inc,Azi\n" + rows, "survey.csv", "text/csv");
        }
      } catch (err) {
        console.error(err);
        alert("Export failed: " + (err.message || err));
      }
    }, 50);
  });

  document.getElementById("btn-save-img")?.addEventListener("click", () => {
    try {
      const canvas = document.getElementById("geology-canvas");
      if (!canvas) return alert("Section canvas not found");
      const a = document.createElement("a");
      const name =
        (typeof ExportHeader !== "undefined" &&
          ExportHeader.fields &&
          ExportHeader.fields.wellName) ||
        "section";
      a.href = canvas.toDataURL("image/png");
      a.download = String(name).replace(/\s+/g, "_") + ".png";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 200);
    } catch (err) {
      alert("Save IMG failed: " + (err.message || err));
    }
  });

  // Init logs grids
  setTimeout(() => {
    if (typeof DrillingParams !== "undefined") {
      DrillingParams.render();
      DrillingParams.updateChart();
    }
    if (typeof GasParams !== "undefined") {
      GasParams.render();
      GasParams.updateChart();
    }
    if (typeof TopsManager !== "undefined") TopsManager.render();
  }, 400);

  // ——— Comments ———
  document.getElementById("btn-add-comment")?.addEventListener("click", () => {
    const text = document.getElementById("cmt-text")?.value;
    if (!text) {
      alert("Enter comment text");
      return;
    }
    CommentsManager.add(
      text,
      document.getElementById("cmt-depth")?.value,
      document.getElementById("cmt-pos")?.value,
      document.getElementById("cmt-color")?.value
    );
    GeologyView.draw();
    document.getElementById("cmt-text").value = "";
  });
  document
    .getElementById("btn-clear-comments")
    ?.addEventListener("click", () => {
      if (confirm("Clear all comments?")) {
        CommentsManager.clear();
        GeologyView.draw();
      }
    });
  document.addEventListener("comments-changed", () => GeologyView.draw());

  // ——— Templates ———
  document
    .getElementById("btn-create-template")
    ?.addEventListener("click", () => {
      const name = prompt("Template name:", "My_Template");
      if (!name) return;
      const opts = {
        layers: confirm("تشمل الطبقات (Layers)?"),
        survey: confirm("تشمل المسح (Survey)?"),
        casings: confirm("تشمل الكيسينج?"),
        tops: confirm("تشمل الـ Tops?"),
        comments: confirm("تشمل الكومنتات?"),
        header: confirm("تشمل الهيدر?"),
        drilling: confirm("تشمل Drilling Parameters?"),
        gases: confirm("تشمل Gases?"),
      };
      syncHeaderFromUI();
      TemplateManager.saveTemplate(name, opts);
      alert("Template saved: " + name);
    });
  document
    .getElementById("btn-load-template")
    ?.addEventListener("click", () => {
      document.getElementById("load-template-input")?.click();
    });
  document
    .getElementById("load-template-input")
    ?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.type === "lithotrack_template" || data.payload) {
            TemplateManager.loadTemplate(data);
            if (typeof initLayersSpreadsheet === "function")
              initLayersSpreadsheet();
            alert("Template loaded: " + (data.name || file.name));
          } else if (data.wells) {
            WellsManager.importProject(data);
            alert("Full project loaded");
          } else {
            alert("Unknown file format");
          }
        } catch (err) {
          alert("File error: " + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });

  document.getElementById("btn-reload")?.addEventListener("click", () => {
    if (confirm("Reload LithoTrack?")) location.reload();
  });
  if (typeof ShortcutManager !== "undefined") {
    ShortcutManager.init();
    document.getElementById("btn-shortcuts")?.addEventListener("click", () => {
      document.querySelector('.tab-btn[data-tab="shortcuts"]')?.click();
    });
    document
      .getElementById("btn-shortcuts-reset")
      ?.addEventListener("click", () => ShortcutManager.reset());
  }
  window.HeaderCustom = {
    key: "lithotrack_hdr_custom",
    fields: [],
    load() {
      try {
        this.fields = JSON.parse(localStorage.getItem(this.key) || "[]");
      } catch (e) {
        this.fields = [];
      }
      this.render();
    },
    save() {
      const list = document.getElementById("hdr-dyn-list");
      if (!list) return;
      this.fields = [];
      list.querySelectorAll(".hdr-dyn-item").forEach((row) => {
        const label = row.querySelector(".hdr-label")?.value?.trim();
        const value = row.querySelector(".hdr-value")?.value ?? "";
        if (label) this.fields.push({ label, value });
      });
      localStorage.setItem(this.key, JSON.stringify(this.fields));
      if (typeof ExportHeader !== "undefined")
        ExportHeader.customFields = this.fields.slice();
    },
    render() {
      const list = document.getElementById("hdr-dyn-list");
      if (!list) return;
      list.innerHTML = "";
      this.fields.forEach((f, i) => {
        const row = document.createElement("div");
        row.className = "hdr-dyn-item";
        row.innerHTML =
          '<input class="hdr-label" placeholder="Field name" value="' +
          String(f.label || "").replace(/"/g, "&quot;") +
          '" /><input class="hdr-value" placeholder="Value" value="' +
          String(f.value || "").replace(/"/g, "&quot;") +
          '" /><button type="button" class="small-btn hdr-del" data-i="' +
          i +
          '">Remove</button>';
        list.appendChild(row);
      });
      list.querySelectorAll(".hdr-del").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.fields.splice(+btn.dataset.i, 1);
          this.render();
          this.save();
        });
      });
      list
        .querySelectorAll("input")
        .forEach((inp) => inp.addEventListener("change", () => this.save()));
    },
    add() {
      this.save();
      this.fields.push({ label: "New Field", value: "" });
      this.render();
      this.save();
    },
    clear() {
      this.fields = [];
      this.save();
      this.render();
    },
  };
  HeaderCustom.load();
  document
    .getElementById("btn-hdr-add-field")
    ?.addEventListener("click", () => HeaderCustom.add());
  document
    .getElementById("btn-hdr-clear-custom")
    ?.addEventListener("click", () => {
      if (confirm("Remove all custom header fields?")) HeaderCustom.clear();
    });

  console.log("LithoTrack 3D ready — Mode:", AppMode.current);
});

/** Excel-style layers grid */
function initLayersSpreadsheet() {
  const tbody = document.getElementById("ss-layers-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  const layers = LayersManager.layers.length ? LayersManager.layers : [];
  if (layers.length === 0) {
    for (let i = 0; i < 5; i++) addSSRow();
  } else {
    layers.forEach((l) =>
      addSSRow(
        l.name,
        l.top,
        l.bottom,
        LithologyLibrary.getById(l.lithology).name
      )
    );
  }
}

function addSSRow(name, top, bottom, lith) {
  const tbody = document.getElementById("ss-layers-body");
  if (!tbody) return;
  const tr = document.createElement("tr");
  tr.innerHTML =
    '<td><input value="' +
    (name || "") +
    '" data-col="name" /></td>' +
    '<td><input type="number" value="' +
    (top != null ? top : "") +
    '" data-col="top" /></td>' +
    '<td><input type="number" value="' +
    (bottom != null ? bottom : "") +
    '" data-col="bottom" /></td>' +
    '<td><input value="' +
    (lith || "") +
    '" data-col="lith" /></td>';
  tbody.appendChild(tr);
}

function readSSGrid() {
  const rows = [];
  document.querySelectorAll("#ss-layers-body tr").forEach((tr) => {
    const inputs = tr.querySelectorAll("input");
    const name = inputs[0].value.trim();
    const top = parseFloat(inputs[1].value);
    const bottom = parseFloat(inputs[2].value);
    const lith = inputs[3].value.trim() || "Sandstone";
    if (!name && isNaN(top)) return;
    rows.push({
      name: name || "Layer",
      top,
      bottom,
      lithology: lith,
      valid: !isNaN(top) && !isNaN(bottom) && bottom > top,
    });
  });
  return rows;
}

// Override paste apply to use grid when available
const _origApplyPaste = ImportManager.applyPaste.bind(ImportManager);
ImportManager.applyPaste = function (type, replace) {
  if (type === "layers") {
    const gridRows = readSSGrid();
    const valid = gridRows.filter((r) => r.valid);
    if (valid.length) {
      const prepared = valid.map((d) => ({
        name: d.name,
        top: d.top,
        bottom: d.bottom,
        lithology: LithologyLibrary.getByName(d.lithology)?.id || "sandstone",
        color: LithologyLibrary.getByName(d.lithology)?.color || "#888888",
        opacity: 0.85,
        description: "",
      }));
      LayersManager.setLayers(prepared, replace);
      GeologyView.draw();
      WellsManager.persist();
      const prev = document.getElementById("paste-layers-preview");
      if (prev) {
        prev.classList.remove("hidden");
        prev.innerHTML =
          '<span class="ok">' + valid.length + " layers applied</span>";
      }
      return;
    }
  }
  _origApplyPaste(type, replace);
  WellsManager.persist();
};

// Allow pasting into spreadsheet
document.addEventListener("DOMContentLoaded", () => {
  const wrap = document.querySelector(".ss-wrap");
  if (!wrap) return;
  wrap.addEventListener("paste", (e) => {
    const text = (e.clipboardData || window.clipboardData).getData("text");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return;
    e.preventDefault();
    const rows = ImportManager.parsePasteText(text, "layers");
    const tbody = document.getElementById("ss-layers-body");
    tbody.innerHTML = "";
    rows.forEach((r) => addSSRow(r.name, r.top, r.bottom, r.lithology));
    if (rows.length === 0) addSSRow();
  });
});

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type: type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function exportFullLogImage(withComments) {
  const prev = GeologyView.showComments;
  GeologyView.showComments = !!withComments;
  GeologyView.draw();
  const section = document.getElementById("geology-canvas");
  const scale = window.devicePixelRatio || 1;
  const W = Math.max(1400, section.width);
  const headerH = 320;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = headerH * scale + section.height;
  const ctx = out.getContext("2d");
  const f = ExportHeader.fields;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);

  // Blue header bar
  ctx.fillStyle = "#3B7EA1";
  ctx.fillRect(0, 0, out.width, 48 * scale);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold " + 26 * scale + "px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText(f.wellName || "WELL", out.width / 2, 32 * scale);
  ctx.font = 12 * scale + "px Segoe UI";
  ctx.fillText("FORMATION EVALUATION LOG", out.width / 2, 44 * scale);

  // Left / right columns
  ctx.fillStyle = "#111";
  ctx.font = 12 * scale + "px Segoe UI";
  ctx.textAlign = "left";
  const left = [
    "COMPANY : " + f.company,
    "RIG : " + f.rig,
    "FIELD : " + f.field,
    "AREA : " + f.area,
    "COUNTRY : " + f.country,
    "AIR GAP : " + f.airGap,
    "W.D : " + f.wd,
    "RKB : " + f.rkb,
  ];
  const right = [
    "SPUD DATE : " + f.spudDate,
    "T.D DATE : " + f.tdDate,
    "T.D DEPTH : " + f.tdDepth,
    "WELL STATUS : " + f.wellStatus,
    "X : " + f.coordX + "   Y : " + f.coordY,
    "LATITUDE : " + f.latitude,
    "LONGITUDE : " + f.longitude,
    "SCALE : " + f.scale,
  ];
  left.forEach((t, i) => ctx.fillText(t, 20 * scale, (70 + i * 18) * scale));
  right.forEach((t, i) =>
    ctx.fillText(t, out.width * 0.52, (70 + i * 18) * scale)
  );

  // Well config box
  let y0 = 70 + left.length * 18 + 10;
  ctx.fillStyle = "#3B7EA1";
  ctx.fillRect(10 * scale, y0 * scale, out.width - 20 * scale, 18 * scale);
  ctx.fillStyle = "#fff";
  ctx.font = "bold " + 11 * scale + "px Segoe UI";
  ctx.fillText("WELL CONFIGURATION", 16 * scale, (y0 + 13) * scale);
  ctx.fillStyle = "#111";
  ctx.font = 11 * scale + "px Consolas, monospace";
  const cfg = (f.wellConfig || "").split("\\n").filter(Boolean);
  cfg.forEach((line, i) => {
    ctx.fillText(line, 16 * scale, (y0 + 32 + i * 14) * scale);
  });

  // Crew / geo
  const midX = out.width * 0.55;
  ctx.fillStyle = "#3B7EA1";
  ctx.fillRect(midX, y0 * scale, out.width - midX - 10 * scale, 18 * scale);
  ctx.fillStyle = "#fff";
  ctx.fillText("E.C.S CREW / GEOLOGIST", midX + 6 * scale, (y0 + 13) * scale);
  ctx.fillStyle = "#111";
  ctx.font = 10 * scale + "px Segoe UI";
  const crew = (f.crew || "").split("\\n").filter(Boolean);
  const geo = (f.geologist || "").split("\\n").filter(Boolean);
  crew.forEach((t, i) =>
    ctx.fillText(t, midX + 6 * scale, (y0 + 32 + i * 13) * scale)
  );
  geo.forEach((t, i) =>
    ctx.fillText(
      t,
      midX + 6 * scale,
      (y0 + 32 + (crew.length + 1 + i) * 13) * scale
    )
  );

  // Lithology legend strip
  let ly = headerH * scale - 36 * scale;
  ctx.fillStyle = "#eee";
  ctx.fillRect(0, ly - 4 * scale, out.width, 40 * scale);
  let lx = 10 * scale;
  ctx.font = 9 * scale + "px Segoe UI";
  LayersManager.layers.slice(0, 14).forEach((layer) => {
    ctx.fillStyle = layer.color;
    ctx.fillRect(lx, ly, 12 * scale, 12 * scale);
    ctx.strokeStyle = "#333";
    ctx.strokeRect(lx, ly, 12 * scale, 12 * scale);
    ctx.fillStyle = "#222";
    ctx.fillText(layer.name, lx + 16 * scale, ly + 10 * scale);
    lx += ctx.measureText(layer.name).width + 28 * scale;
  });

  // Section image
  ctx.drawImage(section, 0, headerH * scale);

  const a = document.createElement("a");
  a.href = out.toDataURL("image/png");
  a.download = (f.wellName || "well").replace(/\\s+/g, "_") + "_FEL.png";
  a.click();
  GeologyView.showComments = prev;
  GeologyView.draw();
}

/** Composite: drill charts LEFT | lithology CENTER | gas charts RIGHT */

function exportFullScreenComposite() {
  try {
    if (typeof syncHeaderFromUI === "function") syncHeaderFromUI();
  } catch (e) {}
  setTimeout(function () {
    try {
      const minD = GeologyView.minDepth;
      const maxD = GeologyView.maxDepth;
      const span = Math.max(1, maxD - minD);
      const px = Math.min(4, Math.max(1.2, 1200 / span));
      const canvas = renderScaledSection(minD, maxD, px, true);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download =
        ((ExportHeader.fields && ExportHeader.fields.wellName) || "well") +
        "_composite.png";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        a.remove();
      }, 200);
    } catch (err) {
      console.error(err);
      alert("Composite export failed: " + (err.message || err));
    }
  }, 80);
}

/* Chart zoom for bottom survey tracks */
window.chartZoomLevel = 1;
function applyChartZoom(delta) {
  window.chartZoomLevel = Math.max(
    0.6,
    Math.min(4, (window.chartZoomLevel || 1) + delta)
  );
  const h = Math.round(160 * window.chartZoomLevel);
  const wPct = Math.round(100 * window.chartZoomLevel);
  document
    .querySelectorAll("#charts-panel .chart-scroll canvas")
    .forEach(function (c) {
      c.style.height = h + "px";
      c.style.minHeight = h + "px";
      c.style.width = Math.max(100, wPct) + "%";
    });
  try {
    if (typeof ChartsManager !== "undefined") {
      [
        ChartsManager.chartInc,
        ChartsManager.chartAzi,
        ChartsManager.chartDls,
        DrillingParams && DrillingParams.chart,
        GasParams && GasParams.chart,
      ].forEach(function (ch) {
        if (ch) ch.resize();
      });
      ChartsManager.update();
    }
  } catch (e) {}
  const lab = document.getElementById("chart-zoom-label");
  if (lab) lab.textContent = Math.round(window.chartZoomLevel * 100) + "%";
}
document.addEventListener("DOMContentLoaded", function () {
  document
    .getElementById("btn-chart-zoom-in")
    ?.addEventListener("click", function () {
      applyChartZoom(0.25);
    });
  document
    .getElementById("btn-chart-zoom-out")
    ?.addEventListener("click", function () {
      applyChartZoom(-0.25);
    });
  document
    .getElementById("btn-chart-zoom-reset")
    ?.addEventListener("click", function () {
      window.chartZoomLevel = 1;
      applyChartZoom(0);
    });
});
