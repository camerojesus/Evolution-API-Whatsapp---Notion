# Proceso de Integración WhatsApp-Notion-MariaDB

## Recepción de Mensajes WhatsApp
- Conexión vía WhatsApp Web API
- Eventos de mensajes entrantes y salientes
- Filtrado de mensajes válidos
- Extracción de metadatos (remitente, destinatario, grupo, etc.)

## Procesamiento de Datos
- Normalización de información de contactos
- Asociación con proyectos vía mapeo de grupos
- Generación de timestamps ISO
- Limpieza y validación de contenido
- Asignación de tipos (Entrada/Salida)

## Almacenamiento en Notion
- Selección de database por proyecto
- Creación de fila principal con propiedades
- Generación de sub-página con contenido completo
- Enlace entre fila y sub-página
- Firma con metadatos del mensaje

## Almacenamiento en MariaDB
- Conexión pool para eficiencia
- Inserción en tabla `whatsapp_messages`
- Campos: ID, nombres, teléfonos, tipo, timestamp, contenido, grupo, proyecto
- Manejo de errores y reconexión

## Backup Local
- Guardado de mensajes raw en archivos diarios
- Logs de operaciones y errores
- Estructura organizada por fecha
- Preservación de datos originales

## Gestión de Errores y Recuperación
- Reintentos en fallos de conexión
- Logging detallado de excepciones
- Reconexión automática a WhatsApp
- Notificación de problemas críticos

## Mantenimiento y Escalabilidad
- Soporte para múltiples proyectos
- Configuración flexible vía archivos
- Actualización automática de contactos
- Bloqueo programado de contactos no deseados
- Monitoreo continuo de integridad