
import type {
  ParticipantCampaignConfig,
} from "./participantNavigation";

/**
 * Configuración del frontend de una campaña.
 *
 * Cada instalación podrá tener sus propios
 * módulos habilitados.
 */
export interface CampaignConfig {
  id: string;
  name: string;
  participant: ParticipantCampaignConfig;
}

/**
 * Configuración inicial de desarrollo.
 *
 * Todavía no habilitamos mecánicas porque
 * sus páginas y endpoints no están implementados.
 */
export const campaignConfig: CampaignConfig = {
  id: "pauta-demo",
  name: "Pauta Campaign Platform",
  participant: {
    enabledModules: [],
  },
};
