# Mapa Completo, Verdadero y Exhaustivo del Flujo de Ejecución y Comportamiento

*Fecha y hora de modificación: 6 de diciembre de 2025, 12:15 PM*

## 1. Inicialización de la Aplicación

### 1.1. Carga de Dependencias y Configuraciones
- **Archivo**: `whatsapp-notion-mariadb.js`
- **Función**: Inicio del script
- Cargar variables de entorno desde `.env` usando `dotenv`
- Validar existencia de `NOTION_API_KEY` y `PAGE_ID`; mostrar advertencia si faltan
- Configurar constantes: `DEFAULT_NOTION_API_KEY`, `DEFAULT_PAGE_ID`, `DEFAULT_PROYECTO_ID`
- Establecer `bConsola = true` para mostrar logs y QR
- Configurar `FORCE_NEW_SESSION` basado en variable de entorno

### 1.2. Configuración de Directorios y Sesión
- Crear directorio base `data/` si no existe
- Si `FORCE_NEW_SESSION` es true, eliminar carpetas de sesión previas (`session-*`, `Session-*`, `wwebjs*`)
- Loggear ruta base de datos/sesión

### 1.3. Configuración de MariaDB
- Crear pool de conexiones MariaDB con parámetros de entorno (`DB_HOST`, `DB_USER`, etc.)
- Configurar `connectionLimit: 5`, `charset: utf8mb4`, `connectTimeout: 15000`
- Capturar errores fatales en creación del pool y salir si falla

### 1.4. Funciones de Fecha y Logging
- Definir arrays `MESES` y `DIAS` en español
- **Función**: `getDailyDir()` - Genera directorio mensual/diario basado en fecha actual
- **Función**: `logFile()` - Retorna path del archivo de log diario
- **Función**: `msgFile()` - Retorna path del archivo de mensajes diario
- **Función**: `log(m, err=false)` - Escribe mensaje con timestamp a archivo y consola si `bConsola`

### 1.5. Carga de Datos de Configuración
- **Función**: `cargarContactos()` - Lee `contactos.txt`, parsea líneas `nombre:numero`, crea array `aContactos`
- **Función**: `buscarNombrePorNumero(num)` - Busca nombre por número en `aContactos`
- **Función**: `cargarMapeo(f, n)` - Lee archivo de mapeo, retorna array de líneas limpias
- Cargar `gruposYProy` desde `grupoproyecto.txt` (formato `grupo:proyecto`)
- Cargar `proyectosNotion` desde `notionproyecto.txt` (formato `proyecto:apiKey:databaseId`)
- Crear objeto `notionIntegrations` con clientes Notion por proyecto
- **Función**: `getIntegration(p)` - Retorna integración Notion por proyecto o default
- **Función**: `proyectoPorGrupo(g)` - Busca proyecto por nombre de grupo

### 1.6. Función de Guardado Raw
- **Función**: `saveRaw(o)` - Convierte objeto a JSON y appendea a `msgFile()` con separador `---`

## 2. Inicialización del Cliente WhatsApp

### 2.1. Creación del Cliente
- Crear instancia `client` con `LocalAuth` y configuración de Puppeteer
- Configurar Puppeteer headless, args para estabilidad, timeout 180000

### 2.2. Manejo de Eventos de Autenticación
- **Evento**: `client.on('qr')` - Generar QR usando `qrcode` o `qrcode-terminal`
- **Evento**: `client.on('authenticated')` - Loggear "Autenticado"
- **Evento**: `client.on('ready')` - Loggear "WhatsApp listo"
- **Evento**: `client.on('auth_failure', m)` - Loggear error de autenticación
- **Evento**: `client.on('disconnected', r)` - Loggear desconexión, reconectar en 120 segundos
- **Evento**: `client.on('error', e)` - Loggear error de WhatsApp

### 2.3. Procesamiento de Mensajes
- **Función**: `processMessage(m, out)`
  - Validar mensaje: no `isStatus`, tiene `body`, no vacío, no broadcast si no fromMe
  - Detectar trigger `#hola` en mensajes entrantes → responder con `"Hola jesus, sé que eres tu"` usando `m.reply`, sin interrumpir el flujo
  - Obtener chat y `yo` (serialized wid)
  - Determinar `tipo`: 'Salida' si `out`, 'Entrada' si no
  - Calcular `isoDate` desde `timestamp`
  - Inicializar variables: `remit`, `dest`, `telRem`, `telDest`, `grp`, `proj`

  - **Bifurcación por tipo de mensaje**:
    - SI `out` (mensaje saliente):
      - `remit = client.info.pushname || 'Yo'`
      - `telRem = yo`
      - `telDest = m.to`
      - SI `chat.isGroup`: `grp = chat.name`, `dest = grp`
      - SINO: obtener contacto por `m.to`, `dest = pushname || name || buscarNombrePorNumero(m.to)`
    - SINO (mensaje entrante):
      - `dest = client.info.pushname || 'Yo'`
      - `telDest = yo`
      - SI `chat.isGroup`: `grp = chat.name`, obtener `author`, contacto por `author`, `remit = pushname || name || buscarNombrePorNumero(author)`, `telRem = author`
      - SINO: `telRem = m.from`, obtener contacto, `remit = pushname || name || buscarNombrePorNumero(m.from)`, `proj = DEFAULT_PROYECTO_ID`

  - SI `grp`: `proj = proyectoPorGrupo(grp)`
  - Loggear: `[tipo] remit→dest G:grp P:proj`
  - Llamar `saveRaw(m)`
  - Obtener integración Notion: `integ = getIntegration(proj)`
  - Llamar `addEntryToNotion(integ.client, integ.databaseId, ...)`
  - Llamar `addEntryToMariaDB(...)`

- **Evento**: `client.on('message', m)` - SI `!m.fromMe`: `processMessage(m, false)`
- **Evento**: `client.on('message_create', m)` - SI `m.fromMe`: `processMessage(m, true)`

- **Llamada a agente remoto (Gescel-vps)**
  - Solo en mensajes entrantes (`out=false`)
  - **Función**: `getAgentReply({ text, from, to })` → POST a `AGENT_API_URL` (default `http://localhost:3000/agent/reply`)
  - Si responde `reply`, se envía al usuario vía `m.reply(reply)`
  - Errores se loguean pero no detienen el guardado en Notion/MariaDB

### 2.4. Inserción en Notion
- **Función**: `addEntryToNotion(notionClient, databaseId, remitente, destinatario, tipo, isoDate, contenido, telRem, telDest, proyecto, grupo)`
  - **Paso 1**: Crear fila principal en database
    - Crear página con propiedades: Remitente (title), Destinatario, Tipo, Fecha de Contacto, Contenido (rich_text con '(ver sub-página)'), Teléfonos, Proyecto, Grupo
    - Capturar `pageId`
  - **Paso 2**: Crear sub-página
    - Preparar bloques de texto (dividir contenido en chunks de 1900 chars)
    - Agregar firma con remitente, destinatario, fecha, proyecto, grupo
    - Crear página hija de `pageId` con título truncado
    - Capturar `subId`
  - **Paso 3**: Actualizar fila principal
    - Actualizar propiedad 'Contenido' con mención a `subId`
  - Loggear éxito o errores

### 2.5. Inserción en MariaDB
- **Función**: `addEntryToMariaDB(msgId, remitente, destinatario, telRem, telDest, tipo, isoDate, cuerpo, grupo, proyecto)`
  - Obtener conexión del pool
  - Ejecutar INSERT en `whatsapp_messages` con valores preparados
  - Liberar conexión
  - Loggear errores

## 3. Inicio y Ciclo Principal

### 3.1. Verificación de Sesión Previa
- Verificar existencia de carpetas de sesión en `baseDataDir`
- Loggear si se detecta sesión existente o no

### 3.2. Inicialización del Cliente
- Llamar `client.initialize()`
- Capturar errores en inicialización

### 3.3. Manejo de Salida
- **Función**: `clean(sig)` - Loggear señal, destruir cliente, cerrar pool, salir
- Escuchar `SIGINT` y `SIGTERM` para limpieza segura

## 4. Resumen de Flujos Críticos

- **Flujo de mensaje entrante → procesamiento y almacenamiento**
  - Paso 1: Evento `message` dispara `processMessage`
  - Paso 2: Validación y extracción de metadatos
  - Paso 3: SI cuerpo = `#hola` y es entrante → responder `"Hola jesus, sé que eres tu"`
  - Paso 4: Determinación de proyecto y grupo
  - Paso 5: Guardado raw local
  - Paso 6: Inserción en Notion (fila + sub-página)
  - Paso 7: Inserción en MariaDB
  - Paso 8: Logging de éxito

- **Flujo de inicialización → conexión WhatsApp**
  - Paso 1: Carga de configuraciones
  - Paso 2: Creación de pool MariaDB
  - Paso 3: Carga de mapeos de contactos y proyectos
  - Paso 4: Inicialización de cliente WhatsApp
  - Paso 5: Espera de QR y autenticación
  - Paso 6: Evento `ready` indica listo para procesar

- **Flujo de guardado en Notion**
  - Paso 1: Selección de integración por proyecto
  - Paso 2: Creación de fila con propiedades principales
  - Paso 3: Creación de sub-página con contenido completo
  - Paso 4: Enlace fila-sub-página vía mención
  - Paso 5: Actualización de propiedad Contenido

- **Flujo de guardado en MariaDB**
  - Paso 1: Obtención de conexión del pool
  - Paso 2: Preparación de query INSERT
  - Paso 3: Ejecución con parámetros
  - Paso 4: Liberación de conexión
  - Paso 5: Manejo de errores y logging