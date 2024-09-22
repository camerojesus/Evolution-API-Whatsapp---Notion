const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

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
function saveMessage(logMessage) {
    const messageFileName = getMessageFileName();
    fs.appendFile(messageFileName, logMessage, (err) => {
        if (err) {
            log('Error al guardar el mensaje: ' + err);
        }
    });
}

// Crear una instancia del cliente con autenticación local
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
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

// Función para procesar y guardar mensajes
async function processMessage(message, isOutgoing = false) {
    try {
        // Ignorar actualizaciones de estado
        if (message.isStatus) {
            return;
        }

        let logMessage = `Fecha: ${new Date().toLocaleString()}\n`;

        if (isOutgoing) {
            logMessage += `Tipo: Mensaje Saliente\n`;
        } else {
            // Obtener información del remitente
            const contact = await message.getContact();
            const senderNumber = contact.number || 'Número desconocido';
            const senderName = contact.pushname || contact.name || 'Nombre desconocido';

            // Verificar si el mensaje es de un grupo
            const chat = await message.getChat();
            if (chat.isGroup) {
                const groupName = chat.name || 'Nombre de grupo desconocido';
                logMessage += `Grupo: ${groupName} (${chat.id._serialized})\n`;
            }

            logMessage += `Tipo: Mensaje Entrante\n`;
            logMessage += `De: ${senderName} (${senderNumber})\n`;
        }

        logMessage += `Mensaje: ${message.body}\n\n`;

        saveMessage(logMessage); // Guardar el mensaje en archivo específico del día
    } catch (error) {
        log('Error al procesar el mensaje: ' + error);
    }
}

// Escuchar nuevos mensajes entrantes
client.on('message', async (message) => {
    await processMessage(message);
});

// Escuchar mensajes salientes
client.on('message_create', async (message) => {
    if (message.fromMe) {
        await processMessage(message, true);
    }
});

// Manejar la desconexión
client.on('disconnected', (reason) => {
    log('Cliente desconectado: ' + reason);
    client.destroy();
    setTimeout(() => {
        log('Intentando reconectar...');
        client.initialize();
    }, 5000);
});

// Capturar errores no manejados
process.on('unhandledRejection', (reason, promise) => {
    log('Unhandled Rejection at: ' + promise + ' reason: ' + reason);
});

// Inicializar el cliente
client.initialize();

// Mantener el script en ejecución
setInterval(() => {
    log('Script sigue en ejecución. Hora: ' + new Date().toLocaleString());
}, 600000); // Log cada 10 minutos
