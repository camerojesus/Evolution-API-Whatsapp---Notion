/**
 * whatsapp_sync.js – WhatsApp → Notion + MariaDB
 *
 *  ▸ Múltiples proyectos ➜ múltiples databases / tokens (notionproyecto.txt)
 *  ▸ Cada registro crea sub-página con cuerpo completo + firma
 *  ▸ Propiedad “Contenido” (rich_text) = mención a la sub-página
 *  ▸ Registros locales, cron de bloqueo, etc.
 */

'use strict';

/*━━━━━━━━━━  DEPENDENCIAS  ━━━━━━━━━━*/
require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode  = require('qrcode-terminal');
const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');
const cron    = require('node-cron');
const mariadb = require('mariadb');

/*━━━━━━━━━━  VARIABLES DE ENTORNO POR DEFECTO  ━━━━━━━━━━*/
const DEFAULT_NOTION_API_KEY = process.env.NOTION_API_KEY;
const DEFAULT_PAGE_ID        = process.env.PAGE_ID;       // Database ID por defecto
const DEFAULT_PROYECTO_ID    = process.env.PROYECTO_ID;   // Proyecto por defecto

if (!DEFAULT_NOTION_API_KEY || !DEFAULT_PAGE_ID) {
  console.error('Error CRÍTICO: NOTION_API_KEY o PAGE_ID no definidos en .env');
  process.exit(1);
}

/*━━━━━━━━━━  CONFIGURACIÓN DE CONSOLA  ━━━━━━━━━━*/
const bConsola = false;            // true = muestra logs y QR

/*━━━━━━━━━━  DIRECTORIO BASE PARA SESIÓN Y LOGS  ━━━━━━━━━━*/
const baseDataDir = path.join(__dirname, 'data');
if (!fs.existsSync(baseDataDir)) fs.mkdirSync(baseDataDir, { recursive: true });

/*━━━━━━━━━━  POOL MariaDB  ━━━━━━━━━━*/
let pool;
try {
  pool = mariadb.createPool({
    host            : process.env.DB_HOST,
    user            : process.env.DB_USER,
    password        : process.env.DB_PASSWORD,
    database        : process.env.DB_DATABASE,
    port            : process.env.DB_PORT || 3306,
    connectionLimit : 5,
    charset         : 'utf8mb4',
    connectTimeout  : 15000
  });
} catch (e) {
  console.error('Error fatal creando pool MariaDB:', e);
  process.exit(1);
}

/*━━━━━━━━━━  FECHA EN ESPAÑOL  ━━━━━━━━━━*/
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
               'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
function getDailyDir () {
  const d = new Date();
  const mDir = `${d.getFullYear()}_${String(d.getMonth()+1).padStart(2,'0')}_${MESES[d.getMonth()]}`;
  const dDir = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}_${DIAS[d.getDay()]}`;
  const p = path.join(baseDataDir, mDir, dDir);
  if (!fs.existsSync(p)) fs.mkdirSync(p,{recursive:true});
  return p;
}
function logFile () { const d=new Date(); return path.join(getDailyDir(),`whatsapp-log-${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}.log`);}
function msgFile () { const d=new Date(); return path.join(getDailyDir(),`mensajes-${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}.log`);}
function log (m, err=false){ const l=`${new Date().toLocaleString()}: ${m}`; try{fs.appendFileSync(logFile(),l+'\n');}catch{} if(bConsola)(err?console.error:console.log)(l);}

/*━━━━━━━━━━  CARGA contactos, grupos, proyectos  ━━━━━━━━━━*/
let aContactos=[];
function cargarContactos(){
  const p=path.join(__dirname,'contactos.txt');
  if(!fs.existsSync(p)) return;
  aContactos = fs.readFileSync(p,'utf8').split(/\r?\n/)
    .map(l=>{const s=l.split(':');return s.length>=2?{nombre:s[0].trim(),numero:s[1].trim()}:null;})
    .filter(Boolean);
}
cargarContactos();
function buscarNombrePorNumero(num=''){ const s=num.split('@')[0].replace(/\D/g,''); const f=aContactos.find(c=>{const t=c.numero.replace(/\D/g,'');return s.endsWith(t)||t.endsWith(s);}); return f?f.nombre:'Contacto no Registrado';}

function cargarMapeo(f,n) {
  if(!fs.existsSync(f)) { log(`${n} no encontrado.`); return[];}
  return fs.readFileSync(f,'utf8').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
}
const gruposYProy = cargarMapeo(path.join(__dirname,'grupoproyecto.txt'),'grupoproyecto.txt')
  .map(l=>{const p=l.split(':');return p.length>=2?{grupo:p[0].trim(),proyecto:p[1].trim()}:null;}).filter(Boolean);

const proyectosNotion = cargarMapeo(path.join(__dirname,'notionproyecto.txt'),'notionproyecto.txt')
  .map(l=>{const p=l.split(':');return p.length>=3?{proyecto:p[0].trim(),apiKey:p[1].trim(),databaseId:p[2].trim()}:null;}).filter(Boolean);

const notionIntegrations={};
for(const {proyecto,apiKey,databaseId} of proyectosNotion){
  notionIntegrations[proyecto.toLowerCase()] = {
    client: axios.create({
      baseURL: 'https://api.notion.com/v1',
      headers:{
        'Authorization':`Bearer ${apiKey}`,
        'Content-Type':'application/json',
        'Notion-Version':'2022-06-28'
      },
      timeout:120000
    }),
    databaseId
  };
}
const defaultNotion = {
  client: axios.create({
    baseURL:'https://api.notion.com/v1',
    headers:{
      'Authorization':`Bearer ${DEFAULT_NOTION_API_KEY}`,
      'Content-Type':'application/json',
      'Notion-Version':'2022-06-28'
    },
    timeout:120000
  }),
  databaseId: DEFAULT_PAGE_ID
};
function getIntegration(p){ return notionIntegrations[p.toLowerCase()]||defaultNotion; }
function proyectoPorGrupo(g){ const m=gruposYProy.find(x=>x.grupo.toLowerCase()===g.toLowerCase()); return m?m.proyecto:(DEFAULT_PROYECTO_ID||'N/A');}

/*━━━━━━━━━━  GUARDAR RAW  ━━━━━━━━━━*/
function saveRaw(o){ try{fs.appendFileSync(msgFile(),JSON.stringify(o,null,2)+'\n---\n');}catch{}}

/*━━━━━━━━━━  INSERCIÓN EN NOTION – CON SUB-PÁGINA  ━━━━━━━━━━*/
async function addEntryToNotion(
  notionClient, databaseId,
  remitente, destinatario, tipo, isoDate, contenido,
  telRem, telDest, proyecto, grupo
){
  /* paso 1 – fila principal */
  let pageId;
  try{
    const res = await notionClient.post('/pages',{
      parent:{database_id:databaseId},
      properties:{
        'Remitente'          :{title:[{text:{content:remitente||'Desconocido'}}]},
        'Destinatario'       :{rich_text:[{text:{content:destinatario||'Desconocido'}}]},
        'Tipo'               :{select:{name:tipo}},
        'Fecha de Contacto'  :{date:{start:isoDate}},
        'Contenido'          :{rich_text:[{text:{content:'(ver sub-página)'}}]},
        'Teléfono remitente' :{rich_text:[{text:{content:telRem||'N/A'}}]},
        'Teléfono destinatario':{rich_text:[{text:{content:telDest||'N/A'}}]},
        'Proyecto'           :{rich_text:[{text:{content:proyecto}}]},
        'Grupo'              :{rich_text:[{text:{content:grupo}}]}
      }
    });
    pageId = res.data.id;
  }catch(e){
    log('Error creando fila Notion: '+(e.response?JSON.stringify(e.response.data):e.message),true);
    return;
  }

  /* paso 2 – sub-página */
  const tituloSub = (contenido||'(sin contenido)').slice(0,150);
  const bloques=[];
  const MAX=1900;
  for(let i=0;i<contenido.length;i+=MAX){
    bloques.push({
      object:'block',
      type:'paragraph',
      paragraph:{rich_text:[{text:{content:contenido.slice(i,i+MAX)}}]}
    });
    if(bloques.length===99)break;
  }
  const firma = [
    '',
    '---',
    `Remitente : ${remitente}`,
    `Destinatario: ${destinatario}`,
    `FechaHora : ${isoDate}`,
    `Proyecto  : ${proyecto}`,
    `Grupo     : ${grupo}`
  ].join('\n');
  bloques.push({object:'block',type:'paragraph',paragraph:{rich_text:[{text:{content:firma}}]}});
  let subId;
  try{
    const r = await notionClient.post('/pages',{
      parent:{page_id:pageId},
      properties:{title:[{text:{content:tituloSub}}]},
      children:bloques
    });
    subId=r.data.id;
  }catch(e){
    log('Error creando sub-página: '+(e.response?JSON.stringify(e.response.data):e.message),true);
    return;
  }

  /* paso 3 – mención en “Contenido” */
  try{
    await notionClient.patch(`/pages/${pageId}`,{
      properties:{
        'Contenido':{
          rich_text:[{type:'mention',mention:{page:{id:subId}}}]
        }
      }
    });
    log(`Notion OK: fila ${pageId} ➜ sub-página ${subId}`);
  }catch(e){
    log('Error actualizando mención: '+(e.response?JSON.stringify(e.response.data):e.message),true);
  }
}

/*━━━━━━━━━━  INSERTAR EN MariaDB  ━━━━━━━━━━*/
async function addEntryToMariaDB(
  msgId, remitente, destinatario,
  telRem, telDest,
  tipo, isoDate, cuerpo,
  grupo, proyecto
){
  if(!pool){log('Pool MariaDB no disponible',true);return;}
  const sql = `
    INSERT INTO whatsapp_messages
      (message_id,sender_name,recipient_name,sender_phone,recipient_phone,
       message_type,message_timestamp,message_content,group_name,project_name)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `;
  const vals=[
    msgId,
    remitente||'Desconocido',
    destinatario||'Desconocido',
    telRem||'N/A',
    telDest||'N/A',
    tipo,
    new Date(isoDate),
    cuerpo||'(Sin contenido)',
    grupo||null,
    proyecto==='N/A'?null:proyecto
  ];
  let c;
  try{ c=await pool.getConnection(); await c.query(sql,vals);}
  catch(e){ log('Error MariaDB: '+e.message,true); }
  finally{ if(c) await c.release(); }
}

/*━━━━━━━━━━  CLIENTE WHATSAPP  ━━━━━━━━━━*/
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: baseDataDir }),
  puppeteer : {
    headless:true,
    args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas','--no-first-run',
          '--no-zygote','--disable-gpu'],
    timeout:180000
  }
});
client.on('qr', qr=>{ log('Escanee el QR'); if(bConsola)qrcode.generate(qr,{small:true}); });
client.on('authenticated',()=>log('Autenticado.'));
client.on('ready',()=>log('WhatsApp listo.'));
client.on('auth_failure',m=>log('Auth failure: '+m,true));
client.on('disconnected',r=>{log('Desconectado: '+r,true);setTimeout(()=>client.initialize(),120000);});
client.on('error',e=>log('WhatsApp error: '+e.message,true));

/*━━━━━━━━━━  PROCESAR MENSAJE  ━━━━━━━━━━*/
async function processMessage(m,out){
  try{
    if(!m||m.isStatus||typeof m.body!=='string')return;
    if(!m.body.trim()||String(m.timestamp)===m.body.trim())return;
    if(m.isBroadcast&&!m.fromMe)return;

    const chat=await m.getChat();
    const yo = client.info.wid._serialized;
    const tipo = out?'Salida':'Entrada';
    const isoDate = m.timestamp?new Date(m.timestamp*1000).toISOString():new Date().toISOString();
    const cuerpo  = m.body;
    const msgId   = m.id?.id||null;

    let remit='Desconocido', dest='Desconocido', telRem='N/A', telDest='N/A', grp='', proj='N/A';

    if(out){
      remit = client.info.pushname||'Yo';
      telRem=yo; telDest=m.to;
      if(chat.isGroup){ grp=chat.name||''; dest=grp; }
      else{
        const c=await client.getContactById(m.to);
        dest=c.pushname||c.name||buscarNombrePorNumero(m.to);
      }
    }else{
      dest=client.info.pushname||'Yo'; telDest=yo;
      if(chat.isGroup){
        grp=chat.name||''; const auth=m.author||m.from;
        telRem=auth; const c=await client.getContactById(auth);
        remit=c.pushname||c.name||buscarNombrePorNumero(auth);
      }else{
        telRem=m.from; const c=await m.getContact();
        remit=c.pushname||c.name||buscarNombrePorNumero(m.from);
        proj=DEFAULT_PROYECTO_ID||'N/A';
      }
    }
    if(grp) proj = proyectoPorGrupo(grp);

    log(`[${tipo}] ${remit}→${dest} G:${grp} P:${proj}`);

    saveRaw(m);

    const integ = getIntegration(proj);
    await addEntryToNotion(
      integ.client, integ.databaseId,
      remit,dest,tipo,isoDate,cuerpo,
      telRem,telDest,proj,grp
    );
    await addEntryToMariaDB(
      msgId,remit,dest,telRem,telDest,
      tipo,isoDate,cuerpo,grp,proj
    );
  }catch(e){ log('Error procesando mensaje: '+(e.stack||e),true); }
}
client.on('message', m=>{ if(!m.fromMe) processMessage(m,false); });
client.on('message_create', m=>{ if(m.fromMe) processMessage(m,true); });

/*━━━━━━━━━━  INIT  ━━━━━━━━━━*/
log('Inicializando WhatsApp…');
client.initialize().catch(e=>log('Init error: '+e.message,true));

/*━━━━━━━━━━  SALIDA SEGURA  ━━━━━━━━━━*/
async function clean(sig){ log(`Señal ${sig}. Cerrando…`); try{await client.destroy();}catch{} try{await pool.end();}catch{} process.exit(0);}
process.on('SIGINT', ()=>clean('SIGINT'));
process.on('SIGTERM',()=>clean('SIGTERM'));
