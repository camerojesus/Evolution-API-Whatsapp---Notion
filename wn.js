// Dependencias necesarias
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron'); // Importar la librería cron para programar tareas
require('dotenv').config();

// Define dataDir early
const dataDir = path.join(__dirname, 'data');

// Asegurar que el directorio 'data' existe
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Leer el archivo contactos.txt
const contactosData = fs.readFileSync('contactos.txt', 'utf-8');

// Procesar los datos y cargarlos en el array aContactos
let aContactos = contactosData.split('\n').map(line => {
  const [nombre, numero] = line.split(':');
  return { nombre: nombre.trim(), numero: numero.trim() };
});

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
        await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo antes de continuar
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
        await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo antes de continuar
      } catch (innerError) {
        log(`Error al desbloquear contacto ${nombre.trim()} (${contactId}): ${innerError}`);
      }
    }
  } catch (error) {
    log('Error al desbloquear contactos: ' + error);
  }
}

// Función para loggear solo errores y eventos importantes
function log(message) {
  const logFileName = getLogFileName();
  fs.appendFileSync(logFileName, `${new Date().toLocaleString()}: ${message}\n`);
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
});

// Manejar errores de autenticación
client.on('auth_failure', (msg) => {
  log('Error de autenticación: ' + msg);
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

// Inicializar el cliente de WhatsApp
client.initialize();

// Mantener el script en ejecución
setInterval(() => {
  log('Script sigue en ejecución. Hora: ' + new Date().toLocaleString());
}, 600000); // Log cada 10 minutos
