# Proceso de Guardado de Mensajes Raw

## Determinación de Archivo Diario
- **Función**: `getDailyDir`
- Obtener fecha actual
- Crear directorio mensual (`YYYY_MM_Mes`)
- Crear directorio diario (`DD-MM-YYYY_Dia`)
- Asegurar existencia de directorios

## Archivo de Mensajes
- **Función**: `msgFile`
- Generar nombre: `mensajes-DD-MM-YYYY.log`
- Ubicación: dentro del directorio diario
- Crear si no existe

## Guardado del Contenido Raw
- **Función**: `saveRaw`
- Convertir objeto mensaje a JSON
- Agregar separador `---`
- Escribir al archivo de mensajes
- Manejar errores de escritura

## Archivo de Logs
- **Función**: `logFile`
- Generar nombre: `whatsapp-log-DD-MM-YYYY.log`
- **Función**: `log`
- Agregar timestamp
- Escribir a archivo y consola (si habilitado)
- Manejar errores de escritura

## Estructura de Datos Guardados
- Mensajes: JSON completo del objeto mensaje
- Logs: mensajes con timestamp
- Separadores para legibilidad
- Codificación UTF-8

## Integración con Procesamiento
- Llamado en `processMessage`
- Antes de inserción en bases de datos
- Backup completo de datos originales
- Debugging y auditoría