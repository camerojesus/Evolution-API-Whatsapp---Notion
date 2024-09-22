// Dependencias necesarias
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

// Verifica que las variables de entorno se están cargando correctamente
log('NOTION_API_KEY: ' + process.env.NOTION_API_KEY);
log('PAGE_ID: ' + process.env.PAGE_ID);

// Variables de entorno
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const PAGE_ID = process.env.PAGE_ID;

// Leer el archivo contactos.txt
const contactosData = fs.readFileSync('contactos.txt', 'utf-8');

// Procesar los datos y cargarlos en el array aContactos
const aContactos = contactosData.split('\n').map(line => {
  const [nombre, numero] = line.split(':');
  return { nombre: nombre.trim(), numero: numero.trim() };
});

// Verificar que los contactos se han cargado correctamente
console.log(aContactos);

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
  

// Función para obtener el nombre del archivo de log en base a la fecha actual
function getLogFileName() {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses son 0-indexed
  const year = date.getFullYear();
  return `whatsapp-log-${day}-${month}-${year}.log`;
}

// Función para obtener el nombre del archivo de mensajes en base a la fecha actual
function getMessageFileName() {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses son 0-indexed
  const year = date.getFullYear();
  return `mensajes-${day}-${month}-${year}.log`;
}

// Función para loggear solo errores y eventos importantes
function log(message) {
  const logFileName = getLogFileName();
  fs.appendFileSync(logFileName, `${new Date().toLocaleString()}: ${message}\n`);
}

// Función para guardar mensajes en un archivo diferenciado por día
function saveMessage(logMessage,oObjetoMensaje) {
  const messageFileName = getMessageFileName();
  const mensajeString = JSON.stringify(oObjetoMensaje, null, 2); // Convertir a string con formato
  fs.appendFile(messageFileName, mensajeString, (err) => {
    if (err) {
      log('Error al guardar el mensaje: ' + err);
    }
  });
}

async function addEntryToNotionDatabase(pageId, cRemitente, cDestinatario,type, date, content, phoneNumber, cTelefonoDestinatario, groupNumber) {
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
                content: phoneNumber
              }
            }
          ]
        },
        'Teléfono destinatario': {
          rich_text: [
            {
              text: {
                content: phoneNumber
              }
            }
          ]
        },

        'Grupo': {
          rich_text: [
            {
              text: {
                content: groupNumber
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

    let cTelefonoDestinatario=message.to

    // Guardar el mensaje en el archivo específico del día
    saveMessage(logMessage,message);

    // Enviar el mensaje a la base de datos de Notion
    
    
    await addEntryToNotionDatabase(PAGE_ID, cRemitente, cDestinatario, type, date, content, phoneNumber, cTelefonoDestinatario,groupNumber);

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

// Capturar errores no manejados
process.on('unhandledRejection', (reason, promise) => {
  log('Unhandled Rejection at: ' + promise + ' reason: ' + reason);
});

// Inicializar el cliente de WhatsApp
client.initialize();

// Mantener el script en ejecución
setInterval(() => {
  log('Script sigue en ejecución. Hora: ' + new Date().toLocaleString());
}, 600000); // Log cada 10 minutos