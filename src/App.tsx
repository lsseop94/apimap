import { useRef, useState } from "react";

type Place = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

type FieldState = {
  query: string;
  results: Place[];
  selected: Place | null;
  loading: boolean;
  error: string;
};

type Route = {
  distance: number;
  duration: number;
};

const emptyField: FieldState = {
  query: "",
  results: [],
  selected: null,
  loading: false,
  error: "",
};

let lastGeocodeRequest = 0;
let geocodeQueue = Promise.resolve();

function searchNominatim(query: string): Promise<Place[]> {
  const search = async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastGeocodeRequest));
    if (wait > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, wait));
    }
    lastGeocodeRequest = Date.now();

    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
      "accept-language": "ko",
    });
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) {
      throw new Error(
        response.status === 429
          ? "검색 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요."
          : "장소를 검색하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
    return (await response.json()) as Place[];
  };

  const request = geocodeQueue.then(search, search);
  geocodeQueue = request.then(
    () => undefined,
    () => undefined,
  );
  return request;
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters).toLocaleString("ko-KR")} m`;
  }
  return `${(meters / 1000).toLocaleString("ko-KR", {
    maximumFractionDigits: 1,
  })} km`;
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `약 ${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `약 ${hours}시간 ${remainder}분` : `약 ${hours}시간`;
}

function App() {
  const [origin, setOrigin] = useState<FieldState>(emptyField);
  const [destination, setDestination] = useState<FieldState>(emptyField);
  const [route, setRoute] = useState<Route | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const searchSequence = useRef({ origin: 0, destination: 0 });

  const setField = (which: "origin" | "destination", value: FieldState) => {
    if (which === "origin") setOrigin(value);
    else setDestination(value);
  };

  const updateQuery = (which: "origin" | "destination", query: string) => {
    searchSequence.current[which] += 1;
    const current = which === "origin" ? origin : destination;
    setField(which, {
      ...current,
      query,
      loading: false,
      results: [],
      selected: null,
      error: "",
    });
    setRoute(null);
    setRouteError("");
  };

  const search = async (which: "origin" | "destination") => {
    const current = which === "origin" ? origin : destination;
    const query = current.query.trim();
    if (!query) {
      setField(which, { ...current, error: "장소 이름을 입력해 주세요." });
      return;
    }

    const requestId = ++searchSequence.current[which];
    setField(which, { ...current, loading: true, error: "", results: [] });
    try {
      const results = await searchNominatim(query);
      if (searchSequence.current[which] !== requestId) return;
      setField(which, {
        ...current,
        loading: false,
        results,
        error: results.length === 0 ? "검색 결과가 없습니다. 다른 이름으로 검색해 보세요." : "",
      });
    } catch (error) {
      if (searchSequence.current[which] !== requestId) return;
      setField(which, {
        ...current,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "장소를 검색하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      });
    }
  };

  const selectPlace = (
    which: "origin" | "destination",
    place: Place,
  ) => {
    searchSequence.current[which] += 1;
    const current = which === "origin" ? origin : destination;
    setField(which, {
      ...current,
      query: place.display_name,
      selected: place,
      results: [],
      error: "",
    });
    setRoute(null);
    setRouteError("");
  };

  const calculateRoute = async () => {
    if (!origin.selected || !destination.selected) return;
    setRouteLoading(true);
    setRouteError("");
    setRoute(null);
    const start = `${origin.selected.lon},${origin.selected.lat}`;
    const end = `${destination.selected.lon},${destination.selected.lat}`;

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start};${end}?overview=false`,
      );
      if (!response.ok) {
        throw new Error("경로를 계산하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
      const data = (await response.json()) as {
        code: string;
        routes?: Route[];
      };
      if (data.code !== "Ok" || !data.routes?.length) {
        throw new Error("두 장소 사이의 자동차 경로를 찾을 수 없습니다.");
      }
      setRoute(data.routes[0]);
    } catch (error) {
      setRouteError(
        error instanceof Error
          ? error.message
          : "경로를 계산하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setRouteLoading(false);
    }
  };

  const mapUrl =
    route && origin.selected && destination.selected
      ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(
          `${origin.selected.lat},${origin.selected.lon};${destination.selected.lat},${destination.selected.lon}`,
        )}`
      : "";

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="거리 측정 홈">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M4 17.5 17.5 4l2.5 2.5L6.5 20 4 17.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="m8 13 2 2m1-5 2 2m1-5 2 2" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          <span>거리 측정</span>
        </a>
        <span className="topbar-note">OpenStreetMap 기반</span>
      </header>

      <section className="main-content">
        <div className="intro">
          <span className="eyebrow"><span className="eyebrow-dot" /> EASY ROUTE FINDER</span>
          <h1>
            두 장소 사이,
            <br />
            <span>얼마나 멀까요?</span>
          </h1>
          <p>출발지와 도착지를 검색하면 자동차 경로와 거리를 알려드려요.</p>
        </div>

        <section className="search-card" aria-label="장소 및 거리 검색">
          <PlaceField
            label="출발지"
            hint="어디에서 출발하시나요?"
            icon="start"
            field={origin}
            onQueryChange={(query) => updateQuery("origin", query)}
            onSearch={() => void search("origin")}
            onSelect={(place) => selectPlace("origin", place)}
            onEnter={() => void search("origin")}
          />

          <div className="route-connector" aria-hidden="true">
            <span />
            <span />
          </div>

          <PlaceField
            label="도착지"
            hint="어디로 가시나요?"
            icon="end"
            field={destination}
            onQueryChange={(query) => updateQuery("destination", query)}
            onSearch={() => void search("destination")}
            onSelect={(place) => selectPlace("destination", place)}
            onEnter={() => void search("destination")}
          />

          <button
            className="calculate-button"
            type="button"
            onClick={() => void calculateRoute()}
            disabled={!origin.selected || !destination.selected || routeLoading}
          >
            {routeLoading ? (
              <>
                <span className="spinner" /> 거리 계산 중
              </>
            ) : (
              <>
                거리 계산하기
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
        </section>

        {routeError && (
          <p className="route-error" role="alert">
            {routeError}
          </p>
        )}

        {route && (
          <section className="result-card" aria-live="polite">
            <div className="result-copy">
              <span className="result-label">자동차 경로 총거리</span>
              <strong>{formatDistance(route.distance)}</strong>
              <span className="duration">{formatDuration(route.duration)} 소요</span>
            </div>
            <div className="result-divider" />
            <a className="map-link" href={mapUrl} target="_blank" rel="noreferrer">
              <span className="map-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
                </svg>
              </span>
              <span>지도에서 보기</span>
              <svg className="external-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 3H3v10h10v-3M8 3h5v5m0-5L7 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </section>
        )}

        <p className="attribution">
          장소 검색 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
          <span aria-hidden="true"> · </span>
          경로 정보는 예상값이며 실제 이동 경로와 다를 수 있습니다.
        </p>
      </section>
      <footer className="footer">필요한 두 곳의 거리를 간편하게 확인하세요.</footer>
    </main>
  );
}

type PlaceFieldProps = {
  label: string;
  hint: string;
  icon: "start" | "end";
  field: FieldState;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onSelect: (place: Place) => void;
  onEnter: () => void;
};

function PlaceField({
  label,
  hint,
  icon,
  field,
  onQueryChange,
  onSearch,
  onSelect,
  onEnter,
}: PlaceFieldProps) {
  return (
    <div className="place-field">
      <div className="field-icon-wrap">
        <span className={`place-icon ${icon}`} aria-hidden="true">
          {icon === "start" ? (
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <circle cx="12" cy="9" r="2.4" fill="currentColor" />
            </svg>
          )}
        </span>
      </div>
      <div className="field-content">
        <label htmlFor={`${icon}-place`}>{label}</label>
        <div className="input-row">
          <input
            id={`${icon}-place`}
            value={field.query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onEnter();
            }}
            placeholder={hint}
            autoComplete="off"
            aria-describedby={field.error ? `${icon}-error` : undefined}
          />
          <button
            className="search-button"
            type="button"
            onClick={onSearch}
            disabled={field.loading}
            aria-label={`${label} 검색`}
          >
            {field.loading ? <span className="spinner dark" /> : "검색"}
          </button>
        </div>
        {field.selected && (
          <span className="selected-note">장소가 선택되었습니다</span>
        )}
        {field.error && (
          <span className="field-message" id={`${icon}-error`} role="alert">
            {field.error}
          </span>
        )}
        {field.results.length > 0 && (
          <ul className="results-list" aria-label={`${label} 검색 결과`}>
            {field.results.map((place) => (
              <li key={place.place_id}>
                <button type="button" onClick={() => onSelect(place)}>
                  <span className="result-pin" aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="none">
                      <path d="M16.5 8.3c0 4.1-6.5 9.7-6.5 9.7S3.5 12.4 3.5 8.3a6.5 6.5 0 1 1 13 0Z" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </span>
                  <span>{place.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;
