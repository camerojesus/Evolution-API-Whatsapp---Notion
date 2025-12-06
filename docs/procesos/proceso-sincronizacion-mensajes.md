# Proceso de Sincronización de Mensajes WhatsApp a Notion y MariaDB

## Inicio del Proceso
- **Archivo**: `whatsapp-notion-mariadb.js`
- **Función**: Inicialización del cliente WhatsApp
- Cargar configuraciones de entorno (.env)
- Configurar pool de conexiones MariaDB
- Cargar mapeos de contactos, grupos y proyectos
- Inicializar cliente de WhatsApp con LocalAuth

## Procesamiento de Mensajes Entrantes
- **Evento**: `client.on('message')`
- **Función**: `processMessage(m, false)`
- Validar mensaje (no status, tiene body, no vacío)
- Obtener información del chat
- Determinar remitente y destinatario
  - SI es grupo → obtener autor y nombre del grupo
  - SINO → obtener contacto directo
- Asignar proyecto basado en grupo o defecto
- Guardar mensaje raw en archivo
- Insertar en Notion
  - **Función**: `addEntryToNotion`
  - Crear fila principal en database
  - Crear sub-página con contenido completo
  - Actualizar fila con mención a sub-página
- Insertar en MariaDB
  - **Función**: `addEntryToMariaDB`
  - Ejecutar query INSERT

## Procesamiento de Mensajes Salientes
- **Evento**: `client.on('message_create')`
- **Función**: `processMessage(m, true)`
- Similar a entrantes pero con remitente = 'Yo'
- Insertar en Notion y MariaDB

## Gestión de Sesión WhatsApp
- Generar QR si no autenticado
- Manejar eventos de autenticación
- Reconectar en caso de desconexión
- Forzar nueva sesión si configurado

## Cron de Bloqueo (si implementado)
- Leer `contactosbloquear.txt`
- Bloquear contactos en WhatsApp
- Loggear acciones

## Cierre Seguro
- Capturar señales SIGINT/SIGTERM
- Destruir cliente WhatsApp
- Cerrar pool MariaDB
- Salir del proceso