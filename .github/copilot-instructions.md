# Instrucciones para GitHub Copilot

Saluda con un "Hola Jesús - Iniciando trabajo", y luego deja un salto de carro y continua tu respuesta en las lineas posteriores.

## 📚 Política de Documentación Obligatoria (CRÍTICO)

**Regla de Oro:** Cualquier cambio en el código que afecte la lógica de negocio, flujos de ejecución o características del sistema **DEBE** ir acompañado de una actualización inmediata en la documentación.

Cuando el usuario te solicite crear flujos de ejecucion sobre algun proceso, o script, usaras al prompt ubicado en .github/prompt-flujo-ejecucion.md como guia para generar el flujo de ejecucion
y en ese caso escribiras en el chat : "Iniciando generación del flujo de ejecución utilizando el prompt de guía". Luego pondras un salto de carro y en la linea siguiente continuaras rus respuestas.

### Reglas Específicas:
1. **Actualización en `docs/`**:

   - Cuando el usuario escriba en su solicitud el texto #comportamientosesenciales: **ANALIZA TUS PROXIMOS CAMBIOS AL CODIGO**  contra el archivo .github/comportamientos-esenciales.md para validar que no haya regresiones.. Unicamente en el caso de que el usuario escriba el
   texto indicado. 
   - Cada vez que modifiques una funcionalidad existente, verifica y actualiza los archivos correspondientes en la carpeta `docs/`.
   - Si implementas una nueva funcionalidad ("feature"), **DEBES** crear un nuevo archivo de documentación en `docs/` que explique:
     - El propósito de la funcionalidad.
     - Cómo funciona técnicamente.
     - Ejemplos de uso.

2. **Sincronización de Flujos (CRÍTICO)**:
   - **Lectura Previa Obligatoria**: Antes de planificar cualquier cambio o responder preguntas sobre el funcionamiento del sistema, **DEBES LEER** el archivo `docs/flujo_ejecucion.md` (Mapa Completo, Verdadero y Exhaustivo del Flujo de Ejecución). Este archivo es la **fuente de verdad operativa**.
   - **Actualización Post-Cambio**: Al finalizar cualquier tarea que modifique la lógica de negocio, el orden de llamadas, las integraciones o las condiciones del sistema, **DEBES ACTUALIZAR** `docs/flujo_ejecucion.md` para reflejar fielmente el nuevo estado del código.
   - **Cuando actualices** flujo_ejecucion.md, después del primer título agrega la fecha.hora de modificación.
   - Si no hubo cambios en el flujo de ejecución, no es necesario actualizarlo.
   
3. **Verificación**:
   - Antes de terminar una tarea, pregúntate: "¿He actualizado la documentación para reflejar estos cambios?". Si la respuesta es no, hazlo antes de confirmar la tarea.

## 🛠️ Estándares del Proyecto
- **Idioma**: La documentación debe estar en **Español**.
- **Formato**: Markdown (.md) estándar. Adicionalmente generar u flujo de ejecucion en .txt, en forma de jerarquia usando sangrias y reflejando las bifurcaciones condicionales y ciclos.
- **Ubicación**: Todo archivo de documentación técnica debe residir en `docs/`.

## Prompt estandar para la creación de flujo_ejecucion.mediante
- **El flujo de ejecucion** lo realizaras siguiendo las instrucciones de este prompt:
### Prompt Maestro para Generación de Mapas de Ejecución Secuenciales y Exhaustivos

**Rol:** Actúa como un Arquitecto de Software Senior especializado en ingeniería inversa, análisis de flujos de ejecución, modelado de comportamiento y documentación técnica de alto detalle.

**Objetivo:** Analizar el código fuente proporcionado y generar un documento técnico titulado **"Mapa Completo, Verdadero y Exhaustivo del Flujo de Ejecución y Comportamiento"**, que describa de forma **secuencial** y **jerárquica** cómo se ejecuta realmente el sistema, incluyendo bifurcaciones, bucles, asincronía y puntos de integración externa.

---

## 1. Instrucciones Generales

1. El resultado debe ser un archivo en formato **Markdown**.
2. El documento debe servir como **fuente de verdad operativa** sobre cómo funciona el software, no como un resumen genérico.
3. No debes inferir comportamientos que no estén soportados claramente por el código. Si algo no puede determinarse con certeza, indícalo explícitamente como **"No determinado a partir del código disponible"**.
4. El enfoque principal es el **flujo de ejecución secuencial**: qué sucede primero, qué sucede después, en qué orden se llaman las funciones, y cómo se ramifica o repite la ejecución.

---

## 2. Estructura Global del Documento

Organiza el documento en secciones jerárquicas, manteniendo y ampliando las ventajas del prompt original.

### 2.1. Fases Cronológicas Principales

Divide el flujo en fases macro, en el orden en que ocurren en tiempo de ejecución. Por ejemplo (adaptar al proyecto real):

1. **Inicialización**
2. **Arranque / Bootstrap de la Aplicación**
3. **Ciclo Principal / Manejo de Solicitudes**
4. **Tareas Asíncronas / Eventos Diferidos**
5. **Persistencia / Cierre / Liberación de Recursos**

Dentro de cada fase, debes detallar la ejecución secuencial paso a paso (ver sección 3).

### 2.2. Subniveles por Módulos y Responsabilidades

Usa subniveles numerados para organizar por módulos y responsabilidades. Ejemplo:

* 2.1.1. Módulo de Autenticación
* 2.1.2. Módulo de Inventario
* 2.1.3. Módulo de Logging / Trazas

Cada submódulo debe incluir:

* Descripción breve de su responsabilidad.
* Puntos de entrada (funciones que reciben llamadas desde fuera del módulo).
* Puntos de salida (qué devuelve, qué dispara, qué efectos secundarios produce).

---

## 3. Reglas de Secuencialidad (CRÍTICO)

Esta sección define cómo debes describir el flujo de ejecución de forma secuencial.

1. **Numeración Obligatoria:**

   * Cada paso del flujo debe estar numerado en orden de ejecución dentro de su fase.
   * Formato recomendado: `1.`, `1.1.`, `1.1.1.` según el nivel de detalle.

2. **Secuencia Paso a Paso:**

   * Para cada flujo principal, describe la secuencia de esta forma:

     * `1. [Función A] en [archivo X] se ejecuta cuando ocurre [evento / condición de entrada].`
     * `2. [Función A] llama a [Función B] en [archivo Y].`
     * `3. [Función B] realiza [operación] y luego retorna [valor/objeto].`

3. **Entradas y Salidas:**

   * Para cada paso, indica claramente:

     * Parámetros de entrada relevantes.
     * Datos/estructuras principales que se retornan.
     * Efectos secundarios importantes (ej. actualizar estado global, escribir en base de datos, llamar a un API externo).

4. **Puntos de Inicio del Flujo:**

   * Identifica explícitamente las funciones o handlers que actúan como puntos de entrada del sistema:

     * Eventos de usuario (clicks, envíos de formularios, mensajes).
     * Peticiones HTTP.
     * Jobs programados.
     * Eventos del framework (onMounted, hooks, etc.).

5. **Puntos de Finalización / Retorno:**

   * Indica en qué momento el flujo termina para cada escenario:

     * Dónde retorna al llamador.
     * Dónde se corta por error.
     * Dónde se delega a un handler asíncrono.

---

## 4. Bifurcaciones, Condiciones y Bucles

Debes representar de forma explícita y detallada:

### 4.1. Condicionales (IF / ELSE / SWITCH)

1. Usa el siguiente formato para cada decisión lógica clave:

   * `SI [condición exacta basada en código] -> seguir flujo A`
   * `SINO (o ELSE) -> seguir flujo B`

2. Para cada rama, documenta su propio flujo secuencial con numeración diferenciada, por ejemplo:

   * `3. Decisión: SI usuario está autenticado`

     * `3.A. [Rama A] Usuario autenticado`

       * `3.A.1. ...`
       * `3.A.2. ...`
     * `3.B. [Rama B] Usuario no autenticado`

       * `3.B.1. ...`
       * `3.B.2. ...`

3. Cuando uses `switch` o estructuras similares, documenta cada caso con su propia mini-secuencia.

### 4.2. Bucles (FOR, WHILE, FOREACH, LOOPS ASÍNCRONOS)

1. Identifica todos los bucles significativos.
2. Para cada bucle, explica:

   * Condición de entrada al bucle.
   * Qué se hace en cada iteración.
   * Condición de salida (cuándo deja de iterar).
3. Usa un formato como:

   * `5. Ciclo sobre [colección X]`

     * `5.1. Para cada elemento [item] en [colección X]:`

       * `5.1.1. Ejecuta [Función F] con [item].`
       * `5.1.2. Si [condición] -> acumula en [estructura Y].`

### 4.3. Manejo de Errores y Excepciones

1. Documenta los bloques `try/catch/finally` relevantes.
2. Para cada uno, indica:

   * Qué se intenta en el bloque `try`.
   * Qué ocurre si se produce una excepción (`catch`).
   * Qué se ejecuta siempre (`finally`), si existe.

---

## 5. Asincronía, Eventos y Callbacks

1. Identifica todas las funciones `async`, promesas, callbacks y sus puntos de espera (`await`, `then`, `catch`).
2. Explica el flujo de asincronía con claridad:

   * Cuándo se lanza una tarea asíncrona.
   * Qué sucede mientras tanto (si hay trabajo concurrente relevante).
   * Dónde y cómo se reanuda el flujo cuando la tarea termina.
3. Marca explícitamente este tipo de pasos, por ejemplo:

   * `[ASÍNCRONO] Llamada a API externa X mediante [función F] en [archivo].`
   * `[ESPERA] El flujo se reanuda aquí cuando la promesa se resuelve.`

---

## 6. Referencias de Código Precisas (MANTENER Y AMPLIAR)

Conserva las ventajas del prompt original y hazlas obligatorias:

1. Cada paso debe mencionar explícitamente:

   * El **nombre de la función o método**.
   * El **archivo** donde se encuentra (ruta relativa), en negritas.
   * Ejemplo: `**validarUsuario**() en **src/auth/authService.js**`.

2. Cuando una función se define pero no se usa, márcalo claramente como:

   * `Función definida pero sin uso detectado en el flujo analizado.`

3. Cuando una función se usa en múltiples contextos, indica todos los contextos relevantes.

---

## 7. Flujo de Datos y Estructuras Clave (MANTENER Y AMPLIAR)

1. Identifica los objetos, estructuras o modelos clave que fluyen entre funciones.
2. Usa bloques de código para mostrar estructuras importantes (JSON, DTOs, payloads, etc.).
3. Para cada estructura relevante, indica:

   * Dónde se crea.
   * Dónde se enriquece o modifica.
   * Dónde se consume o persiste.

Ejemplo de formato:

```json
{
  "nombre": "sessionContext",
  "camposPrincipales": ["userId", "rol", "timestamp", "modoActual"],
  "creadoEn": "src/composables/useChatSession.js",
  "usadoEn": [
    "resolveInventoryContextForMessage",
    "buildMessageChain"
  ]
}
```

---

## 8. Integraciones y Límites del Sistema (MANTENER Y AMPLIAR)

1. Documenta todos los puntos donde el sistema interactúa con:

   * APIs externas.
   * Bases de datos.
   * Sistemas de archivos.
   * Servicios en la nube.
   * localStorage / sessionStorage / cookies / variables de entorno.

2. Para cada integración, indica:

   * Qué función realiza la llamada.
   * Qué datos se envían.
   * Qué datos se esperan recibir.
   * Cómo se maneja el error si la integración falla.

---

## 9. Formato Visual y Legibilidad

1. Usa listas numeradas para los pasos secuenciales.
2. Usa viñetas adicionales sólo para desglosar detalles dentro de un mismo paso.
3. Usa **negritas** para resaltar nombres de funciones, archivos y conceptos críticos.
4. Usa bloques de código para:

   * estructuras JSON,
   * ejemplos de variables de entorno,
   * estructuras de datos clave.
5. Evita párrafos largos; prioriza pasos cortos y directos.

---

## 10. Sección de "Resumen de Flujos Críticos"

Al final del documento, incluye una sección donde resumas, en forma muy estructurada, los flujos más críticos del sistema, cada uno en pocas líneas pero manteniendo el orden secuencial. Por ejemplo:

* **Flujo de mensaje de usuario → respuesta de IA**

  * Paso 1 → función de entrada.
  * Paso 2 → análisis de intención.
  * Paso 3 → recuperación de contexto.
  * Paso 4 → llamada al modelo.
  * Paso 5 → postprocesamiento.
  * Paso 6 → persistencia.

* **Flujo de carga de inventario**

  * Paso 1 → verificación de cache.
  * Paso 2 → lectura de fuente externa.
  * Paso 3 → normalización.
  * Paso 4 → almacenamiento en memoria.

Esta sección no reemplaza el detalle, solo lo condensa para consulta rápida.

---

## 11. Tono y Estilo del Documento

1. El tono debe ser técnico, preciso y descriptivo.
2. No incluyas opiniones subjetivas; describe lo que el código hace y cómo lo hace.
3. Marca claramente cualquier limitación, ambigüedad o comportamiento no determinado.

---

## 12. Inicio del Análisis

Cuando recibas el código fuente o el contexto del proyecto:

1. Identifica los puntos de entrada principales.
2. Recorre el flujo de ejecución siguiendo las llamadas de funciones y handlers.
3. Aplica las reglas anteriores para construir el **Mapa Completo, Verdadero y Exhaustivo del Flujo de Ejecución y Comportamiento**, con especial énfasis en:

   * Secuencialidad.
   * Bifurcaciones.
   * Bucles.
   * Asincronía.
   * Integraciones externas.

## 13. trigger documentación de procesos
1. Cuando el usuario escriba #documentarprocesos en su solicitud (solo esa palabra), deberas generar en la carpeta docs\procesos archivos con procesos documentados (decidir el nombre de proceso a documentar), un proceso puede estar
contenido en varios archivos fuentes e involucrar multiples funciones. Indicar todo eso en el archivo de documentacion que generes, de manera cuidadosa es muy importante para el usuario conocer donde esta cada 
funcion y en que archivo pertenece. Si el usuario no te indica el nombre del proceso a documentar, documenta los procesos que identifiques en las reglas de negocios. Y crea archivos para cada uno segun el formato 
indicado .txt y .md. Ademas de los procesos a nivel de algoritmos que consigas, necesito que documentes los procesos desde el punto de vista del negocio, por ejemplo:
"Proceso de Filtrado y Recuperación de Inventario", o "Proceso de Guardado de Registros en Notion". Los procesos complejos a nivel de algoritmos son valiosos y quiero que igual los consideres pero no
omitas el punto de vista de los procesos de negocios del cliente como tal.
2. Cuando el usuario escriba el trigger #documentarproceso agregando un nombre de proceso, ejemplo:
#documentarproceso Identificación de Contacto
Deberás documentar ese proceso siguiendo el formato indicado en la regla 13.1 pero para el proceso indicado por el usuario.

## 14. Ejemplo de .txt de documentación de flujo de ejecución
Proceso de Filtrado y Recuperación de Inventario
├── Inicio del Proceso
│   ├── Archivo: src/composables/useChatSession.js
│   ├── Función: resolveInventoryContextForMessage
│   └── Condición: includeInventory = true
├── Carga de Inventario
│   ├── Archivo: src/services/inventoryClient.js
│   ├── Función: getInventoryDataset
│   ├── Verificar caché local
│   │   ├── SI caché existe → Retornar caché
│   │   └── SINO → Continuar
│   ├── Llamar fetchInventoryFromApi
│   ├── Petición HTTP GET /api/articulos
│   └── Procesar y cachear respuesta
├── Extracción de Consultas de Producto
│   ├── SI promptMode === 'libre'
│   │   ├── Usar extractProductQueriesWithLLM
│   │   └── Procesamiento con IA
│   └── SINO
│       └── Usar splitMultiProductQuery
│           └── Separar por delimitadores
├── Búsqueda de Productos
│   ├── Para cada consulta extraída
│   │   ├── Función: findRelevantProducts
│   │   ├── Normalización de texto
│   │   ├── Algoritmo de scoring
│   │   │   ├── Coincidencia exacta: puntaje alto
│   │   │   ├── Coincidencia parcial: puntaje medio
│   │   │   └── Fuzzy matching: puntaje bajo
│   │   ├── Filtrado por INVENTORY_DOMAIN_KEYWORDS
│   │   └── Ordenamiento por relevancia
│   └── Ciclo: Repetir para cada consulta
├── Fallback Remoto
│   ├── Condición: búsqueda local = 0 resultados
│   ├── Función: searchInventoryRemote
│   └── Petición HTTP GET /api/articulos?search=query
├── Validación y Fallback
│   ├── SI inventario vacío
│   │   └── respondWithInventoryFallback('connection-error')
│   ├── SI no productos encontrados
│   │   └── respondWithInventoryFallback('no-products')
│   └── SI búsqueda genérica
│       └── respondWithInventoryFallback('search-too-generic')
└── Integración con Respuesta IA
    ├── Función: buildMessageChain
    └── Inyección en {{INVENTORY_CONTEXT}}





