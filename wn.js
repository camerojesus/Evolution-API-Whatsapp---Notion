// index.js

// Carga de variables de entorno
require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const mariadb = require('mariadb');

// --- VARIABLES DE ENTORNO POR DEFECTO ---
const DEFAULT_NOTION_API_KEY = process.env.NOTION_API_KEY;
const DEFAULT_PAGE_ID        = process.env.PAGE_ID;       // Database ID por defecto
const DEFAULT_PROYECTO_ID    = process.env.PROYECTO_ID;   // Proyecto por defecto

if (!DEFAULT_NOTION_API_KEY || !DEFAULT_PAGE_ID) {
  console.error('Error CRÍTICO: NOTION_API_KEY o PAGE_ID no están definidos en .env');
  process.exit(1);
}

// --- CONTROL DE SALIDA A CONSOLA ---
const bConsola = false; // true = mostrar logs y QR en terminal

// --- DIRECTORIO BASE PARA SESIÓN Y DATOS ---
const baseDataDir = path.join(__dirname, 'data');
if (!fs.existsSync(baseDataDir)) {
  fs.mkdirSync(baseDataDir);
  if (bConsola) console.log(`Directorio base creado: ${baseDataDir}`);
}

// --- POOL DE CONEXIONES MariaDB ---
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
} catch (err) {
  console.error('Error fatal al crear el pool de MariaDB:', err);
  process.exit(1);
}

// --- Helpers para meses y días en español ---
const meses = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];
const diasSemana = [
  "Domingo","Lunes","Martes","Miércoles",
  "Jueves","Viernes","Sábado"
];

// --- Funciones de ruta de log diario ---
function getDailyLogDirectory() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth()+1).padStart(2,'0');
  const dd   = String(d.getDate()).padStart(2,'0');
  const monthName = meses[d.getMonth()];
  const dayName   = diasSemana[d.getDay()];
  const dirMonth = `${yyyy}_${mm}_${monthName}`;
  const dirDay   = `${dd}-${mm}-${yyyy}_${dayName}`;
  const fullPath = path.join(baseDataDir, dirMonth, dirDay);
  if (!fs.existsSync(fullPath)) {
    try {
      fs.mkdirSync(fullPath, { recursive: true });
      if (bConsola) console.log(`Directorios de log creados: ${fullPath}`);
    } catch (err) {
      console.error(`CRITICAL - Error creando directorio de logs (${fullPath}):`, err);
      return baseDataDir;
    }
  }
  return fullPath;
}
function getLogFilePath() {
  const dir = getDailyLogDirectory();
  const d = new Date();
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  return path.join(dir, `whatsapp-log-${dd}-${mm}-${yyyy}.log`);
}
function getMessageLogFilePath() {
  const dir = getDailyLogDirectory();
  const d = new Date();
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  return path.join(dir, `mensajes-${dd}-${mm}-${yyyy}.log`);
}

// --- Función de logging ---
function log(message, isError = false) {
  const timestamp = new Date().toLocaleString();
  const line = `${timestamp}: ${message}`;
  try {
    fs.appendFileSync(getLogFilePath(), line + '\n');
  } catch (err) {
    console.error(`CRITICAL - No se pudo escribir en log file:`, err);
    console.error(`CRITICAL - Mensaje: ${line}`);
  }
  if (bConsola) {
    if (isError) console.error(line);
    else console.log(line);
  }
}

// --- Verificar conexión a MariaDB al iniciar ---
(async function checkDbConnection() {
  let conn;
  try {
    conn = await pool.getConnection();
    log('Conexión a MariaDB establecida correctamente.');
  } catch (err) {
    log('Error al conectar con MariaDB: ' + err.message, true);
  } finally {
    if (conn) {
      try { await conn.release(); }
      catch (e) { log('Error liberando conexión de prueba: ' + e.message, true); }
    }
  }
})();

// --- Funciones de bloqueo y desbloqueo de contactos ---
async function bloquearContactos(client) {
  try {
    const filePath = path.join(__dirname, 'contactosbloquear.txt');
    if (!fs.existsSync(filePath)) {
      log('Archivo contactosbloquear.txt no encontrado.');
      return;
    }
    const lines = fs.readFileSync(filePath,'utf8')
      .split(/\r?\n/)
      .filter(l => l.trim());
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length<2) continue;
      const nombre = parts[0].trim();
      const id = parts[1].trim();
      try {
        const contact = await client.getContactById(id);
        await contact.block();
        log(`Bloqueado: ${nombre} (${id})`);
        await new Promise(r=>setTimeout(r,1000));
      } catch (err) {
        log(`Error bloqueando ${nombre} (${id}): ${err.message}`, true);
      }
    }
  } catch (err) {
    log('Error en bloquearContactos: '+err.message, true);
  }
}
async function desbloquearContactos(client) {
  try {
    const filePath = path.join(__dirname, 'contactosbloquear.txt');
    if (!fs.existsSync(filePath)) {
      log('Archivo contactosbloquear.txt no encontrado.');
      return;
    }
    const lines = fs.readFileSync(filePath,'utf8')
      .split(/\r?\n/)
      .filter(l => l.trim());
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length<2) continue;
      const nombre = parts[0].trim();
      const id = parts[1].trim();
      try {
        const contact = await client.getContactById(id);
        await contact.unblock();
        log(`Desbloqueado: ${nombre} (${id})`);
        await new Promise(r=>setTimeout(r,1000));
      } catch (err) {
        log(`Error desbloqueando ${nombre} (${id}): ${err.message}`, true);
      }
    }
  } catch (err) {
    log('Error en desbloquearContactos: '+err.message, true);
  }
}

// --- Cargar contactos registrados ---
let aContactos = [];
(function() {
  try {
    const filePath = path.join(__dirname, 'contactos.txt');
    if (fs.existsSync(filePath)) {
      aContactos = fs.readFileSync(filePath,'utf8')
        .split(/\r?\n/)
        .map(line => {
          const p = line.split(':');
          return (p.length>=2) ? { nombre:p[0].trim(), numero:p[1].trim() } : null;
        })
        .filter(c=>c && c.numero);
      log(`Cargados ${aContactos.length} contactos desde contactos.txt`);
    } else {
      log('contactos.txt no encontrado. Se creará si se añaden contactos.');
    }
  } catch (err) {
    log('Error leyendo contactos.txt: '+err.message, true);
  }
})();

function agregarContactoNoRegistrado(nombre, numero) {
  const contacto = `${nombre}:${numero}`;
  const filePath = path.join(__dirname, 'contactos.txt');
  try {
    let data = '';
    if (fs.existsSync(filePath)) data = fs.readFileSync(filePath,'utf8');
    if (data.includes(`:${numero}`)) return;
    const newContent = data.trim() ? `${data.trim()}\n${contacto}` : contacto;
    fs.writeFileSync(filePath, newContent);
    log('Contacto agregado: '+contacto);
    // recargar
    aContactos = fs.readFileSync(filePath,'utf8')
      .split(/\r?\n/)
      .map(line=>{
        const p = line.split(':');
        return (p.length>=2) ? { nombre:p[0].trim(), numero:p[1].trim() } : null;
      })
      .filter(c=>c && c.numero);
    log(`Contactos recargados (${aContactos.length})`);
  } catch (err) {
    log('Error agregando contacto: '+err.message, true);
  }
}

// --- Cargar grupos → proyecto (grupoproyecto.txt) ---
function cargarGruposYProyectos(filePath) {
  const arr = [];
  try {
    if (fs.existsSync(filePath)) {
      fs.readFileSync(filePath,'utf8')
        .split(/\r?\n/)
        .forEach(line=>{
          const p = line.split(':');
          if (p.length>=2) arr.push({ grupo:p[0].trim(), proyecto:p[1].trim() });
        });
      log(`Cargados ${arr.length} mapeos grupo→proyecto.`);
    } else {
      log(`${path.basename(filePath)} no encontrado.`, true);
    }
  } catch (err) {
    log(`Error leyendo ${path.basename(filePath)}: ${err.message}`, true);
  }
  return arr;
}
const gruposYProyectos = cargarGruposYProyectos(path.join(__dirname,'grupoproyecto.txt'));

// --- Cargar proyecto → Notion API_KEY & PAGE_ID (notionproyecto.txt) ---
function cargarProyectosNotion(filePath) {
  const arr = [];
  try {
    if (fs.existsSync(filePath)) {
      fs.readFileSync(filePath,'utf8')
        .split(/\r?\n/)
        .map(l=>l.trim())
        .filter(l=>l && l.split(':').length>=3)
        .forEach(line=>{
          const parts = line.split(':');
          const proyecto  = parts[0].trim();
          const apiKey    = parts[1].trim();
          const databaseId= parts[2].trim();
          if (proyecto && apiKey && databaseId) {
            arr.push({ proyecto, apiKey, databaseId });
          }
        });
      log(`Cargados ${arr.length} mapeos proyecto→Notion (API_KEY+PAGE_ID).`);
    } else {
      log(`${path.basename(filePath)} no encontrado. Se usará configuración por defecto.`, true);
    }
  } catch (err) {
    log(`Error leyendo ${path.basename(filePath)}: ${err.message}`, true);
  }
  return arr;
}
const proyectosNotion = cargarProyectosNotion(path.join(__dirname,'notionproyecto.txt'));

// --- Construir clientes de Notion por proyecto ---
const notionIntegrations = {};
for (const { proyecto, apiKey, databaseId } of proyectosNotion) {
  notionIntegrations[proyecto.toLowerCase()] = {
    client: axios.create({
      baseURL: 'https://api.notion.com/v1',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      timeout: 120000
    }),
    databaseId
  };
}
// integración por defecto
const defaultNotion = {
  client: axios.create({
    baseURL: 'https://api.notion.com/v1',
    headers: {
      'Authorization': `Bearer ${DEFAULT_NOTION_API_KEY}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    timeout: 120000
  }),
  databaseId: DEFAULT_PAGE_ID
};

function getNotionIntegration(proyecto) {
  return notionIntegrations[proyecto.toLowerCase()] || defaultNotion;
}

// --- Guardar mensaje localmente ---
function saveMessage(obj) {
  let str;
  try { str = JSON.stringify(obj,null,2); }
  catch { str = '[No serializable]'; }
  try { fs.appendFileSync(getMessageLogFilePath(), str + '\n---\n'); }
  catch (err) { log('Error guardando mensaje: '+err.message, true); }
}

// --- Añadir entrada a Notion (dinámico) ---
async function addEntryToNotion(notionClient, databaseId,
  remitente, destinatario, tipo, fecha, contenido,
  telRemitente, telDestinatario, proyecto, grupo
) {
  const MAX = 2000;
  let cont = contenido || '';
  if (cont.length > MAX) cont = cont.substring(0,MAX-3)+'...';
  const payload = {
    parent: { database_id: databaseId },
    properties: {
      'Remitente': { title: [{ text:{ content: remitente } }] },
      'Destinatario': { rich_text:[{ text:{ content: destinatario } }] },
      'Tipo': { select:{ name: tipo } },
      'Fecha de Contacto': { date:{ start: fecha } },
      'Contenido': { rich_text:[{ text:{ content: cont } }] },
      'Teléfono remitente': { rich_text:[{ text:{ content: telRemitente } }] },
      'Teléfono destinatario':{ rich_text:[{ text:{ content: telDestinatario } }] },
      'Proyecto': { rich_text:[{ text:{ content: proyecto } }] },
      'Grupo':   { rich_text:[{ text:{ content: grupo } }] }
    }
  };
  try {
    const res = await notionClient.post('/pages', payload);
    log('Entrada agregada a Notion. ID: '+res.data.id);
  } catch (err) {
    const msg = err.response ? JSON.stringify(err.response.data) : err.message;
    log(`Error Notion: ${msg}`, true);
  }
}

// --- Añadir entrada a MariaDB ---
async function addEntryToMariaDB(
  messageId, senderName, recipientName, senderPhone, recipientPhone,
  messageType, messageTimestamp, content, groupName, projectName
) {
  if (!pool) { log('Pool MariaDB no disponible', true); return; }
  const sql = `
    INSERT INTO whatsapp_messages
    (message_id, sender_name, recipient_name, sender_phone, recipient_phone,
     message_type, message_timestamp, message_content, group_name, project_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const vals = [
    messageId,
    senderName, recipientName,
    senderPhone, recipientPhone,
    messageType, new Date(messageTimestamp),
    content, groupName,
    projectName==='N/A'?null:projectName
  ];
  let conn;
  try {
    conn = await pool.getConnection();
    const r = await conn.query(sql, vals);
    log(`Mensaje guardado en MariaDB. InsertId: ${r.insertId}`);
  } catch (err) {
    log('Error MariaDB: '+err.message, true);
  } finally {
    if (conn) {
      try { await conn.release(); }
      catch (e) { log('Error liberando MariaDB: '+e.message, true); }
    }
  }
}

// --- Inicializar cliente WhatsApp ---
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: baseDataDir }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox','--disable-setuid-sandbox',
      '--disable-dev-shm-usage','--disable-accelerated-2d-canvas',
      '--no-first-run','--no-zygote','--disable-gpu'
    ],
    timeout: 180000
  }
});

// --- Eventos del cliente ---
client.on('qr', qr => {
  log('Se necesita escanear QR.');
  if (bConsola) qrcode.generate(qr,{ small:true });
});
client.on('authenticated', () => log('Autenticación exitosa.'));
client.on('ready', () => {
  log(`Cliente listo como ${client.info.pushname||client.info.wid.user}`);
  const tz = "America/Mexico_City";
  cron.schedule('0 8 * * 0-4,6', ()=>desbloquearContactos(client).catch(e=>log(e.message,true)), { timezone: tz });
  cron.schedule('0 12 * * *', ()=>bloquearContactos(client).catch(e=>log(e.message,true)), { timezone: tz });
  cron.schedule('0 14 * * 0-4,6', ()=>desbloquearContactos(client).catch(e=>log(e.message,true)), { timezone: tz });
  cron.schedule('0 17 * * *', ()=>bloquearContactos(client).catch(e=>log(e.message,true)), { timezone: tz });
  log('Tareas cron configuradas.');
});
client.on('auth_failure', msg => log('Auth failure: '+msg, true));
client.on('disconnected', reason => {
  log('Desconectado: '+reason, true);
  setTimeout(()=>client.initialize().catch(e=>log(e.message,true)),120000);
});
client.on('change_state', state=>log('Estado cambiado: '+state));
client.on('error', err=>log('Error cliente: '+err.message, true));

// --- Procesar mensajes ---
async function processMessage(message, fromMe=false) {
  try {
    if (!message || message.isStatus || typeof message.body!=='string') return;
    if (!message.body.trim() || String(message.timestamp)===message.body.trim()) return;
    if (message.isBroadcast && !message.fromMe) return;

    const chat = await message.getChat();
    const ownNumber = client.info.wid._serialized;

    // Datos básicos
    const tipo = fromMe ? 'Salida' : 'Entrada';
    const fecha = message.timestamp
      ? new Date(message.timestamp*1000).toISOString()
      : new Date().toISOString();
    const contenido = message.body;
    const msgId = message.id?.id || null;

    let remitente = 'Desconocido', destinatario = 'Desconocido';
    let telRem = 'N/A', telDest = 'N/A';
    let grp = '', proj = 'N/A';

    if (fromMe) {
      remitente = client.info.pushname||'Yo';
      telRem = ownNumber;
      telDest = message.to;
      if (chat.isGroup) {
        grp = chat.name||'';
        destinatario = grp;
      } else {
        const ct = await client.getContactById(message.to);
        destinatario = ct.pushname||ct.name||buscarNombrePorNumero(message.to);
      }
    } else {
      destinatario = client.info.pushname||'Yo';
      telDest = ownNumber;
      if (chat.isGroup) {
        grp = chat.name||'';
        const authId = message.author||message.from;
        telRem = authId;
        if (authId) {
          const ac = await client.getContactById(authId);
          remitente = ac.pushname||ac.name||buscarNombrePorNumero(authId);
        }
      } else {
        telRem = message.from;
        const ct = await message.getContact();
        remitente = ct.pushname||ct.name||buscarNombrePorNumero(message.from);
        proj = DEFAULT_PROYECTO_ID||'N/A';
      }
    }

    // Determinar proyecto por grupo si existe
    if (grp) {
      const gm = gruposYProyectos.find(g=>g.grupo.toLowerCase()===grp.toLowerCase());
      proj = gm ? gm.proyecto : (DEFAULT_PROYECTO_ID||'N/A');
    }

    log(`[${tipo}] De:${remitente} A:${destinatario} Grupo:${grp} Proy:${proj} ID:${msgId}`);

    // Guardar local
    saveMessage(message);

    // Enviar a Notion con integración correcta
    const integration = getNotionIntegration(proj);
    await addEntryToNotion(
      integration.client,
      integration.databaseId,
      remitente, destinatario,
      tipo, fecha, contenido,
      telRem, telDest,
      proj, grp
    );

    // Enviar a MariaDB
    await addEntryToMariaDB(
      msgId, remitente, destinatario,
      telRem, telDest,
      tipo, fecha, contenido,
      grp, proj
    );
  } catch (err) {
    log('Error procesando mensaje: '+(err.stack||err), true);
    try {
      fs.appendFileSync(
        path.join(getDailyLogDirectory(),'error_messages.log'),
        `--- ERROR ${new Date().toISOString()} ---\n${err.stack||err}\n`
      );
    } catch {}
  }
}

client.on('message', m=>{ if (!m.fromMe) processMessage(m,false); });
client.on('message_create', m=>{ if (m.fromMe) processMessage(m,true); });

// --- Funciones auxiliares ---
function buscarNombrePorNumero(numeroFull) {
  if (!numeroFull) return 'Contacto no Registrado';
  const simple = numeroFull.split('@')[0].replace(/\D/g,'');
  const found = aContactos.find(c=>{
    const s = c.numero.replace(/\D/g,'');
    return simple.endsWith(s) || s.endsWith(simple);
  });
  return found ? found.nombre : 'Contacto no Registrado';
}

// --- Manejo global de errores y señales ---
process.on('unhandledRejection',(r)=>log('Unhandled Rejection: '+r, true));
process.on('uncaughtException', e=>{
  log('Uncaught Exception: '+(e.stack||e), true);
  setTimeout(()=>process.exit(1),500);
});

async function cleanup(sig) {
  log(`Señal ${sig} recibida. Cerrando...`);
  try { await client.destroy(); log('Cliente WhatsApp destruido.'); } catch {}
  try { await pool.end(); log('Pool MariaDB cerrado.'); } catch {}
  setTimeout(()=>process.exit(0),500);
}
process.on('SIGINT', ()=>cleanup('SIGINT'));
process.on('SIGTERM', ()=>cleanup('SIGTERM'));

// --- Inicializar cliente WhatsApp ---
log('Inicializando cliente WhatsApp...');
client.initialize().catch(e=>{
  log('Error inicializando cliente: '+e.message, true);
  setTimeout(()=>process.exit(1),1000);
});
log(`Script iniciado. bConsola=${bConsola}. DataPath=${baseDataDir}`);
