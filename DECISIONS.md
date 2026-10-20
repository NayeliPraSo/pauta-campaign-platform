# Registro de decisiones del proyecto

## Confirmadas
- Campañas aisladas por despliegue/base de datos; no multi-tenant.
- Astro + TypeScript (sitio y panel), Express + TypeScript (API), PostgreSQL, pnpm, Veryfi.
- Desarrollo web primero; WhatsApp posterior, con backend independiente del canal.
- Configuración de campaña en TypeScript; identidad visual separada.
- Preguntas en PostgreSQL; importación CSV/JSON; sin editor visual inicial.
- Registro web con correo y contraseña; campos configurables; consentimientos versionados.
- OCR y reglas con aprobación automática para casos claros y revisión humana por excepción.
- Tres estados de ticket: aprobado, pendiente, rechazado; preservar OCR original y auditoría.
- Jugar provisionalmente con ticket pendiente; puntos no oficiales hasta aprobación; rechazo invalida puntos.
- Una partida por ticket admitido.
- Trivia hasta fallar o timeout; preguntas aleatorias sin repetir; tiempo/puntos configurables.
- Mecánica alternativa de puntos por compra.
- Periodos configurables; acumulación independiente o total por campaña.
- Ranking visible en vivo, al cierre o solo ganadores, configurable.
- Desempate: primero en alcanzar puntuación, con hora del servidor.
- Un rol de administrador; panel dentro de Astro; exportaciones CSV/Excel.
- Premios entregados fuera de plataforma; sin constructor visual ni permisos complejos.

## Propuestas, no cerradas
- Nombre definitivo del repositorio y paquetes.
- Forma exacta del archivo `campaign.config.ts` y validación de su esquema.
- Estructura y campos SQL finales; `score_events` como opción para movimientos de puntos.
- Almacenamiento privado de tickets y política de retención/eliminación.
- Estrategia de autenticación y sesiones; proveedor SMTP.
- Reglas específicas de duplicados, umbrales de autoaprobación y límites de archivo.
- Manejo de periodo si un ticket se sube cerca del cierre y se valida después.
- Tratamiento de empate exacto también en tiempo, si llegara a ocurrir.
- Qué ocurre con una trivia interrumpida por desconexión o abandono.
- Comportamiento de campañas con puntos por compra y trivia combinados; no asumir simultaneidad sin requerimiento.

## Regla de actualización
Cuando el usuario confirme una decisión nueva, moverla a **Confirmadas**, registrar su efecto y evitar contradicciones con `PROJECT_CONTEXT.md`, `ARCHITECTURE.md` e `IMPLEMENTATION_PLAN.md`.
