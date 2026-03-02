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
  {
    id: "patio-universidad",
    displayName: "Patio Universidad",
    fbAccount: "Patio Universidad",
    igAccount: "patiouniversidad",
    adsCampaignKeyword: "f1_02uni",
  },
  {
    id: "portal-centro",
    displayName: "Portal Centro",
    fbAccount: "Portal Centro",
    igAccount: "portal_centro",
    adsCampaignKeyword: "f1_03bot",
  },
  {
    id: "city-center-merida",
    displayName: "City Center Mérida",
    fbAccount: "City Center Merida",
    igAccount: "citycentermerida",
    adsCampaignKeyword: "f1_05ccm",
  },
  {
    id: "patio-merida",
    displayName: "Patio Mérida",
    fbAccount: "Patio Mérida",
    igAccount: "patiomerida",
    adsCampaignKeyword: "f1_08mer",
  },
];

export function getPlazaById(id: string): PlazaConfig | undefined {
  return PLAZAS.find((p) => p.id === id);
}

export function getPlazaSummaries(): Array<{ id: string; displayName: string }> {
  return PLAZAS.map((p) => ({ id: p.id, displayName: p.displayName }));
}
