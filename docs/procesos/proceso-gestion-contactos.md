# Proceso de Gestión de Contactos

## Carga Inicial de Contactos
- **Archivo**: `contactos.txt`
- **Función**: `cargarContactos` (en varios archivos)
- Leer archivo `contactos.txt`
- Parsear líneas `nombre:numero`
- Crear array `aContactos`
- Filtrar entradas válidas

## Búsqueda de Nombre por Número
- **Función**: `buscarNombrePorNumero`
- Limpiar número (quitar @ y no dígitos)
- Buscar en array `aContactos`
- Comparar números (`endsWith` o viceversa)
- Retornar nombre o 'Contacto no Registrado'

## Agregado de Contactos No Registrados
- **Función**: `agregarContactoNoRegistrado`
- **Archivo**: `bloquearcontactos.js`
- Leer archivo `contactos.txt`
- Agregar nueva línea `nombre:numero`
- Escribir archivo actualizado
- Recargar array `aContactos`
- Loggear acción

## Validación de Contactos
- Verificar existencia de archivo
- Manejar errores de lectura/escritura
- Mantener integridad del array

## Integración con Procesos de Mensajes
- Usado en `processMessage` para identificar remitentes
- Actualizado dinámicamente al agregar nuevos contactos
- Sincronizado entre archivos