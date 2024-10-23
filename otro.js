// Dependencias necesarias
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron'); // Importar la librería cron para programar tareas
require('dotenv').config();

// Define dataDir early
const dataDir = path.join(__dirname, 'data');

// Asegurar que el directorio 'data' existe
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Función para obtener el nombre del archivo de log en base a la fecha actual
function getLogFileName() {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses son 0-indexed
  const year = date.getFullYear();
  const fileName = `whatsapp-log-${day}-${month}-${year}.log`;
  return path.join(dataDir, fileName);
}

// Función para bloquear usuarios leyendo de contactosbloquear.txt
async function bloquearContactos(client) {
  try {
    const data = fs.readFileSync('contactosbloquear.txt', 'utf-8');
    const lines = data.split('\n').filter(line => line.trim() !== ''); // Eliminar líneas vacías

    for (const line of lines) {
      const [nombre, id] = line.split(':');
      const contactId = id.trim();
      try {
        const contact = await client.getContactById(contactId);
        await contact.block();
        log(`Contacto bloqueado: ${nombre.trim()} (${contactId})`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Esperar 1 segundo antes de continuar
      } catch (innerError) {
        log(`Error al bloquear contacto ${nombre.trim()} (${contactId}): ${innerError}`);
      }
    }
  } catch (error) {
    log('Error al bloquear contactos: ' + error);
  }
}

// Función para desbloquear usuarios leyendo de contactosbloquear.txt
async function desbloquearContactos(client) {
  try {
    const data = fs.readFileSync('contactosbloquear.txt', 'utf-8');
    const lines = data.split('\n').filter(line => line.trim() !== ''); // Eliminar líneas vacías

    for (const line of lines) {
      const [nombre, id] = line.split(':');
      const contactId = id.trim();
      try {
        const contact = await client.getContactById(contactId);
        await contact.unblock();
        log(`Contacto desbloqueado: ${nombre.trim()} (${contactId})`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Esperar 1 segundo antes de continuar
      } catch (innerError) {
        log(`Error al desbloquear contacto ${nombre.trim()} (${contactId}): ${innerError}`);
      }
    }
  } catch (error) {
    log('Error al desbloquear contactos: ' + error);
  }
}

// Función para obtener el nombre del archivo de mensajes en base a la fecha actual
function getMessageFileName() {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses son 0-indexed
  const year = date.getFullYear();
  const fileName = `mensajes-${day}-${month}-${year}.log`;
  return path.join(dataDir, fileName);
}

// Función para loggear solo errores y eventos importantes
function log(message) {
  const logFileName = getLogFileName();
  fs.appendFileSync(logFileName, `${new Date().toLocaleString()}: ${message}\n`);
}

// Verifica que las variables de entorno se están cargando correctamente
log('NOTION_API_KEY: ' + process.env.NOTION_API_KEY);
log('PAGE_ID: ' + process.env.PAGE_ID);

// Variables de entorno
const NOTION_API_KEY  = process.env.NOTION_API_KEY;
const PAGE_ID         = process.env.PAGE_ID;
const PROYECTO_ID     = process.env.PROYECTO_ID;

// Leer el archivo contactos.txt
const contactosData = fs.readFileSync('contactos.txt', 'utf-8');

// Procesar los datos y cargarlos en el array aContactos
let aContactos = contactosData.split('\n').map(line => {
  const [nombre, numero] = line.split(':');
  return { nombre: nombre.trim(), numero: numero.trim() };
});

// Verificar que los contactos se han cargado correctamente
console.log("PROYECTO ACTIVO: ", PROYECTO_ID)

// Función para agregar un contacto no registrado al archivo contactos.txt
function agregarContactoNoRegistrado(nombre, numero) {
  const contacto = `${nombre}:${numero}`;
  const filePath = path.join(__dirname, 'contactos.txt');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      log('Error al leer el archivo de contactos: ' + err);
      return;
    }

    const newContent = data.trim() ? `${data.trim()}\n${contacto}` : contacto;

    fs.writeFile(filePath, newContent, (err) => {
      if (err) {
        log('Error al agregar contacto no registrado: ' + err);
      } else {
        // reemplazar por guardar en el archivo de .log
        log('Contacto no registrado agregado: ' + contacto);
        
        // Recargar el array aContactos
        const contactosData = fs.readFileSync(filePath, 'utf8');
        aContactos = contactosData.split('\n').map(line => {
          const [nombre, numero] = line.split(':');
          return { nombre: nombre.trim(), numero: numero.trim() };
        });
        log("Contactos recargados");
      }
    });
  });
}

// Función para cargar el contenido del archivo en un array
function cargarGruposYProyectos(filePath) {
  const data = fs.readFileSync(filePath, 'utf8');
  const lines = data.split('\n');
  const gruposYProyectos = [];

  lines.forEach(line => {
    const [grupo, proyecto] = line.split(':');
    if (grupo && proyecto) {
      gruposYProyectos.push({ grupo: grupo.trim(), proyecto: proyecto.trim() });
    }
  });

  return gruposYProyectos;
}

// Ruta del archivo grupoproyecto.txt
const filePath = path.join(__dirname, 'grupoproyecto.txt');

// Cargar los datos en el array
const gruposYProyectos = cargarGruposYProyectos(filePath);

// Configuración de Axios para conectar con Notion
const notionClient = axios.create({
    baseURL: 'https://api.notion.com/v1',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    timeout: 120000 // Tiempo de espera en milisegundos (60 segundos)
  });  

// Función para guardar mensajes en un archivo diferenciado por día
function saveMessage(logMessage, oObjetoMensaje) {
  const messageFileName = getMessageFileName();
  const mensajeString = JSON.stringify(oObjetoMensaje, null, 2); // Convertir a string con formato
  fs.appendFile(messageFileName, mensajeString, (err) => {
    if (err) {
      log('Error al guardar el mensaje: ' + err);
    }
  });
}

async function addEntryToNotionDatabase(pageId, cRemitente, cDestinatario, type, date, content, cTelefonoRemitente, cTelefonoDestinatario, cProyecto, cNombreGrupo) {
  try {
    const response = await notionClient.post(`/pages`, {
      parent: { database_id: pageId },
      properties: {
        'Remitente': {
          title: [
            {
              text: {
                content: cRemitente
              }
            }
          ]
        },
        'Destinatario': {
          rich_text: [
            {
              text: {
                content: cDestinatario
              }
            }
          ]
        },
        'Tipo': {
          select: {
            name: type
          }
        },
        'Fecha de Contacto': {
          date: {
            start: date
          }
        },
        'Contenido': {
          rich_text: [
            {
              text: {
                content: content
              }
            }
          ]
        },
        'Teléfono remitente': {
          rich_text: [
            {
              text: {
                content: cTelefonoRemitente
              }
            }
          ]
        },
        'Teléfono destinatario': {
          rich_text: [
            {
              text: {
                content: cTelefonoDestinatario
              }
            }
          ]
        },
        'Proyecto': {
          rich_text: [
            {
              text: {
                content: cProyecto
              }
            }
          ]
        },
        'Grupo': {
          rich_text: [
            {
              text: {
                content: cNombreGrupo
              }
            }
          ]
        }
      }
    });
    log('Entrada agregada a la base de datos de Notion: ' + JSON.stringify(response.data));
  } catch (error) {
    log('Error agregando entrada a la base de datos de Notion: ' + (error.response ? JSON.stringify(error.response.data) : error.message));
  }
}

// Crear una instancia del cliente con autenticación local para WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        timeout: 1200000 // Aumenta el tiempo de espera a 60 segundos
    }
});

// Manejar la generación del código QR
client.on('qr', (qr) => {
  log('Escanea el siguiente código QR para iniciar sesión.');
  qrcode.generate(qr, { small: true });
});

// Cuando el cliente está autenticando
client.on('authenticated', () => {
  log('Autenticación exitosa.');
});

// Cuando el cliente está listo
client.on('ready', () => {
  log('Cliente está listo y conectado.');
  // Programar el bloqueo de contactos todos los días a las 12:46pm
  cron.schedule('00 12 * * *', () => {
    log('Iniciando bloqueo de contactos programado.');
    bloquearContactos(client);
  });

  // Programar el desbloqueo de contactos todos los días a la 1:00pm
  cron.schedule('00 13 * * *', () => {
    log('Iniciando desbloqueo de contactos programado.');
    desbloquearContactos(client);
  });

  cron.schedule('00 17 * * *', () => {
    log('Iniciando bloqueo de contactos programado.');
    bloquearContactos(client);
  });  

  cron.schedule('00 08 * * *', () => {
    log('Iniciando desbloqueo de contactos programado.');
    desbloquearContactos(client);
  });  
  desbloquearContactos(client);
});

// Manejar errores de autenticación
client.on('auth_failure', (msg) => {
  log('Error de autenticación: ' + msg);
});

// Función para procesar y guardar mensajes, y enviar a Notion
async function processMessage(message, isOutgoing = false) {
  let cTipoMensaje='';
  try {      
    // Ignorar actualizaciones de estado
    if (message.isStatus) {
      return;
    }

    // Ignorar mensajes sin texto
    if (!message.body || message.body.trim() === '') {
      return;
    }
    let logMessage = `Fecha: ${new Date().toLocaleString()}\n`;
    let contact = '';
    let phoneNumber = '';
    let groupNumber = '';
    let type = isOutgoing ? 'Salida' : 'Entrada';
    let date = new Date().toISOString();
    let content = message.body;

    // Obtener información del chat
    const chat = await message.getChat();

    if (isOutgoing) {
      logMessage += `Tipo: Mensaje Saliente\n`;
      phoneNumber = chat.id.user || 'Número desconocido';
      contact = 'Usuario (Yo)';
      logMessage += `Para: ${phoneNumber}\n`;
      cTipoMensaje='Salida';
    } else {
      // Obtener información del remitente
      const contactInfo = await message.getContact();
      phoneNumber = contactInfo.number || 'Número desconocido';
      contact = contactInfo.pushname || contactInfo.name || 'Nombre desconocido';

      logMessage += `Tipo: Mensaje Entrante\n`;
      logMessage += `De: ${contact} (${phoneNumber})\n`;
      cTipoMensaje='Entrada';
    }

    // Verificar si el mensaje es de un grupo
    if (chat.isGroup) {
      const groupName = chat.name || 'Nombre de grupo desconocido';
      groupNumber = chat.id._serialized || '';
      logMessage += `Grupo: ${groupName} (${groupNumber})\n`;
    }

    logMessage += `Mensaje: ${message.body}\n\n`;

    if(cTipoMensaje==='Salida'){
       contact="Jesús Camero (yo)"
    }
    else{
      contact=buscarNombrePorNumero(message.from)
    }

    let cRemitente=''
    cRemitente=buscarNombrePorNumero(message.from)

    let cDestinatario=''
    cDestinatario=buscarNombrePorNumero(message.to)

    let cTelefonoRemitente=message.from
    let cTelefonoDestinatario=message.to

    let cIDGrupo=getGroupIdIfGroupChat(message);
    let cNombreGrupo=buscarNombrePorNumero(cIDGrupo)

    if(message.author) {
        cRemitente=buscarNombrePorNumero(message.author)
    }

    if(cNombreGrupo==='Contacto no Registrado'){
      cNombreGrupo=''
    }

    if(cRemitente==='Contacto no Registrado'){
       if(message._data.notifyName){
        cRemitente=message._data.notifyName;       
        if(message.author) {
          agregarContactoNoRegistrado(cRemitente, message.author);
        }else{
          agregarContactoNoRegistrado(cRemitente, message.from);
        }        
       } 
    }

    let cProyecto=obtenerProyectoPorGrupo(cNombreGrupo);
    
    // Guardar el mensaje en el archivo específico del día
    saveMessage(logMessage,message);

    // Enviar el mensaje a la base de datos de Notion
    await addEntryToNotionDatabase(PAGE_ID, cRemitente, cDestinatario, type, date, content, cTelefonoRemitente, cTelefonoDestinatario, cProyecto, cNombreGrupo);

  } catch (error) {
    log('Error al procesar el mensaje: ' + error);
  }
}

// Escuchar nuevos mensajes entrantes en WhatsApp
client.on('message', async (message) => {
  await processMessage(message);
});

// Escuchar mensajes salientes
client.on('message_create', async (message) => {
  if (message.fromMe) {
    await processMessage(message, true);
  }
});

// Manejar la desconexión de WhatsApp
client.on('disconnected', (reason) => {
  log('Cliente desconectado: ' + reason);
  client.destroy();
  setTimeout(() => {
    log('Intentando reconectar...');
    client.initialize();
  }, 120000);
});

function buscarNombrePorNumero(numero) {
  for (const contacto of aContactos) {
    if (numero.includes(contacto.numero)) {
      return contacto.nombre;
    }
  }
  return "Contacto no Registrado";
}

function obtenerProyectoPorGrupo(nombreGrupo) {
  const grupoProyecto = gruposYProyectos.find(gp => gp.grupo === nombreGrupo);
  return grupoProyecto ? grupoProyecto.proyecto : 'N/A';
}

function getGroupIdIfGroupChat(message) {
  // Verifica si es un chat grupal verificando el campo '_data.id.remote'
  if (message._data && message._data.id && message._data.id.remote.endsWith('@g.us')) {
      return message._data.id.remote;  // Retorna el ID del grupo
  }
  return '';  // Si no es un grupo, retorna una cadena vacía
}

// Capturar errores no manejados
process.on('unhandledRejection', (reason, promise) => {
  log('Unhandled Rejection at: ' + promise + ' reason: ' + reason);
});

// Inicializar el cliente de WhatsApp
client.initialize();

// Mantener el script en ejecución
setInterval(() => {
  log('Script sigue en ejecución. Hora: ' + new Date().toLocaleString());
}, 600000); // Log cada