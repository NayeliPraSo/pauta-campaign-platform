# Contexto del proyecto — Plataforma reutilizable de campañas promocionales

## Propósito
Construir una base técnica reutilizable para campañas promocionales de Pauta Creativa, evitando desarrollar cada promoción desde cero. Cada campaña tendrá su propio despliegue, dominio y base de datos; **no es una plataforma multi-tenant ni un constructor visual de campañas**.

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
- Estados: aprobado, pendiente de revisión, rechazado.
- Aprobar automáticamente los casos claramente válidos; rechazar automáticamente solo incumplimientos comprobados; enviar ambigüedades a revisión humana.
- Alertas de OCR/fraude no equivalen por sí solas a fraude demostrado.
- Guardar imagen original, respuesta original de Veryfi, datos normalizados y correcciones/historial.
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
- Reglas de negocio en `campaign.config.ts`, interpretadas y validadas en el backend.
- Identidad visual y textos en `campaign.theme.ts` o equivalente del frontend.
- Preguntas de trivia en PostgreSQL, importables desde CSV/JSON; no editor visual de preguntas en MVP.
- Credenciales, claves, secretos y datos sensibles en variables de entorno, nunca en archivos públicos ni en repositorio.

## Antecedente reutilizable
Existe un prototipo previo de integración Veryfi en un proyecto local llamado `veryfi-integration`, con frontend Astro y backend Express/TypeScript. **No asumir que sus archivos están disponibles**; inspeccionarlos si el usuario proporciona la ruta o los comparte, antes de reutilizar código.

## Fuera de alcance del primer MVP
Multi-tenancy, constructor visual, permisos granulares, distribución automática de premios, analítica avanzada, motor genérico de reglas, integración WhatsApp operativa y automatizaciones no solicitadas.
