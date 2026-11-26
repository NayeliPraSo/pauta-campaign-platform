/**
 * Configuración inicial de la campaña promocional.
 *
 * Centraliza los parámetros de identificación y las reglas de
 * validación que se utilizarán durante la inicialización.
 *
 * PostgreSQL es la fuente de reglas utilizada por el motor
 * durante la ejecución de la plataforma.
 *
 * Modificar este archivo no actualiza automáticamente las
 * reglas existentes en la base de datos.
 *
 * Los valores actuales corresponden a una campaña de desarrollo
 * y no representan las condiciones definitivas de una promoción.
 */

import type { CampaignConfig } from "./campaign.types";

export const campaignConfig: CampaignConfig = {
  // Identificador de la campaña de desarrollo.
  id: "pauta-demo",

  // Nombre descriptivo de la campaña.
  name: "Pauta Campaign Platform",

  // Zona horaria de referencia para futuros periodos de participación.
  timezone: "America/Mexico_City",

  tickets: {
    // Indicador declarativo del módulo de comprobantes.
    enabled: true,

    validationRules: {
      /**
       * Vigencia de compra.
       *
       * Valida que la fecha normalizada del comprobante se encuentre
       * dentro del periodo permitido, incluyendo ambos límites.
       *
       * Veryfi puede proporcionar una fecha acompañada de la hora,
       * pero el motor utiliza la fecha previamente normalizada.
       *
       * La regla permanece deshabilitada porque todavía no existe
       * un periodo definitivo para la campaña de desarrollo.
       */
      purchaseDateRange: {
        enabled: false,
        failureAction: "rejected",
        startDate: "2026-12-01",
        endDate: "2026-12-31",
      },

      /**
       * Importe mínimo de compra.
       *
       * El comprobante debe alcanzar el importe requerido y
       * corresponder a la moneda configurada.
       */
      minimumAmount: {
        enabled: true,
        failureAction: "rejected",
        minimum: 150,
        currency: "MXN",
      },

      /**
       * Comercios participantes.
       *
       * Los alias permiten reconocer diferentes denominaciones
       * comerciales obtenidas durante el procesamiento OCR.
       */
      allowedMerchants: {
        enabled: true,
        failureAction: "rejected",

        merchants: [
          {
            name: "Walmart",
            aliases: [
              "Wal-Mart",
              "Walmart Supercenter",
            ],
          },
          {
            name: "Soriana",
            aliases: [
              "Soriana Híper",
              "Soriana Mercado",
            ],
          },
          {
            name: "Chedraui",
            aliases: [],
          },
        ],
      },

      /**
       * Productos participantes.
       *
       * La cantidad mínima se calcula considerando las unidades
       * reconocidas de cualquiera de los productos permitidos.
       *
       * Los alias permiten reconocer diferentes descripciones
       * de un mismo producto en los comprobantes procesados
       * mediante OCR.
       *
       * Los incumplimientos se envían a revisión manual debido
       * a las posibles diferencias entre las descripciones
       * comerciales y la información obtenida mediante OCR.
       */
      requiredProducts: {
        enabled: true,
        failureAction: "requires_review",
        minimumQuantity: 1,

        products: [
          {
            name: "Coca-Cola 600 ml",
            aliases: [
              "Coca Cola 600ML",
              "Coca-Cola PET 600",
            ],
          },
          {
            name: "Sprite 600 ml",
            aliases: [
              "Sprite PET 600",
            ],
          },
        ],
      },

      /**
       * Detección de comprobantes duplicados.
       *
       * Utiliza la información de duplicidad disponible durante
       * la validación automática del comprobante.
       *
       * La protección contra archivos idénticos durante el
       * registro del ticket funciona de manera independiente.
       */
      duplicateTicket: {
        enabled: true,
        failureAction: "rejected",
      },
    },
  },
};
