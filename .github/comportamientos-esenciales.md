# Comportamientos esenciales del sistema y del asistente (Dialca Agent)

Este documento define los **comportamientos esenciales** que no deben romperse cuando se propongan cambios de código, flujos o configuraciones. Se utiliza especialmente cuando el usuario activa el gatillo:

**#comportamientosesenciales: ANALIZA TUS PROXIMOS CAMBIOS AL CODIGO**

En ese caso, cualquier modificación sugerida o implementada debe evaluarse explícitamente contra estas reglas.

---

## 1. No inventar datos ni comportamientos

1.1. El sistema y el asistente **no deben inventar**:

* Códigos de artículos.
* Precios.
* Descuentos.
* Disponibilidad de inventario.
* Condiciones comerciales.

1.2. Si un dato no está disponible en:

* la base de datos,
* la documentación del proyecto,
* o el contexto proporcionado,

se debe responder con un mensaje equivalente a:

> "No tengo esa información registrada. Un agente humano te confirmará este dato."

1.3. Cualquier lógica nueva que utilice datos críticos (precios, inventario, condiciones de crédito, etc.) debe tomar esos datos siempre de fuentes verificadas del sistema (por ejemplo, consultas a la base de datos o a servicios oficiales internos), nunca de constantes inventadas.

---

## 2. Coherencia con la política comercial de Dialca

2.1. El sistema no debe:

* Ofrecer descuentos no autorizados.
* Modificar listas de precios sin control.
* Presentar precios en monedas no soportadas por el negocio sin conversión explícita y autorizada.

2.2. Si el usuario solicita funciones que impliquen cambios de política comercial (por ejemplo, reglas de descuentos globales, crédito automático, precios especiales), el asistente debe:

* Señalar que esto puede impactar la política comercial.
* Sugerir documentar la nueva política antes de implementarla.

---

## 3. Integridad del flujo de cotización y venta

3.1. Cualquier cambio que afecte el flujo de:

* recepción de requerimiento del cliente,
* selección de productos,
* cálculo de cantidades y precios,
* generación de cotización o propuesta,

**debe mantener**:

* el registro correcto de los productos ofrecidos,
* la trazabilidad de los precios utilizados,
* la correcta asociación entre cliente y oferta.

3.2. No se debe eliminar ni ignorar validaciones esenciales como:

* verificación de existencia mínima de datos del cliente,
* verificación de que los productos existan en la base de datos,
* verificación de que los precios no sean cero, nulos o negativos salvo que esté explícitamente permitido y documentado.

---

## 4. Trazabilidad y logging mínimo necesario

4.1. Los flujos críticos (cotizaciones, actualizaciones de inventario, operaciones de sincronización con sistemas externos) deben mantener algún mecanismo de logging mínimo que permita:

* rastrear qué operación se ejecutó,
* con qué parámetros clave,
* y si fue exitosa o falló.

4.2. Los cambios propuestos no deben eliminar completamente estos logs sin ofrecer una alternativa equivalente o mejor.

---

## 5. Sincronización con documentación y flujos de ejecución

5.1. Cualquier cambio que afecte los comportamientos aquí descritos **debe** reflejarse en:

* `docs/flujo_ejecucion.md` (flujo maestro del sistema),
* y, si procede, en los documentos específicos de procesos o archivos (`docs/procesos/`, `fe_*.md`, etc.).

5.2. No se debe aceptar como "terminada" una modificación esencial mientras la documentación no haya sido actualizada.

---

## 6. Experiencia de usuario y claridad de respuestas

6.1. El asistente debe priorizar respuestas claras, ordenadas y accionables, evitando:

* respuestas ambiguas,
* saltos bruscos de contexto,
* terminología técnica sin explicación cuando el contexto requiera claridad.

6.2. En el contexto de atención comercial:

* Debe mantenerse un tono profesional.
* Debe evitar afirmaciones categóricas sobre compromisos de entrega o condiciones especiales sin una fuente clara en el sistema.

---

## 7. Seguridad y protección de información

7.1. Ningún cambio debe introducir comportamiento que:

* exponga credenciales,
* muestre tokens,
* imprima en logs datos sensibles (claves, tokens de API, contraseñas, etc.).

7.2. Si una propuesta de cambio requiere manipular variables de entorno o secretos:

* Debe hacerse referencia siempre a archivos de configuración seguros (`.env`, gestores de secretos, etc.),
* Nunca a valores embebidos directamente en el código.

---

## 8. Checklist de verificación contra comportamientos esenciales

Cuando el gatillo **#comportamientosesenciales: ANALIZA TUS PROXIMOS CAMBIOS AL CODIGO** esté activo, cualquier cambio propuesto debe revisarse, como mínimo, con estas preguntas:

1. ¿Se está inventando algún dato comercial (código, precio, stock, política)?
2. ¿Se respeta la política comercial de Dialca en descuentos, precios y condiciones?
3. ¿Sigue siendo íntegro el flujo de cotización y venta?
4. ¿Se mantiene o mejora la trazabilidad y el logging mínimo necesario?
5. ¿Están alineados los cambios con la documentación y flujos de ejecución registrados?
6. ¿La experiencia de usuario se mantiene profesional y clara?
7. ¿No se están exponiendo datos sensibles ni debilitando la seguridad?

Si alguna respuesta es negativa o dudosa, el cambio debe:

* ajustarse para cumplir estos comportamientos esenciales,
* o ser explícitamente marcado como un riesgo que requiere revisión humana antes de ser aplicado en producción.

---

Fin del archivo.
