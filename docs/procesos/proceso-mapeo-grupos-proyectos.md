# Proceso de Mapeo de Grupos a Proyectos

## Carga de Mapeos
- **Archivo**: `grupoproyecto.txt`
- **Función**: `cargarMapeo`
- Leer archivo `grupoproyecto.txt`
- Parsear líneas `grupo:proyecto`
- Crear array `gruposYProy`
- Filtrar entradas válidas

## Asociación Grupo-Proyecto
- **Función**: `proyectoPorGrupo`
- Buscar grupo en array `gruposYProy`
- Retornar proyecto asociado
- Usar proyecto por defecto si no encontrado

## Integración con Notion
- **Archivo**: `notionproyecto.txt`
- Cargar configuraciones de proyectos
- Parsear líneas `proyecto:apiKey:databaseId`
- Crear objeto `notionIntegrations`
- **Función**: `getIntegration`
- Retornar cliente y databaseId por proyecto

## Asignación de Proyecto en Mensajes
- En `processMessage`
- SI mensaje de grupo → obtener proyecto por grupo
- SINO → usar proyecto por defecto
- Seleccionar integración Notion correspondiente
- Insertar en database específica

## Gestión de Múltiples Proyectos
- Soporte para múltiples bases de datos Notion
- API keys específicas por proyecto
- Separación lógica de datos por proyecto
- Configuración flexible vía archivos .txt