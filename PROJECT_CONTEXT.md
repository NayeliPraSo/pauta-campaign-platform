# Contexto del proyecto — Plataforma reutilizable de campañas promocionales

## Propósito

Construir una base técnica reutilizable para campañas promocionales de Pauta Creativa, evitando desarrollar cada promoción desde cero. Cada campaña tendrá su propio despliegue, dominio y base de datos; **no es una plataforma multi-tenant ni un constructor visual de campañas**.

## Estado actual del proyecto

- La plataforma se encuentra en una etapa de construcción y validación técnica.
- El entorno actual, incluida la base de datos PostgreSQL, corresponde a un ambiente de pruebas.
- La configuración, los participantes, los tickets y las reglas utilizados actualmente tienen fines de prueba.
- Los valores de configuración actuales no representan las condiciones definitivas de una campaña comercial.
- Todavía no existe un entorno de producción autorizado.

## Prioridades

1. MVP pequeño, funcional y seguro; evitar sobreingeniería.
2. Reutilizar módulos de registro, tickets, validación, trivia, puntos, periodos y administración.
3. Personalizar reglas, campos, identidad visual y contenidos por campaña.
4. Implementar y comprobar primero el flujo web; WhatsApp será una etapa posterior, pero el backend debe ser independiente del canal.
5. Trabajar incrementalmente y no programar funciones que no se hayan acordado.

## Tecnologías acordadas

- Frontend y panel administrativo: Astro + TypeScript.
- API: Node.js + Express + TypeScript.
- Base de datos: PostgreSQL.
- OCR de comprobantes: Veryfi.
- Paquetes: pnpm.
- Integración WhatsApp: adaptador posterior; no elegir proveedor ni API sin validar requisitos vigentes.
- El usuario trabaja habitualmente en WSL Ubuntu y VS Code.

## Modalidades de campaña contempladas

1. Sitio web participativo.
2. Landing informativa + participación por WhatsApp.
3. Sitio web y WhatsApp con backend compartido y vinculación verificada de identidades.
4. Solo WhatsApp.

**Primera entrega:** participación web. Los otros canales son objetivos arquitectónicos, no compromisos de implementación del primer MVP.

## Registro

- Campos visibles y obligatorios configurables por campaña.
- En web, acceso con correo y contraseña; contraseñas con hash seguro y recuperación mediante correo.
- Registrar aceptación de términos y aviso de privacidad con su versión y fecha.
- En WhatsApp, identificación por número; la vinculación web/WhatsApp requerirá verificación, nunca asumir identidad por coincidencia de datos.

## Tickets

- Subida de comprobante; extracción OCR con Veryfi y validación de comercio, fecha, productos, importe y posibles duplicados según reglas de campaña.
- Estados técnicos de los tickets:
  - `pending`: comprobante registrado, pendiente de procesamiento OCR o validación.
  - `processing`: comprobante en procesamiento; estado contemplado en el modelo, todavía no utilizado en el flujo actual.
  - `requires_review`: comprobante que requiere revisión manual.
  - `approved`: comprobante aprobado.
  - `rejected`: comprobante rechazado.
- Aprobar automáticamente los casos claramente válidos; rechazar automáticamente solo incumplimientos comprobados; enviar ambigüedades a revisión humana.
- Las reglas de validación pueden habilitarse o deshabilitarse individualmente según la campaña.
- Cada regla permite configurar la acción ante un incumplimiento comprobado: rechazo o revisión manual.
- Cuando una regla no puede evaluarse de manera concluyente, el comprobante requiere revisión manual, salvo que exista otro incumplimiento comprobado que determine su rechazo.
- Alertas de OCR/fraude no equivalen por sí solas a fraude demostrado.
- Guardar imagen original, respuesta original de Veryfi, datos normalizados y correcciones/historial.
- Normalizar la fecha de compra al formato `YYYY-MM-DD`, conservando la información original en la respuesta OCR.
- Los rangos de fechas de compra son inclusivos y son independientes de los periodos de participación.
- Un mismo archivo de comprobante no puede registrarse nuevamente, incluso cuando el ticket original haya sido rechazado.
- Un mismo ticket no debe habilitar múltiples partidas ni puntos duplicados.
- El participante **puede jugar provisionalmente mientras su ticket está pendiente**; los puntos no cuentan en rankings oficiales hasta la aprobación. El rechazo invalida los puntos sin borrar la evidencia de la partida.

## Mecánicas iniciales

- Puntos directos por compra conforme a reglas configuradas por campaña.
- Trivia asociada a ticket: una partida por ticket admitido; preguntas aleatorias sin repetición dentro de la partida; se continúa hasta respuesta incorrecta o tiempo agotado; tiempo y puntos por acierto configurables.
- Si se agotan las preguntas sin fallar, finalizar la partida conservando los puntos.
- El servidor controla respuestas, tiempo y puntuación; nunca revelar respuestas correctas anticipadamente al cliente.

## Periodos, rankings y ganadores

- Periodos con inicio/cierre configurables.
- Acumulación configurable: independiente por periodo o acumulada a lo largo de la campaña.
- Ranking visible en vivo, después del cierre o solo ganadores, configurable por campaña.
- Solo puntos confirmados cuentan en el ranking oficial.
- Desempate: primero en alcanzar la puntuación (hora registrada por servidor, asociada al logro, no a la aprobación tardía del ticket).
- Cierre de participaciones distinto de publicación definitiva de resultados; resolver tickets pendientes antes de cerrar resultados.
- Identificación y exportación de posibles ganadores; gestión de entrega de premios fuera del sistema.

## Administración MVP

- Un único tipo de administrador, con autenticación propia.
- Consulta/búsqueda de participantes; bandeja de tickets que requieren atención; consulta de historial y OCR; aprobación/rechazo/corrección con auditoría; puntos y rankings; exportación CSV/Excel.
- Panel en el mismo proyecto Astro bajo rutas protegidas (por ejemplo, /admin); autorización real siempre en API.
- Evitar editor visual de campañas, roles avanzados, logística de premios y estadísticas sofisticadas.

## Configuración

- Reglas de negocio en `backend/src/config/campaign.config.ts`, interpretadas y validadas en el backend.
- Configuración tipada mediante interfaces TypeScript y validaciones explícitas antes de su inicialización.
- La configuración actualmente implementada contempla:
  - Identificador de campaña.
  - Nombre de campaña.
  - Zona horaria.
  - Habilitación del módulo de tickets.
  - Reglas de validación de comprobantes.
- Las reglas de validación de tickets disponibles son:
  - Rango de fechas de compra.
  - Importe mínimo y moneda.
  - Comercios permitidos y sus alias.
  - Productos requeridos, sus alias y cantidad mínima.
  - Detección de comprobantes duplicados.
- Cada regla dispone de una configuración individual, estado de habilitación y acción ante incumplimientos comprobados.
- Las reglas se inicializan explícitamente en PostgreSQL mediante `pnpm --filter backend campaign:init`.
- Las reglas persistidas en `validation_rules` son utilizadas por el motor de validación de tickets.
- La inicialización es transaccional e idempotente: registra las reglas cuando la tabla está vacía y no modifica registros cuando la configuración existente coincide.
- Si existen diferencias entre la configuración del archivo y las reglas persistidas, la inicialización se detiene e informa los conflictos sin sobrescribir los registros existentes.
- Modificar el archivo de configuración no actualiza automáticamente las reglas almacenadas en PostgreSQL.
- La actualización explícita de reglas mediante `campaign:update` se contempla como funcionalidad futura; su implementación, auditoría y versionado están pendientes.
- La zona horaria y la habilitación general del módulo de tickets forman parte de la configuración actual, pero todavía no controlan las ventanas de participación ni restringen el acceso al módulo.
- Las configuraciones de registro, trivia, puntos, periodos, rankings y otros módulos se incorporarán conforme avance su implementación.
- Identidad visual y textos en `campaign.theme.ts` o equivalente del frontend.
- Preguntas de trivia en PostgreSQL, importables desde CSV/JSON; no editor visual de preguntas en MVP.
- Credenciales, claves, secretos y datos sensibles en variables de entorno, nunca en archivos públicos ni en repositorio.

## Antecedente reutilizable

Existe un prototipo previo de integración Veryfi en un proyecto local llamado `veryfi-integration`, con frontend Astro y backend Express/TypeScript. **No asumir que sus archivos están disponibles**; inspeccionarlos si el usuario proporciona la ruta o los comparte, antes de reutilizar código.

## Fuera de alcance del primer MVP

Multi-tenancy, constructor visual, permisos granulares, distribución automática de premios, analítica avanzada, motor genérico de reglas, integración WhatsApp operativa y automatizaciones no solicitadas.
