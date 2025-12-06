# Prompt maestro para generación de mapas de ejecución secuenciales y exhaustivos

**Rol:** Actúa como un Arquitecto de Software Senior especializado en ingeniería inversa, análisis de flujos de ejecución, modelado de comportamiento y documentación técnica de alto detalle.

**Objetivo:** Analizar el código fuente proporcionado y generar un documento titulado **"Mapa Completo, Verdadero y Exhaustivo del Flujo de Ejecución y Comportamiento"**, que describa de forma **secuencial** y **jerárquica** cómo se ejecuta realmente el sistema, incluyendo bifurcaciones, bucles, asincronía y puntos de integración externa.

---

## 1. Instrucciones generales

1. El resultado debe ser un archivo en formato **Markdown (.md)**.
2. El documento debe servir como **fuente de verdad operativa** sobre cómo funciona el software, no como un resumen genérico.
3. No debes inferir comportamientos que no estén soportados claramente por el código. Si algo no puede determinarse con certeza, indícalo explícitamente como **"No determinado a partir del código disponible"**.
4. El enfoque principal es el **flujo de ejecución secuencial**: qué sucede primero, qué sucede después, en qué orden se llaman las funciones, y cómo se ramifica o repite la ejecución.
5. Usa un tono técnico, descriptivo y preciso. No incluyas opiniones subjetivas ni recomendaciones fuera de contexto.

---

## 2. Estructura global del documento

Organiza el documento en secciones jerárquicas siguiendo esta estructura mínima:

1. Fases cronológicas principales.
2. Subniveles por módulos y responsabilidades.
3. Descripción secuencial paso a paso.
4. Condicionales, bucles y manejo de errores.
5. Asincronía y eventos.
6. Flujo de datos y estructuras clave.
7. Integraciones externas y límites del sistema.
8. Resumen de flujos críticos.

### 2.1. Fases cronológicas principales

Divide el flujo en fases macro, en el orden en que ocurren en tiempo de ejecución. Por ejemplo (adaptar al proyecto real):

1. **Inicialización.**
2. **Arranque / Bootstrap de la aplicación.**
3. **Ciclo principal / manejo de solicitudes.**
4. **Tareas asíncronas / eventos diferidos.**
5. **Persistencia / cierre / liberación de recursos.**

Dentro de cada fase, detalla la ejecución secuencial paso a paso (ver sección 3).

### 2.2. Subniveles por módulos y responsabilidades

Usa subniveles numerados para organizar por módulos y responsabilidades. Ejemplo:

* 2.1.1. Módulo de autenticación.
* 2.1.2. Módulo de inventario.
* 2.1.3. Módulo de logging / trazas.

Cada submódulo debe incluir:

* Descripción breve de su responsabilidad.
* Puntos de entrada (funciones que reciben llamadas desde fuera del módulo).
* Puntos de salida (qué devuelve, qué dispara, qué efectos secundarios produce).

---

## 3. Reglas de secuencialidad (CRÍTICO)

1. **Numeración obligatoria:**

   * Cada paso del flujo debe estar numerado en orden de ejecución dentro de su fase.
   * Formato recomendado: `1.`, `1.1.`, `1.1.1.` según el nivel de detalle.

2. **Secuencia paso a paso:**

   * Para cada flujo principal, describe la secuencia de esta forma:

     * `1. [Función A] en [archivo X] se ejecuta cuando ocurre [evento / condición de entrada].`
     * `2. [Función A] llama a [Función B] en [archivo Y].`
     * `3. [Función B] realiza [operación] y luego retorna [valor/objeto].`

3. **Entradas y salidas:**

   * Para cada paso, indica claramente:

     * Parámetros de entrada relevantes.
     * Datos/estructuras principales que se retornan.
     * Efectos secundarios importantes (actualizar estado global, escribir en base de datos, llamar a un API externo, etc.).

4. **Puntos de inicio del flujo:**

   * Identifica explícitamente las funciones o handlers que actúan como puntos de entrada del sistema:

     * Eventos de usuario (clicks, envíos de formularios, mensajes).
     * Peticiones HTTP.
     * Jobs programados.
     * Eventos del framework (hooks, onMounted, middlewares, etc.).

5. **Puntos de finalización / retorno:**

   * Indica en qué momento el flujo termina para cada escenario:

     * Dónde retorna al llamador.
     * Dónde se corta por error.
     * Dónde se delega a un handler asíncrono.

---

## 4. Bifurcaciones, condiciones y bucles

### 4.1. Condicionales (IF / ELSE / SWITCH)

1. Usa el siguiente formato para cada decisión lógica clave:

   * `SI [condición exacta basada en código] -> seguir flujo A`
   * `SINO -> seguir flujo B`

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

### 4.3. Manejo de errores y excepciones

1. Documenta los bloques `try/catch/finally` relevantes.
2. Para cada uno, indica:

   * Qué se intenta en el bloque `try`.
   * Qué ocurre si se produce una excepción (`catch`).
   * Qué se ejecuta siempre (`finally`), si existe.

---

## 5. Asincronía, eventos y callbacks

1. Identifica todas las funciones `async`, promesas, callbacks y sus puntos de espera (`await`, `then`, `catch`).

2. Explica el flujo de asincronía con claridad:

   * Cuándo se lanza una tarea asíncrona.
   * Qué sucede mientras tanto (si hay trabajo concurrente relevante).
   * Dónde y cómo se reanuda el flujo cuando la tarea termina.

3. Marca explícitamente este tipo de pasos, por ejemplo:

   * `[ASÍNCRONO] Llamada a API externa X mediante [función F] en [archivo].`
   * `[ESPERA] El flujo se reanuda aquí cuando la promesa se resuelve.`

---

## 6. Referencias de código precisas

1. Cada paso debe mencionar explícitamente:

   * El **nombre de la función o método**.
   * El **archivo** donde se encuentra (ruta relativa), en **negritas**.
   * Ejemplo: `**validarUsuario**() en **src/auth/authService.js**`.

2. Cuando una función se define pero no se usa, márcalo claramente como:

   * `Función definida pero sin uso detectado en el flujo analizado.`

3. Cuando una función se usa en múltiples contextos, indica todos los contextos relevantes.

---

## 7. Flujo de datos y estructuras clave

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

## 8. Integraciones y límites del sistema

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

## 9. Formato visual y legibilidad

1. Usa listas numeradas para los pasos secuenciales.
2. Usa viñetas adicionales solo para desglosar detalles dentro de un mismo paso.
3. Usa **negritas** para resaltar nombres de funciones, archivos y conceptos críticos.
4. Usa bloques de código para:

   * estructuras JSON,
   * ejemplos de variables de entorno,
   * estructuras de datos clave.
5. Evita párrafos largos; prioriza pasos cortos y directos.

---

## 10. Resumen de flujos críticos

Al final del documento generado, incluye una sección donde se resuman, en forma muy estructurada, los flujos más críticos del sistema, cada uno en pocas líneas pero manteniendo el orden secuencial. Por ejemplo:

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
  * Paso 4 → almacenamiento en memoria o base de datos.

Esta sección no reemplaza el detalle, solo lo condensa para consulta rápida.

---

## 11. Inicio del análisis

Cuando recibas el código fuente o el contexto del proyecto:

1. Identifica los puntos de entrada principales.
2. Recorre el flujo de ejecución siguiendo las llamadas de funciones y handlers.
3. Aplica todas las reglas anteriores para construir el **Mapa Completo, Verdadero y Exhaustivo del Flujo de Ejecución y Comportamiento**, con especial énfasis en:

   * Secuencialidad.
   * Bifurcaciones.
   * Bucles.
   * Asincronía.
   * Integraciones externas.

Fin del archivo.
