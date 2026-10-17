/**
 * GeoVision 3D — Cesium Globe Manager
 */
const GlobeManager = {
  viewer: null,
  marker: null,
  wellEntity: null,
  currentMode: 'globe',
  autoRotate: true,
  rotateHandler: null,

  async init() {
    // Use Ion-free imagery for local use (OpenStreetMap + natural earth style)
    Cesium.Ion.defaultAccessToken = undefined;

    this.viewer = new Cesium.Viewer('cesium-container', {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      imageryProvider: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      skyBox: new Cesium.SkyBox({
        sources: {
          positiveX: this.createStarCanvas(),
          negativeX: this.createStarCanvas(),
          positiveY: this.createStarCanvas(),
          negativeY: this.createStarCanvas(),
          positiveZ: this.createStarCanvas(),
          negativeZ: this.createStarCanvas()
        }
      }),
      orderIndependentTranslucency: false,
      contextOptions: { webgl: { alpha: true } }
    });

    // Dark space background
    this.viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#000010');
    this.viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a1628');
    this.viewer.scene.globe.enableLighting = true;
    this.viewer.scene.globe.atmosphereLightIntensity = 5;
    this.viewer.scene.skyAtmosphere.show = true;
    this.viewer.scene.fog.enabled = true;
    this.viewer.scene.moon.show = true;
    this.viewer.scene.sun.show = true;

    // Imagery: satellite first (with timeout), then OSM — never leave black globe
    this.viewer.imageryLayers.removeAll();
    this.viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#1a3a2a');
    this.viewer.scene.globe.show = true;

    const addOsm = () => {
      try {
        this.viewer.imageryLayers.addImageryProvider(
          new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' })
        );
        return true;
      } catch (e) {
        console.warn('OSM failed', e);
        return false;
      }
    };

    try {
      const satPromise = Cesium.ArcGisMapServerImageryProvider.fromUrl(
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
      );
      const imagery = await Promise.race([
        satPromise,
        new Promise((_, rej) => setTimeout(() => rej(new Error('sat timeout')), 8000))
      ]);
      this.viewer.imageryLayers.addImageryProvider(imagery);
    } catch (e) {
      console.warn('Satellite failed, OSM fallback', e);
      addOsm();
    }
    if (this.viewer.imageryLayers.length === 0) addOsm();
    this.viewer.resize();

    // Initial view
    this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(31.2357, 30.0444, 18000000),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90),
        roll: 0
      }
    });

    // Auto rotate
    this.startAutoRotate();

    // Stop auto-rotate on user input
    this.viewer.screenSpaceEventHandler.setInputAction(() => {
      this.stopAutoRotate();
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    this.viewer.screenSpaceEventHandler.setInputAction(() => {
      this.stopAutoRotate();
    }, Cesium.ScreenSpaceEventType.WHEEL);

    // Compass update
    this.viewer.scene.postRender.addEventListener(() => this.updateCompass());

    // Click handler for info
    this.viewer.screenSpaceEventHandler.setInputAction(click => {
      const picked = this.viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && picked.id && picked.id._gvType === 'well') {
        // handled in well entity
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    window.addEventListener('resize', () => this.viewer.resize());
  },

  createStarCanvas() {
    // Simple procedural star field as data URL for skybox faces
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000010';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = Math.random() * 1.5;
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return c.toDataURL();
  },

  startAutoRotate() {
    if (this.rotateHandler) return;
    this.autoRotate = true;
    this.rotateHandler = this.viewer.clock.onTick.addEventListener(() => {
      if (this.autoRotate && this.currentMode === 'globe') {
        this.viewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, -0.0005);
      }
    });
  },

  stopAutoRotate() {
    this.autoRotate = false;
  },

  setBasemap(type) {
    this.viewer.imageryLayers.removeAll();
    const urls = {
      satellite: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
      terrain: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer',
      hybrid: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer',
      dark: null
    };

    if (type === 'dark') {
      this.viewer.imageryLayers.addImageryProvider(
        new Cesium.SingleTileImageryProvider({
          url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          rectangle: Cesium.Rectangle.MAX_VALUE
        })
      );
      this.viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a1628');
      return;
    }

    Cesium.ArcGisMapServerImageryProvider.fromUrl(urls[type] || urls.satellite)
      .then(provider => {
        this.viewer.imageryLayers.addImageryProvider(provider);
      })
      .catch(() => {
        this.viewer.imageryLayers.addImageryProvider(
          new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' })
        );
      });
  },

  goToLocation(lat, lon, zoomHeight = 50000) {
    this.stopAutoRotate();
    WellManager.setWellhead(lat, lon);

    // Remove old marker
    if (this.marker) {
      this.viewer.entities.remove(this.marker);
    }

    this.marker = this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString('#00d4ff'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      },
      label: {
        text: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`,
        font: '13px Segoe UI',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      }
    });

    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, zoomHeight),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-45),
        roll: 0
      },
      duration: 2.5
    });

    // Location info
    const info = document.getElementById('location-info');
    if (info) {
      info.innerHTML = `
        <strong>Lat:</strong> ${lat.toFixed(5)}°<br>
        <strong>Lon:</strong> ${lon.toFixed(5)}°<br>
        <strong>Status:</strong> Marker placed
      `;
    }

    this.updateWellOnGlobe();
  },

  setMode(mode) {
    this.currentMode = mode;
    const cesiumEl = document.getElementById('cesium-container');
    const sideEl = document.getElementById('side-view-container');
    const label = document.getElementById('view-label');

    if (mode === 'side') {
      cesiumEl.style.display = 'none';
      sideEl.classList.remove('hidden');
      label.textContent = 'SIDE VIEW — Geological Cross-Section';
      GeologyView.resize();
      GeologyView.draw();
    } else {
      cesiumEl.style.display = 'block';
      sideEl.classList.add('hidden');
      label.textContent = mode === 'globe' ? 'GLOBE VIEW' : 'BIRD VIEW';
      this.viewer.resize();

      if (mode === 'bird') {
        this.stopAutoRotate();
        const lat = parseFloat(document.getElementById('input-lat').value) || 30.0444;
        const lon = parseFloat(document.getElementById('input-lon').value) || 31.2357;
        this.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, 8000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-90),
            roll: 0
          },
          duration: 1.5
        });
      } else {
        this.startAutoRotate();
        this.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            parseFloat(document.getElementById('input-lon').value) || 31.2357,
            parseFloat(document.getElementById('input-lat').value) || 30.0444,
            12000000
          ),
          duration: 2
        });
      }
    }
  },

  updateWellOnGlobe() {
    if (this.wellEntity) {
      this.viewer.entities.remove(this.wellEntity);
      this.wellEntity = null;
    }
    // Remove previous well points
    const toRemove = [];
    this.viewer.entities.values.forEach(e => {
      if (e._gvType === 'well') toRemove.push(e);
    });
    toRemove.forEach(e => this.viewer.entities.remove(e));

    const traj = WellManager.trajectory;
    if (traj.length < 2) return;

    const lat = WellManager.wellhead.lat;
    const lon = WellManager.wellhead.lon;
    // Approximate meters to degrees
    const mPerDegLat = 111320;
    const mPerDegLon = 111320 * Math.cos(lat * Math.PI / 180);

    const positions = traj.map(pt => {
      const dLat = pt.n / mPerDegLat;
      const dLon = pt.e / mPerDegLon;
      return Cesium.Cartesian3.fromDegrees(lon + dLon, lat + dLat, -pt.tvd * 0.1); // scaled depth for visibility
    });

    this.wellEntity = this.viewer.entities.add({
      _gvType: 'well',
      polyline: {
        positions,
        width: 4,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          color: Cesium.Color.fromCssColorString('#f59e0b')
        }),
        clampToGround: false
      }
    });

    // Station markers
    traj.forEach((pt, i) => {
      const dLat = pt.n / mPerDegLat;
      const dLon = pt.e / mPerDegLon;
      this.viewer.entities.add({
        _gvType: 'well',
        position: Cesium.Cartesian3.fromDegrees(lon + dLon, lat + dLat, -pt.tvd * 0.1),
        point: {
          pixelSize: i === traj.length - 1 ? 10 : 5,
          color: i === traj.length - 1 ? Cesium.Color.RED : Cesium.Color.fromCssColorString('#fbbf24'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1
        },
        label: i % 2 === 0 || i === traj.length - 1 ? {
          text: `MD ${pt.md}`,
          font: '10px Segoe UI',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(10, 0),
          scale: 0.8
        } : undefined
      });
    });
  },

  home() {
    this.stopAutoRotate();
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(20, 20, 20000000),
      duration: 2
    });
    setTimeout(() => this.startAutoRotate(), 2200);
  },

  updateCompass() {
    const heading = this.viewer.camera.heading;
    const needle = document.querySelector('.compass-needle');
    if (needle) {
      needle.style.transform = `rotate(${-Cesium.Math.toDegrees(heading)}deg)`;
    }
  },

  resetNorth() {
    this.viewer.camera.setView({
      orientation: {
        heading: 0,
        pitch: this.viewer.camera.pitch,
        roll: 0
      }
    });
  }
};
