/**
 * CSV Importer para QA Suite Xray
 * Parsea y reconstruye casos de prueba con sus pasos de ejecución a partir de archivos CSV para Jira Xray.
 */

function parseCsvRows(text) {
    if (!text || typeof text !== 'string') return [];
    const clean = text.replace(/^\uFEFF/, '');
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let insideQuotes = false;
    let i = 0;
    const len = clean.length;

    while (i < len) {
        const char = clean[i];

        if (insideQuotes) {
            if (char === '"') {
                if (i + 1 < len && clean[i + 1] === '"') {
                    currentField += '"';
                    i += 2;
                    continue;
                } else {
                    insideQuotes = false;
                    i++;
                    continue;
                }
            } else {
                currentField += char;
                i++;
                continue;
            }
        } else {
            if (char === '"') {
                insideQuotes = true;
                i++;
                continue;
            } else if (char === ',') {
                currentRow.push(currentField);
                currentField = '';
                i++;
                continue;
            } else if (char === '\r') {
                if (i + 1 < len && clean[i + 1] === '\n') {
                    i++;
                }
                currentRow.push(currentField);
                currentField = '';
                rows.push(currentRow);
                currentRow = [];
                i++;
                continue;
            } else if (char === '\n') {
                currentRow.push(currentField);
                currentField = '';
                rows.push(currentRow);
                currentRow = [];
                i++;
                continue;
            } else {
                currentField += char;
                i++;
                continue;
            }
        }
    }

    if (currentField !== '' || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }

    return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

function normalizeHeader(val) {
    return String(val || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function extractPreconditions(descripcion, titulo) {
    if (!descripcion || typeof descripcion !== 'string') return '';
    const desc = descripcion.trim();
    if (!desc) return '';

    const match = desc.match(/(?:^|\n+)precondiciones:\s*([\s\S]*)$/i);
    if (match && match[1] !== undefined) {
        return match[1].trim();
    }

    if (titulo && desc.startsWith(titulo)) {
        const resto = desc.slice(titulo.length).trim();
        if (resto) return resto;
    }

    return '';
}

function parseXrayCsv(csvText) {
    const rawRows = parseCsvRows(csvText);
    if (rawRows.length === 0) {
        return { casos: [], ticket: '', tags: '', totalPasos: 0 };
    }

    const headerRow = rawRows[0];
    const headerMap = {};
    headerRow.forEach((col, idx) => {
        const norm = normalizeHeader(col);
        headerMap[norm] = idx;
    });

    const findIndex = (aliases) => {
        for (const alias of aliases) {
            const normAlias = normalizeHeader(alias);
            if (headerMap[normAlias] !== undefined) return headerMap[normAlias];
            for (const key in headerMap) {
                if (key.includes(normAlias) || normAlias.includes(key)) {
                    return headerMap[key];
                }
            }
        }
        return -1;
    };

    const idxTcid = findIndex(['tcid', 'id de tarea', 'test id', 'id']);
    const idxResumen = findIndex(['resumen', 'summary', 'titulo', 'nombre']);
    const idxDescripcion = findIndex(['descripcion', 'description']);
    const idxAccion = findIndex(['accion', 'action', 'paso']);
    const idxResultado = findIndex(['resultado esperado', 'expected result', 'resultado']);
    const idxEtiquetas = findIndex(['etiquetas', 'labels', 'tags']);
    const idxHU = findIndex(['hu relacionada', 'hu', 'ticket', 'issue key', 'enlace tests']);

    const dataRows = rawRows.slice(1);
    const grupos = new Map();
    let detectedTicket = '';
    let detectedTags = '';

    dataRows.forEach((row, rowIndex) => {
        const tcidRaw = idxTcid >= 0 ? (row[idxTcid] || '').trim() : '';
        const resumenRaw = idxResumen >= 0 ? (row[idxResumen] || '').trim() : '';
        const descRaw = idxDescripcion >= 0 ? (row[idxDescripcion] || '').trim() : '';
        const accionRaw = idxAccion >= 0 ? (row[idxAccion] || '').trim() : '';
        const resultadoRaw = idxResultado >= 0 ? (row[idxResultado] || '').trim() : '';
        const etiquetasRaw = idxEtiquetas >= 0 ? (row[idxEtiquetas] || '').trim() : '';
        const huRaw = idxHU >= 0 ? (row[idxHU] || '').trim() : '';

        if (!detectedTicket && huRaw) detectedTicket = huRaw;
        if (!detectedTags && etiquetasRaw) detectedTags = etiquetasRaw;

        const clave = tcidRaw || resumenRaw || `CASO-${rowIndex + 1}`;

        if (!grupos.has(clave)) {
            const titulo = resumenRaw || (descRaw ? descRaw.split('\n')[0].trim() : `Caso ${grupos.size + 1}`);
            const precondiciones = extractPreconditions(descRaw, titulo);

            grupos.set(clave, {
                tcid: tcidRaw,
                titulo: titulo || `Caso ${grupos.size + 1}`,
                precondiciones: precondiciones,
                status: 'pending',
                selected: false,
                pasos: []
            });
        }

        const caso = grupos.get(clave);

        if (accionRaw || resultadoRaw) {
            caso.pasos.push({
                accion: accionRaw,
                resultado_esperado: resultadoRaw
            });
        }
    });

    const casos = [];
    let totalPasos = 0;

    for (const [, caso] of grupos) {
        if (caso.pasos.length === 0) {
            caso.pasos.push({
                accion: "Ingresar al sistema.",
                resultado_esperado: "Sistema responde correctamente."
            });
        }
        totalPasos += caso.pasos.length;
        casos.push({
            titulo: caso.titulo,
            precondiciones: caso.precondiciones,
            status: caso.status,
            selected: false,
            pasos: caso.pasos
        });
    }

    return {
        casos,
        ticket: detectedTicket,
        tags: detectedTags,
        totalPasos
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseCsvRows,
        normalizeHeader,
        extractPreconditions,
        parseXrayCsv
    };
}

if (typeof window !== 'undefined') {
    window.csvImporter = {
        parseCsvRows,
        normalizeHeader,
        extractPreconditions,
        parseXrayCsv
    };
}
