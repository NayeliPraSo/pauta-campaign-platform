# Plan incremental de implementación

**Estado actual:** planeación; no hay autorización implícita para empezar a programar. Cada etapa requiere confirmación del usuario.

## Etapa 0 — Preparación
- Revisar estos documentos y confirmar pendientes bloqueantes.
- Inicializar repositorio y carpetas solo cuando el usuario lo indique.
- Definir scripts pnpm, TypeScript, variables de entorno de ejemplo y conexión local a PostgreSQL.
**Listo cuando:** el entorno arranque, el proyecto compile y haya instrucciones reproducibles.

## Etapa 1 — Registro web
- Esquema inicial de participantes, consentimientos y administradores.
- Registro configurable, login, sesión y recuperación de contraseña.
- Rutas privadas de participante y panel.
**Listo cuando:** flujos válidos e inválidos estén probados y las contraseñas no se guarden en claro.

## Etapa 2 — Tickets y Veryfi
- Subida segura, OCR, normalización y reglas configurables.
- Detección de duplicados; aprobación automática segura; revisión por excepción.
- Bandeja admin y auditoría de correcciones/decisiones.
**Listo cuando:** un ticket aprobado, pendiente, rechazado y duplicado tenga comportamiento correcto y verificable.

## Etapa 3 — Trivia
- Importador de preguntas CSV/JSON a PostgreSQL.
- Selección aleatoria sin repetir, partida por ticket y tiempo validado en servidor.
- Fin por error, timeout o agotamiento de preguntas.
- Permitir partida provisional si ticket pendiente.
**Listo cuando:** respuestas, límites, duplicados y reintentos indebidos estén probados.

## Etapa 4 — Puntos y periodos
- Puntos por trivia o compra según configuración.
- Confirmación/invalidez asociada a estado del ticket.
- Periodos, acumulación independiente/global, rankings y desempate.
- Separar cierre de participación de cierre de resultados.
**Listo cuando:** ranking y desempate sean correctos con tickets aprobados tardíamente y rechazados.

## Etapa 5 — Administración y exportaciones
- Búsquedas, filtros y paginación simples.
- Consulta de participantes, tickets, partidas y clasificaciones.
- Exportaciones CSV/Excel y lista de posibles ganadores.
**Listo cuando:** operación básica se haga sin consultar manualmente la base de datos.

## Etapa posterior — WhatsApp
- Elegir/verificar proveedor, webhooks y requisitos vigentes.
- Identificación y vinculación segura con cuentas web.
- Adaptar interacción de tickets/trivia al canal sin duplicar reglas de negocio.
**No forma parte del primer MVP web.**

## Protocolo por tarea para un asistente
1. Leer contexto, reglas, decisiones y plan.
2. Identificar etapa y objetivo exactos.
3. Explicar cambio mínimo y archivos afectados.
4. Esperar aprobación si implica nuevas decisiones, dependencias o cambios arquitectónicos.
5. Implementar solo lo solicitado.
6. Ejecutar verificaciones disponibles y reportar resultados reales.
7. Actualizar documentación de decisiones si el usuario confirma cambios.
