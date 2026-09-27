import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  Layers,
  Eye,
  Compass,
  Info,
  MapPin,
  RotateCcw,
  Bug,
  ArrowLeftRight,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Table as TableIcon,
  HelpCircle,
  Sparkles,
  Mountain,
  AlertTriangle,
  Play,
  Pause,
  Sliders,
  Maximize2,
  Grid,
  Map as MapIcon
} from 'lucide-react';
import { BlockData, DownscalingResult, FarmerReport, Language, Panchayat } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { NASHIK_BLOCKS, PANCHAYATS_DATA } from '../data/nashikGeoData';
import { calculateDownscaledWeather } from '../ml/randomForestModel';

interface PanchayatMapProps {
  lang: Language;
  selectedPanchayat: Panchayat;
  onSelectPanchayat: (p: Panchayat) => void;
  farmerReports: FarmerReport[];
  forecastByBlock: Record<string, BlockData>;
  onOpenIntake: () => void;
}

type MapMode = 'block' | 'panchayat_rf' | 'calibrated' | 'split';
type CompareSubView = 'slider' | 'side_by_side' | 'delta_heatmap' | 'table';

// IMD 0.25° Grid Cell Definitions across Nashik District
interface ImdGridMeshCell {
  id: string;
  nameMr: string;
  nameEn: string;
  bounds: [[number, number], [number, number]]; // [[southLat, westLng], [northLat, eastLng]]
  blockId: string;
  center: [number, number];
}

const IMD_025_GRID_MESH: ImdGridMeshCell[] = [
  {
    id: 'grid_igatpuri_bhavali',
    nameMr: 'इगतपुरी / भवली जलसंधारण क्षेत्र',
    nameEn: 'Igatpuri / Bhavali Catchment',
    bounds: [[19.50, 73.40], [19.75, 73.65]],
    blockId: 'igatpuri',
    center: [19.625, 73.525],
  },
  {
    id: 'grid_trimbak',
    nameMr: 'त्र्यंबकेश्वर सह्याद्री घाट क्षेत्र',
    nameEn: 'Trimbakeshwar Ghat Sector',
    bounds: [[19.75, 73.40], [20.00, 73.65]],
    blockId: 'trimbak',
    center: [19.875, 73.525],
  },
  {
    id: 'grid_sinnar',
    nameMr: 'सिन्नर पर्जन्यछाया सपाट क्षेत्र',
    nameEn: 'Sinnar Rain-Shadow Plain',
    bounds: [[19.75, 73.90], [20.00, 74.15]],
    blockId: 'sinnar',
    center: [19.875, 74.025],
  },
  {
    id: 'grid_nashik_central',
    nameMr: 'नाशिक मध्य / गोदावरी खोरे',
    nameEn: 'Nashik Central / Godavari Basin',
    bounds: [[19.90, 73.65], [20.15, 73.90]],
    blockId: 'niphad',
    center: [20.025, 73.775],
  },
  {
    id: 'grid_niphad_pimpalgaon',
    nameMr: 'निफाड / पिंपळगाव द्राक्ष पट्टा',
    nameEn: 'Niphad / Pimpalgaon Grape Belt',
    bounds: [[20.00, 73.90], [20.25, 74.15]],
    blockId: 'niphad',
    center: [20.125, 74.025],
  },
  {
    id: 'grid_dindori',
    nameMr: 'दिंडोरी डोंगर उतार क्षेत्र',
    nameEn: 'Dindori Slope Agro-Zone',
    bounds: [[20.10, 73.65], [20.35, 73.90]],
    blockId: 'dindori',
    center: [20.225, 73.775],
  },
  {
    id: 'grid_satana_baglan',
    nameMr: 'सटाणा / बागलाण उत्तर पठार',
    nameEn: 'Satana / Baglan North Plateau',
    bounds: [[20.45, 74.05], [20.70, 74.30]],
    blockId: 'satana',
    center: [20.575, 74.175],
  },
];

export const PanchayatMap: React.FC<PanchayatMapProps> = ({
  lang,
  selectedPanchayat,
  onSelectPanchayat,
  farmerReports,
  forecastByBlock,
  onOpenIntake,
}) => {
  const t = TRANSLATIONS[lang];
  const [mapMode, setMapMode] = useState<MapMode>('calibrated');
  const [compareSubView, setCompareSubView] = useState<CompareSubView>('slider');
  const [filterBlockId, setFilterBlockId] = useState<string>('all');
  const [hoveredPanchayat, setHoveredPanchayat] = useState<Panchayat | null>(null);
  const [showImdMeshGrid, setShowImdMeshGrid] = useState<boolean>(false);
  const [activeTileTheme, setActiveTileTheme] = useState<'topo' | 'positron'>('topo');

  const getBlockForecast = (blockId: string) => forecastByBlock[blockId]
    || NASHIK_BLOCKS.find((block) => block.id === blockId)
    || NASHIK_BLOCKS[0];

  // Before/After Curtain Split Slider State (0% = 100% IMD, 100% = 100% VarshaGyan)
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const autoPlayDirRef = useRef<number>(1);
  const autoPlayTimerRef = useRef<number | null>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Leaflet Container References
  const leafletMapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapInstanceRef = useRef<L.Map | null>(null);
  const leafletLayersRef = useRef<{
    tileLayer?: L.TileLayer;
    meshLayer?: L.LayerGroup;
    panchayatLayer?: L.LayerGroup;
    selectedMarker?: L.LayerGroup;
  }>({});

  // Precompute downscaled data for all panchayats
  const panchayatResults = React.useMemo(() => {
    const map = new Map<string, DownscalingResult>();
    PANCHAYATS_DATA.forEach((p) => {
      const block = getBlockForecast(p.blockId);
      const res = calculateDownscaledWeather(p, block, farmerReports);
      map.set(p.id, res);
    });
    return map;
  }, [farmerReports, forecastByBlock]);

  // A simple green scale: lighter shades mean less rain, darker shades mean more.
  const getRainfallColor = (rainMm: number) => {
    if (rainMm <= 1.0) return '#F0F7E9';
    if (rainMm <= 3.0) return '#D6EACB';
    if (rainMm <= 6.0) return '#99A873';
    if (rainMm <= 10.0) return '#78B56B';
    if (rainMm <= 15.0) return '#4B925B';
    if (rainMm <= 20.0) return '#466849';
    return '#2F4638';
  };

  // Divergent Delta Color function for Difference Heatmap:
  const getDeltaColor = (deltaMm: number) => {
    if (deltaMm >= 4.0) return '#059669'; // Deep Emerald (High Positive lift)
    if (deltaMm >= 2.0) return '#10B981'; // Green (Moderate Positive lift)
    if (deltaMm >= 0.5) return '#6EE7B7'; // Mint (Mild Positive lift)
    if (deltaMm <= -4.0) return '#B6413A'; // Crimson Warning Red (Severe deficit)
    if (deltaMm <= -2.0) return '#5A7852'; // Muted Terracotta Clay
    if (deltaMm <= -0.5) return '#C9A14A'; // Warm Turmeric Ochre
    return '#94A3B8'; // Slate Neutral (Equal to IMD within +/- 0.5mm)
  };

  const filteredPanchayats = filterBlockId === 'all'
    ? PANCHAYATS_DATA
    : PANCHAYATS_DATA.filter((p) => p.blockId === filterBlockId);

  // -------------------------------------------------------------
  // DEDICATED CALIBRATED GEOGRAPHIC PROJECTION SYSTEM
  // Includes internal safe margins (top, bottom, left, right)
  // Ensures northern villages (Taharabad/Satana), southern villages (Bhavali/Ghot),
  // western ghats (Trimbak/Anjaneri), and eastern plains (Lasalgaon/Ranwad)
  // are 100% visible, fully contained within the SVG canvas, and never clipped.
  // -------------------------------------------------------------
  const projectToSvg = (lat: number, lng: number, width = 800, height = 600) => {
    // Safe inner padding inside the 800x600 SVG canvas:
    // Top: 82px (clears top badges like "BEFORE IMD" / "AFTER VarshaGyan")
    // Bottom: 76px (clears bottom floating pill and captions)
    // Left: 78px, Right: 78px (prevents edge boundary clipping)
    const padTop = 82;
    const padBottom = 76;
    const padLeft = 78;
    const padRight = 78;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Geographic envelope bounding all Nashik GP coordinates with boundary buffer:
    const geoMinLat = 19.56;
    const geoMaxLat = 20.74;
    const geoMinLng = 73.44;
    const geoMaxLng = 74.32;

    const x = padLeft + ((lng - geoMinLng) / (geoMaxLng - geoMinLng)) * plotW;
    const y = padTop + ((geoMaxLat - lat) / (geoMaxLat - geoMinLat)) * plotH;
    return { x, y };
  };

  const selectedResult = panchayatResults.get(selectedPanchayat.id);
  const selectedBlock = getBlockForecast(selectedPanchayat.blockId);
  const selectedDelta = (selectedResult?.calibratedRainfall ?? 0) - selectedBlock.imdRainfallMm;

  // LEAFLET MAP INITIALIZATION & REACTIVE RENDERING
  useEffect(() => {
    if (!leafletMapContainerRef.current) return;

    if (!leafletMapInstanceRef.current) {
      const map = L.map(leafletMapContainerRef.current, {
        center: [20.10, 73.88],
        zoom: 9.5,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

      const tileLayer = L.tileLayer(tileUrl, {
        opacity: 0.9,
        maxZoom: 19,
      }).addTo(map);

      leafletLayersRef.current.tileLayer = tileLayer;
      leafletLayersRef.current.meshLayer = L.layerGroup().addTo(map);
      leafletLayersRef.current.panchayatLayer = L.layerGroup().addTo(map);
      leafletLayersRef.current.selectedMarker = L.layerGroup().addTo(map);

      leafletMapInstanceRef.current = map;
    }

    const map = leafletMapInstanceRef.current;
    map.invalidateSize();

    if (leafletLayersRef.current.tileLayer) {
      const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      leafletLayersRef.current.tileLayer.setUrl(tileUrl);
      leafletLayersRef.current.tileLayer.setOpacity(activeTileTheme === 'topo' ? 0.9 : 0.72);
      const tilePane = map.getPane('tilePane');
      if (tilePane) tilePane.style.filter = activeTileTheme === 'positron' ? 'grayscale(0.82) saturate(0.7)' : 'none';
    }

    // Start at block scale so the video can show several local estimates together.
    const sameBlockPanchayats = filteredPanchayats.filter((p) => p.blockId === selectedPanchayat.blockId);
    if (sameBlockPanchayats.length > 1) {
      const blockCoordinates = sameBlockPanchayats.flatMap((p) =>
        p.polygon?.length ? p.polygon : [[p.lat, p.lng]],
      ) as [number, number][];
      map.setView(L.latLngBounds(blockCoordinates).getCenter(), 11, { animate: false });
    } else if (selectedPanchayat.polygon && selectedPanchayat.polygon.length > 0) {
      const villageBounds = L.latLngBounds(selectedPanchayat.polygon as [number, number][]);
      villageBounds.extend([selectedPanchayat.lat, selectedPanchayat.lng]);
      map.fitBounds(villageBounds, {
        padding: [60, 60],
        maxZoom: 13,
        animate: true,
        duration: 0.75,
      });
    } else if (filteredPanchayats.length > 0) {
      const bounds = L.latLngBounds(filteredPanchayats.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
    }

    // 1. RENDER IMD 0.25° × 0.25° BOUNDING COORDINATE MESH GRID
    if (leafletLayersRef.current.meshLayer) {
      leafletLayersRef.current.meshLayer.clearLayers();

      if (showImdMeshGrid) {
        IMD_025_GRID_MESH.forEach((cell) => {
          const isSelectedBlockGrid = cell.blockId === selectedPanchayat.blockId;

          const rect = L.rectangle(cell.bounds, {
            color: isSelectedBlockGrid ? '#C9A14A' : '#2F4638',
            weight: isSelectedBlockGrid ? 3 : 1,
            dashArray: isSelectedBlockGrid ? undefined : '4, 4',
            fillColor: isSelectedBlockGrid ? '#C9A14A' : '#2F4638',
            fillOpacity: isSelectedBlockGrid ? 0.35 : 0.15,
          });

          rect.bindTooltip(
            `<div class="text-xs font-marathi">
              <div class="font-bold text-[#2F4638]">${lang === 'mr' ? cell.nameMr : cell.nameEn}</div>
              <div class="text-[10px] text-gray-600">Illustrative 0.25° block mesh (~27km)</div>
            </div>`,
            { direction: 'center', opacity: 0.85 }
          );

          leafletLayersRef.current.meshLayer?.addLayer(rect);
        });
      }
    }

    // 2. RENDER PANCHAYAT POLYGONS & LABELS
    if (leafletLayersRef.current.panchayatLayer) {
      leafletLayersRef.current.panchayatLayer.clearLayers();
      const blockByRainfall = [...sameBlockPanchayats].sort(
        (a, b) => (panchayatResults.get(a.id)?.calibratedRainfall ?? 0) - (panchayatResults.get(b.id)?.calibratedRainfall ?? 0),
      );
      const visibleBlockIds = new Set<string>([
        selectedPanchayat.id,
        blockByRainfall[0]?.id,
        blockByRainfall[blockByRainfall.length - 1]?.id,
      ].filter((id): id is string => Boolean(id)));
      if (visibleBlockIds.size < 3) {
        const middle = blockByRainfall[Math.floor(blockByRainfall.length / 2)];
        if (middle) visibleBlockIds.add(middle.id);
      }

      filteredPanchayats.forEach((p) => {
        const res = panchayatResults.get(p.id);
        const block = getBlockForecast(p.blockId);
        const isSelected = p.id === selectedPanchayat.id;
        const activeCount = res?.activeReportsCount ?? 0;
        const localAdjustmentPct = block.imdRainfallMm > 0 && res
          ? Math.round(((res.calibratedRainfall - block.imdRainfallMm) / block.imdRainfallMm) * 100)
          : 0;

        let fillColor = '#FFFFFF';
        let rainValue = '0 mm';

        if (mapMode === 'block') {
          fillColor = getRainfallColor(block.imdRainfallMm);
          rainValue = `${block.imdRainfallMm} mm (${block.isDemoForecast ? 'Demo' : 'Block input'})`;
        } else if (mapMode === 'panchayat_rf') {
          fillColor = getRainfallColor(res ? res.rfDownscaledRainfall : block.imdRainfallMm);
          rainValue = `${res ? res.rfDownscaledRainfall : block.imdRainfallMm} mm`;
        } else if (mapMode === 'calibrated' || mapMode === 'split') {
          fillColor = getRainfallColor(res ? res.calibratedRainfall : block.imdRainfallMm);
          rainValue = `${res ? res.calibratedRainfall : block.imdRainfallMm} mm`;
        }

        if (p.polygon && p.polygon.length > 0) {
          const poly = L.polygon(p.polygon as [number, number][], {
            fillColor: fillColor,
            fillOpacity: isSelected ? 0.95 : 0.75,
            color: isSelected ? '#C9A14A' : '#FFFFFF',
            weight: isSelected ? 3.5 : 1.5,
          });

          const tooltipContent = mapMode === 'block'
            ? `<div class="p-1 font-marathi text-xs">
                <div class="font-extrabold text-[#2F4638] flex items-center gap-1">
                  <span>📍 ${lang === 'mr' ? p.nameMr : p.nameEn}</span>
                  <span class="text-[10px] text-gray-500 font-mono">(${p.elevationM}m)</span>
                </div>
                <div class="text-[11px] text-[#2F4638] font-bold mt-1 bg-amber-50 p-1.5 rounded border border-amber-200">
                  <span class="text-amber-900">🏛️ ${lang === 'mr' ? 'समान ब्लॉक इनपुट:' : 'Shared block input:'}</span>
                  <span class="font-mono font-black text-[#2F4638] ml-1">${block.imdRainfallMm} mm</span>
                  <div class="text-[10px] text-gray-600 font-normal mt-0.5">
                    ${lang === 'mr' ? 'संपूर्ण तालुक्यातील सर्व गावांना हाच एक नंबर लागू होतो (सपाट अंदाज)' : 'Same flat number applied to all villages in block'}
                  </div>
                </div>
              </div>`
            : `<div class="p-1 font-marathi text-xs">
                <div class="font-extrabold text-[#2F4638] flex items-center gap-1">
                  <span>📍 ${lang === 'mr' ? p.nameMr : p.nameEn}</span>
                  <span class="text-[10px] text-gray-500 font-mono">(${p.elevationM}m)</span>
                </div>
                <div class="text-[11px] text-[#2F4638] font-bold mt-0.5">
                  ${lang === 'mr' ? 'पाऊस अंदाज:' : 'Rain Forecast:'} <span class="font-mono text-[#C9A14A]">${rainValue}</span>
                </div>
                <div class="text-[10px] text-[#5A7852] font-semibold mt-0.5 flex items-center gap-1">
                  <span>🐜 ${activeCount > 0 ? `${activeCount} ${lang === 'mr' ? 'सक्रिय शेतकरी संकेत' : 'Active Farmer Reports'}` : `${lang === 'mr' ? 'भूभाग प्रात्यक्षिक पद्धत' : 'Terrain demo heuristic'}`}</span>
                </div>
              </div>`;

          poly.bindTooltip(tooltipContent, { direction: 'top', sticky: true });

          poly.on('click', () => {
            onSelectPanchayat(p);
          });

          poly.on('mouseover', () => {
            setHoveredPanchayat(p);
          });

          poly.on('mouseout', () => {
            setHoveredPanchayat(null);
          });

          leafletLayersRef.current.panchayatLayer?.addLayer(poly);
        }

        const pinHtml = mapMode === 'block'
          ? `
            <div class="flex flex-col items-center justify-center pointer-events-none transform -translate-x-1/2 -translate-y-1/2">
              <div class="px-1.5 py-0.5 rounded shadow-md text-[10px] font-mono font-black ${
                isSelected ? 'bg-[#C9A14A] text-[#2F4638] ring-2 ring-white scale-110' : 'bg-[#2F4638] text-white border border-gray-400'
              }">
                🏛️ ${block.imdRainfallMm} mm
              </div>
              <div class="text-[10px] font-bold text-[#2F4638] drop-shadow-sm whitespace-nowrap px-1.5 py-0.2 rounded bg-[#F6F4EC]/95 mt-0.5 border border-gray-300 shadow-2xs">
                ${lang === 'mr' ? p.nameMr.split(' ')[0] : p.nameEn.split(' ')[0]}
              </div>
            </div>
          `
          : `
            <div class="flex flex-col items-center justify-center pointer-events-none transform -translate-x-1/2 -translate-y-1/2">
              <div class="px-1.5 py-0.5 rounded shadow-md text-[10px] font-mono font-black ${
                isSelected ? 'bg-[#C9A14A] text-[#2F4638] ring-2 ring-white scale-110' : 'bg-[#F6F4EC] text-[#2F4638] border border-gray-300'
              }">
                ${rainValue}
              </div>
              <div class="text-[9px] font-bold text-[#5A7852] whitespace-nowrap px-1.5 py-0.2 rounded bg-white/95 mt-0.5 border border-gray-200 shadow-2xs">
                ${localAdjustmentPct > 0 ? '+' : ''}${localAdjustmentPct}% ${lang === 'mr' ? 'स्थानिक बदल' : 'local change'}
              </div>
              <div class="text-[10px] font-bold text-[#2F4638] drop-shadow-sm whitespace-nowrap px-1.5 py-0.2 rounded bg-[#F6F4EC]/95 mt-0.5 border border-gray-200 shadow-2xs">
                ${lang === 'mr' ? p.nameMr.split(' ')[0] : p.nameEn.split(' ')[0]}
              </div>
            </div>
          `;

        const markerIcon = L.divIcon({
          html: pinHtml,
          className: 'custom-village-pin',
          iconSize: [0, 0],
        });

        // Keep the default map readable: show the numeric label only for the
        // selected Panchayat. Other Panchayats remain colored and selectable.
        if (visibleBlockIds.has(p.id)) {
          const marker = L.marker([p.lat, p.lng], { icon: markerIcon });
          leafletLayersRef.current.panchayatLayer?.addLayer(marker);
        }
      });
    }

    // 3. SELECTED PANCHAYAT HIGHLIGHT
    if (leafletLayersRef.current.selectedMarker) {
      leafletLayersRef.current.selectedMarker.clearLayers();

      const pulseCircle = L.circleMarker([selectedPanchayat.lat, selectedPanchayat.lng], {
        radius: 12,
        color: '#C9A14A',
        weight: 3,
        fillColor: '#C9A14A',
        fillOpacity: 0.4,
      });

      leafletLayersRef.current.selectedMarker.addLayer(pulseCircle);
    }
  }, [
    lang,
    selectedPanchayat,
    filteredPanchayats,
    mapMode,
    showImdMeshGrid,
    activeTileTheme,
    panchayatResults,
  ]);

  // Center and fit full boundary of selected village without clipping
  const handleCenterOnSelectedVillage = () => {
    const map = leafletMapInstanceRef.current;
    if (!map) return;
    map.invalidateSize();

    if (selectedPanchayat.polygon && selectedPanchayat.polygon.length > 0) {
      const bounds = L.latLngBounds(selectedPanchayat.polygon as [number, number][]);
      bounds.extend([selectedPanchayat.lat, selectedPanchayat.lng]);
      map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 13,
        animate: true,
        duration: 0.75,
      });
    } else {
      const center = L.latLng(selectedPanchayat.lat, selectedPanchayat.lng);
      const bounds = center.toBounds(3500);
      map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 13,
        animate: true,
        duration: 0.75,
      });
    }
  };

  // Fit bounds to entire district or current filtered taluka
  const handleFitFullDistrict = () => {
    const map = leafletMapInstanceRef.current;
    if (!map) return;
    map.invalidateSize();

    if (filteredPanchayats.length > 0) {
      const bounds = L.latLngBounds(filteredPanchayats.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 11, animate: true, duration: 0.75 });
    }
  };

  // Auto-play animation for Before/After Slider
  useEffect(() => {
    if (isAutoPlaying) {
      autoPlayTimerRef.current = window.setInterval(() => {
        setSliderPos((prev) => {
          let next = prev + autoPlayDirRef.current * 1.5;
          if (next >= 95) {
            autoPlayDirRef.current = -1;
            next = 95;
          } else if (next <= 5) {
            autoPlayDirRef.current = 1;
            next = 5;
          }
          return next;
        });
      }, 40);
    } else {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    }
    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [isAutoPlaying]);

  const handlePointerMove = (clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDraggingRef.current && e.touches.length > 0) {
      handlePointerMove(e.touches[0].clientX);
    }
  };

  // Reusable SVG drawing with calibrated margins and crystal clear typography
  const renderSvgCanvas = (
    mode: 'block' | 'calibrated' | 'delta',
    svgWidth = 800,
    svgHeight = 600,
    interactive = true
  ) => {
    // Calculate real projected paths for decorative geographic reference lines
    const riverPt1 = projectToSvg(19.98, 73.55, svgWidth, svgHeight);
    const riverPt2 = projectToSvg(20.03, 73.80, svgWidth, svgHeight);
    const riverPt3 = projectToSvg(20.06, 74.05, svgWidth, svgHeight);
    const riverPt4 = projectToSvg(20.12, 74.25, svgWidth, svgHeight);

    const ghatsPt1 = projectToSvg(20.65, 73.65, svgWidth, svgHeight);
    const ghatsPt2 = projectToSvg(20.15, 73.55, svgWidth, svgHeight);
    const ghatsPt3 = projectToSvg(19.65, 73.52, svgWidth, svgHeight);

    // Give each village a readable callout position instead of stacking labels
    // directly on top of nearby villages. Values and village data stay unchanged.
    const labelLayout = new Map<string, { x: number; y: number; width: number; height: number }>();
    const occupiedLabels: Array<{ x: number; y: number; width: number; height: number }> = [];
    const labelOrder = [...filteredPanchayats].sort((a, b) => {
      if (a.id === selectedPanchayat.id) return -1;
      if (b.id === selectedPanchayat.id) return 1;
      const pointA = projectToSvg(a.lat, a.lng, svgWidth, svgHeight);
      const pointB = projectToSvg(b.lat, b.lng, svgWidth, svgHeight);
      return pointA.y - pointB.y || pointA.x - pointB.x;
    });
    const directions = Array.from({ length: 16 }, (_, index) => (index * Math.PI) / 8);

    labelOrder.forEach((p, index) => {
      const point = projectToSvg(p.lat, p.lng, svgWidth, svgHeight);
      const shortName = lang === 'mr' ? p.nameMr.split(' ')[0] : p.nameEn.split(' ')[0];
      const nameWidth = Array.from(shortName).length * (lang === 'mr' ? 11.5 : 8.5) + 20;
      const labelWidth = Math.max(74, nameWidth, 66);
      const labelHeight = 46;
      let best = { x: point.x, y: point.y, width: labelWidth, height: labelHeight, score: Number.POSITIVE_INFINITY };

      [34, 50, 68, 88, 112, 138].forEach((radius) => {
        directions.forEach((directionIndex) => {
          const angle = directions[(directionIndex + index * 5) % directions.length];
          const hasCurtain = mapMode === 'split' && compareSubView === 'slider';
          const leftSide = point.x < svgWidth / 2;
          const minX = hasCurtain
            ? leftSide ? labelWidth / 2 + 12 : svgWidth / 2 + labelWidth / 2 + 16
            : labelWidth / 2 + 12;
          const maxX = hasCurtain
            ? leftSide ? svgWidth / 2 - labelWidth / 2 - 16 : svgWidth - labelWidth / 2 - 12
            : svgWidth - labelWidth / 2 - 12;
          const x = Math.max(minX, Math.min(maxX, point.x + Math.cos(angle) * radius));
          const y = Math.max(102, Math.min(svgHeight - 100, point.y + Math.sin(angle) * radius));
          const overlaps = occupiedLabels.reduce((count, placed) => {
            const overlapsX = Math.abs(x - placed.x) < (labelWidth + placed.width) / 2 + 9;
            const overlapsY = Math.abs(y - placed.y) < (labelHeight + placed.height) / 2 + 8;
            return count + (overlapsX && overlapsY ? 1 : 0);
          }, 0);
          const distance = Math.hypot(x - point.x, y - point.y);
          const score = overlaps * 10000 + distance;
          if (score < best.score) best = { x, y, width: labelWidth, height: labelHeight, score };
        });
      });

      const placement = { x: best.x, y: best.y, width: best.width, height: best.height };
      labelLayout.set(p.id, placement);
      occupiedLabels.push(placement);
    });

    return (
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full select-none"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(46,58,70,0.04))' }}
      >
        <defs>
          <radialGradient id="selectedGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#C9A14A" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#C9A14A" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 1. Background Geographic Context (River & Ghats) */}
        <g opacity="0.28" className="pointer-events-none">
          {/* Godavari River Flow */}
          <path
            d={`M ${riverPt1.x} ${riverPt1.y} Q ${riverPt2.x} ${riverPt2.y} ${riverPt3.x} ${riverPt3.y} T ${riverPt4.x} ${riverPt4.y}`}
            fill="none"
            stroke="#4A90E2"
            strokeWidth="3.5"
            strokeDasharray="5 3"
          />
          <text
            x={riverPt3.x - 20}
            y={riverPt3.y - 12}
            fontSize="10"
            fill="#3B7CB8"
            fontWeight="bold"
            fontStyle="italic"
          >
            {lang === 'mr' ? '≈ गोदावरी नदी खोरे ≈' : '≈ Godavari Basin ≈'}
          </text>

          {/* Western Ghats Ridge Line */}
          <path
            d={`M ${ghatsPt1.x - 15} ${ghatsPt1.y} Q ${ghatsPt2.x - 20} ${ghatsPt2.y} ${ghatsPt3.x - 15} ${ghatsPt3.y}`}
            fill="none"
            stroke="#8B7355"
            strokeWidth="2.5"
            strokeDasharray="6 3"
          />
          <text
            x={ghatsPt2.x - 35}
            y={ghatsPt2.y}
            fontSize="9.5"
            fill="#735C40"
            fontWeight="bold"
            fontStyle="italic"
            transform={`rotate(78, ${ghatsPt2.x - 35}, ${ghatsPt2.y})`}
          >
            {lang === 'mr' ? '▲ सह्याद्री घाटमाथा (Western Ghats) ▲' : '▲ Western Ghats Ridge ▲'}
          </text>
        </g>

        {/* 2. IMD 0.25° Mesh Grid Background Cells */}
        <g opacity="0.16" className="pointer-events-none">
          {IMD_025_GRID_MESH.map((cell) => {
            const topLeft = projectToSvg(cell.bounds[1][0], cell.bounds[0][1], svgWidth, svgHeight);
            const bottomRight = projectToSvg(cell.bounds[0][0], cell.bounds[1][1], svgWidth, svgHeight);
            const boxW = Math.abs(bottomRight.x - topLeft.x);
            const boxH = Math.abs(bottomRight.y - topLeft.y);

            return (
              <rect
                key={cell.id}
                x={topLeft.x}
                y={topLeft.y}
                width={boxW}
                height={boxH}
                fill="#2F4638"
                fillOpacity="0.06"
                stroke="#2F4638"
                strokeWidth="1"
                strokeDasharray="4 4"
                rx="4"
              />
            );
          })}
        </g>

        {/* 3. Village Polygons, Glows, and Pins */}
        {filteredPanchayats.map((p) => {
          const res = panchayatResults.get(p.id);
          const block = getBlockForecast(p.blockId);
          const center = projectToSvg(p.lat, p.lng, svgWidth, svgHeight);
          const delta = (res?.calibratedRainfall ?? 0) - block.imdRainfallMm;

          let fillColor = '#F6F4EC';
          let displayLabel = '';

          if (mode === 'block') {
            fillColor = getRainfallColor(block.imdRainfallMm);
            displayLabel = `${block.imdRainfallMm} mm`;
          } else if (mode === 'calibrated') {
            fillColor = getRainfallColor(res ? res.calibratedRainfall : block.imdRainfallMm);
            displayLabel = `${res ? res.calibratedRainfall : block.imdRainfallMm} mm`;
          } else if (mode === 'delta') {
            fillColor = getDeltaColor(delta);
            displayLabel = `${delta > 0 ? '+' : ''}${delta.toFixed(1)} mm`;
          }

          const isSelected = p.id === selectedPanchayat.id;
          const isHovered = hoveredPanchayat?.id === p.id;
          const hasBioReports = (res?.activeReportsCount ?? 0) > 0;

          let pointsStr = '';
          if (p.polygon && p.polygon.length > 0) {
            pointsStr = p.polygon
              .map(([lat, lng]) => {
                const pt = projectToSvg(lat, lng, svgWidth, svgHeight);
                return `${pt.x},${pt.y}`;
              })
              .join(' ');
          } else {
            pointsStr = `${center.x - 28},${center.y - 22} ${center.x + 28},${center.y - 22} ${center.x + 28},${center.y + 22} ${center.x - 28},${center.y + 22}`;
          }

          const label = labelLayout.get(p.id) ?? { x: center.x, y: center.y + 35, width: 78, height: 38 };
          const labelLeft = label.x - label.width / 2;
          const labelTop = label.y - label.height / 2;
          const connectorX = Math.max(labelLeft, Math.min(label.x + label.width / 2, center.x));
          const connectorY = Math.max(labelTop, Math.min(label.y + label.height / 2, center.y));

          return (
            <g
              key={p.id}
              onClick={interactive ? () => onSelectPanchayat(p) : undefined}
              onMouseEnter={interactive ? () => setHoveredPanchayat(p) : undefined}
              onMouseLeave={interactive ? () => setHoveredPanchayat(null) : undefined}
              className={interactive ? 'cursor-pointer transition-all duration-200' : ''}
            >
              {/* Selected Halo Glow */}
              {isSelected && (
                <circle
                  cx={center.x}
                  cy={center.y}
                  r="24"
                  fill="url(#selectedGlow)"
                  className="animate-pulse pointer-events-none"
                />
              )}

              {/* Village Micro-Region Polygon */}
              <polygon
                points={pointsStr}
                fill={fillColor}
                stroke={isSelected ? '#C9A14A' : isHovered ? '#2F4638' : '#FFFFFF'}
                strokeWidth={isSelected ? 3.5 : isHovered ? 2.5 : 1.4}
                opacity={isSelected ? 1 : 0.94}
                className="transition-colors duration-200"
              />

              {/* Center Map Pin Node */}
              <circle
                cx={center.x}
                cy={center.y + 3}
                r={isSelected ? 5.5 : 3.5}
                fill={isSelected ? '#C9A14A' : '#2F4638'}
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />

              {/* Bio-Indicator Bug Badge */}
              {hasBioReports && mode !== 'block' && (
                <g transform={`translate(${center.x + 15}, ${center.y - 12})`}>
                  <circle r="7" fill="#5A7852" stroke="#FFFFFF" strokeWidth="1" />
                  <text textAnchor="middle" dy="3" fontSize="9" fill="#FFFFFF">
                    🐜
                  </text>
                </g>
              )}

              {/* Leader line and combined rain + village callout */}
              <line
                x1={center.x}
                y1={center.y}
                x2={connectorX}
                y2={connectorY}
                stroke={isSelected ? '#5A7852' : '#789083'}
                strokeWidth={isSelected ? 1.8 : 1.2}
                opacity="0.8"
                className="pointer-events-none"
              />
              <g transform={`translate(${labelLeft}, ${labelTop})`} className="pointer-events-none">
                <rect
                  width={label.width}
                  height={label.height}
                  rx="7"
                  fill={isSelected ? '#FFF7D8' : '#FFFFFF'}
                  stroke={isSelected ? '#B88A36' : '#8DA69A'}
                  strokeWidth={isSelected ? 2 : 1.2}
                />
                <text
                  x={label.width / 2}
                  y="18"
                  textAnchor="middle"
                  fontSize="14"
                  fontFamily="sans-serif"
                  fontWeight="800"
                  fill="#2F4638"
                >
                  {displayLabel}
                </text>
                <text
                  x={label.width / 2}
                  y="37"
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight={isSelected ? '800' : '700'}
                  fill="#2F4638"
                >
                  {lang === 'mr' ? p.nameMr.split(' ')[0] : p.nameEn.split(' ')[0]}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    );
  };

  // Render a standard standalone SVG Card
  const renderSvgMap = (
    mode: 'block' | 'calibrated' | 'delta',
    title: string,
    subtitle: string,
    badgeColor: string,
    svgWidth = 800,
    svgHeight = 600
  ) => {
    return (
      <div className="bg-[#E6E8DC] rounded-2xl border border-gray-300/40 overflow-hidden flex flex-col relative shadow-inner">
        <div className="bg-[#F6F4EC] px-3.5 py-2.5 border-b border-gray-300/40 flex items-center justify-between gap-2 z-10">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-xs text-[#2F4638]">
              <span className={`w-2.5 h-2.5 rounded-full ${badgeColor}`} />
              <span>{title}</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
              {subtitle}
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold bg-[#E6E8DC] px-2 py-0.5 rounded border border-gray-300/40 text-gray-700">
            {filteredPanchayats.length} GP
          </span>
        </div>

        <div className="relative w-full h-[320px] sm:h-[400px] lg:h-[480px] flex items-center justify-center p-2 select-none">
          {renderSvgCanvas(mode, svgWidth, svgHeight, true)}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-4 font-marathi">
      
      {/* 1. TOP HEADER & MAP LAYER MODE SWITCHER TABS */}
      <div className="bg-[#E6E8DC] rounded-2xl p-4 border border-gray-300/40 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2F4638]" />
            <h2 className="text-base font-bold text-[#2F4638]">
              {lang === 'mr' ? 'नाशिक जिल्हा पावसाचा नकाशा' : 'Nashik village rain map'}
            </h2>
            <span className="text-xs bg-[#F6F4EC] text-[#2F4638] px-2 py-0.5 rounded font-mono border border-gray-300/40">
              {lang === 'mr' ? `${PANCHAYATS_DATA.length} ग्रामपंचायती` : `${PANCHAYATS_DATA.length} villages`}
            </span>
          </div>
          <p className="text-xs text-gray-600">
            {t.clickPanchayatPrompt}
          </p>
        </div>

        {/* Secondary map views remain available without crowding the main map. */}
        <details className="w-full md:w-auto rounded-xl border border-gray-300/40 bg-[#F6F4EC] p-1 text-xs shadow-2xs">
          <summary className="flex min-h-10 list-none cursor-pointer items-center justify-between gap-3 rounded-lg px-3 font-bold text-[#2F4638] [&::-webkit-details-marker]:hidden">
            <span>{lang === 'mr' ? 'नकाशा दृश्य बदला' : 'Change map view'}</span>
            <span className="text-[#5A7852]">{mapMode === 'calibrated' ? (lang === 'mr' ? 'गावाचा पाऊस' : 'Village rain') : mapMode === 'split' ? (lang === 'mr' ? 'तुलना' : 'Compare') : mapMode === 'block' ? (lang === 'mr' ? 'तालुका अंदाज' : 'Block forecast') : (lang === 'mr' ? 'स्थानिक अंदाज' : 'Local estimate')}</span>
          </summary>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-gray-200 p-1">
          
          <button
            type="button"
            onClick={() => setMapMode('split')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
              mapMode === 'split'
                ? 'bg-[#C9A14A] text-[#2F4638] shadow-xs ring-1 ring-[#C9A14A]/50'
                : 'text-[#2F4638] hover:bg-white/60'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>{lang === 'mr' ? 'दोन अंदाजांची तुलना' : 'Compare forecasts'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMapMode('calibrated')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
              mapMode === 'calibrated'
                ? 'bg-[#5A7852] text-white shadow-xs'
                : 'text-[#2F4638] hover:bg-white/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{lang === 'mr' ? 'गावाचा पाऊस' : 'Village rain'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMapMode('panchayat_rf')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              mapMode === 'panchayat_rf'
                ? 'bg-[#2F4638] text-white shadow-sm'
                : 'text-[#2F4638] hover:bg-white/60'
            }`}
          >
            {lang === 'mr' ? 'स्थानिक अंदाज' : 'Local forecast'}
          </button>

          <button
            type="button"
            onClick={() => setMapMode('block')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              mapMode === 'block'
                ? 'bg-[#2F4638] text-white shadow-sm'
                : 'text-[#2F4638] hover:bg-white/60'
            }`}
          >
            {lang === 'mr' ? 'तालुका अंदाज' : 'District forecast'}
          </button>
        </div>
        </details>
      </div>

      {/* Shared block-input view */}
      {mapMode === 'block' && (
        <div className="bg-amber-50 border-2 border-[#C9A14A] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/80 pb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[#2F4638] text-white flex items-center justify-center font-bold text-lg">
                🏛️
              </span>
              <div>
                <h3 className="font-black text-sm sm:text-base text-[#2F4638]">
                  {lang === 'mr'
                    ? 'समान ब्लॉक इनपुट नकाशा (प्रात्यक्षिक)'
                    : 'Shared Block Input Map (Illustrative)'}
                </h3>
                <span className="text-xs text-amber-900 font-medium">
                  {lang === 'mr'
                    ? 'या डेमोमध्ये ब्लॉकमधील सर्व गावांसाठी समान आधार मूल्य'
                    : 'The demo uses one shared baseline for villages in this block'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMapMode('split')}
                className="bg-[#C9A14A] hover:bg-[#B88A36] text-[#2F4638] font-black text-xs px-3.5 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>{lang === 'mr' ? 'फरक तपासा (Compare)' : 'Compare Split'}</span>
              </button>
              <button
                type="button"
                onClick={() => setMapMode('calibrated')}
                className="bg-[#5A7852] hover:bg-[#466849] text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>🌿 {lang === 'mr' ? 'स्मार्ट सूक्ष्म नकाशा' : 'Smart Map'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-[#2F4638]">
            <div className="bg-[#F6F4EC] p-3 rounded-xl border border-amber-200/70">
              <span className="font-bold text-[#2F4638] block mb-0.5">📦 १. एकच सपाट आकडा</span>
              <p className="text-gray-600 text-[11px]">
                {lang === 'mr'
                  ? `उदा. निफाड तालुक्यातील सर्व ३०+ गावांना एकच ${selectedBlock.imdRainfallMm} मिमी दाखवला जातो.`
                  : `All villages in ${selectedBlock.nameEn} block receive the identical ${selectedBlock.imdRainfallMm} mm.`}
              </p>
            </div>
            <div className="bg-[#F6F4EC] p-3 rounded-xl border border-amber-200/70">
              <span className="font-bold text-[#2F4638] block mb-0.5">⛰️ २. डोंगर व स्थानिक नद्या अंध</span>
              <p className="text-gray-600 text-[11px]">
                {lang === 'mr'
                  ? 'घाटमाथा (इगतपुरी) व सपाट शेतजमीन (सिन्नर) मधील नैसर्गिक पावसाचा फरक यात दिसत नाही.'
                  : 'Hills with orographic lift and rain-shadow plains look completely identical.'}
              </p>
            </div>
            <div className="bg-[#F6F4EC] p-3 rounded-xl border border-amber-200/70">
              <span className="font-bold text-[#5A7852] block mb-0.5">🚀 ३. वर्षा ज्ञानचे निराकरण</span>
              <p className="text-gray-600 text-[11px]">
                {lang === 'mr'
                  ? '३० मी SRTM DEM व पारंपारिक निरीक्षणांद्वारे प्रत्येक गावाचा खरा पाऊस मोजला जातो.'
                  : '30m SRTM DEM & bio-indicators calculate true hyperlocal reality per panchayat.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* One clear summary before the map and its optional controls. */}
      <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5" aria-label={lang === 'mr' ? 'ब्लॉक ते ग्रामपंचायत अंदाज' : 'Block to Panchayat forecast'}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#5A7852]">{lang === 'mr' ? 'ब्लॉक ते ग्रामपंचायत' : 'Block to Panchayat'}</p>
            <h3 className="mt-0.5 text-base font-black text-[#2F4638] sm:text-lg">{lang === 'mr' ? 'तुमच्या गावाचा स्थानिक अंदाज' : 'Local estimate for your Panchayat'}</h3>
          </div>
          <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-900">{lang === 'mr' ? 'डेमो · पडताळणी बाकी' : 'Demo · validation pending'}</span>
        </div>
        <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
          <div className="min-w-0 rounded-xl bg-[#2F4638] px-3.5 py-3 text-white">
            <p className="text-[11px] font-bold text-white/75">{lang === 'mr' ? 'समान तालुका अंदाज' : 'Shared block forecast'} · {lang === 'mr' ? selectedBlock.nameMr : selectedBlock.nameEn}</p>
            <p className="mt-0.5 text-3xl font-black tabular-nums">{selectedBlock.imdRainfallMm.toFixed(1)} <span className="text-base">mm</span></p>
            {selectedBlock.isDemoForecast && <p className="mt-0.5 text-[10px] text-white/70">{lang === 'mr' ? 'नमुना मूल्य · प्रत्यक्ष अंदाज नाही' : 'Illustrative sample · not a live forecast'}</p>}
          </div>
          <div className="flex items-center justify-center gap-1.5 text-xs font-black text-[#5A7852] sm:flex-col sm:px-3">
            <ArrowLeftRight className="h-4 w-4 rotate-90 sm:rotate-0" aria-hidden="true" />
            <span>{lang === 'mr' ? 'स्थानिक घटकांनुसार बदल' : 'Downscaling'}</span>
          </div>
          <div className="min-w-0 rounded-xl border border-[#5A7852]/30 bg-[#E6E8DC] px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <p className="min-w-0 text-sm font-black text-[#2F4638]">{lang === 'mr' ? selectedPanchayat.nameMr : selectedPanchayat.nameEn}</p>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#5A7852]">{selectedBlock.imdRainfallMm > 0 ? `${selectedDelta > 0 ? '+' : ''}${Math.round((selectedDelta / selectedBlock.imdRainfallMm) * 100)}%` : '—'}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="text-[11px] font-semibold text-[#2F4638]/70">{lang === 'mr' ? 'अंतिम अंदाज' : 'Final estimate'}</span>
              <span className="text-3xl font-black tabular-nums text-[#5A7852]">{selectedResult?.calibratedRainfall} <span className="text-base">mm</span></span>
            </div>
            <p className="text-[10px] text-[#2F4638]/60">{lang === 'mr' ? 'उदाहरणासाठीचे मूल्य · पडताळलेला अंदाज नाही' : 'Illustrative value · not a validated forecast'}</p>
          </div>
        </div>
      </section>

      {/* 3. ENHANCED COMPARISON STUDIO BANNER */}
      {mapMode === 'split' && (
        <div className="bg-[#E6E8DC] rounded-2xl p-4 sm:p-5 border border-gray-300/40 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-300/30 pb-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-1 rounded bg-[#C9A14A] text-[#2F4638] font-bold text-xs">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </span>
                <h3 className="font-black text-sm sm:text-base text-[#2F4638]">
                  {t.compareStudioTitle}
                </h3>
                <span className="text-[10px] font-bold bg-[#5A7852]/20 text-[#5A7852] px-2 py-0.5 rounded-full">
                  {lang === 'mr' ? 'सूक्ष्म हवामान विश्लेषण' : 'Microclimate Analysis'}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                {t.compareStudioSubtitle}
              </p>
            </div>

            {/* 4 Sub-view switchers */}
            <div className="flex flex-wrap items-center gap-1 bg-[#F6F4EC] p-1 rounded-xl border border-gray-300/40 text-xs shrink-0 shadow-2xs">
              <button
                type="button"
                onClick={() => setCompareSubView('slider')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  compareSubView === 'slider'
                    ? 'bg-[#C9A14A] text-[#2F4638] shadow-xs ring-1 ring-[#C9A14A]/40'
                    : 'text-gray-700 hover:bg-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{t.viewSliderCompare}</span>
              </button>

              <button
                type="button"
                onClick={() => setCompareSubView('side_by_side')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  compareSubView === 'side_by_side'
                    ? 'bg-[#2F4638] text-white shadow-xs'
                    : 'text-gray-700 hover:bg-white'
                }`}
              >
                <span>🔲</span>
                <span>{t.viewSideBySide}</span>
              </button>

              <button
                type="button"
                onClick={() => setCompareSubView('delta_heatmap')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  compareSubView === 'delta_heatmap'
                    ? 'bg-[#5A7852] text-white shadow-xs'
                    : 'text-gray-700 hover:bg-white'
                }`}
              >
                <span>🎨</span>
                <span>{t.viewDeltaHeatmap}</span>
              </button>

              <button
                type="button"
                onClick={() => setCompareSubView('table')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  compareSubView === 'table'
                    ? 'bg-[#2F4638] text-white shadow-xs'
                    : 'text-gray-700 hover:bg-white'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>{t.viewDiffTable}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MAIN COMPARISON DISPLAY VIEWS */}

      {/* VIEW A: INTERACTIVE BEFORE/AFTER SPLIT CURTAIN SLIDER */}
      {mapMode === 'split' && compareSubView === 'slider' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          <div className="lg:col-span-8 space-y-3">
            
            {/* Slider Control Toolbar */}
            <div className="bg-[#E6E8DC] rounded-2xl p-3 sm:p-4 border border-gray-300/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#C9A14A] animate-pulse" />
                  <span className="font-black text-xs sm:text-sm text-[#2F4638]">
                    {t.viewSliderCompare}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">
                  {t.sliderInstruction}
                </p>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => { setIsAutoPlaying(false); setSliderPos(0); }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    sliderPos === 0 ? 'bg-[#2F4638] text-white' : 'bg-[#F6F4EC] text-gray-700 hover:bg-white border border-gray-300/40'
                  }`}
                  title={lang === 'mr' ? 'समान ब्लॉक इनपुट दृश्य' : 'Shared block input view'}
                >
                  {t.presetImd}
                </button>

                <button
                  type="button"
                  onClick={() => { setIsAutoPlaying(false); setSliderPos(50); }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    sliderPos === 50 ? 'bg-[#C9A14A] text-[#2F4638]' : 'bg-[#F6F4EC] text-gray-700 hover:bg-white border border-gray-300/40'
                  }`}
                  title="50/50 Split View"
                >
                  {t.presetSplit}
                </button>

                <button
                  type="button"
                  onClick={() => { setIsAutoPlaying(false); setSliderPos(100); }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    sliderPos === 100 ? 'bg-[#5A7852] text-white' : 'bg-[#F6F4EC] text-gray-700 hover:bg-white border border-gray-300/40'
                  }`}
                  title="100% VarshaGyan View"
                >
                  {t.presetVarshaGyan}
                </button>

                <button
                  type="button"
                  onClick={() => setIsAutoPlaying((prev) => !prev)}
                  className={`px-3 py-1 rounded-lg font-black transition cursor-pointer flex items-center gap-1 shadow-xs ${
                    isAutoPlaying
                      ? 'bg-amber-500 text-white animate-pulse'
                      : 'bg-[#F6F4EC] text-[#2F4638] border border-gray-300/40 hover:bg-white'
                  }`}
                >
                  {isAutoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{t.autoSwipeDemo}</span>
                </button>
              </div>
            </div>

            {/* Range Slider Controls */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#E6E8DC] p-3 rounded-2xl border border-gray-300/40">
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 text-xs">
                <span className="text-gray-600 font-medium">{lang === 'mr' ? 'तालुका:' : 'Block:'}</span>
                <select
                  value={filterBlockId}
                  onChange={(e) => setFilterBlockId(e.target.value)}
                  className="font-bold text-[#2F4638] bg-[#F6F4EC] border border-gray-300/50 rounded-lg px-2.5 py-1 text-xs cursor-pointer"
                >
                  <option value="all">{lang === 'mr' ? 'सर्व तालुके (All Blocks)' : 'All Blocks'}</option>
                  {NASHIK_BLOCKS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {lang === 'mr' ? b.nameMr : b.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 w-full flex items-center gap-3">
                <span className="text-[11px] font-bold text-[#2F4638] shrink-0">{lang === 'mr' ? 'तालुका अंदाज' : 'District forecast'}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderPos}
                  onChange={(e) => {
                    setIsAutoPlaying(false);
                    setSliderPos(Number(e.target.value));
                  }}
                  className="w-full accent-[#C9A14A] h-2 bg-gray-300 rounded-lg cursor-pointer"
                />
                <span className="text-[11px] font-bold text-[#5A7852] shrink-0">{lang === 'mr' ? 'गावाचा अंदाज' : 'Village forecast'}</span>
                <span className="font-mono text-xs font-black bg-[#F6F4EC] px-2 py-0.5 rounded text-[#2F4638] shrink-0 border border-gray-300/40">
                  {Math.round(sliderPos)}%
                </span>
              </div>
            </div>

            {/* DUAL-LAYER MAP CANVAS WITH VERTICAL CURTAIN DIVIDER */}
            <div
              ref={sliderContainerRef}
              onMouseDown={() => { isDraggingRef.current = true; setIsAutoPlaying(false); }}
              onMouseUp={() => { isDraggingRef.current = false; }}
              onMouseMove={(e) => {
                if (isDraggingRef.current) handlePointerMove(e.clientX);
              }}
              onTouchStart={() => { isDraggingRef.current = true; setIsAutoPlaying(false); }}
              onTouchEnd={() => { isDraggingRef.current = false; }}
              onTouchMove={handleTouchMove}
              className="bg-[#E6E8DC] rounded-2xl border border-gray-300/40 overflow-hidden relative w-full h-[320px] sm:h-[440px] lg:h-[520px] shadow-inner select-none cursor-ew-resize"
            >
              {/* LAYER 1: BASE (IMD FLAT) */}
              <div className="absolute inset-0 w-full h-full p-2">
                {renderSvgCanvas('block', 800, 600, true)}
              </div>

              {/* LAYER 2: TOP (VARSHAGYAN HYPERLOCAL) */}
              <div
                className="absolute inset-0 w-full h-full p-2 pointer-events-none"
                style={{
                  clipPath: `inset(0 0 0 ${sliderPos}%)`,
                  WebkitClipPath: `inset(0 0 0 ${sliderPos}%)`,
                }}
              >
                {renderSvgCanvas('calibrated', 800, 600, false)}
              </div>

              {/* Floating Status Badges with High Contrast */}
              <div className="absolute top-3 left-3 bg-[#2F4638]/95 backdrop-blur-xs text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md border border-white/20 pointer-events-none flex items-center gap-1.5 z-10">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>{t.imdSideLabel}</span>
              </div>

              <div className="absolute top-3 right-3 bg-[#5A7852]/95 backdrop-blur-xs text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md border border-white/20 pointer-events-none flex items-center gap-1.5 z-10">
                <span className="w-2 h-2 rounded-full bg-amber-300" />
                <span>{t.varshaGyanSideLabel}</span>
              </div>

              {/* Vertical Drag Handle */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_12px_rgba(0,0,0,0.5)] z-20 pointer-events-none flex items-center justify-center"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-r from-[#C9A14A] to-[#5A7852] text-[#2F4638] border-2 border-white shadow-xl flex items-center justify-center text-xs font-bold cursor-ew-resize active:scale-110 transition-transform pointer-events-auto">
                  <ArrowLeftRight className="w-4 h-4 text-white" />
                </div>
              </div>

              {/* Bottom Instruction Pill */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#2F4638]/90 backdrop-blur-xs text-white px-4 py-1.5 rounded-full text-[11px] font-medium shadow-lg pointer-events-none flex items-center gap-2 z-10">
              <span>◀ {lang === 'mr' ? 'ब्लॉक इनपुट' : 'Block input'}</span>
                <span className="text-[#C9A14A] font-bold">| {lang === 'mr' ? 'स्लायडर ओढा' : 'Drag Split'} |</span>
                <span>{lang === 'mr' ? 'वर्षा ज्ञान सूक्ष्म' : 'VarshaGyan Local'} ▶</span>
              </div>
            </div>

            <div className="text-[11px] text-gray-600 flex flex-wrap items-center justify-between gap-2 px-1">
              <span>💡 {lang === 'mr' ? 'नकाशावरील प्रत्येक आकडा त्या गावात अपेक्षित पाऊस (मिमी) दाखवतो. आधीचा आणि गावाचा अंदाज पाहण्यासाठी स्लायडर ओढा.' : 'Each number shows expected rain in that village. Drag the slider to compare the district and village forecasts.'}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 border border-gray-200 shrink-0">
                <span>{lang === 'mr' ? 'कमी पाऊस' : 'Less rain'}</span>
                <span className="w-14 h-2 rounded-full bg-gradient-to-r from-[#F0F7E9] via-[#78B56B] to-[#2F4638]" />
                <span>{lang === 'mr' ? 'जास्त पाऊस' : 'More rain'}</span>
              </span>
            </div>
          </div>

          {/* Selected Village Inspector Sidebar */}
          <div className="lg:col-span-4 bg-[#E6E8DC] rounded-2xl p-4 sm:p-5 border border-gray-300/40 shadow-sm space-y-4">
            <div className="border-b border-gray-300/30 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-wider text-[#5A7852] font-bold">
                  {t.mapActivePanchayat}
                </div>
              </div>
              <h3 className="text-xl font-black text-[#2F4638] mt-0.5">
                {lang === 'mr' ? selectedPanchayat.nameMr : selectedPanchayat.nameEn}
              </h3>
              <p className="text-xs text-gray-600">
                {lang === 'mr' ? selectedPanchayat.blockNameMr : selectedPanchayat.blockNameEn} {lang === 'mr' ? 'तालुका' : 'Taluka'}
              </p>
            </div>

            {/* Keep the selected village result glanceable; the shared forecast
                and calculation breakdown are already shown in the flow above. */}
            <div className="rounded-xl border border-[#5A7852]/25 bg-[#F6F4EC] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#2F4638]/75">{lang === 'mr' ? 'गावाचा अंदाज' : 'Village estimate'}</span>
                <span className="text-2xl font-black tabular-nums text-[#5A7852]">{selectedResult?.calibratedRainfall} <span className="text-sm">mm</span></span>
              </div>
              <p className="mt-1 text-[11px] text-[#2F4638]/65">{lang === 'mr' ? 'उदाहरणासाठीचे मूल्य · पडताळलेला अंदाज नाही' : 'Illustrative value · not a validated forecast'}</p>
            </div>

            {/* Geographical Features */}
            <details className="bg-[#F6F4EC] p-3 rounded-xl border border-gray-300/40 text-xs">
              <summary className="font-bold text-[#2F4638] cursor-pointer">
                {lang === 'mr' ? 'अधिक माहिती: जमिनीची वैशिष्ट्ये' : 'More details about this area'}
              </summary>
              <div className="space-y-2 mt-3">
              <div className="font-bold text-[#2F4638] flex items-center justify-between">
                <span>{lang === 'mr' ? 'स्थानिक भौगोलिक वैशिष्ट्ये:' : 'Terrain details:'}</span>
                <span className="text-[10px] bg-[#2F4638]/10 text-[#2F4638] px-2 py-0.5 rounded font-mono">
                  SRTM 30m
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-gray-500">{t.elevation}:</span>
                  <div className="font-bold font-mono text-[#2F4638]">{selectedPanchayat.elevationM} m</div>
                </div>
                <div>
                  <span className="text-gray-500">{lang === 'mr' ? 'उतार व दिशा:' : 'Slope & Aspect:'}</span>
                  <div className="font-bold font-mono text-[#2F4638]">{selectedPanchayat.slopeDeg}° ({selectedPanchayat.aspect})</div>
                </div>
                <div>
                  <span className="text-gray-500">{lang === 'mr' ? 'नदी अंतर:' : 'River Dist:'}</span>
                  <div className="font-bold font-mono text-[#2F4638]">{selectedPanchayat.distanceToRiverKm} km</div>
                </div>
                <div>
                  <span className="text-gray-500">NDVI Green:</span>
                  <div className="font-bold font-mono text-[#5A7852]">{selectedPanchayat.ndvi}</div>
                </div>
              </div>
              </div>
            </details>

            {/* Traditional Bio Reports */}
            <div className="pt-2 border-t border-gray-300/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#5A7852] flex items-center gap-1">
                  <Bug className="w-3.5 h-3.5" />
                  <span>{lang === 'mr' ? 'स्थानिक पारंपारिक संकेत:' : 'Active Bio-Indicators:'}</span>
                </span>
                <span className="text-[10px] bg-[#5A7852] text-white px-1.5 py-0.2 rounded-full font-bold">
                  {selectedResult?.activeReportsCount}
                </span>
              </div>

              <details className="rounded-xl bg-[#F6F4EC] px-3 py-2">
                <summary className="cursor-pointer text-[11px] font-bold text-[#2F4638]">
                  {lang === 'mr' ? 'नोंदवलेली निरीक्षणे पहा' : 'View reported observations'}
                </summary>
              {selectedResult && selectedResult.activeReportsCount > 0 ? (
                <div className="space-y-1.5">
                  {farmerReports
                    .filter((r) => r.panchayatId === selectedPanchayat.id)
                    .map((rep) => (
                      <div key={rep.id} className="p-2 bg-[#F6F4EC] rounded-lg border border-gray-300/40 text-[11px]">
                        <div className="flex justify-between font-bold text-[#2F4638]">
                          <span>{lang === 'mr' ? rep.farmerNameMr : rep.farmerNameEn}</span>
                          <span className="text-gray-400 font-normal">{lang === 'mr' ? rep.timeAgoMr : rep.timeAgoEn}</span>
                        </div>
                        <p className="text-gray-600 text-[10px] mt-0.5">
                          {lang === 'mr' ? rep.notesMr : rep.notesEn}
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 italic">
                  {lang === 'mr' ? 'या ग्रामपंचायतीसाठी अद्याप शेतकऱ्यांचे संकेत नोंदवलेले नाहीत.' : 'No crowdsourced bio-indicators reported yet for this panchayat.'}
                </p>
              )}
              </details>

              <button
                type="button"
                onClick={onOpenIntake}
                className="mt-3 w-full bg-[#5A7852] hover:bg-[#466849] text-white text-xs font-bold py-2 rounded-xl transition shadow-sm cursor-pointer"
              >
                {lang === 'mr' ? '+ या ग्रामपंचायतीसाठी संकेत नोंदवा' : '+ Report Observation Here'}
              </button>
            </div>

          </div>

        </div>
      ) : mapMode === 'split' && compareSubView === 'side_by_side' ? (
        /* VIEW B: SIDE-BY-SIDE DUAL MAP */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderSvgMap(
              'block',
              t.imdCoarseTitle,
              lang === 'mr'
                ? 'संपूर्ण तालुक्यात सर्व गावांना एकच नंबर (डोंगर व स्थानिक फरक दुर्लक्षित)'
                : 'Whole block assigned single identical average (ignores terrain differences)',
              'bg-[#2F4638]'
            )}

            {renderSvgMap(
              'calibrated',
              t.varshaGyanLocalTitle,
              lang === 'mr'
                ? 'प्रत्येक गावाचा खरा पाऊस (उंची, उतार व पारंपारिक निरीक्षणांवरून)'
                : 'True village rainfall (calibrated by DEM elevation, slope & folk indicators)',
              'bg-[#5A7852]'
            )}
          </div>

          <div className="bg-[#E6E8DC] border border-amber-300 rounded-xl p-2.5 text-center text-xs font-semibold text-[#806000]">
            👆 {lang === 'mr' ? 'दोन्हीपैकी कोणत्याही नकाशावर स्पर्श करा — दोन्ही नकाशे एकत्र ते गाव हायलाइट करतील!' : 'Tap any village on either map — both maps will simultaneously highlight and compare it!'}
          </div>
        </div>
      ) : mapMode === 'split' && compareSubView === 'table' ? (
        /* VIEW C: ALL VILLAGES COMPARISON DATA TABLE */
        <div className="bg-[#E6E8DC] rounded-2xl border border-gray-300/40 shadow-sm overflow-hidden p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-black text-sm sm:text-base text-[#2F4638]">
                {lang === 'mr' ? 'सर्व ग्रामपंचायतींची थेट तफावत तुलना' : 'All Gram Panchayats Direct Forecast Comparison'}
              </h3>
              <p className="text-xs text-gray-500">
                {lang === 'mr'
                  ? 'कोणत्याही गावावर क्लिक करा व शेतीवरील प्रत्यक्ष परिणाम तपासा.'
                  : 'Click on any village to inspect the agricultural impact and ground reality.'}
              </p>
            </div>
            
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-gray-600 font-medium">{lang === 'mr' ? 'तालुका निवडा:' : 'Filter Taluka:'}</span>
              <select
                value={filterBlockId}
                onChange={(e) => setFilterBlockId(e.target.value)}
                className="font-bold text-[#2F4638] bg-[#F6F4EC] border border-gray-300/50 rounded-lg px-2.5 py-1"
              >
                <option value="all">{lang === 'mr' ? 'सर्व तालुके (All Blocks)' : 'All Blocks'}</option>
                {NASHIK_BLOCKS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {lang === 'mr' ? b.nameMr : b.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F6F4EC] border-b border-gray-300/40 text-[#2F4638] font-bold">
                  <th className="p-2.5">{lang === 'mr' ? 'ग्रामपंचायत' : 'Gram Panchayat'}</th>
                  <th className="p-2.5">{lang === 'mr' ? 'तालुका' : 'Block'}</th>
                  <th className="p-2.5">{lang === 'mr' ? 'उंची' : 'Elevation'}</th>
                  <th className="p-2.5 text-right">{lang === 'mr' ? 'ब्लॉक आधार' : 'Block baseline'}</th>
                  <th className="p-2.5 text-right">{lang === 'mr' ? 'वर्षा ज्ञान' : 'VarshaGyan'}</th>
                  <th className="p-2.5 text-center">{lang === 'mr' ? 'तफावत (Delta)' : 'Difference'}</th>
                  <th className="p-2.5">{lang === 'mr' ? 'भौगोलिक कारण' : 'Terrain Driver'}</th>
                  <th className="p-2.5 text-center">{lang === 'mr' ? 'कृती' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/50">
                {filteredPanchayats.map((p) => {
                  const res = panchayatResults.get(p.id);
                  const block = getBlockForecast(p.blockId);
                  const delta = (res?.calibratedRainfall ?? 0) - block.imdRainfallMm;
                  const isSelected = p.id === selectedPanchayat.id;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => onSelectPanchayat(p)}
                      className={`cursor-pointer transition hover:bg-[#F6F4EC] ${
                        isSelected ? 'bg-amber-100/60 font-bold' : ''
                      }`}
                    >
                      <td className="p-2.5 font-bold text-[#2F4638] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#2F4638]" />
                        <span>{lang === 'mr' ? p.nameMr : p.nameEn}</span>
                      </td>
                      <td className="p-2.5 text-gray-600">
                        {lang === 'mr' ? p.blockNameMr : p.blockNameEn}
                      </td>
                      <td className="p-2.5 font-mono text-gray-600">
                        {p.elevationM} m
                      </td>
                      <td className="p-2.5 text-right font-mono text-[#2F4638]">
                        {block.imdRainfallMm} mm
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-[#5A7852]">
                        {res?.calibratedRainfall} mm
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                            delta > 0.5
                              ? 'bg-emerald-100 text-emerald-800'
                              : delta < -0.5
                              ? 'bg-rose-100 text-[#B6413A]'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {delta > 0 ? '+' : ''}{delta.toFixed(1)} mm
                        </span>
                      </td>
                      <td className="p-2.5 text-gray-600 text-[11px]">
                        {p.elevationM > 600
                          ? (lang === 'mr' ? '⛰️ सह्याद्री डोंगर उताराचा लिफ्ट प्रभाव' : '⛰️ Orographic Ghats Lift')
                          : p.distanceToRiverKm < 2
                          ? (lang === 'mr' ? '🌊 गोदावरी नदी ओलावा प्रभाव' : '🌊 River Basin Moisture')
                          : (lang === 'mr' ? '🌾 पर्जन्यछाया सपाट भूभाग' : '🌾 Rain-Shadow Plain')}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                            isSelected
                              ? 'bg-[#C9A14A] text-[#2F4638]'
                              : 'bg-[#F6F4EC] text-gray-700 hover:bg-white border border-gray-300/40'
                          }`}
                        >
                          {isSelected ? (lang === 'mr' ? 'निवडले आहे' : 'Selected') : (lang === 'mr' ? 'तपासा' : 'Inspect')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VIEW D: LEAFLET.JS ATMOSPHERIC TOPOGRAPHICAL TERRAIN MAP */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          <div className="lg:col-span-8 bg-[#E6E8DC] rounded-2xl border border-gray-300/40 p-3 shadow-inner relative overflow-hidden flex flex-col space-y-2">
            <details className="rounded-xl">
              <summary className="cursor-pointer list-none rounded-xl border border-gray-300/40 bg-[#F6F4EC] px-3 py-2 text-xs font-bold text-[#2F4638] [&::-webkit-details-marker]:hidden">
                {lang === 'mr' ? 'नकाशा फिल्टर, झूम आणि रंग पर्याय' : 'Map filters, zoom and display options'}
              </summary>
            <div className="flex flex-wrap items-center justify-between gap-2 z-10 bg-[#F6F4EC]/95 backdrop-blur-xs p-2 rounded-xl border border-gray-300/40">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[#2F4638]/70">{lang === 'mr' ? 'तालुका:' : 'Block:'}</span>
                <select
                  value={filterBlockId}
                  onChange={(e) => setFilterBlockId(e.target.value)}
                  className="font-bold text-[#2F4638] bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="all">{lang === 'mr' ? 'सर्व तालुके (All Blocks)' : 'All Blocks'}</option>
                  {NASHIK_BLOCKS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {lang === 'mr' ? b.nameMr : b.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Village Dynamic FitBounds Controls */}
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={handleCenterOnSelectedVillage}
                  className="px-2.5 py-1 rounded-lg font-bold bg-[#C9A14A] text-[#2F4638] shadow-xs hover:bg-[#B88A36] transition active:scale-95 flex items-center gap-1 text-[11px] cursor-pointer"
                  title="Fit bounds to active selected village boundary"
                >
                  <MapPin className="w-3 h-3" />
                  <span>{lang === 'mr' ? 'गावाची सीमा झूम' : 'Zoom Village'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleFitFullDistrict}
                  className="px-2 py-1 rounded-lg font-bold bg-white/80 hover:bg-white text-gray-700 border border-gray-300/50 shadow-2xs transition active:scale-95 text-[11px] cursor-pointer"
                  title="Fit bounds to whole district"
                >
                  <span>{lang === 'mr' ? 'जिल्हा' : 'District'}</span>
                </button>
              </div>

              {/* IMD Mesh Grid Toggle */}
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowImdMeshGrid((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 text-[11px] ${
                    showImdMeshGrid
                      ? 'bg-[#2F4638] text-white shadow-xs'
                      : 'bg-[#F6F4EC] text-gray-600 hover:bg-white border border-gray-300/40'
                  }`}
                >
                  <Grid className="w-3 h-3" />
                  <span>{lang === 'mr' ? 'नमुना जाळे' : 'Demo grid'} {showImdMeshGrid ? '✓' : ''}</span>
                </button>

                <div className="flex items-center bg-[#F6F4EC] rounded-lg p-0.5 text-[11px] font-bold border border-gray-300/40">
                  <button
                    type="button"
                    onClick={() => setActiveTileTheme('topo')}
                    className={`px-2 py-0.5 rounded transition ${
                      activeTileTheme === 'topo' ? 'bg-[#2F4638] text-white shadow-2xs' : 'text-gray-600'
                    }`}
                  >
                    {lang === 'mr' ? 'सामान्य' : 'Standard'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTileTheme('positron')}
                    className={`px-2 py-0.5 rounded transition ${
                      activeTileTheme === 'positron' ? 'bg-[#2F4638] text-white shadow-2xs' : 'text-gray-600'
                    }`}
                  >
                    {lang === 'mr' ? 'फिकट' : 'Muted'}
                  </button>
                </div>
              </div>

              {/* Rainfall Legend */}
              <div className="flex items-center gap-2 text-[11px]">
                <span className="font-semibold text-[#2F4638]">{t.mapLegendRainfall}:</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500">0mm</span>
                  <div className="w-14 h-2 rounded-full bg-gradient-to-r from-[#F0F7E9] via-[#78B56B] to-[#2F4638] border border-gray-300" />
                  <span className="text-[10px] text-gray-700 font-bold">20mm+</span>
                </div>
              </div>
            </div>
            </details>

            {/* LEAFLET MAP WRAPPER */}
            <div
              ref={leafletMapContainerRef}
              className="w-full h-[320px] sm:h-[440px] lg:h-[520px] rounded-2xl shadow-inner border border-gray-300/40 relative overflow-hidden z-0"
            />

            <div className="mt-2 flex items-center justify-between text-[11px] text-[#2F4638]/70 px-1">
              <span className="flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-[#2F4638]" />
                {lang === 'mr'
                  ? 'सह्याद्री घाटमाथा (इगतपुरी/त्र्यंबक) ते निफाड पर्जन्यछाया सूक्ष्म हवामान'
                  : 'Western Ghats heavy orographic rain vs eastern plains rain-shadow.'}
              </span>
              <span className="font-mono text-[#5A7852]">
                © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap contributors</a>
              </span>
            </div>
          </div>

          {/* Selected Panchayat Detail Sidebar */}
          <div className="lg:col-span-4 bg-[#E6E8DC] rounded-2xl p-4 sm:p-5 border border-gray-300/40 shadow-sm space-y-4">
            <div className="border-b border-gray-300/30 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-wider text-[#5A7852] font-bold">
                  {t.mapActivePanchayat}
                </div>
              </div>
              <h3 className="text-xl font-black text-[#2F4638] mt-0.5">
                {lang === 'mr' ? selectedPanchayat.nameMr : selectedPanchayat.nameEn}
              </h3>
              <p className="text-xs text-gray-600">
                {lang === 'mr' ? selectedPanchayat.blockNameMr : selectedPanchayat.blockNameEn} {lang === 'mr' ? 'तालुका' : 'Taluka'}
              </p>
            </div>

            <div className="rounded-xl border border-[#5A7852]/25 bg-[#F6F4EC] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#2F4638]/75">{lang === 'mr' ? 'गावाचा अंदाज' : 'Village estimate'}</span>
                <span className="text-2xl font-black tabular-nums text-[#5A7852]">{selectedResult?.calibratedRainfall} <span className="text-sm">mm</span></span>
              </div>
              <p className="mt-1 text-[11px] text-[#2F4638]/65">{lang === 'mr' ? 'उदाहरणासाठीचे मूल्य · पडताळलेला अंदाज नाही' : 'Illustrative value · not a validated forecast'}</p>
            </div>

            <details className="bg-[#F6F4EC] p-3 rounded-xl border border-gray-300/40 text-xs">
              <summary className="font-bold text-[#2F4638] cursor-pointer">
                {lang === 'mr' ? 'अधिक माहिती: जमिनीची वैशिष्ट्ये' : 'More details about this area'}
              </summary>
              <div className="space-y-2 mt-3">
              <div className="font-bold text-[#2F4638] flex items-center justify-between">
                <span>{lang === 'mr' ? 'स्थानिक भौगोलिक वैशिष्ट्ये:' : 'Terrain details:'}</span>
                <span className="text-[10px] bg-[#2F4638]/10 text-[#2F4638] px-2 py-0.5 rounded font-mono">
                  SRTM 30m
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-gray-500">{t.elevation}:</span>
                  <div className="font-bold font-mono text-[#2F4638]">{selectedPanchayat.elevationM} m</div>
                </div>
                <div>
                  <span className="text-gray-500">{lang === 'mr' ? 'उतार व दिशा:' : 'Slope & Aspect:'}</span>
                  <div className="font-bold font-mono text-[#2F4638]">{selectedPanchayat.slopeDeg}° ({selectedPanchayat.aspect})</div>
                </div>
                <div>
                  <span className="text-gray-500">{lang === 'mr' ? 'नदीपासून अंतर:' : 'River Distance:'}</span>
                  <div className="font-bold font-mono text-[#2F4638]">{selectedPanchayat.distanceToRiverKm} km</div>
                </div>
                <div>
                  <span className="text-gray-500">NDVI Green Index:</span>
                  <div className="font-bold font-mono text-[#5A7852]">{selectedPanchayat.ndvi}</div>
                </div>
              </div>
              </div>
            </details>

            <div className="pt-2 border-t border-gray-300/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#5A7852] flex items-center gap-1">
                  <Bug className="w-3.5 h-3.5" />
                  <span>{lang === 'mr' ? 'स्थानिक पारंपारिक संकेत:' : 'Active Bio-Indicators:'}</span>
                </span>
                <span className="text-[10px] bg-[#5A7852] text-white px-1.5 py-0.2 rounded-full font-bold">
                  {selectedResult?.activeReportsCount}
                </span>
              </div>

              <details className="rounded-xl bg-[#F6F4EC] px-3 py-2">
                <summary className="cursor-pointer text-[11px] font-bold text-[#2F4638]">
                  {lang === 'mr' ? 'नोंदवलेली निरीक्षणे पहा' : 'View reported observations'}
                </summary>
              {selectedResult && selectedResult.activeReportsCount > 0 ? (
                <div className="space-y-1.5">
                  {farmerReports
                    .filter((r) => r.panchayatId === selectedPanchayat.id)
                    .map((rep) => (
                      <div key={rep.id} className="p-2 bg-[#F6F4EC] rounded-lg border border-gray-300/40 text-[11px]">
                        <div className="flex justify-between font-bold text-[#2F4638]">
                          <span>{lang === 'mr' ? rep.farmerNameMr : rep.farmerNameEn}</span>
                          <span className="text-gray-400 font-normal">{lang === 'mr' ? rep.timeAgoMr : rep.timeAgoEn}</span>
                        </div>
                        <p className="text-gray-600 text-[10px] mt-0.5">
                          {lang === 'mr' ? rep.notesMr : rep.notesEn}
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 italic">
                  {lang === 'mr' ? 'या ग्रामपंचायतीसाठी अद्याप शेतकऱ्यांचे संकेत नोंदवलेले नाहीत.' : 'No crowdsourced bio-indicators reported yet for this panchayat.'}
                </p>
              )}
              </details>

              <button
                type="button"
                onClick={onOpenIntake}
                className="mt-3 w-full bg-[#5A7852] hover:bg-[#466849] text-white text-xs font-bold py-2 rounded-xl transition shadow-sm cursor-pointer"
              >
                {lang === 'mr' ? '+ या ग्रामपंचायतीसाठी संकेत नोंदवा' : '+ Report Observation Here'}
              </button>
            </div>

          </div>

        </div>
      )}

      {/* Keep the longer explanation available, but collapsed below the map. */}
      <details className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none rounded-2xl p-4 text-sm font-black text-[#2F4638] [&::-webkit-details-marker]:hidden">
          {lang === 'mr' ? 'या गावाचा अंदाज कसा बदलला? अधिक माहिती' : 'Why is this village estimate different? More details'}
          <span className="ml-2 text-xs font-semibold text-[#5A7852]">{selectedDelta > 0 ? '+' : ''}{selectedDelta.toFixed(1)} mm</span>
        </summary>
      <div className="bg-[#E6E8DC] rounded-2xl p-4 sm:p-5 border-t border-gray-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-300/30 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#5A7852]/20 text-[#5A7852] flex items-center justify-center font-bold text-base">
              🌾
            </span>
            <div>
              <h4 className="font-black text-sm sm:text-base text-[#2F4638]">
                {t.villageComparisonVerdict}: <span className="text-[#5A7852]">{lang === 'mr' ? selectedPanchayat.nameMr : selectedPanchayat.nameEn}</span>
              </h4>
              <span className="text-[11px] text-gray-600">
                {lang === 'mr' ? `${selectedPanchayat.blockNameMr} तालुका • सूक्ष्म हवामान विश्लेषण` : `${selectedPanchayat.blockNameEn} Taluka • Microclimate Analysis`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">{t.differenceTag}:</span>
            <span
              className={`px-3 py-1 rounded-xl font-mono font-black text-xs sm:text-sm flex items-center gap-1 ${
                selectedDelta > 0.5
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : selectedDelta < -0.5
                  ? 'bg-rose-100 text-[#B6413A] border border-rose-300'
                  : 'bg-[#F6F4EC] text-gray-700 border border-gray-300'
              }`}
            >
              {selectedDelta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : selectedDelta < -0.5 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              <span>{selectedDelta > 0 ? '+' : ''}{selectedDelta.toFixed(1)} mm</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
          <div className="bg-[#F6F4EC] p-3 rounded-xl border border-gray-300/40 space-y-1">
            <div className="font-bold text-[#2F4638] flex items-center gap-1.5">
              <span>{lang === 'mr' ? '🏛️ ब्लॉक आधार मूल्य:' : '🏛️ Block baseline:'}</span>
              <span className="font-mono text-[#2F4638] font-black">{selectedBlock.imdRainfallMm} mm</span>
            </div>
            <p className="text-gray-600 text-[11px] leading-relaxed">
              {lang === 'mr'
                ? `संपूर्ण ${selectedBlock.nameMr} तालुक्यासाठी एकच आकडा. गावातील डोंगर, नदी किंवा प्रत्यक्ष ढग गृहीत धरले नाहीत.`
                : `A uniform single average for all villages in ${selectedBlock.nameEn}. Does not account for hill lift or local streams.`}
            </p>
          </div>

          <div className="bg-[#F6F4EC] p-3 rounded-xl border border-gray-300/40 space-y-1">
            <div className="font-bold text-[#5A7852] flex items-center gap-1.5">
              <span>{lang === 'mr' ? '🌿 पंचायत नमुना अंदाज:' : '🌿 Panchayat demo estimate:'}</span>
              <span className="font-mono text-[#5A7852] font-black">{selectedResult?.calibratedRainfall} mm</span>
            </div>
            <p className="text-[#2F4638]/80 text-[11px] leading-relaxed">
              {lang === 'mr'
                ? `भूभाग प्रात्यक्षिक सूत्रामुळे आधार मूल्यापेक्षा ${selectedDelta > 0 ? '+' : ''}${selectedDelta.toFixed(1)} मिमी फरक. ही प्रत्यक्ष मोजणी नाही.`
                : `The demonstration terrain formula differs from the baseline by ${selectedDelta > 0 ? '+' : ''}${selectedDelta.toFixed(1)} mm. This is not an observation.`}
            </p>
          </div>

          <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-300 space-y-1">
            <div className="font-bold text-amber-900 flex items-center gap-1.5">
              <span>{lang === 'mr' ? '🚜 शेतकरी मार्गदर्शन:' : '🚜 Farmer guidance:'}</span>
              <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-bold">{lang === 'mr' ? 'प्रात्यक्षिक' : 'Demo'}</span>
            </div>
            <p className="text-amber-900 text-[11px] leading-relaxed">
              {lang === 'mr'
                ? 'या प्रात्यक्षिक अंदाजाला प्रत्यक्ष कृतीचा आधार मानू नका. निर्णयापूर्वी अधिकृत स्थानिक हवामान व कृषी सल्ला तपासा.'
                : 'Treat this as a demo only. Check official local weather and agricultural guidance before taking action.'}
            </p>
          </div>
        </div>
      </div>
      </details>

    </div>
  );
};
