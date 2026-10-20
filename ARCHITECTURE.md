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

## Modelo relacional conceptual (sujeto a diseño final)
- `participants`: perfil, correo y credenciales web; campos extra configurables.
- `participant_consents`: participante, versión, tipo de consentimiento y fecha.
- `tickets`: participante, periodo de participación, ruta protegida del archivo, OCR original, datos normalizados, estado y marcas de tiempo.
- `ticket_reviews`: historial de decisiones/correcciones y administrador responsable.
- `questions`: enunciado, opciones JSONB, identificador de respuesta correcta, activo.
- `periods`: nombre, inicio, cierre y estado.
- `game_sessions`: participante, ticket único, periodo, inicio, fin, estado y puntos de trivia.
- `game_answers`: partida, pregunta, respuesta, corrección y tiempos.
- `score_events`: movimientos de puntuación ligados a ticket/partida, con fecha de obtención y estado derivable o controlado.
- `admins`: acceso al panel.

**Nota:** Es un modelo conceptual, no un esquema SQL aprobado. Ajustar claves, índices, restricciones y relaciones antes de migrar. El puntaje confirmado se determina a partir de reglas y estado del ticket; evitar doble contabilización.

## Configuración
- `campaign.config.ts`: fechas, canales, campos de registro, validaciones, mecánica, periodos, puntos y ranking; consumida en backend.
- `campaign.theme.ts`: marca, colores, imágenes y textos en frontend.
- `questions`: PostgreSQL con importador CSV/JSON.
- `.env`: credenciales y secretos, fuera del control de versiones.

## Invariantes
- Validación de identidad y permisos siempre en backend.
- No repetir preguntas dentro de una partida.
- Una sola partida por ticket; proteger contra solicitudes simultáneas.
- Una aprobación tardía no cambia el instante histórico en que se obtuvo el puntaje.
- Resultados definitivos solo después de revisar pendientes aplicables.
- No borrar evidencia de tickets o partidas invalidadas.

## Decisiones técnicas aún abiertas
Almacenamiento privado de imágenes, formato preciso de reglas de productos/comercios, estrategia de sesiones, servicio de correo, límites de carga, semántica de periodos y tratamiento de cambios de configuración durante campañas activas. Resolver antes de implementar cada área, sin adelantar complejidad.
