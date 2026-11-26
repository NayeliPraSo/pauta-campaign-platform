# Registro de decisiones del proyecto

## Confirmadas

- Campañas aisladas por despliegue/base de datos; no multi-tenant.
- Astro + TypeScript (sitio y panel), Express + TypeScript (API), PostgreSQL, pnpm, Veryfi.
- Desarrollo web primero; WhatsApp posterior, con backend independiente del canal.
- Configuración de campaña en TypeScript; identidad visual separada.
- Preguntas en PostgreSQL; importación CSV/JSON; sin editor visual inicial.
- Registro web con correo y contraseña; campos configurables; consentimientos versionados.
- OCR y reglas con aprobación automática para casos claros y revisión humana por excepción.
- Cinco estados técnicos de ticket: `pending`, `processing`, `requires_review`, `approved` y `rejected`; preservar OCR original y auditoría.
- El estado `processing` está contemplado en el modelo, pero todavía no se utiliza en el flujo actual.
- Diferenciar los tickets pendientes de procesamiento o validación (`pending`) de aquellos que requieren intervención humana (`requires_review`).
- Jugar provisionalmente con ticket pendiente; puntos no oficiales hasta aprobación; rechazo invalida puntos.
- Una partida por ticket admitido.
- Trivia hasta fallar o timeout; preguntas aleatorias sin repetir; tiempo/puntos configurables.
- Mecánica alternativa de puntos por compra.
- Periodos configurables; acumulación independiente o total por campaña.
- Ranking visible en vivo, al cierre o solo ganadores, configurable.
- Desempate: primero en alcanzar puntuación, con hora del servidor.
- Un rol de administrador; panel dentro de Astro; exportaciones CSV/Excel.
- Premios entregados fuera de plataforma; sin constructor visual ni permisos complejos.

### Configuración e inicialización de campañas

- La configuración de negocio de la campaña se define en `backend/src/config/campaign.config.ts`.
- La configuración utiliza interfaces TypeScript y validaciones explícitas antes de su inicialización.
- Cada campaña dispone de identificador, nombre, zona horaria y configuración de módulos.
- Las reglas de validación de tickets se almacenan en PostgreSQL, en la tabla `validation_rules`.
- El motor de validación consulta las reglas activas almacenadas en PostgreSQL.
- Las reglas de validación disponibles son `purchase_date_range`, `minimum_amount`, `allowed_merchants`, `required_products` y `duplicate_ticket`.
- Cada regla puede habilitarse o deshabilitarse individualmente.
- Cada regla permite configurar la acción ante un incumplimiento comprobado: `rejected` o `requires_review`.
- Los resultados no concluyentes requieren revisión manual; un incumplimiento comprobado cuya acción sea `rejected` tiene prioridad sobre la revisión manual.
- Si no existen reglas activas, el ticket requiere revisión manual.
- Los comercios y productos admiten alias configurables para reconocer variaciones en los datos extraídos mediante OCR.
- La cantidad mínima de productos requeridos corresponde a la suma de las cantidades de los productos elegibles, no a una cantidad mínima individual por producto.
- La fecha de compra se normaliza al formato `YYYY-MM-DD`, conservando la información original en la respuesta OCR.
- Los rangos de fechas de compra son inclusivos e independientes de las ventanas de participación y los periodos de puntuación.
- La detección de archivos idénticos mediante SHA-256 impide registrar nuevamente un mismo archivo, independientemente del estado del ticket original y de la habilitación de la regla `duplicate_ticket`.
- La inicialización de reglas se realiza explícitamente mediante `pnpm --filter backend campaign:init`.
- La inicialización es transaccional y utiliza un bloqueo de tabla para evitar inicializaciones simultáneas incompatibles.
- Si no existen reglas persistidas, se registra el conjunto completo de reglas configuradas, incluidas las deshabilitadas.
- Si las reglas persistidas coinciden con la configuración, la inicialización finaliza sin modificar los registros existentes.
- Si existen diferencias, reglas faltantes o reglas adicionales, la inicialización informa los conflictos y finaliza con un código de salida distinto de cero, sin sobrescribir las reglas existentes.
- Los cambios en `campaign.config.ts` no se aplican automáticamente a PostgreSQL.
- Se contempla un mecanismo explícito de actualización mediante `campaign:update`, separado de la inicialización y pendiente de implementación.
- La configuración actual corresponde a un ambiente de pruebas y sus valores no constituyen condiciones comerciales definitivas.

## Propuestas, no cerradas

- Nombre definitivo del repositorio y paquetes.
- Ampliación de `campaign.config.ts` para incorporar la configuración de registro, trivia, puntos, periodos, rankings y otros módulos conforme avance su implementación.
- Aplicación efectiva de la zona horaria configurada a las ventanas de participación y periodos.
- Aplicación efectiva de la habilitación de módulos al control de acceso y disponibilidad de funcionalidades.
- Diseño e implementación del comando `campaign:update`.
- Estrategia de auditoría, versionado y trazabilidad de cambios en las reglas de validación.
- Tratamiento de los tickets registrados antes de una actualización de las reglas de campaña.
- Definición de los valores comerciales definitivos de cada campaña, incluidos los rangos de fechas de compra.
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
