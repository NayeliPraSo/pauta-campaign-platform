# Pauta Campaign Platform

Plataforma modular reutilizable para campañas promocionales. Su objetivo es facilitar el desarrollo de campañas con registro de participantes, carga y validación de comprobantes, minijuegos, puntos, rankings y administración, mediante módulos configurables y reutilizables.

> **Estado:** MVP en desarrollo (etapa inicial, participación web).

## ¿De qué trata?

Cada campaña cuenta con su propio despliegue, dominio y base de datos, pero comparte una base técnica común: registro de participantes, validación de tickets con OCR, trivia, puntos, periodos, rankings y panel administrativo. Lo que cambia entre campañas son las reglas, los campos de registro, la identidad visual y los contenidos.

No es una plataforma multi-tenant ni un constructor visual de campañas.

## Alcance previsto del MVP

Las funcionalidades descritas a continuación forman parte del alcance
planificado. Su inclusión en esta sección no implica que ya estén
implementadas.

**Incluye**

- Registro y acceso web con correo y contraseña, con campos configurables y consentimientos versionados (términos y aviso de privacidad).
- Carga de tickets y extracción de datos mediante OCR (Veryfi), con validación de comercio, fecha, productos, importe y duplicados.
- Estados de ticket: aprobado, pendiente de revisión y rechazado. Aprobación automática en casos claros y revisión humana por excepción.
- Trivia asociada al ticket: una partida por ticket, preguntas aleatorias sin repetición, hasta fallar o agotar el tiempo; tiempo y puntos configurables.
- Puntos por compra o por trivia, según la configuración de la campaña.
- Partida provisional con ticket pendiente: los puntos no cuentan en el ranking oficial hasta la aprobación, y el rechazo los invalida sin borrar la evidencia.
- Periodos configurables, con acumulación independiente o total, y ranking visible en vivo, al cierre o solo para ganadores.
- Desempate por quién alcanzó primero la puntuación (hora del servidor).
- Panel de administración (un solo rol) con búsqueda de participantes, bandeja de tickets, auditoría de decisiones y exportación a CSV/Excel.

**Fuera del alcance inicial**

- Multi-tenancy y constructor visual de campañas.
- Permisos granulares y roles avanzados.
- Entrega o logística automática de premios (se gestiona fuera de la plataforma).
- Analítica avanzada y motor genérico de reglas.
- Integración operativa con WhatsApp (etapa posterior; el backend se diseña independiente del canal).

## Stack tecnológico

| Capa                   | Tecnología                     |
| :--------------------- | :----------------------------- |
| Sitio y panel `/admin` | Astro + TypeScript             |
| API                    | Node.js + Express + TypeScript |
| Base de datos          | PostgreSQL                     |
| OCR de comprobantes    | Veryfi                         |
| Gestor de paquetes     | pnpm (workspace)               |

## Arquitectura

```text
Astro (sitio + /admin)  →  API Express/TypeScript  →  PostgreSQL
                                   ↓
                               Veryfi (OCR)
```

La lógica de negocio vive en el backend, dividida en módulos pequeños: `auth`, `participants`, `tickets`, `trivia`, `scores`, `periods` y `admin`. Más detalle en [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Estructura del repositorio

```text
├── frontend/    # Aplicación Astro
├── backend/     # API Express y PostgreSQL
├── README.md    # Documentación principal
├── AGENTS.md    # Instrucciones para asistentes
├── CLAUDE.md    # Instrucciones para Claude Code
└── *.md         # Arquitectura, decisiones y planificación
```

## Configuración por campaña

- `campaign.config.ts`: reglas de negocio (fechas, canales, campos de registro, mecánica, periodos, puntos y ranking), interpretadas por el backend.
- `campaign.theme.ts`: marca, colores, imágenes y textos del frontend.
- Preguntas de trivia: en PostgreSQL, con importación desde CSV/JSON.
- `.env`: credenciales y secretos, fuera del control de versiones (ver `backend/.env.example`).

## Primeros pasos

Requisitos: Node.js `>=22.22.0`, pnpm y una instancia de PostgreSQL.

```sh
pnpm install
cp backend/.env.example backend/.env   # completar credenciales de PostgreSQL

pnpm dev:backend    # API en http://localhost:3000
pnpm dev:frontend   # sitio en http://localhost:4321
```

Otros comandos útiles:

```sh
pnpm check   # verificación de tipos (backend y frontend)
pnpm build   # compilación de backend y frontend
```

Verificación rápida de la API: `GET http://localhost:3000/api/health`.

## Hoja de ruta

0. Preparación del entorno
1. Registro web y autenticación
2. Tickets y OCR con Veryfi
3. Trivia
4. Puntos, periodos y rankings
5. Administración y exportaciones
6. _(Posterior)_ Canal WhatsApp

El detalle de cada etapa está en [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md).

## Documentación del proyecto

| Archivo                                                 | Contenido                                                             |
| :------------------------------------------------------ | :-------------------------------------------------------------------- |
| [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md)            | Propósito, alcance y requisitos                                       |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md)                  | Diseño modular y modelo conceptual                                    |
| [`DECISIONS.md`](./DECISIONS.md)                        | Decisiones confirmadas y pendientes                                   |
| [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)    | Etapas y criterios de aceptación                                      |
| [`DEVELOPMENT_RULES.md`](./DEVELOPMENT_RULES.md)        | Reglas de desarrollo y seguridad                                      |
| [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md) | Instrucciones para asistentes de programación (Claude Code, OpenCode) |

Al cerrar una regla de negocio, actualizar `DECISIONS.md` y sincronizar los demás documentos afectados. No incluir credenciales ni datos de campañas reales en el repositorio.

## Licencia

Por definir.

## Estado actual de implementación

**Funcionalidades implementadas y verificadas:**

- Registro e inicio de sesión de participantes.
- Autenticación mediante sesiones.
- Carga de comprobantes JPG, PNG y PDF, con límite de 10 MB.
- Validación básica del contenido de los archivos.
- Almacenamiento privado de comprobantes.
- Detección y rechazo de archivos duplicados.
- Registro de tickets en PostgreSQL.
- Consulta del historial de comprobantes por participante.
- Visualización del estado de cada comprobante.

**Funcionalidades pendientes:**

- Procesamiento OCR mediante Veryfi.
- Validaciones comerciales de los comprobantes.
- Revisión administrativa y aprobación o rechazo de tickets.
- Mecánicas de juego, puntos y rankings.
- Panel administrativo y reportes.
