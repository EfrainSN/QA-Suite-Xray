// --- ESTADO GLOBAL Y CONFIGURACIÓN ---
let casosGlobales = [];
let portapapelesPasos = null;
let casoArrastradoIndex = null; // Para Drag & Drop

// Estados de Semáforo
const ESTADOS = {
    pending: { clase: 'status-pending', texto: 'Pendiente', icono: 'icon-status-pending', siguiente: 'editing' },
    editing: { clase: 'status-editing', texto: 'En edición', icono: 'icon-status-editing', siguiente: 'ready' },
    ready:   { clase: 'status-ready',   texto: 'Listo', icono: 'icon-status-ready', siguiente: 'pending' }
};

// Librería de Snippets predefinidos (Repertorio base)
const DEFAULT_SNIPPETS = [
    {
        id: "login",
        nombre: "Inicio de Sesión",
        pasos: [
            { accion: "Ingresar credenciales válidas en la pantalla de inicio de sesión.", resultado_esperado: "El sistema autentica al usuario y muestra la pantalla principal." },
            { accion: "Seleccionar la opción de apertura de turno o sesión de trabajo.", resultado_esperado: "La sesión se inicia exitosamente permitiendo operar en el sistema." }
        ]
    },
    {
        id: "pago_tarjeta",
        nombre: "Cobro Tarjeta Crédito",
        pasos: [
            { accion: "Seleccionar método de pago: Tarjeta de Crédito.", resultado_esperado: "El sistema habilita la interfaz de pago con tarjeta." },
            { accion: "Ingresar datos del medio de pago y confirmar monto.", resultado_esperado: "Transacción aprobada, se genera el comprobante y se registra la operación." }
        ]
    },
    {
        id: "validacion_mh",
        nombre: "Validación de Respuesta",
        pasos: [
            { accion: "Validar que la transacción correspondiente se procese y registre con éxito.", resultado_esperado: "La transacción queda registrada exitosamente en el sistema." },
            { accion: "Verificar que la información de respuesta contenga los datos y estructura correctos.", resultado_esperado: "El sistema valida y procesa los datos correctamente." }
        ]
    }
];

let snippetsUsuario = [];

// Compatibilidad retroactiva con SNIPPETS objeto
const SNIPPETS = {
    login: DEFAULT_SNIPPETS[0].pasos,
    pago_tarjeta: DEFAULT_SNIPPETS[1].pasos,
    validacion_mh: DEFAULT_SNIPPETS[2].pasos
};

function cargarSnippets() {
    try {
        const guardados = localStorage.getItem('qa_snippets');
        if (guardados) {
            const parsed = JSON.parse(guardados);
            if (Array.isArray(parsed) && parsed.length > 0) {
                snippetsUsuario = parsed;
                renderizarSnippetsSidebar();
                return;
            }
        }
    } catch {
        // noop
    }
    snippetsUsuario = JSON.parse(JSON.stringify(DEFAULT_SNIPPETS));
    guardarSnippets();
}

function guardarSnippets() {
    localStorage.setItem('qa_snippets', JSON.stringify(snippetsUsuario));
    renderizarSnippetsSidebar();
}

function renderizarSnippetsSidebar() {
    const contenedor = document.getElementById('snippetsSidebarList');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (!Array.isArray(snippetsUsuario) || snippetsUsuario.length === 0) {
        contenedor.innerHTML = '<p class="help-text" style="font-style: italic; margin-bottom: 8px;">Repertorio vacío. Crea uno nuevo.</p>';
        return;
    }

    snippetsUsuario.forEach(snippet => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'snippet-btn';
        const total = Array.isArray(snippet.pasos) ? snippet.pasos.length : 0;
        btn.title = `Inyectar ${total} paso${total === 1 ? '' : 's'} a casos seleccionados`;
        btn.onclick = () => inyectarSnippet(snippet.id);
        btn.innerHTML = `<svg class="ui-icon" aria-hidden="true"><use href="#icon-add"></use></svg>${escaparHTML(snippet.nombre)}`;
        contenedor.appendChild(btn);
    });
}

// --- INICIALIZACIÓN ---
window.onload = () => {
    cargarSnippets();
    cargarLocal();
    renderizarCasos();
    cargarVersionAplicacion();
};

let debounceGuardarTimer = null;

function guardarLocal(inmediato = false) {
    if (inmediato) {
        if (debounceGuardarTimer) {
            clearTimeout(debounceGuardarTimer);
            debounceGuardarTimer = null;
        }
        ejecutarGuardado();
        return;
    }
    if (debounceGuardarTimer) clearTimeout(debounceGuardarTimer);
    debounceGuardarTimer = setTimeout(() => {
        debounceGuardarTimer = null;
        ejecutarGuardado();
    }, 150);
}

function ejecutarGuardado() {
    try {
        localStorage.setItem('qa_casos_xray', JSON.stringify(casosGlobales));
        const ticketEl = document.getElementById('globalTicket');
        if (ticketEl) localStorage.setItem('qa_ticket', ticketEl.value);
        const tagsEl = document.getElementById('globalEtiquetas');
        if (tagsEl) localStorage.setItem('qa_tags', tagsEl.value);
        const compEl = document.getElementById('globalComponente');
        if (compEl) localStorage.setItem('qa_componente', compEl.value);
        mostrarEstado("Guardado hace un momento.");
    } catch (error) {
        console.error('Error al guardar en almacenamiento local:', error);
    }
}

window.addEventListener('beforeunload', () => {
    guardarLocal(true);
});

function cargarLocal() {
    const guardado = localStorage.getItem('qa_casos_xray');
    if (guardado) {
        casosGlobales = JSON.parse(guardado);
        casosGlobales.forEach(c => { 
            c.selected = false; 
            if(!c.status) c.status = 'pending'; // Migración a nuevo formato
        });
    }
    const tkt = localStorage.getItem('qa_ticket');
    if (tkt) document.getElementById('globalTicket').value = tkt;
    
    const tgs = localStorage.getItem('qa_tags');
    if (tgs) document.getElementById('globalEtiquetas').value = tgs;

    const cmp = localStorage.getItem('qa_componente');
    if (cmp !== null && document.getElementById('globalComponente')) {
        document.getElementById('globalComponente').value = cmp;
    }
}

// --- SISTEMA DE MODALES ---
function customModal(mensaje, esConfirmacion = false, esPeligro = false) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const msgEl = document.getElementById('modalMessage');
        const btnCancel = document.getElementById('modalCancel');
        const btnConfirm = document.getElementById('modalConfirm');

        if (mensaje instanceof Node) {
            msgEl.replaceChildren(mensaje);
        } else {
            msgEl.textContent = mensaje;
        }
        modal.classList.add('active');
        btnCancel.style.display = esConfirmacion ? 'inline-block' : 'none';
        btnCancel.innerText = 'Cancelar';
        btnConfirm.className = esPeligro ? 'btn-danger' : 'primary';
        btnConfirm.innerText = esPeligro ? 'Sí, eliminar' : 'Aceptar';
        btnConfirm.disabled = false;

        const limpiar = () => {
            modal.classList.remove('active');
            btnConfirm.onclick = null;
            btnCancel.onclick = null;
        };

        btnConfirm.onclick = () => { limpiar(); resolve(true); };
        btnCancel.onclick = () => { limpiar(); resolve(false); };
    });
}

const alertUI = (mensaje) => customModal(mensaje);
const confirmUI = (mensaje, esPeligro = false) => customModal(mensaje, true, esPeligro);

// --- ACTUALIZACIONES DESDE GITHUB RELEASES ---
async function cargarVersionAplicacion() {
    const elemento = document.getElementById('appVersion');
    if (!window.updateBridge) {
        elemento.textContent = 'Disponible en la aplicación de escritorio';
        return;
    }
    try {
        elemento.textContent = await window.updateBridge.getVersion();
    } catch (error) {
        elemento.textContent = 'No disponible';
        console.error('No se pudo consultar la versión de la aplicación:', error);
    }
}

function crearMensajeActualizacion(release) {
    const contenido = document.createElement('div');
    contenido.className = 'update-dialog';

    const titulo = document.createElement('h3');
    titulo.textContent = 'Hay una actualización disponible';
    contenido.append(titulo);

    const versiones = document.createElement('p');
    versiones.textContent = `Versión instalada: ${release.currentVersion} · Nueva versión: ${release.latestVersion}`;
    contenido.append(versiones);

    const encabezadoNotas = document.createElement('strong');
    encabezadoNotas.textContent = 'Novedades de esta versión';
    contenido.append(encabezadoNotas);

    const notas = document.createElement('pre');
    notas.className = 'update-release-notes';
    notas.textContent = release.releaseNotes;
    contenido.append(notas);

    const aviso = document.createElement('p');
    aviso.className = 'update-download-note';
    aviso.textContent = 'Al continuar, se abrirá la página oficial del Release para descargar el ejecutable portable.';
    contenido.append(aviso);
    return contenido;
}

async function buscarActualizaciones() {
    if (!window.updateBridge) {
        return await alertUI('La búsqueda de actualizaciones está disponible al ejecutar la aplicación de escritorio.');
    }

    const boton = document.querySelector('.update-button');
    boton.disabled = true;
    try {
        mostrarToast('Buscando actualizaciones en GitHub...');
        const release = await window.updateBridge.checkLatest();
        if (!release.updateAvailable) {
            await alertUI(`Ya tienes la versión más reciente (${release.currentVersion}).`);
            return;
        }

        const confirmacion = customModal(crearMensajeActualizacion(release), true);
        document.getElementById('modalConfirm').textContent = 'Abrir descarga';
        const aceptar = await confirmacion;
        if (aceptar) {
            await window.updateBridge.openRelease(release.releaseUrl);
        }
    } catch (error) {
        await alertUI(`No se pudieron buscar actualizaciones: ${error.message}`);
    } finally {
        boton.disabled = false;
    }
}

// --- UTILIDADES UI ---
function mostrarEstado(msg) {
    const estado = document.getElementById('estadoGuardado');
    estado.innerText = msg;
    setTimeout(() => estado.innerText = "Autoguardado activo.", 2000);
}

function mostrarToast(mensaje) {
    const toast = document.getElementById('toastMsg');
    toast.innerText = mensaje;
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
}

function toggleAcordeon(id) { document.getElementById(id).classList.toggle("active"); }

function escaparHTML(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[caracter]);
}

// --- RENDERIZADO PRINCIPAL ---
function renderizarCasos() {
    const contenedor = document.getElementById("casosLista");
    document.getElementById("contadorCasos").innerText = casosGlobales.length;

    const masterCb = document.getElementById('selectAllCheckbox');
    if (masterCb) {
        const total = casosGlobales.length;
        const seleccionados = casosGlobales.filter(c => c.selected).length;
        masterCb.checked = total > 0 && seleccionados === total;
    }

    const htmlCasos = casosGlobales.map((caso, cIndex) => {
        let htmlPasos = "";
        (caso.pasos || []).forEach((paso, pIndex) => {
            htmlPasos += `
                <div class="step-row" draggable="true" ondragstart="dragPasoStart(event, ${cIndex}, ${pIndex})" ondragover="dragOver(event)" ondrop="dropPaso(event, ${cIndex}, ${pIndex})">
                    <div class="drag-handle" title="Arrastrar para reordenar"><svg class="ui-icon" aria-hidden="true"><use href="#icon-grip"></use></svg></div>
                    <div class="step-col">
                        <strong>Acción<span class="help-tip" tabindex="0" role="img" aria-label="Ayuda: Describe lo que debes hacer en este paso." data-help="Describe lo que debes hacer en este paso."><svg class="ui-icon" aria-hidden="true"><use href="#icon-help"></use></svg></span></strong>
                        <div class="editable" contenteditable="true" onblur="actualizarPaso(${cIndex}, ${pIndex}, 'accion', this)">${escaparHTML(paso.accion)}</div>
                    </div>
                    <div class="step-col">
                        <strong>Resultado Esperado<span class="help-tip" tabindex="0" role="img" aria-label="Ayuda: Indica qué debe ocurrir después de realizar la acción." data-help="Indica qué debe ocurrir después de realizar la acción."><svg class="ui-icon" aria-hidden="true"><use href="#icon-help"></use></svg></span></strong>
                        <div class="editable" contenteditable="true" onblur="actualizarPaso(${cIndex}, ${pIndex}, 'resultado_esperado', this)">${escaparHTML(paso.resultado_esperado)}</div>
                    </div>
                    <div>
                        <button class="btn-danger icon-button" style="padding: 6px; box-shadow:none;" title="Borrar paso" aria-label="Borrar paso" onclick="eliminarPaso(${cIndex}, ${pIndex})"><svg class="ui-icon" aria-hidden="true"><use href="#icon-trash"></use></svg></button>
                    </div>
                </div>
            `;
        });

        const tcidNum = String(cIndex + 1).padStart(3, '0');
        const esSeleccionado = caso.selected ? 'checked' : '';
        const claseSeleccionado = caso.selected ? 'selected' : '';
        const estadoActual = ESTADOS[caso.status || 'pending'];
        const totalPasos = Array.isArray(caso.pasos) ? caso.pasos.length : 0;
        const textoPasos = totalPasos === 1 ? '1 paso' : `${totalPasos} pasos`;

        return `
            <div class="case-item ${claseSeleccionado}" id="case-item-${cIndex}" draggable="true" ondragstart="dragCasoStart(event, ${cIndex})" ondragover="dragOverCaso(event, ${cIndex})" ondrop="dropCaso(event, ${cIndex})" ondragleave="dragLeaveCaso(event, ${cIndex})">
                <div class="case-header" onclick="toggleAcordeon('body-${cIndex}')">
                    <div class="case-title">
                        <div class="drag-handle" onclick="event.stopPropagation()"><svg class="ui-icon" aria-hidden="true"><use href="#icon-grip"></use></svg></div>
                        <label class="case-check-btn" onclick="event.stopPropagation()" title="Seleccionar caso CP-${tcidNum}">
                            <input type="checkbox" id="check-${cIndex}" class="case-checkbox" ${esSeleccionado} onchange="alternarSeleccionCaso(${cIndex}, this)">
                        </label>
                        <span style="color: #5e6c84; font-family: monospace;">CP-${tcidNum}</span> 
                        <span class="editable" style="display:inline; flex:1;" contenteditable="true" onclick="event.stopPropagation()" onblur="actualizarCaso(${cIndex}, 'titulo', this)">${escaparHTML(caso.titulo)}</span>
                        <span class="case-steps-badge" id="steps-badge-${cIndex}" title="Cantidad de pasos de prueba en este caso">${textoPasos}</span>
                        <span class="status-badge ${estadoActual.clase}" id="status-badge-${cIndex}" onclick="event.stopPropagation(); ciclarEstado(${cIndex})" title="Haz clic para cambiar el estado"><svg class="ui-icon" aria-hidden="true"><use href="#${estadoActual.icono}"></use></svg>${estadoActual.texto}</span>
                    </div>
                    <div style="display:flex; gap:5px;" onclick="event.stopPropagation()">
                        <button onclick="duplicarCaso(${cIndex})"><svg class="ui-icon" aria-hidden="true"><use href="#icon-copy"></use></svg>Clonar</button>
                        <button class="btn-danger" onclick="eliminarCaso(${cIndex})"><svg class="ui-icon" aria-hidden="true"><use href="#icon-trash"></use></svg>Borrar</button>
                    </div>
                </div>
                
                <div class="case-body" id="body-${cIndex}">
                    <div style="margin-bottom: 20px;">
                        <strong style="font-size:11px; color:#5e6c84; text-transform:uppercase;">Precondiciones:<span class="help-tip" tabindex="0" role="img" aria-label="Ayuda: Anota lo que debe estar listo antes de ejecutar el caso." data-help="Anota lo que debe estar listo antes de ejecutar el caso."><svg class="ui-icon" aria-hidden="true"><use href="#icon-help"></use></svg></span></strong>
                        <div class="editable" style="background:white; padding:10px; border:1px solid #dfe1e6;" contenteditable="true" onblur="actualizarCaso(${cIndex}, 'precondiciones', this)">${escaparHTML(caso.precondiciones)}</div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="font-size:11px; color:#5e6c84; text-transform:uppercase;">Pasos de ejecución:<span class="help-tip" tabindex="0" role="img" aria-label="Ayuda: Agrega y ordena las acciones que componen la prueba." data-help="Agrega y ordena las acciones que componen la prueba."><svg class="ui-icon" aria-hidden="true"><use href="#icon-help"></use></svg></span></strong>
                        <div>
                            <button onclick="copiarPasos(${cIndex})"><svg class="ui-icon" aria-hidden="true"><use href="#icon-copy"></use></svg>Copiar Pasos</button>
                            <button onclick="pegarPasos(${cIndex})"><svg class="ui-icon" aria-hidden="true"><use href="#icon-paste"></use></svg>Pegar Pasos</button>
                        </div>
                    </div>

                    <div id="pasos-${cIndex}">${htmlPasos}</div>
                    <button style="margin-top: 10px;" onclick="agregarPaso(${cIndex})"><svg class="ui-icon" aria-hidden="true"><use href="#icon-add"></use></svg>Añadir Paso</button>
                </div>
            </div>
        `;
    });

    contenedor.innerHTML = htmlCasos.join('');
    actualizarMenuMasivo();
}

// --- HERRAMIENTAS PRO (BARRA LATERAL) ---

// 1. Exportar / Importar Workspace (.qa)
async function exportarWorkspace() {
    guardarLocal(true);
    if (casosGlobales.length === 0) return await alertUI("El espacio de trabajo está vacío. No hay nada que exportar.");
    
    const compEl = document.getElementById('globalComponente');
    const workspace = {
        version: "1.0",
        fecha: new Date().toISOString(),
        ticket: document.getElementById('globalTicket').value,
        tags: document.getElementById('globalEtiquetas').value,
        componente: compEl ? compEl.value : "",
        casos: casosGlobales
    };

    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Workspace_${workspace.ticket}.qa`;
    link.click();
    mostrarToast("Sesión exportada correctamente.");
}

async function importarWorkspace(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const workspace = JSON.parse(e.target.result);
            if (workspace.casos) {
                casosGlobales = workspace.casos;
                document.getElementById('globalTicket').value = workspace.ticket || "";
                document.getElementById('globalEtiquetas').value = workspace.tags || "";
                if (document.getElementById('globalComponente')) {
                    document.getElementById('globalComponente').value = workspace.componente || "";
                }
                guardarLocal();
                renderizarCasos();
                mostrarToast("Sesión importada con éxito.");
            }
        } catch (error) {
            await alertUI("El archivo seleccionado no es un formato válido de QA Suite.");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
}

async function importarCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const contenido = e.target.result;
            const parseFn = (window.csvImporter && window.csvImporter.parseXrayCsv) || (typeof parseXrayCsv === 'function' ? parseXrayCsv : null);
            if (!parseFn) {
                return await alertUI("El módulo de importación CSV no está disponible.");
            }

            const resultado = parseFn(contenido);
            const { casos, ticket, tags, componente, totalPasos } = resultado;

            if (!casos || casos.length === 0) {
                return await alertUI("No se encontraron casos de prueba válidos en el archivo CSV.");
            }

            if (casosGlobales.length > 0) {
                const modalWrap = document.createElement('div');

                const tituloModal = document.createElement('h3');
                tituloModal.textContent = 'Importar Casos desde CSV';
                tituloModal.style.marginTop = '0';
                tituloModal.style.color = '#176da5';

                const descModal = document.createElement('p');
                descModal.innerHTML = `Se detectaron <strong>${casos.length} casos</strong> con un total de <strong>${totalPasos} pasos</strong>.<br>Actualmente tienes <strong>${casosGlobales.length} casos</strong> en tu espacio de trabajo.`;

                const preguntaModal = document.createElement('p');
                preguntaModal.textContent = '¿Cómo deseas incorporar estos casos?';

                const botonesWrap = document.createElement('div');
                botonesWrap.style.display = 'flex';
                botonesWrap.style.flexDirection = 'column';
                botonesWrap.style.gap = '8px';
                botonesWrap.style.marginTop = '15px';

                const btnAnadir = document.createElement('button');
                btnAnadir.className = 'primary';
                btnAnadir.style.justifyContent = 'center';
                btnAnadir.textContent = `Añadir al final (+${casos.length} casos)`;

                const btnReemplazar = document.createElement('button');
                btnReemplazar.className = 'btn-danger';
                btnReemplazar.style.justifyContent = 'center';
                btnReemplazar.textContent = `Reemplazar todo (${casos.length} casos)`;

                botonesWrap.append(btnAnadir, btnReemplazar);
                modalWrap.append(tituloModal, descModal, preguntaModal, botonesWrap);

                const eleccion = await new Promise((resolve) => {
                    const modal = document.getElementById('customModal');
                    const msgEl = document.getElementById('modalMessage');
                    const btnCancel = document.getElementById('modalCancel');
                    const btnConfirm = document.getElementById('modalConfirm');

                    msgEl.replaceChildren(modalWrap);
                    modal.classList.add('active');
                    btnCancel.style.display = 'inline-block';
                    btnCancel.textContent = 'Cancelar';
                    btnConfirm.style.display = 'none';

                    const limpiar = () => {
                        modal.classList.remove('active');
                        btnConfirm.style.display = 'inline-block';
                        btnCancel.onclick = null;
                        btnAnadir.onclick = null;
                        btnReemplazar.onclick = null;
                    };

                    btnAnadir.onclick = () => { limpiar(); resolve('anadir'); };
                    btnReemplazar.onclick = () => { limpiar(); resolve('reemplazar'); };
                    btnCancel.onclick = () => { limpiar(); resolve('cancelar'); };
                });

                if (eleccion === 'cancelar') return;

                if (eleccion === 'anadir') {
                    casosGlobales = [...casosGlobales, ...casos];
                } else if (eleccion === 'reemplazar') {
                    casosGlobales = casos;
                    if (ticket) document.getElementById('globalTicket').value = ticket;
                    if (tags) document.getElementById('globalEtiquetas').value = tags;
                    if (componente && document.getElementById('globalComponente')) document.getElementById('globalComponente').value = componente;
                }
            } else {
                casosGlobales = casos;
                if (ticket) document.getElementById('globalTicket').value = ticket;
                if (tags) document.getElementById('globalEtiquetas').value = tags;
                if (componente && document.getElementById('globalComponente')) document.getElementById('globalComponente').value = componente;
            }

            guardarLocal(true);
            renderizarCasos();
            mostrarToast(`Se importaron ${casos.length} casos (${totalPasos} pasos) con éxito.`);
        } catch (error) {
            console.error("Error al importar CSV:", error);
            await alertUI(`Ocurrió un error al procesar el archivo CSV: ${error.message}`);
        }
    };
    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
}

// 2. Buscar y Reemplazar Dinámico
async function reemplazarMasivo() {
    const buscar = document.getElementById("buscarTxt").value;
    const reemplazar = document.getElementById("reemplazarTxt").value;
    
    if(!buscar) return await alertUI("Ingresa un texto a buscar.");

    const indices = casosGlobales.reduce((acc, c, idx) => c.selected ? [...acc, idx] : acc, []);
    if(indices.length === 0) {
        return await alertUI("Selecciona al menos un caso (marcando su casilla) para aplicar el reemplazo.");
    }

    let reemplazosHechos = 0;
    const textoBusqueda = buscar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(textoBusqueda, 'g');
    const reemplazarLiteral = () => reemplazar;

    indices.forEach(idx => {
        let caso = casosGlobales[idx];
        if(caso.titulo.match(regex)) { caso.titulo = caso.titulo.replace(regex, reemplazarLiteral).trim(); reemplazosHechos++; }
        if(caso.precondiciones.match(regex)) { caso.precondiciones = caso.precondiciones.replace(regex, reemplazarLiteral); reemplazosHechos++; }
        
        caso.pasos.forEach(p => {
            if(p.accion.match(regex)) { p.accion = p.accion.replace(regex, reemplazarLiteral); reemplazosHechos++; }
            if(p.resultado_esperado.match(regex)) { p.resultado_esperado = p.resultado_esperado.replace(regex, reemplazarLiteral); reemplazosHechos++; }
        });
    });

    guardarLocal();
    renderizarCasos();
    mostrarToast(`Se realizaron ${reemplazosHechos} reemplazos.`);
}

// 3. Librería de Snippets
async function inyectarSnippet(snippetId) {
    const indices = casosGlobales.reduce((acc, c, idx) => c.selected ? [...acc, idx] : acc, []);
    if (indices.length === 0) return await alertUI("Selecciona al menos un caso marcando su casilla para inyectar este snippet.");
    
    // Buscar en snippets del usuario o predeterminados
    let snippet = snippetsUsuario.find(s => s.id === snippetId);
    if (!snippet) {
        snippet = DEFAULT_SNIPPETS.find(s => s.id === snippetId);
    }
    
    const pasos = Array.isArray(snippet?.pasos) ? snippet.pasos : (SNIPPETS[snippetId] || []);
    if (pasos.length === 0) {
        return await alertUI("El snippet seleccionado no contiene pasos válidos.");
    }
    
    indices.forEach(idx => {
        casosGlobales[idx].pasos = [...casosGlobales[idx].pasos, ...JSON.parse(JSON.stringify(pasos))];
    });
    
    guardarLocal();
    renderizarCasos();
    const nombre = snippet?.nombre || 'Snippet';
    mostrarToast(`"${nombre}" inyectado en ${indices.length} casos seleccionados.`);
}

// --- GESTIÓN DEL REPERTORIO DE SNIPPETS (CRUD) ---

function abrirGestorSnippets() {
    const modal = document.getElementById('snippetsModal');
    if (!modal) return;
    
    document.getElementById('snippetsListView').style.display = 'block';
    document.getElementById('snippetsEditorView').style.display = 'none';
    
    renderizarListaGestorSnippets();
    modal.classList.add('active');
}

function cerrarGestorSnippets() {
    const modal = document.getElementById('snippetsModal');
    if (modal) modal.classList.remove('active');
}

function renderizarListaGestorSnippets() {
    const contenedor = document.getElementById('snippetsItemsContainer');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (!Array.isArray(snippetsUsuario) || snippetsUsuario.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 24px; color: #64748b;">
                <p>No tienes snippets en tu repertorio.</p>
                <button type="button" class="primary btn-sm" onclick="abrirEditorSnippet(null)">
                    <svg class="ui-icon" aria-hidden="true"><use href="#icon-add"></use></svg>Crear Primer Snippet
                </button>
            </div>
        `;
        return;
    }

    snippetsUsuario.forEach(snippet => {
        const card = document.createElement('div');
        card.className = 'snippet-card';

        const pasos = Array.isArray(snippet.pasos) ? snippet.pasos : [];
        const previewItems = pasos.slice(0, 3).map(p => `<li>${escaparHTML(p.accion || 'Acción sin definir')}</li>`).join('');
        const masPasos = pasos.length > 3 ? `<li><em>...y ${pasos.length - 3} paso(s) más</em></li>` : '';

        card.innerHTML = `
            <div class="snippet-card-top">
                <div class="snippet-card-title-group">
                    <span class="snippet-card-title">${escaparHTML(snippet.nombre)}</span>
                    <span class="snippet-step-badge">${pasos.length} paso${pasos.length === 1 ? '' : 's'}</span>
                </div>
                <div class="snippet-card-actions">
                    <button type="button" class="snippet-btn-action" title="Editar snippet" onclick="abrirEditorSnippet('${snippet.id}')">
                        <svg class="ui-icon" aria-hidden="true"><use href="#icon-edit"></use></svg>Editar
                    </button>
                    <button type="button" class="snippet-btn-action btn-del" title="Eliminar snippet" onclick="eliminarSnippet('${snippet.id}')">
                        <svg class="ui-icon" aria-hidden="true"><use href="#icon-trash"></use></svg>Eliminar
                    </button>
                </div>
            </div>
            <div class="snippet-steps-preview">
                <ol>${previewItems}${masPasos}</ol>
            </div>
        `;
        contenedor.appendChild(card);
    });
}

function abrirEditorSnippet(snippetId = null) {
    const listView = document.getElementById('snippetsListView');
    const editorView = document.getElementById('snippetsEditorView');
    const editorTitle = document.getElementById('snippetEditorTitle');
    const editIdInput = document.getElementById('snippetEditId');
    const nombreInput = document.getElementById('snippetNombreInput');
    const pasosList = document.getElementById('snippetPasosList');

    if (!editorView || !pasosList) return;

    pasosList.innerHTML = '';

    if (!snippetId) {
        editorTitle.textContent = 'Crear Nuevo Snippet';
        editIdInput.value = '';
        nombreInput.value = '';
        agregarFilaPasoSnippet('', '');
    } else {
        const snippet = snippetsUsuario.find(s => s.id === snippetId);
        if (!snippet) return;

        editorTitle.textContent = `Editar Snippet: ${snippet.nombre}`;
        editIdInput.value = snippet.id;
        nombreInput.value = snippet.nombre;

        const pasos = Array.isArray(snippet.pasos) ? snippet.pasos : [];
        if (pasos.length === 0) {
            agregarFilaPasoSnippet('', '');
        } else {
            pasos.forEach(p => agregarFilaPasoSnippet(p.accion || '', p.resultado_esperado || ''));
        }
    }

    listView.style.display = 'none';
    editorView.style.display = 'block';
    nombreInput.focus();
}

function agregarFilaPasoSnippet(accion = '', resultado = '') {
    const pasosList = document.getElementById('snippetPasosList');
    if (!pasosList) return;

    const row = document.createElement('div');
    row.className = 'snippet-paso-row';
    const index = pasosList.children.length + 1;

    row.innerHTML = `
        <span class="snippet-paso-num">${index}</span>
        <input type="text" class="snippet-step-accion" placeholder="Acción del paso..." value="${escaparHTML(accion)}" autocomplete="off">
        <input type="text" class="snippet-step-resultado" placeholder="Resultado esperado..." value="${escaparHTML(resultado)}" autocomplete="off">
        <button type="button" class="snippet-paso-del-btn" title="Eliminar paso" onclick="eliminarFilaPasoSnippet(this)">
            <svg class="ui-icon" aria-hidden="true"><use href="#icon-trash"></use></svg>
        </button>
    `;
    pasosList.appendChild(row);
    renumerarPasosSnippet();
}

function eliminarFilaPasoSnippet(btn) {
    const row = btn?.closest('.snippet-paso-row');
    const pasosList = document.getElementById('snippetPasosList');
    if (row && pasosList) {
        row.remove();
        if (pasosList.children.length === 0) {
            agregarFilaPasoSnippet('', '');
        } else {
            renumerarPasosSnippet();
        }
    }
}

function renumerarPasosSnippet() {
    const pasosList = document.getElementById('snippetPasosList');
    if (!pasosList) return;
    Array.from(pasosList.children).forEach((row, idx) => {
        const num = row.querySelector('.snippet-paso-num');
        if (num) num.textContent = idx + 1;
    });
}

function cancelarEditorSnippet() {
    document.getElementById('snippetsEditorView').style.display = 'none';
    document.getElementById('snippetsListView').style.display = 'block';
}

async function guardarSnippetDesdeEditor() {
    const editId = (document.getElementById('snippetEditId')?.value || '').trim();
    const nombre = (document.getElementById('snippetNombreInput')?.value || '').trim();

    if (!nombre) {
        return await alertUI('Por favor ingresa un nombre o título para el snippet.');
    }

    const pasosRows = document.querySelectorAll('#snippetPasosList .snippet-paso-row');
    const pasos = [];

    pasosRows.forEach(row => {
        const accion = (row.querySelector('.snippet-step-accion')?.value || '').trim();
        const resultado = (row.querySelector('.snippet-step-resultado')?.value || '').trim();
        if (accion || resultado) {
            pasos.push({
                accion: accion || 'Acción de prueba.',
                resultado_esperado: resultado || 'Resultado satisfactorio.'
            });
        }
    });

    if (pasos.length === 0) {
        return await alertUI('El snippet debe contener al menos un paso con acción o resultado esperado.');
    }

    if (editId) {
        const idx = snippetsUsuario.findIndex(s => s.id === editId);
        if (idx !== -1) {
            snippetsUsuario[idx].nombre = nombre;
            snippetsUsuario[idx].pasos = pasos;
        } else {
            snippetsUsuario.push({ id: editId, nombre, pasos });
        }
    } else {
        const nuevoId = 'snip_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        snippetsUsuario.push({
            id: nuevoId,
            nombre,
            pasos
        });
    }

    guardarSnippets();
    renderizarListaGestorSnippets();
    mostrarToast(`Snippet "${nombre}" guardado con éxito.`);

    document.getElementById('snippetsEditorView').style.display = 'none';
    document.getElementById('snippetsListView').style.display = 'block';
}

async function eliminarSnippet(snippetId) {
    const snippet = snippetsUsuario.find(s => s.id === snippetId);
    if (!snippet) return;

    const confirma = await confirmarUI(`¿Estás seguro de que deseas eliminar el snippet "${snippet.nombre}" de tu repertorio?`);
    if (!confirma) return;

    snippetsUsuario = snippetsUsuario.filter(s => s.id !== snippetId);
    guardarSnippets();
    renderizarListaGestorSnippets();
    mostrarToast(`Snippet "${snippet.nombre}" eliminado.`);
}

async function restablecerSnippetsPredeterminados() {
    const confirma = await confirmarUI("¿Deseas restablecer los snippets de fábrica? Se conservarán los 3 predeterminados (Inicio de Sesión, Cobro Tarjeta, Validación de Respuesta).");
    if (!confirma) return;

    snippetsUsuario = JSON.parse(JSON.stringify(DEFAULT_SNIPPETS));
    guardarSnippets();
    renderizarListaGestorSnippets();
    mostrarToast("Snippets restablecidos a los valores predeterminados.");
}

// 4. Semáforo de Estado
function actualizarBadgeEstadoDOM(cIndex, estadoKey) {
    const badge = document.getElementById(`status-badge-${cIndex}`);
    if (!badge) return;
    const info = ESTADOS[estadoKey || 'pending'];
    badge.className = `status-badge ${info.clase}`;
    badge.innerHTML = `<svg class="ui-icon" aria-hidden="true"><use href="#${info.icono}"></use></svg>${info.texto}`;
}

function ciclarEstado(cIndex) {
    const caso = casosGlobales[cIndex];
    if (!caso) return;
    const actual = caso.status || 'pending';
    const nuevo = ESTADOS[actual].siguiente;
    caso.status = nuevo;
    actualizarBadgeEstadoDOM(cIndex, nuevo);
    guardarLocal();
}

// --- DRAG & DROP (REORDENAMIENTO) ---
// Arrastrar Casos Completos
function dragCasoStart(e, index) { casoArrastradoIndex = index; e.dataTransfer.effectAllowed = "move"; }
function dragOverCaso(e, index) { e.preventDefault(); document.getElementById(`case-item-${index}`).classList.add('drag-over'); }
function dragLeaveCaso(e, index) { document.getElementById(`case-item-${index}`).classList.remove('drag-over'); }
function dropCaso(e, indexTarget) {
    e.preventDefault();
    document.getElementById(`case-item-${indexTarget}`).classList.remove('drag-over');
    if (casoArrastradoIndex === null || casoArrastradoIndex === indexTarget) return;
    
    const casoMovido = casosGlobales.splice(casoArrastradoIndex, 1)[0];
    casosGlobales.splice(indexTarget, 0, casoMovido);
    
    casoArrastradoIndex = null;
    guardarLocal(); renderizarCasos();
}

// Arrastrar Pasos (Dentro del mismo caso)
let pasoArrastradoInfo = null;
function dragPasoStart(e, cIndex, pIndex) {
    e.stopPropagation(); // Evita arrastrar el caso completo
    pasoArrastradoInfo = { cIndex, pIndex };
}
function dragOver(e) { e.preventDefault(); }
function dropPaso(e, targetCIndex, targetPIndex) {
    e.preventDefault();
    e.stopPropagation();
    if (!pasoArrastradoInfo || pasoArrastradoInfo.cIndex !== targetCIndex || pasoArrastradoInfo.pIndex === targetPIndex) return;
    
    const caso = casosGlobales[targetCIndex];
    const pasoMovido = caso.pasos.splice(pasoArrastradoInfo.pIndex, 1)[0];
    caso.pasos.splice(targetPIndex, 0, pasoMovido);
    
    pasoArrastradoInfo = null;
    guardarLocal(); renderizarCasos();
    toggleAcordeon(`body-${targetCIndex}`); // Mantener abierto
}

// --- OPERACIONES BÁSICAS Y MASIVAS ---
// --- GENERACIÓN EN LOTE (MÁS INTELIGENTE) ---
async function generarEsqueletos() {
    const texto = document.getElementById("listaLote").value;
    if (!texto.trim()) return await alertUI("Pega una lista de títulos primero.");

    const lineas = texto
        .replace(/[\u00a0\u2007\u202f]/g, ' ')
        .replace(/[\u200b-\u200d\ufeff]/g, '')
        .split(/\r\n?|\n|\u2028|\u2029|\v|\f/);
    let tituloActual = "";
    let casosAInsertar = [];

    lineas.forEach(linea => {
        let lineaLimpia = linea.trim();
        if (!lineaLimpia) {
            if (tituloActual !== "") {
                casosAInsertar.push(tituloActual);
                tituloActual = "";
            }
            return;
        }

        // Recognize repeated Word numbering and common pasted list markers.
        const marcador = lineaLimpia.match(/^(?:\d+\s*[.)\-]|[\u2022\u25e6\u25aa])\s*/);

        if (marcador) {
            if (tituloActual !== "") casosAInsertar.push(tituloActual);
            tituloActual = lineaLimpia.slice(marcador[0].length).trim();
        } else {
            if (tituloActual === "") {
                tituloActual = lineaLimpia;
            } else {
                tituloActual += " " + lineaLimpia;
            }
        }
    });

    if (tituloActual !== "") casosAInsertar.push(tituloActual);

    // Ahora sí, creamos los esqueletos perfectos
    casosAInsertar.forEach(tituloLimpio => {
        casosGlobales.push({
            titulo: tituloLimpio, 
            precondiciones: "Configuración estándar del ambiente...", 
            status: 'pending', 
            selected: false,
            pasos: [{ accion: "Ingresar al sistema.", resultado_esperado: "Sistema responde correctamente." }]
        });
    });

    document.getElementById("listaLote").value = "";
    guardarLocal(); 
    renderizarCasos();
    mostrarToast(`${casosAInsertar.length} casos creados con éxito.`);
}

function alternarSeleccionCaso(cIndex, checkbox) {
    if (!casosGlobales[cIndex]) return;
    const seleccionado = checkbox.checked;
    casosGlobales[cIndex].selected = seleccionado;
    const tarjeta = document.getElementById(`case-item-${cIndex}`);
    if (tarjeta) {
        tarjeta.classList.toggle('selected', seleccionado);
    }

    const masterCb = document.getElementById('selectAllCheckbox');
    if (masterCb) {
        const total = casosGlobales.length;
        const seleccionados = casosGlobales.filter(c => c.selected).length;
        masterCb.checked = total > 0 && seleccionados === total;
    }

    actualizarMenuMasivo();
    guardarLocal();
}

function alternarSeleccionarTodo(masterCb) {
    const seleccionado = masterCb.checked;
    casosGlobales.forEach((c, cIndex) => {
        c.selected = seleccionado;
        const cb = document.getElementById(`check-${cIndex}`);
        if (cb) cb.checked = seleccionado;
        const tarjeta = document.getElementById(`case-item-${cIndex}`);
        if (tarjeta) tarjeta.classList.toggle('selected', seleccionado);
    });
    actualizarMenuMasivo();
    guardarLocal();
}

function actualizarMenuMasivo() {
    const count = casosGlobales.filter(c => c.selected).length;
    const menu = document.getElementById('bulkMenu');
    document.getElementById('bulkSelectedCount').innerText = count;
    count > 0 ? menu.classList.add('active') : menu.classList.remove('active');
}

function cambiarEstadoMasivo() {
    const estado = document.getElementById('bulkStatusSelect').value;
    let actualizados = 0;
    casosGlobales.forEach((caso, cIndex) => {
        if (caso.selected) {
            caso.status = estado;
            actualizarBadgeEstadoDOM(cIndex, estado);
            actualizados++;
        }
    });
    if (actualizados === 0) return;
    guardarLocal();
    mostrarToast(`Estado actualizado en ${actualizados} casos.`);
}

async function pegarPasosMasivo() {
    if (!portapapelesPasos) return await alertUI("Copia los pasos de un caso primero.");
    casosGlobales.forEach(c => { if(c.selected) { c.pasos = JSON.parse(JSON.stringify(portapapelesPasos)); c.selected = false; } });
    guardarLocal(); renderizarCasos(); mostrarToast("Pasos pegados masivamente.");
}

function duplicarMasivo() {
    const seleccionados = casosGlobales.filter(c => c.selected);
    seleccionados.forEach(c => {
        let copia = JSON.parse(JSON.stringify(c));
        copia.titulo += " (Copia)"; copia.selected = false; copia.status = 'pending';
        casosGlobales.push(copia);
    });
    casosGlobales.forEach(c => c.selected = false);
    guardarLocal(); renderizarCasos();
}

async function borrarMasivo() {
    if (await confirmUI("¿Borrar permanentemente los casos seleccionados?", true)) {
        casosGlobales = casosGlobales.filter(c => !c.selected);
        document.getElementById('selectAllCheckbox').checked = false;
        guardarLocal(); renderizarCasos();
    }
}

// Operaciones individuales de CRUD
function agregarCasoBlanco() { casosGlobales.push({ titulo: "Nuevo Caso", precondiciones: "", pasos: [{ accion: "", resultado_esperado: "" }], status: 'pending' }); guardarLocal(); renderizarCasos(); }
function duplicarCaso(index) { let copia = JSON.parse(JSON.stringify(casosGlobales[index])); copia.titulo += " (Copia)"; copia.selected = false; casosGlobales.splice(index + 1, 0, copia); guardarLocal(); renderizarCasos(); }
async function eliminarCaso(index) { if(await confirmUI("¿Borrar caso?", true)) { casosGlobales.splice(index, 1); guardarLocal(); renderizarCasos(); } }
async function limpiarTodo() { if(await confirmUI("¿Borrar todo?", true)) { casosGlobales = []; guardarLocal(); renderizarCasos(); } }
function agregarPaso(cIndex) { casosGlobales[cIndex].pasos.push({ accion: "", resultado_esperado: "" }); guardarLocal(); renderizarCasos(); toggleAcordeon(`body-${cIndex}`); }
function eliminarPaso(cIndex, pIndex) { casosGlobales[cIndex].pasos.splice(pIndex, 1); guardarLocal(); renderizarCasos(); toggleAcordeon(`body-${cIndex}`); }
function copiarPasos(cIndex) { portapapelesPasos = JSON.parse(JSON.stringify(casosGlobales[cIndex].pasos)); mostrarToast("Pasos copiados al portapapeles."); }
async function pegarPasos(cIndex) {
    if(!portapapelesPasos) return await alertUI("No has copiado ningún paso aún.");
    if(await confirmUI("¿Sobrescribir los pasos actuales de este caso con los copiados?")) {
        casosGlobales[cIndex].pasos = JSON.parse(JSON.stringify(portapapelesPasos));
        guardarLocal(); renderizarCasos(); toggleAcordeon(`body-${cIndex}`);
    }
}
function actualizarCaso(i, c, el) { casosGlobales[i][c] = el.innerText; guardarLocal(); }
function actualizarPaso(ci, pi, c, el) { casosGlobales[ci].pasos[pi][c] = el.innerText; guardarLocal(); }

// --- EXPORTACIÓN CSV XRAY (Descripción y vínculos) ---
function escaparCSV(texto) { return `"${(texto || '').toString().replace(/"/g, '""')}"`; }

async function descargarCSV() {
    guardarLocal(true);
    if (casosGlobales.length === 0) return await alertUI("No hay casos para descargar.");
    
    const tkt = document.getElementById('globalTicket').value || "TICKET";
    const customTags = document.getElementById('globalEtiquetas').value || "";
    const customComponente = document.getElementById('globalComponente') ? document.getElementById('globalComponente').value.trim() : "";
    const columnasCSV = ["TCID", "Resumen", "Descripción", "Tipo de Test", "Acción", "Datos de Prueba", "Resultado Esperado", "Componentes", "Etiquetas", "HU Relacionada", "Responsable"];
    let csvContent = columnasCSV.map(escaparCSV).join(",") + "\n";
    const filasPreview = [];
    const erroresValidacion = [];
    const advertenciasValidacion = [];
    
    casosGlobales.forEach((caso, index) => {
        let tcid = "CP-" + String(index + 1).padStart(3, '0');
        const tituloCaso = typeof caso.titulo === 'string' ? caso.titulo : "";
        const precondiciones = typeof caso.precondiciones === 'string' ? caso.precondiciones : "";
        let textoDescripcion = tituloCaso;
        if (precondiciones.trim()) {
            textoDescripcion += "\n\nPrecondiciones:\n" + precondiciones;
        }
        const pasos = Array.isArray(caso.pasos) ? caso.pasos : [];

        if (!tituloCaso.trim()) {
            erroresValidacion.push(`${tcid}: falta el título del caso.`);
        }
        if (pasos.length === 0) {
            erroresValidacion.push(`${tcid}: el caso no tiene pasos y no generará filas en el CSV.`);
        }

        pasos.forEach((paso, pasoIndex) => {
            const accion = typeof paso.accion === 'string' ? paso.accion : "";
            const resultado = typeof paso.resultado_esperado === 'string' ? paso.resultado_esperado : "";
            if (!accion.trim()) {
                advertenciasValidacion.push(`${tcid}, paso ${pasoIndex + 1}: la acción está vacía.`);
            }
            if (!resultado.trim()) {
                advertenciasValidacion.push(`${tcid}, paso ${pasoIndex + 1}: el resultado esperado está vacío.`);
            }
            const fila = {
                tcid,
                resumen: tituloCaso,
                descripcion: textoDescripcion,
                tipoTest: "Manual",
                accion,
                datosPrueba: "",
                resultado,
                componentes: customComponente,
                etiquetas: [tkt, customTags].filter(Boolean).join(", "),
                enlaceHU: tkt,
                responsable: ""
            };
            csvContent += [
                fila.tcid, fila.resumen, fila.descripcion, fila.tipoTest, fila.accion,
                fila.datosPrueba, fila.resultado, fila.componentes, fila.etiquetas, fila.enlaceHU, fila.responsable
            ].map(escaparCSV).join(",") + "\n";
            filasPreview.push(fila);
        });
    });

    mostrarVistaPreviaCSV({
        csvContent,
        nombreArchivo: `XRAY_${tkt}.csv`,
        casosCount: casosGlobales.length,
        columnasCSV,
        filasPreview,
        customComponente,
        erroresValidacion,
        advertenciasValidacion
    });
}

function mostrarVistaPreviaCSV({ csvContent, nombreArchivo, casosCount, columnasCSV, filasPreview, customComponente, erroresValidacion, advertenciasValidacion }) {
    const modal = document.getElementById('customModal');
    const modalBox = modal.querySelector('.modal-box');
    const msgEl = document.getElementById('modalMessage');
    const btnCancel = document.getElementById('modalCancel');
    const btnConfirm = document.getElementById('modalConfirm');
    const contenido = document.createElement('div');
    contenido.className = 'csv-preview-content';

    const titulo = document.createElement('h3');
    titulo.textContent = 'Vista previa y validación del CSV';
    contenido.append(titulo);

    const resumen = document.createElement('p');
    resumen.textContent = `${casosCount} casos · ${filasPreview.length} filas en CSV (1 fila por cada paso de prueba) · ${erroresValidacion.length} errores · ${advertenciasValidacion.length} advertencias`;
    contenido.append(resumen);

    const explicacion = document.createElement('div');
    explicacion.className = 'csv-info-callout';
    explicacion.innerHTML = `<strong>💡 ¿Por qué hay ${filasPreview.length} filas para ${casosCount} casos?</strong><br>En el formato oficial de <strong>Jira Xray</strong>, cada fila del archivo CSV representa <strong>1 paso de prueba</strong>. Los casos con varios pasos repiten su <code>TCID</code> y <code>Resumen</code> para que Jira los agrupe dentro del <strong>mismo ticket de prueba</strong> sin duplicar incidencias.`;
    contenido.append(explicacion);

    const notaAsignacion = document.createElement('div');
    notaAsignacion.className = 'csv-info-callout callout-unassigned';
    notaAsignacion.innerHTML = `<strong>👤 Casos Sin Asignar:</strong> La columna <code>Responsable</code> se exporta vacía y <code>Componentes</code> ${customComponente ? `está configurado como "<code>${customComponente}</code>"` : 'se encuentra vacío'}. Al importar en Jira, <strong>no mapees Componentes</strong> para evitar que se auto-asignen al Product Owner o líder del componente.`;
    contenido.append(notaAsignacion);

    const listaValidacion = document.createElement('ul');
    listaValidacion.className = 'csv-validation-list';
    erroresValidacion.forEach(mensaje => {
        const item = document.createElement('li');
        item.className = 'csv-validation-error';
        item.textContent = mensaje;
        listaValidacion.append(item);
    });
    advertenciasValidacion.forEach(mensaje => {
        const item = document.createElement('li');
        item.className = 'csv-validation-warning';
        item.textContent = mensaje;
        listaValidacion.append(item);
    });
    if (listaValidacion.childElementCount === 0) {
        const item = document.createElement('li');
        item.className = 'csv-validation-success';
        item.textContent = 'Validación correcta. No se encontraron campos vacíos obligatorios.';
        listaValidacion.append(item);
    }
    contenido.append(listaValidacion);

    const nota = document.createElement('p');
    nota.className = 'csv-preview-note';
    nota.textContent = 'Contenido completo que se incluirá en el archivo:';
    contenido.append(nota);

    const tablaContenedor = document.createElement('div');
    tablaContenedor.className = 'csv-preview-table-wrap';
    const tabla = document.createElement('table');
    const encabezado = document.createElement('thead');
    const filaEncabezado = document.createElement('tr');
    columnasCSV.forEach(texto => {
        const celda = document.createElement('th');
        celda.textContent = texto;
        filaEncabezado.append(celda);
    });
    encabezado.append(filaEncabezado);
    tabla.append(encabezado);

    const cuerpo = document.createElement('tbody');
    let tcidAnterior = null;
    filasPreview.forEach(fila => {
        const tr = document.createElement('tr');
        if (tcidAnterior !== null && fila.tcid !== tcidAnterior) {
            tr.classList.add('csv-row-new-case');
        }
        tcidAnterior = fila.tcid;
        [
            fila.tcid, fila.resumen, fila.descripcion, fila.tipoTest, fila.accion,
            fila.datosPrueba, fila.resultado, fila.componentes, fila.etiquetas, fila.enlaceHU, fila.responsable
        ].forEach(valor => {
            const celda = document.createElement('td');
            celda.textContent = valor;
            tr.append(celda);
        });
        cuerpo.append(tr);
    });
    tabla.append(cuerpo);
    tablaContenedor.append(tabla);
    contenido.append(tablaContenedor);

    const cerrar = () => {
        modal.classList.remove('active');
        modalBox.classList.remove('csv-preview-modal');
        btnCancel.onclick = null;
        btnConfirm.onclick = null;
        btnConfirm.disabled = false;
        btnCancel.textContent = 'Cancelar';
    };

    msgEl.replaceChildren(contenido);
    modalBox.classList.add('csv-preview-modal');
    modal.classList.add('active');
    btnCancel.style.display = 'inline-block';
    btnCancel.textContent = 'Cerrar';
    btnConfirm.className = 'primary';
    btnConfirm.textContent = erroresValidacion.length ? 'Corrige los errores' : 'Descargar CSV';
    btnConfirm.disabled = erroresValidacion.length > 0;
    btnCancel.onclick = cerrar;
    btnConfirm.onclick = () => {
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = nombreArchivo;
        link.click();
        URL.revokeObjectURL(url);
        cerrar();
    };
}

// --- TUTORIAL INTEGRADO PARA IMPORTACIÓN EN JIRA ---
function mostrarTutorialJira() {
    const contenido = document.createElement('div');
    contenido.className = 'tutorial-content';

    const titulo = document.createElement('h3');
    titulo.textContent = 'Guía de Importación Xray';
    contenido.append(titulo);

    const introduccion = document.createElement('p');
    introduccion.append(document.createTextNode('Sigue estos pasos en Jira para importar el archivo '));
    const extension = document.createElement('strong');
    extension.textContent = '.csv';
    introduccion.append(extension, document.createTextNode(' generado por esta suite:'));
    contenido.append(introduccion);

    const pasos = [
        ['En Jira, ve a', 'Aplicaciones (Apps) > Xray > Test Case Importer.'],
        ['Sube el archivo CSV. Usa delimitador', 'Coma (,) y codificación UTF-8.'],
        ['En Tipo de Incidencia, selecciona', 'Tipo de Test.'],
        ['En Mapear Campos, configura los campos como se indica en la tabla:']
    ];
    const lista = document.createElement('ol');
    pasos.forEach(([texto, destacado]) => {
        const item = document.createElement('li');
        item.append(document.createTextNode(texto));
        if (destacado) {
            const strong = document.createElement('strong');
            strong.textContent = destacado;
            item.append(' ', strong);
        }
        lista.append(item);
    });
    contenido.append(lista);

    const calloutAsignacion = document.createElement('div');
    calloutAsignacion.className = 'csv-info-callout callout-unassigned';
    calloutAsignacion.style.marginBottom = '12px';
    calloutAsignacion.innerHTML = `<strong>👤 Para que los casos queden SIN ASIGNAR:</strong><br>
1. <strong>No mapees la columna "Componentes"</strong>: Si la mapeas, Jira aplicará la regla del componente y asignará los casos al Product Owner o líder del componente.<br>
2. <strong>No mapees "Responsable"</strong> (o mapea a Assignee dejándolo en blanco).<br>
3. <strong>Configuración del Proyecto en Jira</strong>: Asegúrate de que el <em>Asignado por defecto</em> del proyecto esté configurado como <strong>Sin asignar (Unassigned)</strong>.`;
    contenido.append(calloutAsignacion);

    const tabla = document.createElement('table');
    const encabezado = document.createElement('thead');
    const filaEncabezado = document.createElement('tr');
    ['Columna de tu CSV', 'Campo en Jira / Xray'].forEach((texto) => {
        const celda = document.createElement('th');
        celda.textContent = texto;
        filaEncabezado.append(celda);
    });
    encabezado.append(filaEncabezado);
    tabla.append(encabezado);

    const mapeos = [
        ['TCID', 'ID de Tarea'],
        ['Resumen', 'Resumen'],
        ['Descripción', 'Descripción'],
        ['Tipo de Test', 'Tipo de Test'],
        ['Acción', 'Acción'],
        ['Resultado Esperado', 'Resultados Esperados'],
        ['HU Relacionada', 'Enlace "tests" (o Enlace externo)']
    ];
    const cuerpo = document.createElement('tbody');
    mapeos.forEach(([columna, campo]) => {
        const fila = document.createElement('tr');
        const celdaColumna = document.createElement('td');
        const codigo = document.createElement('code');
        codigo.textContent = columna;
        celdaColumna.append(codigo);
        const celdaCampo = document.createElement('td');
        celdaCampo.textContent = campo;
        fila.append(celdaColumna, celdaCampo);
        cuerpo.append(fila);
    });
    const filaOmitir = document.createElement('tr');
    filaOmitir.className = 'tutorial-skip-row';
    const campoOmitir = document.createElement('td');
    campoOmitir.textContent = 'Datos de Prueba, Componentes, Etiquetas, Responsable';
    const instruccionOmitir = document.createElement('td');
    instruccionOmitir.innerHTML = '<strong>No mapear</strong> (evita que Componentes auto-asigne al PO)';
    filaOmitir.append(campoOmitir, instruccionOmitir);
    cuerpo.append(filaOmitir);
    tabla.append(cuerpo);
    contenido.append(tabla);

    const modalBox = document.querySelector('#customModal .modal-box');
    modalBox.classList.add('tutorial-modal');
    return customModal(contenido).then((resultado) => {
        modalBox.classList.remove('tutorial-modal');
        return resultado;
    });
}

// --- ASISTENTE IA (GROQ CLOUD) ---
let casosGeneradosIA = [];

const DECOMMISSIONED_MODELS = [
    'deepseek-r1-distill-llama-70b',
    'qwen-2.5-32b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama-3.1-70b-versatile',
    'llama-3.2-11b-vision-preview',
    'llama-3.2-1b-preview',
    'llama-3.2-3b-preview',
    'canopylabs/orpheus-v1-english',
    'canopylabs/orpheus-arabic-saudi'
];

function actualizarModelosSelect(modelsList) {
    if (!Array.isArray(modelsList) || modelsList.length === 0) return;

    const select = document.getElementById('aiModelSelect');
    if (!select) return;

    const valorPrevio = select.value || localStorage.getItem('groq_model') || '';
    select.innerHTML = '';

    // Filtrar modelos no disponibles para generación de casos (audio, descontinuados, etc.)
    const modelosValidos = modelsList.filter(id => !DECOMMISSIONED_MODELS.includes(id));
    if (modelosValidos.length === 0) modelosValidos.push('openai/gpt-oss-120b');

    modelosValidos.forEach(modelId => {
        const opt = document.createElement('option');
        opt.value = modelId;
        let etiqueta = modelId;
        if (modelId.includes('gpt-oss-120b')) etiqueta = 'OpenAI GPT-OSS 120B (Recomendado - Máxima capacidad)';
        else if (modelId.includes('qwen')) etiqueta = 'Qwen 3.8 27B (Lógica y negocio)';
        else if (modelId.includes('gpt-oss-20b')) etiqueta = 'OpenAI GPT-OSS 20B (Ultra rápido)';
        else if (modelId.includes('allam')) etiqueta = `ALLAM (${modelId})`;
        opt.textContent = etiqueta;
        select.append(opt);
    });

    if (modelosValidos.includes(valorPrevio) && !DECOMMISSIONED_MODELS.includes(valorPrevio)) {
        select.value = valorPrevio;
    } else {
        const preferido = modelosValidos.find(m => m.includes('gpt-oss-120b')) || modelosValidos.find(m => m.includes('qwen')) || modelosValidos[0];
        select.value = preferido;
        localStorage.setItem('groq_model', preferido);
    }
}

function abrirModalIA() {
    const modal = document.getElementById('aiModal');
    if (!modal) return;

    // Recuperar configuración guardada (migrando modelos deprecados)
    const savedKey = localStorage.getItem('groq_api_key') || '';
    let savedModel = localStorage.getItem('groq_model') || 'openai/gpt-oss-120b';
    if (DECOMMISSIONED_MODELS.includes(savedModel)) {
        savedModel = 'openai/gpt-oss-120b';
        localStorage.setItem('groq_model', savedModel);
    }
    const savedFocus = localStorage.getItem('groq_focus') || 'balanced';

    const apiKeyInput = document.getElementById('aiApiKey');
    if (apiKeyInput) apiKeyInput.value = savedKey;

    const modelSelect = document.getElementById('aiModelSelect');
    if (modelSelect) modelSelect.value = savedModel;

    const focusSelect = document.getElementById('aiFocusSelect');
    if (focusSelect) focusSelect.value = savedFocus;

    // Si la lista en lote tiene texto, prellenar como sugerencia si el prompt está vacío
    const promptText = document.getElementById('aiPromptText');
    const listaLote = document.getElementById('listaLote');
    if (promptText && !promptText.value.trim() && listaLote && listaLote.value.trim()) {
        promptText.value = `Generar casos de prueba para los siguientes escenarios:\n${listaLote.value.trim()}`;
    }

    // Resetear vistas
    document.getElementById('aiLoadingContainer').style.display = 'none';
    document.getElementById('aiPreviewContainer').style.display = 'none';
    document.getElementById('aiInitialActions').style.display = 'flex';
    document.getElementById('aiResultActions').style.display = 'none';

    const statusEl = document.getElementById('aiKeyStatus');
    if (statusEl) {
        statusEl.className = 'ai-key-status';
        statusEl.textContent = '';
        if (savedKey) {
            statusEl.className = 'ai-key-status success';
            statusEl.textContent = 'Clave guardada localmente.';

            // Sincronizar catálogo de modelos disponibles en segundo plano
            const validateFn = typeof validateGroqApiKey === 'function'
                ? validateGroqApiKey
                : window.GroqService?.validateGroqApiKey;
            if (validateFn) {
                validateFn(savedKey).then(info => {
                    if (info?.models) actualizarModelosSelect(info.models);
                }).catch(() => {});
            }
        }
    }

    modal.classList.add('active');
}

function cerrarModalIA() {
    const modal = document.getElementById('aiModal');
    if (modal) modal.classList.remove('active');
}

function toggleVisibilidadApiKey() {
    const input = document.getElementById('aiApiKey');
    const btn = document.getElementById('aiToggleKeyBtn');
    if (!input || !btn) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🔒';
    } else {
        input.type = 'password';
        btn.textContent = '👁';
    }
}

async function probarClaveIA() {
    const key = (document.getElementById('aiApiKey')?.value || '').trim();
    const statusEl = document.getElementById('aiKeyStatus');
    const testBtn = document.getElementById('aiTestKeyBtn');

    if (!key) {
        statusEl.className = 'ai-key-status error';
        statusEl.textContent = 'Ingresa una clave para validar.';
        return;
    }

    testBtn.disabled = true;
    testBtn.textContent = 'Validando...';
    statusEl.className = 'ai-key-status';
    statusEl.textContent = 'Conectando con Groq...';

    try {
        const validateFn = typeof validateGroqApiKey === 'function'
            ? validateGroqApiKey
            : window.GroqService?.validateGroqApiKey;

        if (!validateFn) throw new Error('Servicio Groq no cargado.');

        const info = await validateFn(key);
        localStorage.setItem('groq_api_key', key);
        statusEl.className = 'ai-key-status success';
        statusEl.textContent = `✓ Conexión exitosa con Groq Cloud (${info.modelCount} modelos disponibles).`;

        if (Array.isArray(info.models) && info.models.length > 0) {
            actualizarModelosSelect(info.models);
        }
    } catch (err) {
        statusEl.className = 'ai-key-status error';
        statusEl.textContent = `✗ ${err.message}`;
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = 'Validar';
    }
}

async function ejecutarGeneracionIA() {
    const apiKey = (document.getElementById('aiApiKey')?.value || '').trim();
    let model = document.getElementById('aiModelSelect')?.value || 'openai/gpt-oss-120b';
    if (DECOMMISSIONED_MODELS.includes(model)) {
        model = 'openai/gpt-oss-120b';
    }
    const focus = document.getElementById('aiFocusSelect')?.value || 'balanced';
    const count = parseInt(document.getElementById('aiCountSelect')?.value || '5', 10);
    const userStory = (document.getElementById('aiPromptText')?.value || '').trim();
    const ticket = (document.getElementById('globalTicket')?.value || '').trim();

    if (!apiKey) {
        return await alertUI('Ingresa tu clave gratuita de API de Groq para continuar. Puedes obtener una en console.groq.com.');
    }
    if (!userStory) {
        return await alertUI('Por favor ingresa la descripción o historia de usuario del requerimiento.');
    }

    // Guardar preferencias en localStorage
    localStorage.setItem('groq_api_key', apiKey);
    localStorage.setItem('groq_model', model);
    localStorage.setItem('groq_focus', focus);

    const generateBtn = document.getElementById('aiGenerateBtn');
    const loadingContainer = document.getElementById('aiLoadingContainer');
    const loadingText = document.getElementById('aiLoadingText');
    const previewContainer = document.getElementById('aiPreviewContainer');
    const previewList = document.getElementById('aiPreviewList');
    const previewSubtitle = document.getElementById('aiPreviewSubtitle');
    const initialActions = document.getElementById('aiInitialActions');
    const resultActions = document.getElementById('aiResultActions');

    generateBtn.disabled = true;
    loadingContainer.style.display = 'flex';
    previewContainer.style.display = 'none';

    let nombreModelo = model;
    if (model.includes('gpt-oss-120b')) nombreModelo = 'OpenAI GPT-OSS 120B';
    else if (model.includes('gpt-oss-20b')) nombreModelo = 'OpenAI GPT-OSS 20B';
    else if (model.includes('qwen')) nombreModelo = 'Qwen 3.8 27B';
    else if (model.includes('allam')) nombreModelo = 'ALLAM 27B';

    loadingText.textContent = `Analizando requerimiento y diseñando casos con ${nombreModelo} en Groq...`;

    try {
        const generateFn = typeof generateTestCasesWithGroq === 'function'
            ? generateTestCasesWithGroq
            : window.GroqService?.generateTestCasesWithGroq;

        if (!generateFn) {
            throw new Error('El módulo groq-service.js no se encuentra disponible.');
        }

        const resultado = await generateFn({
            apiKey,
            model,
            userStory,
            count,
            focus,
            ticket
        });

        casosGeneradosIA = resultado.casos;

        // Renderizar previsualización
        previewList.innerHTML = '';
        casosGeneradosIA.forEach((caso, idx) => {
            const item = document.createElement('div');
            item.className = 'ai-preview-item';

            const titleRow = document.createElement('div');
            titleRow.className = 'ai-preview-item-title';

            const titleSpan = document.createElement('span');
            titleSpan.textContent = `${idx + 1}. ${caso.titulo}`;

            const badge = document.createElement('span');
            badge.className = 'ai-preview-item-steps-badge';
            badge.textContent = `${caso.pasos.length} ${caso.pasos.length === 1 ? 'paso' : 'pasos'}`;

            titleRow.append(titleSpan, badge);
            item.append(titleRow);

            if (caso.precondiciones) {
                const desc = document.createElement('div');
                desc.className = 'ai-preview-item-desc';
                desc.textContent = `Precondiciones: ${caso.precondiciones.slice(0, 120)}${caso.precondiciones.length > 120 ? '...' : ''}`;
                item.append(desc);
            }

            previewList.append(item);
        });

        previewSubtitle.textContent = `${casosGeneradosIA.length} casos listos (${resultado.totalPasos} pasos) generados con ${nombreModelo}`;
        previewContainer.style.display = 'block';
        initialActions.style.display = 'none';
        resultActions.style.display = 'flex';
    } catch (err) {
        console.error('Error generando casos con IA:', err);
        await alertUI(`Error al generar casos con Groq: ${err.message}`);
    } finally {
        generateBtn.disabled = false;
        loadingContainer.style.display = 'none';
    }
}

function reintentarGeneracionIA() {
    casosGeneradosIA = [];
    document.getElementById('aiPreviewContainer').style.display = 'none';
    document.getElementById('aiResultActions').style.display = 'none';
    document.getElementById('aiInitialActions').style.display = 'flex';
}

function aplicarCasosIA(modo) {
    if (!casosGeneradosIA || casosGeneradosIA.length === 0) return;

    if (modo === 'replace') {
        casosGlobales = casosGeneradosIA;
    } else {
        casosGlobales = [...casosGlobales, ...casosGeneradosIA];
    }

    guardarLocal(true);
    renderizarCasos();
    cerrarModalIA();
    mostrarToast(`${casosGeneradosIA.length} casos generados con IA incorporados.`);
    casosGeneradosIA = [];
}