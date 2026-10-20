# Reglas obligatorias de desarrollo para asistentes de IA

## Forma de trabajo
1. Leer `PROJECT_CONTEXT.md`, `DECISIONS.md`, `ARCHITECTURE.md` e `IMPLEMENTATION_PLAN.md` antes de proponer cambios importantes.
2. Respetar el alcance del MVP. No añadir dependencias, frameworks, patrones, servicios o funcionalidades sin necesidad demostrada.
3. Trabajar **una etapa y una tarea concreta a la vez**. Antes de codificar, explicar brevemente objetivo, archivos afectados y validación prevista.
4. Si falta una regla de negocio, señalarla y preguntar; **no inventarla**. Las decisiones pendientes de `DECISIONS.md` no están autorizadas como definitivas.
5. No reescribir archivos completos ni refactorizar código no relacionado salvo petición expresa.
6. Priorizar código simple, tipado, legible, mantenible y reutilizable. Evitar microservicios y abstracciones prematuras.
7. Usar `pnpm`; no introducir npm/yarn ni lockfiles adicionales.
8. Al terminar cada tarea, resumir archivos modificados, pruebas ejecutadas, resultados y pendientes. Nunca afirmar que una prueba pasó sin ejecutarla.
9. Si no se dispone de acceso a un archivo, servidor, herramienta o credencial, decirlo y solicitar lo necesario; no inventar estados ni salidas.
10. No realizar despliegues, migraciones destructivas ni operaciones con datos reales sin autorización explícita.

## Arquitectura
- Frontend y panel administrativo: Astro + TypeScript; backend: Express + TypeScript; PostgreSQL.
- Mantener la lógica de negocio en el backend, no duplicarla en frontend ni en un futuro adaptador WhatsApp.
- Una campaña por despliegue/base de datos. No implementar multi-tenancy.
- Configuración de negocio separada de la identidad visual y de los secretos.
- Módulos pequeños por responsabilidad, sin convertirlos en microservicios.
- Preguntas y respuestas correctas se almacenan en PostgreSQL; no exponer las soluciones al cliente.

## Seguridad y privacidad
- Validar entradas en el servidor; parametrizar consultas SQL y aplicar límites de tamaño/tipo a archivos.
- Hash seguro de contraseñas; autenticación y autorización verificadas en API.
- No registrar ni mostrar secretos, contraseñas, tokens, documentos personales ni imágenes de tickets innecesariamente.
- Tratar OCR y respuestas de proveedores como datos no confiables. No tomar alertas como pruebas concluyentes de fraude.
- Evitar duplicados y condiciones de carrera mediante restricciones/transacciones cuando corresponda.
- Usar marcas de tiempo del servidor para partidas, respuestas, periodos y desempates.
- Registrar correcciones y decisiones administrativas sin destruir evidencia original.
- Aplicar principio de mínimo acceso a archivos, credenciales y datos personales.
- No guardar archivos sensibles en carpetas públicas sin protección.

## Reglas funcionales que no deben alterarse
- Una partida de trivia por ticket admitido.
- Trivia hasta fallar o agotar tiempo; preguntas aleatorias no repetidas en la partida.
- Se permite partida provisional con ticket pendiente; puntos pendientes no cuentan en ranking oficial.
- Ticket rechazado invalida los puntos, pero no borra el historial.
- Puntuación por periodo o acumulada, según configuración.
- Visibilidad de ranking configurable.
- Desempate: quien primero alcanzó la puntuación, no quien primero recibió aprobación del ticket.
- Un solo rol de administrador para MVP; revisión humana por excepción.

## Pruebas y entregas
- Añadir pruebas proporcionales a los riesgos: validación de tickets, duplicados, puntos provisionales, límites de partida, periodos y desempates.
- Verificar TypeScript, build y pruebas existentes antes de declarar una etapa terminada.
- Documentar comandos exactos y variables de entorno requeridas; usar `.env.example` sin valores reales.
- Mantener migraciones versionadas y reversibles cuando sea viable; nunca modificar producción por suposición.

## Comunicación
- Responder en español, con pasos concretos y sin explicaciones excesivas.
- Preferir diffs o cambios localizados; entregar archivos completos solo si el usuario lo pide o facilita la revisión.
- Señalar claramente qué es decisión confirmada, propuesta o pendiente.
