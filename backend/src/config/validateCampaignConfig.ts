/**
 * Validación y transformación de la configuración de campaña.
 *
 * Comprueba que los parámetros definidos en campaign.config.ts
 * sean válidos antes de iniciar cualquier operación en PostgreSQL.
 *
 * También transforma la configuración al formato utilizado por
 * las reglas almacenadas en la base de datos y consumidas por
 * el motor de validación de comprobantes.
 *
 * Este archivo no realiza operaciones de base de datos ni
 * modifica la configuración original.
 */

import type {
  CampaignConfig,
  ValidationRuleConfig,
} from "./campaign.types";

import type {
  ValidationRule,
} from "../modules/tickets/validation/types";

/**
 * Representa una regla preparada para su almacenamiento.
 *
 * Excluye el identificador porque PostgreSQL lo genera
 * automáticamente durante la inserción.
 */
export type CampaignValidationRule = Omit<
  ValidationRule,
  "id"
>;

/**
 * Error generado cuando la configuración de campaña contiene
 * parámetros inválidos o inconsistentes.
 */
export class CampaignConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignConfigError";
  }
}

/**
 * Comprueba que un valor sea una cadena de texto con contenido.
 *
 * Los espacios en blanco no se consideran contenido válido.
 */
function isNonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

/**
 * Valida una fecha de calendario en formato YYYY-MM-DD.
 *
 * Las fechas configuradas representan días completos, por lo
 * que no deben incluir horas ni desplazamientos de zona horaria.
 *
 * La comprobación de los componentes UTC permite detectar fechas
 * inexistentes que JavaScript ajustaría automáticamente.
 */
function isValidDate(
  value: unknown,
): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  // Verifica que JavaScript no haya ajustado una fecha inexistente.
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Comprueba que la zona horaria sea reconocida por el entorno
 * de ejecución mediante la API de internacionalización.
 */
function isValidTimezone(value: unknown): boolean {
  if (!isNonEmptyString(value)) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("es-MX", {
      timeZone: value,
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Normaliza nombres y alias para detectar equivalencias.
 *
 * Elimina acentos, diferencias entre mayúsculas y minúsculas,
 * espacios y caracteres no alfanuméricos.
 *
 * Esta normalización permite identificar configuraciones
 * ambiguas sin modificar los nombres originales.
 */
function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Valida las propiedades comunes de una regla.
 *
 * Todas las reglas deben indicar explícitamente su estado de
 * habilitación y la acción aplicable ante un incumplimiento.
 *
 * @param rule Configuración de la regla.
 * @param path Nombre de la regla utilizado en los errores.
 */
function validateRuleOptions(
  rule: ValidationRuleConfig,
  path: string,
): void {
  if (
    !rule ||
    typeof rule !== "object" ||
    Array.isArray(rule)
  ) {
    throw new CampaignConfigError(
      `${path}: configuración inválida.`,
    );
  }

  if (typeof rule.enabled !== "boolean") {
    throw new CampaignConfigError(
      `${path}.enabled debe ser booleano.`,
    );
  }

  // Las acciones deben coincidir con las admitidas por el motor
  // de validación y las restricciones de PostgreSQL.
  if (
    rule.failureAction !== "rejected" &&
    rule.failureAction !== "requires_review"
  ) {
    throw new CampaignConfigError(
      `${path}.failureAction es inválido.`,
    );
  }
}

/**
 * Valida una colección de comercios o productos.
 *
 * Comprueba que exista al menos un elemento, que los nombres
 * y alias sean válidos y que no existan coincidencias ambiguas
 * entre elementos diferentes.
 *
 * Se permite que un alias sea equivalente al nombre principal
 * del mismo elemento, por ejemplo Walmart y Wal-Mart.
 *
 * @param items Colección de elementos que se desea validar.
 * @param path Ruta de configuración utilizada en los errores.
 */
function validateNamedItems(
  items: unknown,
  path: string,
): void {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw new CampaignConfigError(
      `${path} debe contener al menos un elemento.`,
    );
  }

  // Relaciona cada nombre normalizado con el índice del elemento
  // al que pertenece para detectar coincidencias ambiguas.
  const registeredNames = new Map<string, number>();

  for (const [index, item] of items.entries()) {
    const itemPath = `${path}[${index}]`;

    // Valida la estructura del elemento y su nombre principal.
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      !isNonEmptyString(item.name) ||
      !normalizeName(item.name)
    ) {
      throw new CampaignConfigError(
        `${itemPath}.name es inválido.`,
      );
    }

    // Los alias son opcionales, pero todos los proporcionados
    // deben contener caracteres válidos después de normalizarse.
    if (
      item.aliases !== undefined &&
      (
        !Array.isArray(item.aliases) ||
        !item.aliases.every(
          (alias: unknown) =>
            isNonEmptyString(alias) &&
            normalizeName(alias).length > 0,
        )
      )
    ) {
      throw new CampaignConfigError(
        `${itemPath}.aliases es inválido.`,
      );
    }

    const names: string[] = [
      item.name,
      ...(item.aliases ?? []),
    ];

    // Comprueba tanto el nombre principal como los alias para
    // impedir que una denominación identifique elementos distintos.
    for (const name of names) {
      const normalizedName = normalizeName(name);

      const previousIndex =
        registeredNames.get(normalizedName);

      if (
        previousIndex !== undefined &&
        previousIndex !== index
      ) {
        throw new CampaignConfigError(
          `${itemPath}: el nombre o alias "${name}" pertenece a otro elemento.`,
        );
      }

      registeredNames.set(
        normalizedName,
        index,
      );
    }
  }
}

/**
 * Valida la configuración completa de una campaña.
 *
 * Comprueba los datos generales, la estructura del módulo de
 * comprobantes y los parámetros específicos de cada regla.
 *
 * Las reglas deshabilitadas también se validan para evitar
 * conservar configuraciones incorrectas que puedan habilitarse
 * posteriormente.
 *
 * @param config Configuración de campaña que se desea validar.
 * @throws CampaignConfigError Si algún parámetro es inválido.
 */
export function validateCampaignConfig(
  config: CampaignConfig,
): void {
  // Valida la estructura general de la configuración.
  if (
    !config ||
    typeof config !== "object" ||
    Array.isArray(config)
  ) {
    throw new CampaignConfigError(
      "La configuración de campaña es inválida.",
    );
  }

  // El identificador utiliza letras minúsculas, números y
  // guiones como separadores entre segmentos.
  if (
    typeof config.id !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.id)
  ) {
    throw new CampaignConfigError(
      "El identificador de campaña es inválido.",
    );
  }

  if (!isNonEmptyString(config.name)) {
    throw new CampaignConfigError(
      "El nombre de campaña es obligatorio.",
    );
  }

  if (!isValidTimezone(config.timezone)) {
    throw new CampaignConfigError(
      "La zona horaria de campaña es inválida.",
    );
  }

  // Comprueba la estructura del módulo de comprobantes.
  if (
    !config.tickets ||
    typeof config.tickets !== "object" ||
    Array.isArray(config.tickets) ||
    typeof config.tickets.enabled !== "boolean"
  ) {
    throw new CampaignConfigError(
      "La configuración de tickets es inválida.",
    );
  }

  const rules = config.tickets.validationRules;

  if (
    !rules ||
    typeof rules !== "object" ||
    Array.isArray(rules)
  ) {
    throw new CampaignConfigError(
      "La configuración de reglas es inválida.",
    );
  }

  const {
    purchaseDateRange,
    minimumAmount,
    allowedMerchants,
    requiredProducts,
    duplicateTicket,
  } = rules;

  // Valida las propiedades comunes de todas las reglas antes
  // de comprobar sus parámetros particulares.
  validateRuleOptions(
    purchaseDateRange,
    "purchaseDateRange",
  );

  validateRuleOptions(
    minimumAmount,
    "minimumAmount",
  );

  validateRuleOptions(
    allowedMerchants,
    "allowedMerchants",
  );

  validateRuleOptions(
    requiredProducts,
    "requiredProducts",
  );

  validateRuleOptions(
    duplicateTicket,
    "duplicateTicket",
  );

  // Valida la vigencia de compra.
  // El formato YYYY-MM-DD permite comparar las fechas
  // cronológicamente mediante una comparación de cadenas.
  // Se permite que ambos límites correspondan al mismo día.
  if (
    !isValidDate(purchaseDateRange.startDate) ||
    !isValidDate(purchaseDateRange.endDate) ||
    purchaseDateRange.startDate >
      purchaseDateRange.endDate
  ) {
    throw new CampaignConfigError(
      "purchaseDateRange: el periodo de compra es inválido.",
    );
  }

  // El importe mínimo debe ser un número finito no negativo.
  if (
    typeof minimumAmount.minimum !== "number" ||
    !Number.isFinite(minimumAmount.minimum) ||
    minimumAmount.minimum < 0
  ) {
    throw new CampaignConfigError(
      "minimumAmount.minimum debe ser un importe válido.",
    );
  }

  // Comprueba el formato de tres letras mayúsculas de la moneda.
  // No verifica su pertenencia al catálogo oficial de monedas.
  if (
    typeof minimumAmount.currency !== "string" ||
    !/^[A-Z]{3}$/.test(minimumAmount.currency)
  ) {
    throw new CampaignConfigError(
      "minimumAmount.currency es inválido.",
    );
  }

  // Valida los comercios participantes y sus alias.
  validateNamedItems(
    allowedMerchants.merchants,
    "allowedMerchants.merchants",
  );

  // La cantidad mínima de productos debe ser un entero
  // positivo que pueda representarse de manera segura.
  if (
    !Number.isSafeInteger(
      requiredProducts.minimumQuantity,
    ) ||
    requiredProducts.minimumQuantity < 1
  ) {
    throw new CampaignConfigError(
      "requiredProducts.minimumQuantity debe ser un entero positivo.",
    );
  }

  // Valida los productos participantes y sus alias.
  validateNamedItems(
    requiredProducts.products,
    "requiredProducts.products",
  );
}

/**
 * Transforma la configuración de campaña en reglas compatibles
 * con PostgreSQL y el motor de validación existente.
 *
 * Convierte las propiedades camelCase de la configuración a
 * los nombres snake_case utilizados por los validadores.
 *
 * Incluye las reglas deshabilitadas y conserva su estado.
 * El indicador tickets.enabled es declarativo y actualmente
 * no modifica el estado individual de las reglas.
 *
 * @param config Configuración de campaña.
 * @returns Reglas preparadas para su almacenamiento.
 * @throws CampaignConfigError Si la configuración es inválida.
 */
export function buildCampaignValidationRules(
  config: CampaignConfig,
): CampaignValidationRule[] {
  // Impide generar reglas a partir de una configuración inválida.
  validateCampaignConfig(config);

  const {
    purchaseDateRange,
    minimumAmount,
    allowedMerchants,
    requiredProducts,
    duplicateTicket,
  } = config.tickets.validationRules;

  // El validador de comercios utiliza un objeto que relaciona
  // el nombre principal de cada comercio con sus alias.
  // Se omiten los comercios que no tienen alias configurados.
  const aliases = Object.fromEntries(
    allowedMerchants.merchants
      .filter(
        (merchant) =>
          (merchant.aliases?.length ?? 0) > 0,
      )
      .map((merchant) => [
        merchant.name,
        [...(merchant.aliases ?? [])],
      ]),
  );

  return [
    // Regla de vigencia de compra con límites inclusivos.
    {
      rule_type: "purchase_date_range",
      configuration: {
        start_date: purchaseDateRange.startDate,
        end_date: purchaseDateRange.endDate,
      },
      failure_action:
        purchaseDateRange.failureAction,
      is_enabled: purchaseDateRange.enabled,
    },

    // Regla de importe mínimo y moneda requerida.
    {
      rule_type: "minimum_amount",
      configuration: {
        minimum: minimumAmount.minimum,
        currency: minimumAmount.currency,
      },
      failure_action:
        minimumAmount.failureAction,
      is_enabled: minimumAmount.enabled,
    },

    // Regla de comercios permitidos y nombres alternativos.
    {
      rule_type: "allowed_merchants",
      configuration: {
        merchants: allowedMerchants.merchants.map(
          (merchant) => merchant.name,
        ),
        aliases,
      },
      failure_action:
        allowedMerchants.failureAction,
      is_enabled: allowedMerchants.enabled,
    },

    // Regla de productos participantes y cantidad mínima total.
    {
      rule_type: "required_products",
      configuration: {
        products: requiredProducts.products.map(
          (product) => ({
            name: product.name,
            aliases: [...(product.aliases ?? [])],
          }),
        ),
        minimum_quantity:
          requiredProducts.minimumQuantity,
      },
      failure_action:
        requiredProducts.failureAction,
      is_enabled: requiredProducts.enabled,
    },

    // La detección de duplicados no requiere parámetros
    // adicionales de configuración en esta implementación.
    {
      rule_type: "duplicate_ticket",
      configuration: {},
      failure_action:
        duplicateTicket.failureAction,
      is_enabled: duplicateTicket.enabled,
    },
  ];
}
