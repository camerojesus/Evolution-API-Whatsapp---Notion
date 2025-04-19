// Dependencias necesarias
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const mariadb = require('mariadb');
require('dotenv').config();

// --- CONTROL DE SALIDA A CONSOLA ---
// Cambia a 'false' para deshabilitar COMPLETAMENTE los mensajes en la terminal.
// ¡OJO! Si es 'false', no verás el código QR para escanear.
const bConsola = false; // <-- ¡¡MODIFICA AQUÍ!! (true = con consola, false = sin consola)
// ----------------------------------

// Define dataDir base
const baseDataDir = path.join(__dirname, 'data');

// Asegurar que el directorio 'data' base existe
if (!fs.existsSync(baseDataDir)) {
  fs.mkdirSync(baseDataDir);
  console.log(`Directorio base creado: ${baseDataDir}`); // Log inicial importante
}

// --- Configuración del Pool de Conexiones MariaDB ---
let pool;
try {
    pool = mariadb.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        port: process.env.DB_PORT || 3306,
        connectionLimit: 5,
        charset: 'utf8mb4',
        connectTimeout: 15000
    });
    // Usaremos la función log más adelante, así que no logueamos aquí aún.
} catch (error) {
    // Error crítico inicial, lo mostramos aunque bConsola sea false
    console.error('Error fatal al crear el pool de MariaDB:', error);
    process.exit(1);
}

// --- Helpers para nombres de meses y días en español ---
const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const diasSemana = [
    "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"
];


// --- Función para obtener la ruta completa del directorio del día actual ---
function getDailyLogDirectory() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const monthName = meses[date.getMonth()];
    const dayName = diasSemana[date.getDay()];

    // Formato: data/YYYY_MM_MonthName/DD-MM-YYYY_DayName
    const monthDirName = `${year}_${month}_${monthName}`;
    const dayDirName = `${day}-${month}-${year}_${dayName}`;

    const dayDirPath = path.join(baseDataDir, monthDirName, dayDirName);

    // Asegurar que el directorio del día existe, creando la estructura si es necesario
    if (!fs.existsSync(dayDirPath)) {
        try {
            fs.mkdirSync(dayDirPath, { recursive: true });
            // Logueamos la creación de directorios sólo si la consola está activa
            if (bConsola) {
                 console.log(`Directorios de log creados: ${dayDirPath}`);
            }
        } catch (mkdirErr) {
            // Error crítico al crear directorios, mostrar siempre
            console.error(`CRITICAL - Error creando directorio de logs (${dayDirPath}):`, mkdirErr);
            // Podríamos intentar usar el directorio base como fallback, pero es mejor señalar el problema
            return baseDataDir; // Fallback MUY básico, idealmente se manejaría mejor
        }
    }
    return dayDirPath;
}


// --- Función de Logging Modificada ---
function log(message, isError = false) {
    const timestampedMessage = `${new Date().toLocaleString()}: ${message}`;
    // 1. Siempre intentar escribir en el archivo de log
    const logFilePath = getLogFilePath(); // Obtiene la ruta completa del archivo log del día
    try {
        fs.appendFileSync(logFilePath, timestampedMessage + '\n');
    } catch (err) {
        // Si falla la escritura al archivo, lo intentamos mostrar en consola como crítico
        // independientemente de bConsola, ya que es un fallo del propio logging.
        console.error(`CRITICAL - Error writing to log file (${logFilePath}):`, err);
        console.error(`CRITICAL - Original log message: ${timestampedMessage}`);
    }

    // 2. Escribir en consola SÓLO si bConsola es true
    if (bConsola) {
        if (isError) {
            console.error(timestampedMessage); // Usar console.error para errores
        } else {
            console.log(timestampedMessage); // Usar console.log para mensajes normales
        }
    }
}

// Ahora que log está definida, podemos loguear la creación del pool
if (pool) {
    log('Pool de conexiones MariaDB creado.');
}

// --- Función para obtener la ruta del archivo de log del día ---
function getLogFilePath() {
  const dailyDir = getDailyLogDirectory(); // Obtiene la ruta del directorio del día (asegura que exista)
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const fileName = `whatsapp-log-${day}-${month}-${year}.log`;
  return path.join(dailyDir, fileName);
}

// --- Función para obtener la ruta del archivo de mensajes del día ---
function getMessageLogFilePath() {
  const dailyDir = getDailyLogDirectory(); // Obtiene la ruta del directorio del día (asegura que exista)
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const fileName = `mensajes-${day}-${month}-${year}.log`;
  return path.join(dailyDir, fileName);
}


// Verificar conexión a MariaDB al iniciar
async function checkDbConnection() {
  if (!pool) {
      log('Pool de MariaDB no está inicializado. Saltando verificación.', true); // Log como error
      return;
  }
  let conn;
  try {
    conn = await pool.getConnection();
    log('Conexión a MariaDB establecida correctamente.');
  } catch (err) {
    log('Error al conectar con MariaDB: ' + err.message, true); // Log como error
  } finally {
    if (conn) {
        try {
            await conn.release();
        } catch (releaseError) {
            log('Error al liberar conexión de prueba de MariaDB: ' + releaseError.message, true);
        }
    }
  }
}
checkDbConnection(); // Llamar a la función para verificar

// --- Funciones existentes (bloquear, desbloquear, mensajes, Notion, etc.) ---

async function bloquearContactos(client) {
  try {
    const filePath = path.join(__dirname, 'contactosbloquear.txt');
    if (!fs.existsSync(filePath)) {
        log('Archivo contactosbloquear.txt no encontrado.');
        return;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    const lines = data.split('\n').filter(line => line.trim() !== '');

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length < 2) continue;
      const nombre = parts[0].trim();
      const contactId = parts[1].trim();
      try {
        const contact = await client.getContactById(contactId);
        await contact.block();
        log(`Contacto bloqueado: ${nombre} (${contactId})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (innerError) {
        log(`Error al bloquear contacto ${nombre} (${contactId}): ${innerError.message || innerError}`, true);
      }
    }
  } catch (error) {
    log('Error al procesar bloqueo de contactos: ' + error.message, true);
  }
}

async function desbloquearContactos(client) {
  try {
    const filePath = path.join(__dirname, 'contactosbloquear.txt');
    if (!fs.existsSync(filePath)) {
        log('Archivo contactosbloquear.txt no encontrado.');
        return;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    const lines = data.split('\n').filter(line => line.trim() !== '');

    for (const line of lines) {
      const parts = line.split(':');
       if (parts.length < 2) continue;
      const nombre = parts[0].trim();
      const contactId = parts[1].trim();
      try {
        const contact = await client.getContactById(contactId);
        await contact.unblock();
        log(`Contacto desbloqueado: ${nombre} (${contactId})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (innerError) {
        log(`Error al desbloquear contacto ${nombre} (${contactId}): ${innerError.message || innerError}`, true);
      }
    }
  } catch (error) {
    log('Error al procesar desbloqueo de contactos: ' + error.message, true);
  }
}

// --- NO SE USA MÁS, REEMPLAZADA POR getMessageLogFilePath() ---
// function getMessageFileName() {
//   const date = new Date();
//   const day = String(date.getDate()).padStart(2, '0');
//   const month = String(date.getMonth() + 1).padStart(2, '0');
//   const year = date.getFullYear();
//   const fileName = `mensajes-${day}-${month}-${year}.log`;
//   // DEPRECATED: return path.join(dataDir, fileName); // dataDir ahora es baseDataDir
//   return getMessageLogFilePath(); // <-- USA LA NUEVA FUNCIÓN
// }
// ----------------------------------------------------------------

log('Cargando variables de entorno...');
const NOTION_API_KEY  = process.env.NOTION_API_KEY;
const PAGE_ID         = process.env.PAGE_ID; // Este debería ser DATABASE_ID
const PROYECTO_ID     = process.env.PROYECTO_ID;

if (!NOTION_API_KEY || !PAGE_ID) {
    log('Error CRITICO: NOTION_API_KEY o PAGE_ID (Notion Database ID) no están definidos en .env', true);
    process.exit(1); // Salir si faltan credenciales clave
}
log('NOTION_API_KEY: ' + (NOTION_API_KEY ? 'Cargada' : 'NO Cargada'));
log('NOTION_DATABASE_ID (PAGE_ID): ' + PAGE_ID);
log("PROYECTO ACTIVO por defecto: " + (PROYECTO_ID || 'No especificado'));

let aContactos = [];
try {
    const contactosFilePath = path.join(__dirname, 'contactos.txt');
    if (fs.existsSync(contactosFilePath)) {
        const contactosData = fs.readFileSync(contactosFilePath, 'utf-8');
        aContactos = contactosData.split('\n')
            .map(line => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    return { nombre: parts[0].trim(), numero: parts[1].trim() };
                }
                return null;
            })
            .filter(contact => contact !== null && contact.numero);
        log(`Cargados ${aContactos.length} contactos desde contactos.txt`);
    } else {
        log('Archivo contactos.txt no encontrado. Se creará si se añaden contactos.');
    }
} catch (error) {
    log('Error al leer contactos.txt: ' + error.message, true);
}

function agregarContactoNoRegistrado(nombre, numero) {
  const contacto = `${nombre}:${numero}`;
  const filePath = path.join(__dirname, 'contactos.txt');

  try {
    let data = '';
    if (fs.existsSync(filePath)) {
        data = fs.readFileSync(filePath, 'utf8');
    }
    if (data.includes(`:${numero}`)) {
        // log(`Contacto ${nombre} (${numero}) ya existe en contactos.txt.`); // Comentado para reducir logs
        return;
    }

    const newContent = data.trim() ? `${data.trim()}\n${contacto}` : contacto;
    fs.writeFileSync(filePath, newContent);

    log('Contacto no registrado agregado: ' + contacto);

    const contactosData = fs.readFileSync(filePath, 'utf8');
    aContactos = contactosData.split('\n')
        .map(line => {
            const parts = line.split(':');
            if (parts.length >= 2) {
                return { nombre: parts[0].trim(), numero: parts[1].trim() };
            }
            return null;
        })
        .filter(contact => contact !== null && contact.numero);
    log(`Contactos recargados (${aContactos.length} contactos).`);

  } catch (err) {
    log('Error al agregar contacto no registrado: ' + err.message, true);
  }
}

function cargarGruposYProyectos(filePath) {
  const gruposYProyectos = [];
  try {
      if (fs.existsSync(filePath)) {
          const data = fs.readFileSync(filePath, 'utf8');
          const lines = data.split('\n');
          lines.forEach(line => {
              const parts = line.split(':');
              if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
                  gruposYProyectos.push({ grupo: parts[0].trim(), proyecto: parts[1].trim() });
              }
          });
          log(`Cargados ${gruposYProyectos.length} mapeos de grupo a proyecto.`);
      } else {
          log(`Archivo ${path.basename(filePath)} no encontrado.`);
      }
  } catch (error) {
      log(`Error al cargar ${path.basename(filePath)}: ${error.message}`, true);
  }
  return gruposYProyectos;
}

const grupoproyectoFilePath = path.join(__dirname, 'grupoproyecto.txt');
const gruposYProyectos = cargarGruposYProyectos(grupoproyectoFilePath);

const notionClient = axios.create({
    baseURL: 'https://api.notion.com/v1',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    timeout: 120000
  });

// --- MODIFICADO: Usa getMessageLogFilePath() ---
function saveMessage(oObjetoMensaje) {
  const messageFilePath = getMessageLogFilePath(); // Usa la nueva función para obtener la ruta correcta
  let mensajeString;
  try {
      mensajeString = JSON.stringify(oObjetoMensaje, null, 2);
  } catch (stringifyError) {
      log('Error al convertir mensaje a JSON para archivo: ' + stringifyError.message, true);
      mensajeString = `[Mensaje no serializable - Error: ${stringifyError.message}]`;
  }

  try {
      fs.appendFileSync(messageFilePath, mensajeString + '\n---\n');
  } catch (err) {
      log(`Error al guardar el mensaje en archivo (${messageFilePath}): ` + err, true);
  }
}
// -------------------------------------------

async function addEntryToNotionDatabase(databaseId, cRemitente, cDestinatario, type, date, content, cTelefonoRemitente, cTelefonoDestinatario, cProyecto, cNombreGrupo) {
  const MAX_CONTENT_LENGTH = 2000;
  let truncatedContent = content;
  if (content && content.length > MAX_CONTENT_LENGTH) {
      truncatedContent = content.substring(0, MAX_CONTENT_LENGTH - 3) + "...";
      // log(`Contenido del mensaje truncado para Notion.`); // Comentado para reducir logs
  }

  const payload = {
    parent: { database_id: databaseId },
    properties: {
      'Remitente': { title: [{ text: { content: cRemitente || 'Desconocido' } }] },
      'Destinatario': { rich_text: [{ text: { content: cDestinatario || 'Desconocido' } }] },
      'Tipo': { select: { name: type } },
      'Fecha de Contacto': { date: { start: date } },
      'Contenido': { rich_text: [{ text: { content: truncatedContent || '(Sin contenido)' } }] },
      'Teléfono remitente': { rich_text: [{ text: { content: cTelefonoRemitente || 'N/A' } }] },
      'Teléfono destinatario': { rich_text: [{ text: { content: cTelefonoDestinatario || 'N/A' } }] },
      'Proyecto': { rich_text: [{ text: { content: cProyecto || 'N/A' } }] },
      'Grupo': { rich_text: [{ text: { content: cNombreGrupo || '' } }] }
    }
  };

  try {
    const response = await notionClient.post(`/pages`, payload);
    log('Entrada agregada a Notion. ID: ' + response.data.id);
  } catch (error) {
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    log(`Error agregando entrada a Notion: ${errorMsg}`, true);
  }
}

async function addEntryToMariaDB(messageId, senderName, recipientName, senderPhone, recipientPhone, messageType, messageTimestamp, content, groupName, projectName) {
    if (!pool) {
        log('Error: El pool de MariaDB no está disponible para insertar.', true);
        return;
    }

    const sql = `
      INSERT INTO whatsapp_messages
      (message_id, sender_name, recipient_name, sender_phone, recipient_phone, message_type, message_timestamp, message_content, group_name, project_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      messageId,
      senderName || 'Desconocido',
      recipientName || 'Desconocido',
      senderPhone || 'N/A',
      recipientPhone || 'N/A',
      messageType,
      new Date(messageTimestamp),
      content || '(Sin contenido)',
      groupName || null,
      projectName === 'N/A' ? null : (projectName || null)
    ];

    let conn;
    try {
      conn = await pool.getConnection();
      const results = await conn.query(sql, values);
      log(`Mensaje [${messageId || 'nuevo'}] guardado en MariaDB. ID: ${results.insertId}, Filas: ${results.affectedRows}`);
      return results;
    } catch (error) {
      log(`Error al guardar mensaje en MariaDB: ${error.message}`, true);
      log(`SQL Template (MariaDB): ${sql}`, true); // Loguear SQL en caso de error
      // Loguear solo info no sensible para depuración
      log(`Valores (para depuración): Tipos=${values.map(v => typeof v).join(', ')} LongitudContenido=${(content || '').length}`, true);
    } finally {
      if (conn) {
          try {
              await conn.release();
          } catch (releaseError) {
              log('Error al liberar conexión de MariaDB: ' + releaseError.message, true);
          }
      }
    }
  }

// --- MODIFICADO: Usa baseDataDir para LocalAuth ---
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: baseDataDir }), // Usa el directorio base para la sesión
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
        timeout: 180000
    },
});
// -------------------------------------------------

// --- Manejadores de Eventos de WhatsApp ---

client.on('qr', (qr) => {
  log('Se necesita escanear QR.');
  if (bConsola) {
      log('Escanea el siguiente código:'); // Log normal
      qrcode.generate(qr, { small: true }); // Mostrar QR solo si la consola está habilitada
  } else {
      log('Salida a consola deshabilitada (bConsola=false). No se puede mostrar el QR en terminal.');
      // Podrías añadir aquí una lógica para guardar el QR en un archivo si lo necesitas
      // fs.writeFileSync(path.join(baseDataDir, 'qrcode.txt'), qr); // Guardaría en 'data/qrcode.txt'
      // log('QR guardado en qrcode.txt');
  }
});

client.on('authenticated', () => {
  log('Autenticación exitosa.');
});

client.on('ready', async () => {
  const clientName = client.info.pushname || client.info.wid.user;
  log(`Cliente listo y conectado como: ${clientName}`);
  log(`Número asociado: ${client.info.wid._serialized}`);

  log('Configurando tareas programadas (cron)...');
  const timeZone = "America/Mexico_City"; // Asegúrate que sea tu zona horaria

  cron.schedule('0 8 * * 0-4,6', () => {
    log('CRON: Iniciando desbloqueo de contactos (8am).');
    //desbloquearContactos(client).catch(err => log(`Error en desbloqueo programado (8am): ${err.message}`, true));
  }, { timezone: timeZone });

  cron.schedule('0 12 * * *', () => {
    log('CRON: Iniciando bloqueo de contactos (12pm).');
    //bloquearContactos(client).catch(err => log(`Error en bloqueo programado (12pm): ${err.message}`, true));
  }, { timezone: timeZone });

  cron.schedule('0 14 * * 0-4,6', () => {
    log('CRON: Iniciando desbloqueo de contactos (2pm).');
    //desbloquearContactos(client).catch(err => log(`Error en desbloqueo programado (2pm): ${err.message}`, true));
  }, { timezone: timeZone });

  cron.schedule('0 17 * * *', () => {
    log('CRON: Iniciando bloqueo de contactos (5pm).');
    //bloquearContactos(client).catch(err => log(`Error en bloqueo programado (5pm): ${err.message}`, true));
  }, { timezone: timeZone });

  log('Tareas cron configuradas.');

  log('Realizando desbloqueo inicial de contactos...');
  //await desbloquearContactos(client).catch(err => log(`Error en desbloqueo inicial: ${err.message}`, true));
  log('Desbloqueo inicial completado.');
});

client.on('auth_failure', (msg) => {
  log('Error de autenticación: ' + msg, true);
});

client.on('disconnected', (reason) => {
  log('Cliente desconectado: ' + reason, true); // Loguear desconexión como error/advertencia
  log('Intentando reiniciar cliente en 2 minutos...');
  setTimeout(() => {
    log('Reiniciando cliente...');
    client.initialize().catch(err => {
        log(`Error al reiniciar cliente tras desconexión: ${err.message}`, true);
    });
  }, 120000);
});

client.on('change_state', state => {
    log('Cambio de estado del cliente: ' + state);
});

client.on('error', error => {
    log('Error del cliente de WhatsApp: ' + error.message, true);
});


// --- Función Principal para Procesar Mensajes ---
async function processMessage(message, isOutgoing = false) {
  try {
    // Validaciones iniciales
    if (!message || message.isStatus || typeof message.body !== 'string') {
        return; // Ignorar mensajes de estado o sin cuerpo de texto
    }
    // Ignorar mensajes vacíos o que parecen ser solo timestamp (un bug ocasional?)
    if (message.body.trim() === '' || String(message.timestamp) === message.body.trim()) {
        return;
    }
    // Ignorar mensajes de broadcast recibidos (a menos que sea un grupo?)
    // Podría necesitar ajuste si quieres procesar broadcasts específicos
     if (message.isBroadcast && !message.fromMe) {
        // log('Mensaje de broadcast recibido ignorado.'); // Descomentar para depurar
        return;
    }

    const chat = await message.getChat();
    const contactInfo = !isOutgoing ? await message.getContact() : null;
    const ownNumber = client.info.wid._serialized;

    let type = isOutgoing ? 'Salida' : 'Entrada';
    let date = message.timestamp ? new Date(message.timestamp * 1000).toISOString() : new Date().toISOString();
    let content = message.body;
    let cRemitente = 'Desconocido';
    let cDestinatario = 'Desconocido';
    let cTelefonoRemitente = 'N/A';
    let cTelefonoDestinatario = 'N/A';
    let cNombreGrupo = '';
    let cProyecto = 'N/A'; // Default a 'N/A'
    let authorId = null;
    const messageId = message.id && message.id.id ? message.id.id : null; // ID del mensaje si está disponible

    if (isOutgoing) {
        cRemitente = client.info.pushname || "Jesús Camero (yo)"; // Usa el nombre del perfil si está disponible
        cTelefonoRemitente = ownNumber;
        cTelefonoDestinatario = message.to; // El número al que se envió

        if (chat.isGroup) {
            cNombreGrupo = chat.name || 'Grupo Desconocido';
            cDestinatario = cNombreGrupo; // En grupo, el destinatario es el grupo
            // El proyecto se determinará más abajo basado en cNombreGrupo
        } else {
            // Mensaje directo saliente
            const contact = await client.getContactById(message.to);
            cDestinatario = contact.pushname || contact.name || buscarNombrePorNumero(message.to) || chat.name || 'Contacto Desconocido';
             if (cDestinatario === 'Contacto Desconocido' || cDestinatario === 'Contacto no Registrado') {
                 if (contact.pushname || contact.name) {
                     agregarContactoNoRegistrado(contact.pushname || contact.name, message.to);
                     cDestinatario = buscarNombrePorNumero(message.to); // Intentar buscar de nuevo
                 }
             }
        }

    } else { // Mensaje Entrante
        cDestinatario = client.info.pushname || "Jesús Camero (yo)"; // El destinatario eres tú
        cTelefonoDestinatario = ownNumber;

        if (chat.isGroup) {
            cNombreGrupo = chat.name || 'Grupo Desconocido';
            authorId = message.author || message.from; // message.author es más específico para grupos
            cTelefonoRemitente = authorId;

            if (authorId) { // Asegurarse de que authorId existe
                const authorContact = await client.getContactById(authorId);
                cRemitente = authorContact.pushname || authorContact.name || buscarNombrePorNumero(authorId) || 'Miembro Desconocido';

                 // Lógica para agregar contacto si no está registrado
                 if (cRemitente === 'Miembro Desconocido' || cRemitente === 'Contacto no Registrado') {
                     if (authorContact.pushname || authorContact.name) {
                         const nombreReal = authorContact.pushname || authorContact.name;
                         agregarContactoNoRegistrado(nombreReal, authorId);
                         cRemitente = nombreReal; // Actualizar remitente con el nombre encontrado
                     }
                 } else {
                    // Verificar si el nombre guardado es genérico pero ahora tenemos uno mejor
                    const nombreGuardado = buscarNombrePorNumero(authorId);
                    if (nombreGuardado === 'Contacto no Registrado' && (authorContact.pushname || authorContact.name)) {
                        agregarContactoNoRegistrado(authorContact.pushname || authorContact.name, authorId);
                        cRemitente = buscarNombrePorNumero(authorId); // Actualizar con nombre de contactos.txt
                    }
                 }
            } else {
                cRemitente = 'Miembro Desconocido (Sin Author ID)'; // Fallback si no hay author
                cTelefonoRemitente = message.from; // Usar el 'from' del mensaje como fallback
            }
            // El proyecto se determinará más abajo basado en cNombreGrupo

        } else { // Mensaje Directo Entrante
            cTelefonoRemitente = message.from;
            cRemitente = contactInfo.pushname || contactInfo.name || buscarNombrePorNumero(message.from) || 'Contacto Desconocido';

            // Lógica para agregar contacto si no está registrado
            if (cRemitente === 'Contacto Desconocido' || cRemitente === 'Contacto no Registrado') {
                 if (contactInfo.pushname || contactInfo.name) {
                     const nombreReal = contactInfo.pushname || contactInfo.name;
                     agregarContactoNoRegistrado(nombreReal, message.from);
                     cRemitente = nombreReal; // Actualizar remitente
                 }
            } else {
                // Verificar si el nombre guardado es genérico pero ahora tenemos uno mejor
                const nombreGuardado = buscarNombrePorNumero(message.from);
                 if (nombreGuardado === 'Contacto no Registrado' && (contactInfo.pushname || contactInfo.name)) {
                     agregarContactoNoRegistrado(contactInfo.pushname || contactInfo.name, message.from);
                     cRemitente = buscarNombrePorNumero(message.from); // Actualizar con nombre de contactos.txt
                 }
            }
            // Para mensajes directos, no hay proyecto asociado por grupo
            cProyecto = PROYECTO_ID || 'N/A'; // Usar el proyecto por defecto si existe, sino N/A
        }
    }

    // Determinar el proyecto basado en el grupo (si aplica)
    if (cNombreGrupo) {
      cProyecto = obtenerProyectoPorGrupo(cNombreGrupo); // Sobreescribe el default si se encuentra mapeo
    } else if (!isOutgoing) {
        // Si es mensaje entrante directo, usar el proyecto por defecto
         cProyecto = PROYECTO_ID || 'N/A';
    }
    // Si es saliente directo, no asignamos proyecto a menos que haya una lógica específica futura


    // Loguear info básica (solo si bConsola es true)
    log(`[${type}] De: ${cRemitente}(${cTelefonoRemitente}) A: ${cDestinatario}(${cTelefonoDestinatario}) ${cNombreGrupo ? `Grupo: ${cNombreGrupo} ` : ''}Proy: ${cProyecto} ID: ${messageId || 'N/D'}`);

    // --- Guardar en archivo local ---
    saveMessage(message); // Guarda el objeto mensaje completo en el log de mensajes

    // --- Enviar a Notion ---
    await addEntryToNotionDatabase(
        PAGE_ID,
        cRemitente, cDestinatario, type, date, content,
        cTelefonoRemitente, cTelefonoDestinatario, cProyecto, cNombreGrupo
    );

    // --- Enviar a MariaDB ---
    await addEntryToMariaDB(
        messageId, // Pasar el ID del mensaje
        cRemitente, cDestinatario, cTelefonoRemitente, cTelefonoDestinatario,
        type, date, content,
        cNombreGrupo, // Pasar el nombre del grupo (o vacío)
        cProyecto // Pasar el nombre del proyecto determinado
    );

  } catch (error) {
    // Loguear el error completo, incluyendo el stack trace si está disponible
    log(`Error GRAVE al procesar mensaje: ${error.stack || error.message || error}`, true);
    // Opcionalmente, guardar el mensaje que causó el error para análisis
    try {
        const errorLogPath = path.join(getDailyLogDirectory(), 'error_messages.log');
        const errorData = `--- ERROR ${new Date().toISOString()} ---\n${error.stack || error.message || error}\n--- MESSAGE OBJECT ---\n${JSON.stringify(message, null, 2)}\n\n`;
        fs.appendFileSync(errorLogPath, errorData);
    } catch (logErr) {
        log(`Error adicional al intentar guardar mensaje erróneo: ${logErr.message}`, true);
    }
  }
}


// --- Escuchar Eventos de Mensajes ---
client.on('message', async (message) => {
  // Procesa mensajes entrantes (no enviados por ti)
  if (message.fromMe) return; // Ya no es estrictamente necesario por 'message_create', pero es seguro
  await processMessage(message, false); // false indica que es entrante
});

client.on('message_create', async (message) => {
  // Procesa mensajes creados (generalmente los enviados por ti)
  // Esto captura los mensajes salientes antes de que sean confirmados por el servidor
  if (message.fromMe) {
    await processMessage(message, true); // true indica que es saliente
  }
  // NOTA: Podría haber duplicados si 'message' también se dispara para mensajes salientes
  // La lógica actual con el return en 'message' si fromMe es true previene esto.
});

// --- Funciones Auxiliares ---
function buscarNombrePorNumero(numeroCompleto) {
  if (!numeroCompleto || typeof numeroCompleto !== 'string') return "Contacto no Registrado";
  // Extrae el número antes de '@c.us' o '@g.us'
  const numeroSimple = numeroCompleto.split('@')[0];
  const contacto = aContactos.find(c => {
      // Compara asegurándose de que el número completo contenga el número guardado
      // Esto ayuda si el número guardado no tiene código de país y el completo sí, o viceversa.
      // O si uno tiene un '+' y el otro no. Es una comparación flexible.
      const numeroGuardadoSimple = c.numero.replace(/\D/g, ''); // Quitar no dígitos del guardado
      const numeroEntranteSimple = numeroSimple.replace(/\D/g, ''); // Quitar no dígitos del entrante
      // Comprobar si uno termina con el otro (maneja códigos de país opcionales)
      return numeroEntranteSimple.endsWith(numeroGuardadoSimple) || numeroGuardadoSimple.endsWith(numeroEntranteSimple);
  });
  return contacto ? contacto.nombre : "Contacto no Registrado";
}


function obtenerProyectoPorGrupo(nombreGrupo) {
  if (!nombreGrupo) return 'N/A'; // Si no hay nombre de grupo, no hay proyecto por grupo
  // Busca de forma insensible a mayúsculas/minúsculas
  const grupoProyecto = gruposYProyectos.find(gp => gp.grupo.toLowerCase() === nombreGrupo.toLowerCase());
  // Devuelve el proyecto encontrado o el PROYECTO_ID por defecto si no se encontró mapeo y está definido, sino 'N/A'
  return grupoProyecto ? grupoProyecto.proyecto : (PROYECTO_ID || 'N/A');
}


// --- Manejo de Errores Globales y Señales ---
process.on('unhandledRejection', (reason, promise) => {
  const reasonString = (reason instanceof Error) ? reason.stack : String(reason);
  log(`Unhandled Rejection at: ${promise} reason: ${reasonString}`, true);
});

process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.stack || error}`, true);
  log('Error no capturado detectado. Terminando proceso...', true);
  // Esperar un poco para dar tiempo a que el log se escriba si es posible
  setTimeout(() => process.exit(1), 1000);
});

const cleanup = async (signal) => {
    log(`Recibida señal ${signal}. Cerrando conexiones...`);
    if (client) {
        try {
            log('Destruyendo cliente de WhatsApp...');
            await client.destroy();
            log('Cliente de WhatsApp destruido.');
        } catch (err) {
            log('Error al destruir cliente de WhatsApp: ' + err.message, true);
        }
    }
    if (pool) {
        try {
            log('Cerrando pool de MariaDB...');
            await pool.end();
            log('Pool de MariaDB cerrado.');
        } catch (err) {
            log('Error al cerrar pool de MariaDB: ' + err.message, true);
        }
    }
    log('Saliendo.');
    // Esperar un poco antes de salir para asegurar logs
    setTimeout(() => process.exit(0), 500);
};

process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGTERM', () => cleanup('SIGTERM'));

// --- Inicialización Final ---
log('Inicializando cliente de WhatsApp...');
client.initialize().catch(err => {
    log(`Error fatal durante la inicialización del cliente: ${err.message}`, true);
    // Esperar antes de salir
    setTimeout(() => process.exit(1), 1000);
});

log(`Script iniciado y esperando eventos... Salida a consola: ${bConsola ? 'Habilitada' : 'Deshabilitada'}`);
log(`Directorio base de datos/sesión: ${baseDataDir}`);
log(`Los logs se guardarán en subdirectorios dentro de: ${baseDataDir}`);