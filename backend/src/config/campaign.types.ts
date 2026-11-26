/**
 * Define los tipos e interfaces utilizados para configurar una campaña.
 *
 * Permite establecer una estructura reutilizable y tipada para las
 * diferentes campañas promocionales de la plataforma.
 *
 * Actualmente contempla la información general de la campaña y las
 * reglas de validación de comprobantes de compra.
 */

import type {
  ValidationFailureAction,
} from "../modules/tickets/validation/types";

/**
 * Configuración común de las reglas de validación.
 *
 * Todas las reglas deben indicar si están habilitadas y qué acción
 * debe tomar el motor cuando se detecta un incumplimiento.
 */
export interface ValidationRuleConfig {
  /** Indica si la regla participa en la validación automática. */
  enabled: boolean;

  /** Acción que se aplica cuando la regla no se cumple. */
  failureAction: ValidationFailureAction;
}

/**
 * Configuración del periodo permitido para realizar compras.
 *
 * Las fechas utilizan el formato YYYY-MM-DD y ambos límites
 * del periodo son inclusivos.
 *
 * Esta configuración no representa el periodo de participación
 * ni el plazo para registrar comprobantes.
 */
export interface PurchaseDateRangeConfig
  extends ValidationRuleConfig {
  /** Primer día permitido para realizar compras. */
  startDate: string;

  /** Último día permitido para realizar compras. */
  endDate: string;
}

/**
 * Configuración del importe mínimo de compra requerido
 * para que un comprobante cumpla con esta regla.
 */
export interface MinimumAmountConfig
  extends ValidationRuleConfig {
  /** Importe mínimo requerido en el comprobante. */
  minimum: number;

  /** Código de moneda de tres letras, por ejemplo MXN. */
  currency: string;
}

/**
 * Representa un comercio participante en la campaña.
 *
 * Los alias permiten reconocer distintas denominaciones de un
 * mismo comercio en la información obtenida mediante OCR.
 */
export interface CampaignMerchant {
  /** Nombre principal del comercio. */
  name: string;

  /** Denominaciones alternativas reconocidas para el comercio. */
  aliases?: string[];
}

/**
 * Configuración de los comercios autorizados para participar
 * en la campaña promocional.
 */
export interface AllowedMerchantsConfig
  extends ValidationRuleConfig {
  /** Lista de comercios permitidos y sus respectivos alias. */
  merchants: CampaignMerchant[];
}

/**
 * Representa un producto participante en la campaña.
 *
 * Los alias permiten reconocer diferentes descripciones de un
 * mismo producto en los comprobantes de compra.
 */
export interface CampaignProduct {
  /** Nombre principal del producto. */
  name: string;

  /** Descripciones alternativas reconocidas para el producto. */
  aliases?: string[];
}

/**
 * Configuración de los productos requeridos para participar.
 *
 * La cantidad mínima corresponde a la suma de las unidades
 * reconocidas de los productos permitidos, no a una cantidad
 * independiente para cada producto.
 */
export interface RequiredProductsConfig
  extends ValidationRuleConfig {
  /** Cantidad mínima total de productos participantes. */
  minimumQuantity: number;

  /** Lista de productos válidos y sus respectivos alias. */
  products: CampaignProduct[];
}

/**
 * Configuración de la regla de detección de tickets duplicados.
 *
 * Actualmente no requiere parámetros adicionales a las opciones
 * comunes de validación.
 *
 * Deshabilitar esta regla no elimina la protección independiente
 * contra archivos duplicados durante el registro de comprobantes.
 */
export interface DuplicateTicketConfig
  extends ValidationRuleConfig {}

/**
 * Agrupa las reglas de validación de comprobantes disponibles
 * en la plataforma.
 *
 * Cada regla puede habilitarse y configurarse de manera
 * independiente según las necesidades de la campaña.
 */
export interface TicketValidationRulesConfig {
  /** Validación de la vigencia de compra. */
  purchaseDateRange: PurchaseDateRangeConfig;

  /** Validación del importe mínimo requerido. */
  minimumAmount: MinimumAmountConfig;

  /** Validación del comercio emisor del comprobante. */
  allowedMerchants: AllowedMerchantsConfig;

  /** Validación de los productos participantes. */
  requiredProducts: RequiredProductsConfig;

  /** Validación de comprobantes duplicados. */
  duplicateTicket: DuplicateTicketConfig;
}

/**
 * Configuración general del módulo de comprobantes de compra.
 */
export interface TicketsConfig {
  /**
   * Indicador declarativo de habilitación del módulo.
   *
   * Actualmente no controla el acceso a los endpoints ni
   * deshabilita globalmente las reglas de validación.
   */
  enabled: boolean;

  /** Reglas de validación aplicables a los comprobantes. */
  validationRules: TicketValidationRulesConfig;
}

/**
 * Estructura principal de configuración de una campaña.
 *
 * Cada instalación de la plataforma utiliza su propia
 * configuración y una base de datos independiente.
 *
 * Esta interfaz podrá ampliarse conforme se incorporen nuevos
 * módulos, como registro, trivia, puntos y clasificación.
 */
export interface CampaignConfig {
  /** Identificador único de la campaña dentro de su configuración. */
  id: string;

  /** Nombre descriptivo de la campaña. */
  name: string;

  /**
   * Zona horaria de referencia de la campaña.
   *
   * Se utilizará posteriormente para los periodos y ventanas
   * de participación. No modifica las fechas de compra normalizadas.
   */
  timezone: string;

  /** Configuración del módulo de comprobantes de compra. */
  tickets: TicketsConfig;
}
