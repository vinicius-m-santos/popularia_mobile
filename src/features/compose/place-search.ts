/** Busca de lugares sem chave: Photon/OpenStreetMap, com CORS liberado e nomes locais. */
export type PlaceSuggestion = { id: string; label: string };

type PhotonFeature = {
  properties?: {
    osm_id?: number | string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    state?: string;
  };
};

export async function searchPlaces(query: string, signal: AbortSignal): Promise<PlaceSuggestion[]> {
  const term = query.trim();
  if (term.length < 3) return [];
  try {
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(term)}&limit=6`, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) return [];
    const data = await response.json() as { features?: PhotonFeature[] };
    const seen = new Set<string>();
    const places: PlaceSuggestion[] = [];
    for (const feature of data.features ?? []) {
      const p = feature.properties ?? {};
      const parts = [p.name, p.street && p.housenumber ? `${p.street}, ${p.housenumber}` : p.street, p.district, p.city, p.state]
        .filter((part): part is string => !!part && !!part.trim());
      const label = [...new Set(parts)].join(', ');
      if (!label || seen.has(label)) continue;
      seen.add(label);
      places.push({ id: String(p.osm_id ?? label), label });
    }
    return places;
  } catch {
    return [];
  }
}
