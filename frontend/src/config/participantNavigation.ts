
export type ParticipantModule =
  | "tickets"
  | "trivia"
  | "memorama"
  | "puzzle"
  | "points"
  | "rewards"
  | "ranking";

export interface ParticipantNavigationItem {
  id: string;
  label: string;
  href: string;
  module?: ParticipantModule;
}

export interface ParticipantCampaignConfig {
  enabledModules: readonly ParticipantModule[];
}

const navigationItems: readonly ParticipantNavigationItem[] = [
  {
    id: "dashboard",
    label: "Mi cuenta",
    href: "/dashboard",
  },
  {
    id: "tickets",
    label: "Subir ticket",
    href: "/tickets",
    module: "tickets",
  },
  {
    id: "trivia",
    label: "Jugar trivia",
    href: "/trivia",
    module: "trivia",
  },
  {
    id: "memorama",
    label: "Jugar memorama",
    href: "/memorama",
    module: "memorama",
  },
  {
    id: "puzzle",
    label: "Rompecabezas",
    href: "/rompecabezas",
    module: "puzzle",
  },
  {
    id: "points",
    label: "Mis puntos",
    href: "/puntos",
    module: "points",
  },
  {
    id: "rewards",
    label: "Mis premios",
    href: "/premios",
    module: "rewards",
  },
  {
    id: "ranking",
    label: "Clasificación",
    href: "/clasificacion",
    module: "ranking",
  },
];

export function getParticipantNavigation(
  config: ParticipantCampaignConfig,
): ParticipantNavigationItem[] {
  const enabledModules = new Set(config.enabledModules);

  return navigationItems.filter(
    (item) =>
      item.module === undefined ||
      enabledModules.has(item.module),
  );
}
