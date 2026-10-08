# 🩺 Mi Salud | Registro personal de signos vitales

**Aplicación web educativa · Proyecto de portfolio de [Soyfacuh](https://soyfacuh.com)**

Mi Salud es una propuesta de aplicación web para registrar, ordenar y visualizar mediciones personales de signos vitales desde una interfaz moderna, accesible y adaptable a computadoras y celulares. Fue concebida como proyecto práctico de desarrollo frontend e inspirado en el aprendizaje sobre **Sistemas de Información para la Salud** de la Organización Panamericana de la Salud (OPS).

> **Aviso importante:** Mi Salud es una **demostración educativa para el portfolio de Soyfacuh**. No es un dispositivo médico, no toma mediciones, no identifica anomalías, no emite diagnósticos ni reemplaza la consulta con profesionales. Los registros de ejemplo son completamente **ficticios**. Su uso con información de salud real en dispositivos compartidos **no es recomendable**, ya que `localStorage` no cifra los datos.

## 🎯 Objetivo

Demostrar cómo una aplicación frontend puede convertir un formulario básico en un **panel interactivo de seguimiento** con estadísticas, gráficos, historial, gestión local de datos y una experiencia cuidada para dispositivos móviles, sin necesidad de servicios externos ni instalaciones.

## ✨ Funcionalidades

- **Panel de resumen:** visualización de la última medición de pulso, temperatura, presión arterial y saturación de oxígeno.
- **Gráfico de evolución:** selección de métrica y período (7 días, 30 días o todos los registros), con indicación de mínimo y máximo. La gráfica muestra valores, **no interpretaciones médicas**.
- **Nuevo registro:** fecha, hora, frecuencia cardíaca, temperatura, presión sistólica, presión diastólica, saturación y observaciones opcionales.
- **Validación de entradas:** comprobación de campos obligatorios, formato de fechas, rangos numéricos y relación entre presión sistólica y diastólica. Los rangos del formulario son **límites de entrada para evitar errores de tipeo**, no niveles de referencia médica.
- **Edición y eliminación:** corrección de mediciones guardadas y confirmación antes de eliminar.
- **Historial avanzado:** búsqueda libre, filtros por período, orden cronológico y paginación de diez registros por página.
- **Adaptación móvil:** tabla en escritorio y tarjetas de lectura sencilla en celulares.
- **Exportación CSV:** descarga de los registros visibles según los filtros, compatible con hojas de cálculo.
- **Respaldo JSON:** exportación completa de los datos e importación de copias sin reemplazar los registros actuales. Los identificadores repetidos se omiten.
- **Vista para impresión:** generación mediante la función de impresión del navegador del historial filtrado (también se puede usar "Guardar como PDF").
- **Modo claro y oscuro:** preferencia recordada en el navegador.
- **Datos de ejemplo:** carga opcional de ocho registros ficticios identificados como demostración, sin reemplazar el historial existente.
- **Privacidad transparente:** funcionamiento sin backend, cuentas, analíticas, librerías de terceros ni envío automático de mediciones.
- **Compatibilidad:** lectura de los registros guardados bajo la clave de `localStorage` de la primera versión (`misalud_mediciones`).

## 🛠️ Tecnologías

| Tecnología | Uso |
| --- | --- |
| HTML5 semántico | Navegación, formularios, tablas, diálogo de confirmación y metadatos. |
| CSS3 | Diseño responsive, tarjetas, animaciones discretas, temas y estilos de impresión. |
| JavaScript (Vanilla ES6+) | Validaciones, edición, filtros, gráficos SVG, importación y exportación. |
| SVG | Íconos vectoriales locales y gráficos sin dependencias. |
| Web Storage API | Persistencia local con `localStorage`. |
| File y Blob APIs | Lectura de archivos JSON y descarga de respaldos JSON/CSV. |

**No requiere React, Node.js, npm, dependencias por CDN ni servicios externos.**

## 📁 Estructura del proyecto

```text
Mi-Salud/
├── index.html       # Estructura semántica, vistas y componentes
├── style.css        # Diseño, temas, responsive e impresión
├── script.js        # Lógica del historial, gráficos y validaciones
├── favicon.svg      # Identidad visual vectorial
└── README.md        # Presentación y documentación
```

## 🚀 Ejecutar en tu computadora

1. Descargá el ZIP y extraé la carpeta `Mi-Salud`.
2. Abrí la carpeta completa desde **Visual Studio Code** (`Archivo → Abrir carpeta`).
3. Abrí `index.html` y elegí **Open with Live Server / Go Live**.
4. También podés abrir `index.html` directamente en un navegador moderno. Se recomienda Live Server para probar almacenamiento y descargas con un origen estable.

No hace falta instalar paquetes ni ejecutar comandos.

## 🌐 Publicar en GitHub Pages

1. Subí **el contenido de la carpeta `Mi-Salud`**, con `index.html` en la raíz del repositorio.
2. En GitHub, ingresá a **Settings → Pages**.
3. Elegí **Deploy from a branch**, rama `main` y carpeta `/(root)`.
4. Guardá la configuración y utilizá el enlace que te indique GitHub.

Los recursos son relativos (`./style.css`, `./script.js`, `./favicon.svg`) y funcionan también en repositorios publicados bajo una ruta, por ejemplo `usuario.github.io/mi-salud/`.

## 💾 Almacenamiento y copias de seguridad

Los datos se almacenan **únicamente en el navegador y dispositivo actuales** con la clave `misalud_mediciones`. La preferencia del tema se guarda en `misalud_tema`.

- Si borrás los datos del sitio, usás modo privado o cambiás de navegador/dispositivo, podés perder los registros.
- Para transferirlos, descargá primero **Copia JSON** y luego elegí **Importar** en el otro navegador.
- **CSV** exporta los resultados correspondientes a los filtros y a la búsqueda actual; **JSON** siempre respalda el historial completo.
- El historial no se sincroniza con ninguna cuenta ni servidor.
- Aunque no se envíen datos a servidores desde la aplicación, `localStorage` no proporciona cifrado y otros usuarios del mismo perfil del navegador pueden acceder a la información.

### Datos de ejemplo

Desde la sección **Registrar medición**, presioná **Cargar datos de ejemplo** para incorporar ocho registros ficticios de fechas recientes. Se identifican como ejemplos y pueden editarse o eliminarse individualmente. No se incluyen datos personales ni mediciones reales en el proyecto distribuido.

### Compatibilidad con la versión original

Si actualizás esta aplicación en el **mismo origen web** donde ya utilizabas la versión inicial, Mi Salud reconoce el formato de sus registros antiguos, que incluían presión arterial como `"120/80"` y no almacenaban la hora.

- Los registros antiguos muestran **«Sin hora»** hasta que se editen.
- El sistema permite seguir incorporando mediciones en el mismo historial.
- Si un registro previo tiene datos ilegibles o fuera de los límites permitidos, se omite de la vista y se muestra un aviso. **Descargá un respaldo antes de actualizar una instancia que contenga registros reales.**
- Cambiar de `file://` a Live Server, de dominio o de ruta de origen puede cambiar el área de almacenamiento y no trasladará los datos automáticamente.

## ♿ Accesibilidad y diseño

La interfaz incluye navegación semántica, enlace para saltar al contenido, etiquetas asociadas a los campos, estados de foco visibles, controles accesibles por teclado, mensajes de estado y compatibilidad con la preferencia de movimiento reducido. Ofrece diseño adaptable y gráficos con resumen textual accesible.

## 🔒 Alcance y limitaciones

Mi Salud **no es una historia clínica electrónica, sistema sanitario certificado ni herramienta de monitoreo clínico**. No ofrece autenticación, cifrado, sincronización, respaldo en la nube, notificaciones médicas, alertas clínicas ni integración con dispositivos físicos. Los gráficos representan exclusivamente números ingresados manualmente.

Este proyecto está pensado para **demostraciones técnicas, portfolio y aprendizaje**. No se aconseja almacenar información confidencial o utilizarlo en la atención de pacientes.

## 👨‍💻 Desarrollo

**Soyfacuh · Desarrollo Web y soluciones digitales**

Sitio web: [soyfacuh.com](https://soyfacuh.com)

Mi Salud forma parte de una colección de proyectos demostrativos destinados a mostrar capacidades en diseño de interfaces, experiencia de usuario, desarrollo frontend y organización de información.

---

*Desarrollado con HTML, CSS y JavaScript. Proyecto independiente, educativo y no afiliado a la OPS.*
