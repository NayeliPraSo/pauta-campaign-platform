# Plan incremental de implementación

**Estado actual:** implementación incremental del MVP en un ambiente de pruebas. Actualmente se trabaja en la Etapa 2 — Tickets y Veryfi. La actividad A4 — Configuración e inicialización de reglas de campaña ha concluido su implementación y verificación técnica, y está pendiente de registro en Git. La actividad A5 todavía no ha iniciado.

Cada nueva etapa o actividad requiere confirmación del usuario. El avance de la implementación no implica autorización para realizar despliegues, modificar entornos de producción o incorporar funcionalidades fuera del alcance acordado.

## Seguimiento general

| Etapa     | Descripción                        | Estado                 |
| --------- | ---------------------------------- | ---------------------- |
| 0         | Preparación del proyecto y entorno | Completada             |
| 1         | Registro web y autenticación       | Implementación parcial |
| 2         | Tickets y Veryfi                   | En progreso            |
| 3         | Trivia                             | Pendiente              |
| 4         | Puntos y periodos                  | Pendiente              |
| 5         | Administración y exportaciones     | Pendiente              |
| Posterior | Integración WhatsApp               | Fuera del primer MVP   |

Los estados representan el avance técnico actual. Una etapa no se considera completamente terminada hasta satisfacer sus criterios de aceptación y ejecutar las verificaciones correspondientes.

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

### Seguimiento de actividades

| Actividad | Descripción                                         | Estado     |
| --------- | --------------------------------------------------- | ---------- |
| A1        | Integración de validación automática de tickets     | Completada |
| A2        | Resultados de validación en la API                  | Completada |
| A3        | Historial y presentación de tickets                 | Completada |
| A4        | Configuración e inicialización de reglas de campaña | En cierre  |
| A5        | Pruebas integrales del flujo de tickets             | Pendiente  |
| A6        | Bandeja administrativa y revisión manual            | Pendiente  |

### A1 — Integración de validación automática de tickets

- Integración del motor de validación con el registro de comprobantes.
- Recuperación de reglas activas desde PostgreSQL.
- Evaluación de duplicados mediante SHA-256 y señales de Veryfi.
- Exclusión del ticket actual durante la búsqueda de duplicados.
- Decisiones automáticas de aprobación, rechazo o revisión manual.
- Persistencia transaccional de decisiones y registros de auditoría.
- Conservación del estado pendiente cuando no se completa correctamente el procesamiento OCR o la validación.

**Estado:** completada a nivel de implementación y pruebas unitarias. La comprobación integral con el flujo real de participación corresponde a A5.

### A2 — Resultados de validación en la API

- Mensajes de registro según el estado del comprobante.
- Incorporación de comercio, fecha de compra, importe, moneda y mensaje de estado al historial del participante.
- Conservación de los controles de autenticación y propiedad de los comprobantes.
- Exclusión de información interna o sensible en las respuestas públicas.
- Pruebas unitarias del repositorio y del registro de comprobantes mediante la API.

**Estado:** completada. Las pruebas HTTP específicas del historial autenticado quedan pendientes para A5.

### A3 — Historial y presentación de tickets

- Presentación diferenciada de los cinco estados técnicos de tickets.
- Mensajes de resultado según el estado devuelto por la API.
- Visualización de comercio, fecha de compra, importe y moneda.
- Manejo de datos no disponibles.
- Presentación adaptable a dispositivos móviles y escritorio.
- Conservación de los controles existentes de carga de comprobantes.

**Estado:** completada a nivel de implementación, comprobaciones estáticas y revisión visual. La verificación integral de carga y actualización del historial corresponde a A5.

### A4 — Configuración e inicialización de reglas de campaña

- Configuración tipada de campaña mediante TypeScript.
- Validación de parámetros y transformación al formato de persistencia.
- Configuración individual de las cinco reglas de validación disponibles.
- Alias configurables para comercios y productos.
- Inicialización explícita de reglas mediante:

```bash
pnpm --filter backend campaign:init
```

- Inicialización transaccional e idempotente.
- Detección de diferencias sin sobrescribir configuraciones existentes.
- Manejo de errores, reversión de transacciones y descarte de conexiones cuando corresponde.
- Documentación de código en español.

#### Verificaciones realizadas

- 27 pruebas automatizadas de configuración, validación y transformación de reglas.
- 18 pruebas unitarias del inicializador de campaña.
- Total: 45 pruebas automatizadas exitosas.
- Comprobaciones estáticas mediante `pnpm check`.
- Sincronización autorizada de las reglas existentes del ambiente de pruebas.
- Inicialización desde una tabla vacía en un esquema aislado de PostgreSQL.
- Verificación de idempotencia, incluyendo la conservación de identificadores y marcas de tiempo.
- Detección de conflictos mediante una diferencia intencional en el importe mínimo.
- Verificación del código de salida ante conflictos.
- Comprobación de que las reglas existentes no fueron sobrescritas.
- Verificación de integridad de las reglas del esquema original.
- Eliminación autorizada del esquema aislado utilizado para las pruebas.
- Revisión final del código fuente y de las pruebas automatizadas.
- Revisión de consistencia de los documentos del proyecto.
- Ejecución final de las 45 pruebas automatizadas, sin fallos, cancelaciones ni omisiones.
- Comprobación estática final del backend y frontend mediante `pnpm check`, sin errores, advertencias ni sugerencias de Astro.
- Compilación exitosa del backend y frontend mediante `pnpm build`.
- Generación correcta de las cinco páginas estáticas del frontend.
- Verificación de espacios en blanco y saltos de línea finales de los archivos nuevos.
- Verificación del inventario de archivos modificados y nuevos, sin incorporar archivos generados durante la compilación.

Los escenarios de errores de inserción, fallos de reversión y descarte de conexiones defectuosas fueron comprobados mediante pruebas unitarias. No se provocaron estos fallos en PostgreSQL real.

#### Limitaciones y pendientes

- `campaign:update` todavía no está implementado.
- La auditoría y el versionado de cambios de configuración están pendientes.
- El tratamiento de tickets registrados antes de una actualización de reglas está pendiente.
- La zona horaria y la habilitación general del módulo de tickets todavía no controlan las ventanas de participación ni el acceso al módulo.
- La configuración actual contiene valores de prueba, no condiciones comerciales definitivas.
- La regla de rango de fechas de compra permanece deshabilitada y utiliza fechas provisionales.
- Quedan pendientes la revisión final de documentación, compilación y registro de los cambios en Git.

**Estado:** implementación y pruebas de integración previstas concluidas; cierre documental y técnico en progreso.

### A5 — Pruebas integrales del flujo de tickets

Actividades previstas:

- Verificar el registro y acceso de un participante de pruebas.
- Comprobar la carga de comprobantes desde la interfaz web.
- Verificar el procesamiento OCR mediante Veryfi.
- Comprobar los escenarios de aprobación, rechazo, revisión manual y procesamiento pendiente.
- Verificar la protección contra el registro de archivos duplicados.
- Comprobar la persistencia de datos OCR y decisiones automáticas.
- Verificar los registros de auditoría en PostgreSQL.
- Comprobar los mensajes y la actualización del historial del participante.
- Añadir pruebas HTTP del historial autenticado y sus controles de acceso.
- Verificar el comportamiento en escritorio y dispositivos móviles.

El estado `processing` está contemplado en el modelo, pero todavía no se utiliza en el flujo actual. No se considerará obligatorio provocar una transición a este estado mientras no exista una implementación que lo utilice.

**Estado:** pendiente de ejecución.

### A6 — Bandeja administrativa y revisión manual

Actividades previstas:

- Consulta de tickets que requieren atención.
- Acceso autorizado a los comprobantes y sus datos OCR.
- Consulta de resultados de validación e historial.
- Corrección de datos cuando corresponda.
- Aprobación o rechazo manual con registro de auditoría.
- Verificación de autenticación y autorización administrativa.
- Pruebas de decisiones manuales y conservación de evidencia.

Las decisiones específicas de implementación deberán confirmarse antes de iniciar esta actividad.

**Estado:** pendiente de implementación.

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
