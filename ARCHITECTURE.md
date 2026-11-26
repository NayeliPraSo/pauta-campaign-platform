# Arquitectura propuesta — MVP

## Visión

`Astro (sitio + /admin)` → `API Express/TypeScript` → `PostgreSQL`; la API se integra con `Veryfi` para OCR. En una etapa posterior, un adaptador WhatsApp consumirá la misma lógica de negocio.

## Estructura inicial orientativa

```text
campaign-platform/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── styles/
│   │   └── lib/
│   └── public/
├── backend/
│   └── src/
│       ├── modules/
│       │   ├── auth/
│       │   ├── participants/
│       │   ├── tickets/
│       │   ├── trivia/
│       │   ├── scores/
│       │   ├── periods/
│       │   └── admin/
│       ├── integrations/veryfi/
│       ├── config/
│       └── database/
├── PROJECT_CONTEXT.md
├── DEVELOPMENT_RULES.md
├── ARCHITECTURE.md
├── IMPLEMENTATION_PLAN.md
├── DECISIONS.md
├── CLAUDE.md
└── AGENTS.md
```

## Límites de responsabilidad

- `auth`: registro, acceso, sesiones y recuperación de contraseña.
- `participants`: perfil y consentimientos versionados.
- `tickets`: carga, validaciones, duplicados, estados y revisiones; adaptador Veryfi encapsulado.
- `trivia`: banco de preguntas, selección aleatoria, partidas, respuestas y temporizador validado por servidor.
- `scores`: movimientos de puntos y cálculos oficiales/provisionales.
- `periods`: ventanas de participación y cierre de resultados.
- `admin`: consultas, revisión y exportaciones; **no** duplicar reglas de tickets/puntos.
- `config`: definición tipada de la configuración de campaña, validación de parámetros y transformación de reglas al formato de persistencia.
- `database`: conexión a PostgreSQL, migraciones e inicialización explícita de las reglas de campaña.

## Modelo relacional conceptual (sujeto a diseño final)

- `participants`: perfil, correo y credenciales web; campos extra configurables.
- `participant_consents`: participante, versión, tipo de consentimiento y fecha.
- `tickets`: participante, periodo de participación, ruta protegida del archivo, OCR original, datos normalizados, estado y marcas de tiempo.
- `ticket_reviews`: historial de decisiones/correcciones y administrador responsable.
- `validation_rules`: reglas de validación de tickets, configuración JSONB, acción ante incumplimiento, estado de habilitación y marcas de tiempo.
- `questions`: enunciado, opciones JSONB, identificador de respuesta correcta, activo.
- `periods`: nombre, inicio, cierre y estado.
- `game_sessions`: participante, ticket único, periodo, inicio, fin, estado y puntos de trivia.
- `game_answers`: partida, pregunta, respuesta, corrección y tiempos.
- `score_events`: movimientos de puntuación ligados a ticket/partida, con fecha de obtención y estado derivable o controlado.
- `admins`: acceso al panel.

**Nota:** Es un modelo conceptual, no un esquema SQL aprobado. Ajustar claves, índices, restricciones y relaciones antes de migrar. El puntaje confirmado se determina a partir de reglas y estado del ticket; evitar doble contabilización.

## Configuración

### Configuración de negocio

La configuración de negocio se define en el backend mediante archivos TypeScript. Se mantiene separada de la identidad visual, los contenidos del frontend y las credenciales.

Componentes actualmente implementados:

```text
backend/src/
├── config/
│   ├── campaign.config.ts
│   ├── campaign.types.ts
│   ├── validateCampaignConfig.ts
│   └── validateCampaignConfig.test.ts
└── database/
    ├── initializeCampaign.ts
    └── initializeCampaign.test.ts
```

Responsabilidades:

- `campaign.config.ts`: definición de los parámetros y reglas de negocio de la campaña.
- `campaign.types.ts`: interfaces y contratos TypeScript de la configuración.
- `validateCampaignConfig.ts`: validación de parámetros y transformación de reglas al formato requerido por PostgreSQL.
- `validateCampaignConfig.test.ts`: pruebas unitarias de validación, transformación y compatibilidad con el motor de reglas.
- `initializeCampaign.ts`: inicialización explícita, transaccional e idempotente de las reglas.
- `initializeCampaign.test.ts`: pruebas unitarias del proceso de inicialización, detección de conflictos y manejo de errores.

### Alcance actual de la configuración

- Identificador y nombre de campaña.
- Zona horaria.
- Habilitación del módulo de tickets.
- Reglas de validación de comprobantes.

La zona horaria y la habilitación general del módulo de tickets están definidas y validadas, pero todavía no controlan las ventanas de participación ni el acceso al módulo.

La configuración de registro, canales, trivia, puntos, periodos y rankings se incorporará conforme avance la implementación de los módulos correspondientes.

### Configuración del frontend y otros recursos

- `campaign.theme.ts` o equivalente: marca, colores, imágenes y textos en frontend.
- La configuración de módulos del frontend se mantiene separada de la configuración de negocio del backend; todavía no existe sincronización automática entre ambas.
- `questions`: PostgreSQL con importador CSV/JSON, pendiente de implementación.
- `.env`: credenciales y secretos, fuera del control de versiones.

## Persistencia e inicialización de reglas de validación

### Modelo de persistencia implementado

Las reglas de validación se almacenan en la tabla `validation_rules` de PostgreSQL.

Campos principales:

| Campo            | Tipo         | Propósito                                    |
| ---------------- | ------------ | -------------------------------------------- |
| `id`             | BIGINT       | Identificador único generado por PostgreSQL. |
| `rule_type`      | VARCHAR(100) | Tipo único de regla de validación.           |
| `configuration`  | JSONB        | Parámetros específicos de la regla.          |
| `failure_action` | VARCHAR(30)  | Acción ante un incumplimiento comprobado.    |
| `is_enabled`     | BOOLEAN      | Indica si la regla está habilitada.          |
| `created_at`     | TIMESTAMPTZ  | Fecha de creación del registro.              |
| `updated_at`     | TIMESTAMPTZ  | Fecha de última actualización del registro.  |

Restricciones:

- Identificador único mediante clave primaria.
- Un único registro por tipo de regla.
- La configuración debe ser un objeto JSON.
- Las acciones de incumplimiento permitidas son `rejected` y `requires_review`.

### Reglas disponibles

| Tipo de regla         | Configuración persistida                                       |
| --------------------- | -------------------------------------------------------------- |
| `purchase_date_range` | `start_date`, `end_date`                                       |
| `minimum_amount`      | `minimum`, `currency`                                          |
| `allowed_merchants`   | `merchants`, `aliases`                                         |
| `required_products`   | `products`, `minimum_quantity`                                 |
| `duplicate_ticket`    | Objeto vacío; utiliza los datos de duplicidad del comprobante. |

Los rangos de fechas de compra son inclusivos y utilizan fechas normalizadas al formato `YYYY-MM-DD`.

Los comercios y productos admiten alias configurables. La cantidad mínima de productos se calcula sumando las cantidades de los productos elegibles.

### Flujo de inicialización

```text
campaign.config.ts
        │
        ▼
validateCampaignConfig.ts
        │
        ▼
initializeCampaign.ts
        │
        ▼
PostgreSQL: validation_rules
```

La configuración se inicializa explícitamente desde la raíz del proyecto:

```bash
pnpm --filter backend campaign:init
```

El comando realiza las siguientes operaciones:

1. Valida la configuración antes de solicitar una conexión a PostgreSQL.
2. Transforma las reglas al formato de persistencia.
3. Inicia una transacción.
4. Bloquea la tabla `validation_rules` mediante `SHARE ROW EXCLUSIVE MODE` para evitar inicializaciones simultáneas incompatibles.
5. Consulta las reglas existentes.
6. Si la tabla está vacía, registra todas las reglas configuradas, incluidas las deshabilitadas.
7. Si las reglas existentes coinciden con la configuración, finaliza sin modificar los registros.
8. Si existen diferencias, reglas faltantes o adicionales, informa los conflictos y revierte la transacción.
9. Libera la conexión y finaliza con el código de salida correspondiente.

Ante un error durante una transacción iniciada, el inicializador intenta revertir las operaciones realizadas. Si la reversión falla, la conexión se descarta para evitar devolver una conexión potencialmente inconsistente al pool.

El inicializador no ejecuta migraciones ni modifica la estructura de las tablas.

### Actualización de reglas existentes

Modificar `campaign.config.ts` no actualiza automáticamente las reglas persistidas.

El comando `campaign:init` no sobrescribe, elimina ni completa parcialmente configuraciones existentes que presenten diferencias.

Se contempla un comando independiente `campaign:update` para actualizar explícitamente las reglas de campaña. Su implementación, auditoría, versionado y efectos sobre tickets anteriores están pendientes.

## Evaluación automática de tickets

### Flujo de validación

```text
Comprobante registrado
        │
        ▼
Procesamiento OCR mediante Veryfi
        │
        ▼
Normalización y persistencia de datos OCR
        │
        ▼
Consulta de reglas activas mediante rulesRepository.ts
        │
        ▼
Motor de validación de tickets
        │
        ▼
Decisión automática y registro de auditoría
```

El motor de validación utiliza las reglas activas almacenadas en PostgreSQL, no directamente los valores definidos en `campaign.config.ts`.

### Criterios de decisión

- `approved`: existe al menos una regla activa y todas las reglas activas se cumplen de manera concluyente.
- `rejected`: existe al menos un incumplimiento comprobado cuya acción configurada es `rejected`.
- `requires_review`: existe un resultado no concluyente, un incumplimiento cuya acción es `requires_review` o no existen reglas activas, siempre que no exista otro incumplimiento que determine el rechazo.
- `pending`: el comprobante permanece pendiente cuando no se ha completado correctamente su procesamiento OCR o su validación automática.
- `processing`: estado contemplado en el modelo, todavía no utilizado en el flujo actual.

El rechazo por un incumplimiento comprobado tiene prioridad sobre la revisión manual.

La decisión automática y su registro en `ticket_reviews` se realizan dentro de una misma transacción.

### Protección contra duplicados

La detección de archivos idénticos mediante SHA-256 se realiza antes de registrar un nuevo comprobante y se refuerza mediante una restricción de unicidad en PostgreSQL.

Esta protección opera independientemente de la habilitación de la regla `duplicate_ticket` y del estado del ticket original.

Cuando la regla `duplicate_ticket` está habilitada, las señales de duplicidad proporcionadas por Veryfi se evalúan adicionalmente. Si no existe información suficiente para determinar de manera concluyente la duplicidad, el comprobante requiere revisión manual, salvo que otra regla determine su rechazo.

## Invariantes

- Validación de identidad y permisos siempre en backend.
- No repetir preguntas dentro de una partida.
- Una sola partida por ticket; proteger contra solicitudes simultáneas.
- Una aprobación tardía no cambia el instante histórico en que se obtuvo el puntaje.
- Resultados definitivos solo después de revisar pendientes aplicables.
- No borrar evidencia de tickets o partidas invalidadas.

## Decisiones técnicas aún abiertas

- Estrategia definitiva de almacenamiento privado de comprobantes y política de retención.
- Ampliación de las reglas de validación conforme a los requisitos de cada campaña.
- Estrategia definitiva de sesiones y servicio de correo.
- Límites de carga definitivos por campaña.
- Semántica de ventanas de participación y periodos de puntuación.
- Aplicación efectiva de la zona horaria configurada.
- Control de acceso y disponibilidad de módulos según la configuración de campaña.
- Implementación del comando `campaign:update`.
- Auditoría y versionado de las actualizaciones de reglas.
- Tratamiento de tickets registrados antes de cambios en las reglas de validación.
- Configuración de los módulos de registro, trivia, puntos, periodos y rankings.

Resolver estas decisiones antes de implementar cada área, sin adelantar complejidad.
