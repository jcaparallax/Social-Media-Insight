export interface PlazaConfig {
  id: string;
  displayName: string;
  fbAccount: string;
  igAccount: string;
  adsCampaignKeyword: string;
}

export const PLAZAS: PlazaConfig[] = [
  {
    id: "patio-santa-fe",
    displayName: "Patio Santa Fe",
    fbAccount: "Patio Santa Fe",
    igAccount: "patiosantafe",
    adsCampaignKeyword: "f1_01sfe",
  },
];

export function getPlazaById(id: string): PlazaConfig | undefined {
  return PLAZAS.find((p) => p.id === id);
}

export function getPlazaSummaries(): Array<{ id: string; displayName: string }> {
  return PLAZAS.map((p) => ({ id: p.id, displayName: p.displayName }));
}
