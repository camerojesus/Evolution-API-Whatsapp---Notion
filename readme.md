# WhatsApp Automation - wn.js

Este proyecto es una implementación para automatizar la interacción con WhatsApp usando la biblioteca `whatsapp-web.js`. El script está diseñado para bloquear y desbloquear contactos de manera programada, procesar mensajes entrantes y salientes, y registrar eventos importantes en archivos de log. Además, se integra con Notion para guardar información sobre las interacciones en una base de datos de la plataforma.

## Requisitos

- Node.js (versión 14 o superior)
- `whatsapp-web.js`
- `qrcode-terminal`
- `axios`
- `dotenv`
- `cron`
- `fs`
- `path`

Asegúrate de tener las siguientes dependencias instaladas:

```bash
npm install whatsapp-web.js qrcode-terminal axios dotenv cron fs-extra
```

## Configuración

1. Clona este repositorio.
2. Crea un archivo `.env` con las siguientes variables:
    ```bash
    NOTION_API_KEY=<tu-api-key>
    PAGE_ID=<id-de-la-base-de-datos-en-notion>
    PROYECTO_ID=<id-del-proyecto>
    ```
3. Coloca los siguientes archivos de texto en el directorio raíz:
   - `contactos.txt`: Lista de contactos en el formato `nombre:número`.
   - `contactosbloquear.txt`: Lista de contactos a bloquear en el formato `nombre:número`.
   - `grupoproyecto.txt`: Mapeo de grupos y proyectos en el formato `grupo:proyecto`.

## Funcionalidades

### 1. Bloqueo y Desbloqueo Automático de Contactos
Se implementa la funcionalidad para bloquear y desbloquear contactos de manera programada, leyendo los datos desde `contactosbloquear.txt`.

- **Bloqueo de contactos**: Se ejecuta a las 12:46 pm y 5:00 pm.
- **Desbloqueo de contactos**: Se ejecuta a las 1:00 pm y 8:00 am.

### 2. Procesamiento de Mensajes
El script escucha mensajes entrantes y salientes, y registra los eventos en archivos de log. Los mensajes también se guardan en Notion.

- **Mensajes entrantes**: Son procesados y almacenados en un archivo de log diario. Si el remitente no está registrado en `contactos.txt`, se agrega automáticamente.
- **Mensajes salientes**: Los mensajes enviados también se loguean y almacenan de manera similar.
- **Notion Integration**: Cada mensaje se sube a una base de datos en Notion con los campos de remitente, destinatario, fecha, contenido, proyecto y grupo.

### 3. Logs
El script genera dos tipos de archivos de log:
- **whatsapp-log-[dd-mm-yyyy].log**: Registra eventos importantes y errores.
- **mensajes-[dd-mm-yyyy].log**: Registra los mensajes procesados.

### 4. Reconexión Automática
Si el cliente de WhatsApp se desconecta, el script intenta reconectarse automáticamente después de 2 minutos.

### 5. Mantenimiento
El script incluye una función que registra cada 10 minutos que sigue en ejecución para asegurar su funcionamiento continuo.

## Funciones Principales

### `bloquearContactos(client)`
Lee la lista de contactos desde `contactosbloquear.txt` y bloquea a los contactos especificados en WhatsApp.

### `desbloquearContactos(client)`
Similar a `bloquearContactos`, pero desbloquea a los contactos.

### `processMessage(message, isOutgoing)`
Procesa los mensajes entrantes y salientes. Los guarda en archivos de log y los sube a la base de datos de Notion.

### `addEntryToNotionDatabase(pageId, cRemitente, cDestinatario, type, date, content)`
Envía los detalles de un mensaje a la base de datos en Notion.

### `log(message)`
Función auxiliar para registrar eventos y errores en archivos de log.

### `agregarContactoNoRegistrado(nombre, numero)`
Si un contacto no está registrado en `contactos.txt`, se agrega automáticamente y se recargan los contactos.

## Ejecución

Para ejecutar el proyecto, simplemente utiliza el siguiente comando en la terminal:

```bash
node wn.js
```

El cliente de WhatsApp se inicializará, y si es necesario, se te pedirá que escanees un código QR. Una vez autenticado, el script funcionará de manera continua para bloquear/desbloquear contactos y procesar mensajes.

## Consideraciones

- **Seguridad**: Asegúrate de que tus claves API y otros datos confidenciales estén almacenados de manera segura. No compartas tu archivo `.env` en público.
- **Cron Jobs**: El uso de `node-cron` permite programar tareas automáticas. Puedes ajustar los tiempos de bloqueo/desbloqueo según tus necesidades.

## Contribuciones

Si deseas contribuir a este proyecto, por favor realiza un fork y envía una pull request con tus mejoras.

---

### Autor
Proyecto desarrollado por Jesús Camero.