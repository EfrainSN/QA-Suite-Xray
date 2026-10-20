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

// Librería de Snippets predefinidos
const SNIPPETS = {
    login: [
        { accion: "Ingresar credenciales válidas en la pantalla de inicio de sesión.", resultado_esperado: "El sistema autentica al usuario y muestra la pantalla principal." },
        { accion: "Seleccionar la opción de apertura de turno o sesión de trabajo.", resultado_esperado: "La sesión se inicia exitosamente permitiendo operar en el sistema." }
    ],
    pago_tarjeta: [
        { accion: "Seleccionar método de pago: Tarjeta de Crédito.", resultado_esperado: "El sistema habilita la interfaz de pago con tarjeta." },
        { accion: "Ingresar datos del medio de pago y confirmar monto.", resultado_esperado: "Transacción aprobada, se genera el comprobante y se registra la operación." }
    ],
    validacion_mh: [
        { accion: "Validar que la transacción correspondiente se procese y registre con éxito.", resultado_esperado: "La transacción queda registrada exitosamente en el sistema." },
        { accion: "Verificar que la información de respuesta contenga los datos y estructura correctos.", resultado_esperado: "El sistema valida y procesa los datos correctamente." }
    ]
};

// --- INICIALIZACIÓN ---
window.onload = () => {
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
async function inyectarSnippet(snippetKey) {
    const indices = casosGlobales.reduce((acc, c, idx) => c.selected ? [...acc, idx] : acc, []);
    if (indices.length === 0) return await alertUI("Selecciona al menos un caso marcando su casilla para inyectar este snippet.");
    
    const snippetPasos = SNIPPETS[snippetKey];
    
    indices.forEach(idx => {
        casosGlobales[idx].pasos = [...casosGlobales[idx].pasos, ...JSON.parse(JSON.stringify(snippetPasos))];
    });
    
    guardarLocal();
    renderizarCasos();
    mostrarToast(`Snippet inyectado en ${indices.length} casos seleccionados.`);
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