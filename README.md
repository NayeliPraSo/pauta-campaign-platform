# Documentación inicial para asistentes de programación

Coloca estos archivos en la **raíz del repositorio**. Claude Code utilizará `CLAUDE.md` como guía de entrada y OpenCode puede utilizar `AGENTS.md`; ambos remiten a la misma documentación compartida.

## Archivos
- `PROJECT_CONTEXT.md`: propósito, alcance y requisitos.
- `DEVELOPMENT_RULES.md`: reglas obligatorias de trabajo y seguridad.
- `ARCHITECTURE.md`: diseño modular y modelo conceptual.
- `IMPLEMENTATION_PLAN.md`: etapas y criterios de aceptación.
- `DECISIONS.md`: decisiones confirmadas y pendientes.
- `CLAUDE.md`: entrada para Claude Code.
- `AGENTS.md`: entrada para OpenCode y agentes compatibles.

## Primer mensaje sugerido para el asistente
> Lee `CLAUDE.md` (o `AGENTS.md`) y todos los documentos que referencia. Resume el objetivo del MVP, las decisiones confirmadas y los pendientes que bloquearían la etapa 0. No crees archivos de código todavía. Espera mi confirmación antes de iniciar.

## Mantenimiento
Actualizar `DECISIONS.md` cuando se cierre una regla de negocio; sincronizar los demás documentos afectados. No copiar credenciales ni datos de campañas reales a estos documentos.
