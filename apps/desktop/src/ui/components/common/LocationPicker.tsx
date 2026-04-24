import { createSignal, onCleanup, Show, For } from "solid-js";
import type L from "leaflet";
import { useT } from "../../../i18n/context";

// Lazy-load Leaflet on first map mount (heavy library, only needed for location picking)
let leafletModule: typeof import("leaflet") | null = null;
async function getLeaflet(): Promise<typeof import("leaflet")> {
  if (!leafletModule) {
    leafletModule = await import("leaflet");
    await import("leaflet/dist/leaflet.css");

    // Fix Leaflet default icon paths (broken by bundlers)
    const Lmod = leafletModule.default ?? leafletModule;
    delete (Lmod.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
    Lmod.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }
  return leafletModule;
}

export interface LocationPickerProps {
  location: string;
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (location: string, lat: number | null, lng: number | null) => void;
  placeholder?: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";

export function LocationPicker(props: LocationPickerProps) {
  const { t } = useT();
  const [query, setQuery] = createSignal(props.location || "");
  const [suggestions, setSuggestions] = createSignal<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [showMap, setShowMap] = createSignal(false);
  const [dropdownPos, setDropdownPos] = createSignal({ top: 0, left: 0, width: 0 });

  let inputRowRef: HTMLDivElement | undefined;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let mapInstance: L.Map | null = null;
  let markerInstance: L.Marker | null = null;

  onCleanup(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (mapInstance) { mapInstance.remove(); mapInstance = null; }
  });

  async function searchNominatim(q: string) {
    if (q.length < 3) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `${NOMINATIM_URL}/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=fr`,
        { headers: { "User-Agent": "MagickCookie/1.0" } }
      );
      const data: NominatimResult[] = await res.json();
      setSuggestions(data);
      if (data.length > 0) { updateDropdownPos(); setShowSuggestions(true); } else { setShowSuggestions(false); }
    } catch {
      setSuggestions([]);
    }
    setLoading(false);
  }

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(
        `${NOMINATIM_URL}/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`,
        { headers: { "User-Agent": "MagickCookie/1.0" } }
      );
      const data = await res.json();
      if (data.display_name) {
        setQuery(data.display_name);
        props.onLocationChange(data.display_name, lat, lng);
      }
    } catch {}
  }

  function handleInput(value: string) {
    setQuery(value);
    props.onLocationChange(value, props.latitude, props.longitude);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => searchNominatim(value), 400);
  }

  function selectSuggestion(result: NominatimResult) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setQuery(result.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    props.onLocationChange(result.display_name, lat, lng);
    setShowMap(true);
    updateMap(lat, lng);
  }

  function initMap(el: HTMLDivElement) {
    if (mapInstance) return;

    getLeaflet().then((mod) => {
      const Lmod = mod.default ?? mod;
      if (mapInstance) return; // double-check after await

      const lat = props.latitude ?? 48.8566;
      const lng = props.longitude ?? 2.3522;

      mapInstance = Lmod.map(el, {
        center: [lat, lng],
        zoom: props.latitude ? 15 : 5,
        zoomControl: false,
        attributionControl: false,
      });

      Lmod.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(mapInstance);

      Lmod.control.zoom({ position: "bottomright" }).addTo(mapInstance);

      if (props.latitude && props.longitude) {
        markerInstance = Lmod.marker([props.latitude, props.longitude], { draggable: true }).addTo(mapInstance);
        markerInstance.on("dragend", () => {
          const pos = markerInstance!.getLatLng();
          reverseGeocode(pos.lat, pos.lng);
        });
      }

      // Ensure tiles render correctly after Show mounts the container
      setTimeout(() => mapInstance?.invalidateSize(), 100);

      mapInstance.on("click", (e: L.LeafletMouseEvent) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        updateMap(clickLat, clickLng);
        reverseGeocode(clickLat, clickLng);
      });
    });
  }

  function updateMap(lat: number, lng: number) {
    if (!mapInstance || !leafletModule) return;
    const Lmod = (leafletModule as any).default ?? leafletModule;
    mapInstance.setView([lat, lng], 15);
    if (markerInstance) {
      markerInstance.setLatLng([lat, lng]);
    } else {
      markerInstance = Lmod.marker([lat, lng], { draggable: true }).addTo(mapInstance);
      markerInstance.on("dragend", () => {
        const pos = markerInstance!.getLatLng();
        reverseGeocode(pos.lat, pos.lng);
      });
    }
  }

  function updateDropdownPos() {
    if (!inputRowRef) return;
    const rect = inputRowRef.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }

  function handleBlur() {
    setTimeout(() => setShowSuggestions(false), 200);
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Input + icon */}
      <div ref={inputRowRef} style={{ display: "flex", "align-items": "center", gap: "10px" }}>
        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          title={t("locationPicker.openMap")}
          style={{
            display: "flex", "align-items": "center", "justify-content": "center",
            width: "28px", height: "28px", "border-radius": "var(--radius-sm)",
            border: "none", background: showMap() ? "color-mix(in srgb, var(--accent-primary) 15%, transparent)" : "transparent",
            color: showMap() ? "var(--accent-primary)" : "var(--text-muted)",
            cursor: "pointer", "flex-shrink": "0", transition: "var(--transition-fast)",
            padding: "0",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
          </svg>
        </button>
        <div style={{ flex: "1", position: "relative" }}>
          <input
            value={query()}
            onInput={(e) => handleInput(e.currentTarget.value)}
            onFocus={() => { if (suggestions().length > 0) { updateDropdownPos(); setShowSuggestions(true); } }}
            onBlur={handleBlur}
            placeholder={props.placeholder || t("locationPicker.searchPlace")}
            style={{
              width: "100%", border: "none", background: "transparent",
              color: "var(--text-primary)", "font-size": "13px", outline: "none", padding: "0",
              "box-sizing": "border-box",
            }}
          />

          {/* Suggestions dropdown (fixed to escape overflow parents) */}
          <Show when={showSuggestions()}>
            <div style={{
              position: "fixed",
              top: `${dropdownPos().top}px`,
              left: `${dropdownPos().left}px`,
              width: `${dropdownPos().width}px`,
              "z-index": "10000",
              background: "var(--bg-surface)", border: "1px solid var(--border-color)",
              "border-radius": "var(--radius-lg)", "box-shadow": "0 8px 24px rgba(0,0,0,0.25)",
              "max-height": "200px", "overflow-y": "auto",
            }}>
              <For each={suggestions()}>
                {(result) => (
                  <button
                    type="button"
                    onClick={() => selectSuggestion(result)}
                    style={{
                      display: "block", width: "100%", padding: "8px 12px",
                      border: "none", background: "transparent",
                      color: "var(--text-primary)", "font-size": "12px",
                      "text-align": "left", cursor: "pointer",
                      transition: "var(--transition-fast)",
                      "line-height": "1.4",
                    }}
                  >
                    {result.display_name}
                  </button>
                )}
              </For>
              <Show when={loading()}>
                <div style={{ padding: "8px 12px", "font-size": "11px", color: "var(--text-muted)", "text-align": "center" }}>
                  {t("locationPicker.searching")}
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>

      {/* Mini map */}
      <Show when={showMap() || (props.latitude !== null && props.longitude !== null)}>
        <div
          ref={initMap}
          style={{
            height: "140px",
            "margin-top": "10px",
            "border-radius": "var(--radius-md)",
            border: "1px solid var(--border-color)",
            overflow: "hidden",
          }}
        />
      </Show>
    </div>
  );
}
