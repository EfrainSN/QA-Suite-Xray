# QA Suite Xray

QA Suite Xray es una aplicación de escritorio para preparar casos de prueba manuales de Xstore y Omnipay y exportarlos a un archivo CSV que se puede importar en Jira con Xray. La aplicación organiza el trabajo localmente y ayuda a revisar los datos antes de importarlos; no crea incidencias ni modifica Jira directamente.

## Para qué sirve

Al preparar casos de prueba para una historia de usuario suele ser necesario repetir información, redactar los mismos tipos de pasos y adaptar los datos a la plantilla que espera Xray. Esta aplicación reúne esas tareas en un solo espacio:

- Crea casos de uno en uno o genera borradores a partir de una lista de títulos.
- Mantiene títulos, precondiciones y pasos organizados en un editor visual.
- Permite revisar el avance de cada caso y realizar cambios en varios casos a la vez.
- Conserva el trabajo localmente y permite guardar o recuperar sesiones.
- Genera un CSV con formato para Xray, valida sus datos y muestra todas las filas antes de descargarlo.
- Incluye una guía de importación para ayudar a mapear las columnas en Jira.

El resultado es un archivo listo para que una persona autorizada lo importe y confirme el mapeo dentro de Jira/Xray.

## Funciones

### Creación y edición de casos

- **Creación rápida en lote:** pega una lista de títulos. Se reconocen líneas separadas, numeraciones comunes y viñetas; las líneas continuadas se unen al título anterior.
- **Creación individual:** añade un caso vacío y completa su título, precondiciones y pasos.
- **Pasos de ejecución:** cada paso contiene una acción y su resultado esperado. Se pueden añadir, borrar, reordenar y copiar entre casos.
- **Reordenamiento:** arrastra los casos para cambiar su orden y arrastra sus pasos para ordenarlos dentro del caso.
- **Clonado y borrado:** duplica casos individualmente o en grupo; las operaciones de borrado solicitan confirmación.
- **Snippets:** agrega secuencias de ejemplo para inicio de sesión y apertura de POS, pago con tarjeta y validación de Hacienda.
- **Buscar y reemplazar:** aplica un reemplazo a los casos seleccionados.

### Estados y operaciones masivas

Cada caso tiene un estado interno:

1. **Pendiente**
2. **En edición**
3. **Listo**

Al hacer clic en el estado de un caso, avanza al siguiente. También es posible seleccionar varios casos y aplicarles un estado común. Desde el menú masivo se pueden pegar pasos, clonar o borrar los casos seleccionados.

Los estados se guardan en la sesión local y en los archivos de sesión `.qa`; no se exportan como una columna del CSV ni cambian el estado de una incidencia en Jira.

### Guardado de trabajo y sesiones

- La aplicación guarda automáticamente los casos, el ticket y las etiquetas en el almacenamiento local del perfil donde se ejecuta.
- **Exportar Sesión (.qa)** descarga un archivo JSON con los casos y la configuración para conservar o transferir el trabajo.
- **Importar Sesión** permite recuperar un archivo `.qa` o `.json`.
- **Importar CSV Xray (.csv)** permite leer un archivo CSV generado para Xray y reconstruir automáticamente sus casos y pasos de prueba, con la opción de agregarlos a los existentes o reemplazar el espacio de trabajo.
- La sesión es independiente de Jira y no se envía a un servidor.

El almacenamiento local del navegador o de Electron no equivale a una copia de seguridad. Exporta sesiones `.qa` si necesitas conservarlas o compartirlas.

## Flujo recomendado

1. Escribe el ticket Jira que representa la historia de usuario y las etiquetas globales.
2. Pega los títulos de los casos en **Creación Rápida en Lote**, o agrega un caso vacío.
3. Revisa cada caso. Completa el título y las precondiciones, y describe las acciones y resultados esperados de cada paso.
4. Usa la selección, los estados, la librería de snippets y las operaciones masivas para organizar y acelerar la revisión.
5. Pulsa **Descargar CSV para Xray**.
6. Revisa la validación y la vista previa completa. Si hay errores, corrígelos antes de descargar.
7. Descarga el CSV e impórtalo desde **Aplicaciones (Apps) > Xray > Test Case Importer** en Jira.
8. En el importador, usa coma como delimitador y UTF-8 como codificación; selecciona el tipo de incidencia **Test** y mapea las columnas como se describe más abajo.
9. Comprueba el resultado de la importación en Jira/Xray.

## CSV generado

El archivo se descarga con el nombre `XRAY_<ticket>.csv`. Se codifica como UTF-8 con BOM, lo que ayuda a conservar caracteres acentuados en aplicaciones compatibles con CSV. Los valores se entrecomillan y las comillas que forman parte de un valor se duplican.

El archivo contiene estas diez columnas:

| Columna | Contenido y uso |
| --- | --- |
| `TCID` | Identificador generado en orden, por ejemplo `CP-001`. Se repite para las filas de los pasos del mismo caso. |
| `Resumen` | Título del caso de prueba. |
| `Descripción` | Título seguido de las precondiciones, cuando existen. |
| `Tipo de Test` | Se genera como `Manual`. |
| `Acción` | Acción de un paso. Cada paso genera una fila. |
| `Datos de Prueba` | Se deja vacío para completar o mapear según el proceso del equipo. |
| `Resultado Esperado` | Resultado esperado para el paso correspondiente. |
| `Componentes` | Se genera como `SV-FEL`. |
| `Etiquetas` | Combina el ticket Jira y las etiquetas globales configuradas. |
| `HU Relacionada` | Contiene el ticket Jira configurado para vincular el caso con su historia durante la importación. |

Un caso con varios pasos produce varias filas con el mismo `TCID`, resumen y descripción, una por cada acción y resultado esperado. La vista previa presenta todas las filas de datos; no se limita a una muestra inicial.

### Validación antes de descargar

La vista previa informa la cantidad de casos, filas de datos, errores y advertencias:

- **Error:** un caso sin título o sin pasos. Si existe algún error, el botón de descarga queda deshabilitado.
- **Advertencia:** un paso tiene vacía la acción o el resultado esperado. Se puede descargar, pero conviene revisar esos datos.
- **Validación correcta:** se muestra cuando no hay errores ni advertencias.

La validación se realiza localmente antes de generar la descarga. El contenido visible en la tabla es el contenido que se prepara para el CSV.

### Mapeo sugerido en Jira/Xray

En el paso de mapeo del importador, la guía integrada propone:

| Columna del CSV | Campo de Jira/Xray |
| --- | --- |
| `TCID` | ID de Tarea |
| `Resumen` | Resumen |
| `Descripción` | Descripción |
| `Tipo de Test` | Tipo de Test |
| `Acción` | Acción |
| `Resultado Esperado` | Resultados Esperados |
| `HU Relacionada` | Enlace `tests` o Enlace externo |

La guía recomienda no mapear `Datos de Prueba`, `Componentes` ni `Etiquetas`. Los nombres de los campos disponibles pueden depender de la configuración de Jira/Xray; verifica el mapeo antes de confirmar la importación.

## Carpetas de Xray y alcance de Jira

La aplicación no se autentica en Jira ni en Xray. El CSV no comprueba si una carpeta del Test Repository existe, no crea carpetas, no coloca automáticamente los casos en una carpeta y no puede preguntar durante la importación si se deben agregar a una carpeta existente. Tampoco crea enlaces directamente.

La columna `HU Relacionada` prepara el dato para que se mapee durante la importación, pero la persona que importa debe revisar que el campo de enlace esté disponible y correctamente configurado. La asignación a carpetas se gestiona en el proceso de Jira/Xray, no en esta aplicación.

## Actualizaciones desde GitHub Releases

La aplicación de escritorio muestra su versión y ofrece **Buscar actualización**. El proceso consulta la API pública de GitHub para el último Release de `EfrainSN/QA-Suite-Xray`, compara la etiqueta del Release con la versión instalada y, si hay una versión más nueva, presenta sus notas. Al aceptar, abre la página oficial del Release en el navegador; la persona descarga y reemplaza el ejecutable manualmente.

El comprobador no descarga ni instala actualizaciones por sí mismo. Valida que el enlace abierto pertenezca al repositorio esperado y usa un puente IPC limitado desde el proceso principal de Electron.

**Limitación para repositorios privados:** la consulta actual no incluye autenticación. GitHub no permite a una aplicación anónima consultar Releases de un repositorio privado, por lo que la API puede responder como si no hubiera un Release. La publicación privada mediante GitHub Actions y el acceso desde la aplicación son cosas distintas: el workflow puede publicar con sus permisos, pero el comprobador actual no puede leer ese Release privado. No se debe solucionar incrustando un token de GitHub en la aplicación. Para habilitar actualizaciones desde un repositorio privado habría que diseñar un mecanismo de distribución/autenticación apropiado; esa funcionalidad no está implementada.

## Arquitectura técnica

La aplicación usa Electron, HTML, CSS y JavaScript sin framework de interfaz:

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Estructura de la interfaz, controles y modales. |
| `styles.css` | Diseño, estados visuales, diálogos y vista previa del CSV. |
| `app.js` | Casos, guardado local, edición, operaciones masivas, validación, exportación y lógica de interfaz. |
| `main.js` | Proceso principal de Electron; crea la ventana y gestiona las solicitudes IPC del actualizador. |
| `preload.js` | Expone al renderer solo las funciones IPC necesarias para consultar la versión, revisar Releases y abrir su página. |
| `github-updates.js` | Cliente de la API de Releases, comparación SemVer y validación del enlace. |
| `csv-importer.js` | Parser RFC 4180 y reconstructor de casos y pasos desde archivos CSV de Xray. |
| `tests/github-updates.test.js` | Pruebas de comparación de versiones, validación de enlaces y respuestas de Releases. |
| `tests/csv-importer.test.js` | Pruebas unitarias de parseo CSV RFC 4180 y reconstrucción de casos y pasos de Xray. |
| `.github/workflows/release.yml` | Workflow para compilar el ejecutable portable y crear un Release a partir de una etiqueta de versión. |

La ventana se configura con `contextIsolation` y `sandbox` habilitados y `nodeIntegration` deshabilitado. El renderer no recibe acceso directo a los módulos de Node/Electron; el preload expone un puente específico para actualizaciones.

## Requisitos

- Windows para compilar el ejecutable portable configurado.
- Node.js 22 o compatible con las dependencias declaradas.
- npm, incluido con Node.js.

## Ejecutar en modo desarrollo

Desde la carpeta del proyecto:

```powershell
npm ci
npm start
```

`npm ci` instala exactamente las dependencias registradas en `package-lock.json`. `npm start` abre la aplicación Electron.

También se puede abrir `index.html` en un navegador para trabajar con casos y exportar CSV. Algunas capacidades son propias de la aplicación de escritorio: la versión del ejecutable y el puente IPC del actualizador no están disponibles en un navegador normal.

## Pruebas

Para ejecutar las pruebas existentes:

```powershell
node --test tests\github-updates.test.js
```

Las pruebas cubren la comparación de versiones SemVer, la validación del dominio y ruta del Release y los escenarios de respuesta más relevantes de GitHub. No realizan escrituras ni importaciones en Jira.

## Compilar el ejecutable portable

En Windows:

```powershell
npm ci
npm run build
```

Electron Builder genera un ejecutable portable con nombre versionado, por ejemplo `dist\QA Suite Xray 1.1.0.exe`. El número se obtiene de `version` en `package.json`. El instalador no está configurado; el artefacto de Windows es portable.

## Publicar una versión con GitHub Actions

El workflow `.github/workflows/release.yml` se activa al enviar una etiqueta que comienza con `v`. Comprueba que la versión de la etiqueta coincida con `package.json`, instala dependencias, compila el portable y crea un GitHub Release con el ejecutable adjunto. Requiere que GitHub Actions esté habilitado y que el permiso de escritura de contenidos definido por el workflow esté permitido en el repositorio.

Procedimiento de versión:

1. Actualiza la versión en `package.json` y en la entrada raíz correspondiente de `package-lock.json`, manteniendo ambos valores iguales.
2. Confirma y sube esos cambios a la rama que se usará para la publicación.
3. Crea y sube una etiqueta que coincida exactamente, con prefijo `v`. Por ejemplo, para la versión `1.2.0`, usa `v1.2.0`.
4. Revisa la ejecución de **Build portable release** en la pestaña Actions y confirma que el Release tenga adjunto el `.exe`.

La creación del Release no cambia automáticamente la versión de una copia ya distribuida. Cada nueva compilación debe tener una versión superior para que el comprobador la considere actualización.

## Seguridad y credenciales

El flujo CSV no necesita usuario, contraseña, token de Jira ni credenciales de Xray. La aplicación no escribe datos en esos servicios.

No guardes ni incluyas tokens de GitHub en el código, el ejecutable, el README ni los archivos del repositorio. Si el repositorio es privado, autentícate desde tu propio entorno con el mecanismo autorizado por tu organización, como Git Credential Manager, GitHub CLI o SSH. No compartas contraseñas ni tokens en el chat.

## Estado del proyecto

- La creación y edición de casos, guardado local, sesiones, vista previa completa, validación y exportación CSV están implementadas.
- La importación a Jira/Xray sigue siendo manual.
- La consulta de Releases está implementada para el endpoint público del repositorio indicado; no funciona con Releases privados sin un mecanismo de autenticación adicional.
- No hay sincronización directa con Jira/Xray ni administración automática de carpetas del Test Repository.

## Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más información.

## Reconocimiento de Asistencia de IA

Este proyecto fue conceptualizado, diseñado, desarrollado y probado bajo la dirección y autoría de **Efrain Cortez**, contando con el apoyo y asistencia técnica de modelos de **Inteligencia Artificial (IA)** para pair-programming, diseño de interfaz (Aero Glass UI), optimización de rendimiento en el DOM, estructuración de pruebas unitarias y generación de documentación técnica.

