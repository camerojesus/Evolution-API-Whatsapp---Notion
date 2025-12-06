# Proceso de Bloqueo de Contactos

## Inicio del Proceso
- **Archivo**: `bloquearcontactos.js`
- **Función**: Inicialización del cliente WhatsApp
- Cargar configuraciones de entorno
- Cargar lista de contactos desde `contactos.txt`
- Cargar mapeos de grupos y proyectos
- Inicializar cliente de WhatsApp

## Evento de Cliente Listo
- **Evento**: `client.on('ready')`
- **Función**: `bloquearContactos(client)`
- Leer archivo `contactosbloquear.txt`
- Para cada línea en el archivo
  - Parsear nombre e ID del contacto
  - Obtener contacto por ID
  - Bloquear el contacto
  - Loggear la acción
- Manejar errores de bloqueo

## Procesamiento de Mensajes (similar al principal)
- **Eventos**: `client.on('message')` y `client.on('message_create')`
- **Función**: `processMessage(message, isOutgoing)`
- Validar mensaje
- Obtener información del remitente/destinatario
- Buscar nombre por número
- SI contacto no registrado → agregar a `contactos.txt`
- Obtener proyecto por grupo
- Guardar mensaje en archivo
- Insertar en Notion

## Gestión de Sesión
- Generar QR
- Manejar autenticación
- Reconectar en desconexión
- Mantener script en ejecución

## Funciones Auxiliares
- `buscarNombrePorNumero`
- `obtenerProyectoPorGrupo`
- `getGroupIdIfGroupChat`
- `agregarContactoNoRegistrado`