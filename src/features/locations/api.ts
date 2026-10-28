import { apiRequest } from '@/lib/api/client';

export type LocationState = { id: string; name: string; abbreviation: string };
export type Municipality = { id: string; name: string };
const statesCache: { value: LocationState[] | null } = { value: null };
const municipalitiesCache = new Map<string, Municipality[]>();
export async function getBrazilStates(): Promise<LocationState[]> {
  if (!statesCache.value) statesCache.value = (await apiRequest<{ items: LocationState[] }>('/locations/br/states')).items;
  return statesCache.value;
}
export async function getBrazilMunicipalities(stateId: string): Promise<Municipality[]> {
  const cached = municipalitiesCache.get(stateId); if (cached) return cached;
  const items = (await apiRequest<{ items: Municipality[] }>(`/locations/br/states/${encodeURIComponent(stateId)}/municipalities`)).items;
  municipalitiesCache.set(stateId, items); return items;
}
