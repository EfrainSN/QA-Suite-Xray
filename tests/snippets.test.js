const test = require('node:test');
const assert = require('node:assert/strict');

// Modelado de funciones de gestión de snippets
function createSnippet(id, nombre, pasos) {
    if (!nombre || !nombre.trim()) {
        throw new Error('El nombre del snippet es obligatorio.');
    }
    const cleanPasos = (Array.isArray(pasos) ? pasos : []).filter(p => (p.accion && p.accion.trim()) || (p.resultado_esperado && p.resultado_esperado.trim()));
    if (cleanPasos.length === 0) {
        throw new Error('El snippet debe contener al menos un paso con acción o resultado esperado.');
    }
    return {
        id: id || 'snip_' + Date.now().toString(36),
        nombre: nombre.trim(),
        pasos: cleanPasos.map(p => ({
            accion: (p.accion || '').trim() || 'Acción de prueba.',
            resultado_esperado: (p.resultado_esperado || '').trim() || 'Resultado satisfactorio.'
        }))
    };
}

function updateSnippet(list, id, nuevoNombre, nuevosPasos) {
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Snippet no encontrado.');
    const updated = createSnippet(id, nuevoNombre, nuevosPasos);
    list[idx] = updated;
    return updated;
}

function deleteSnippet(list, id) {
    return list.filter(s => s.id !== id);
}

function injectSnippetIntoCases(cases, selectedIndices, snippet) {
    if (!Array.isArray(selectedIndices) || selectedIndices.length === 0) {
        throw new Error('Selecciona al menos un caso.');
    }
    selectedIndices.forEach(idx => {
        if (cases[idx]) {
            cases[idx].pasos = [...cases[idx].pasos, ...JSON.parse(JSON.stringify(snippet.pasos))];
        }
    });
}

test('createSnippet creates a valid snippet and normalizes steps', () => {
    const s = createSnippet('snip_1', '  Validación DTE Infile  ', [
        { accion: '  Consultar API Infile ', resultado_esperado: ' Respuesta 200 OK ' },
        { accion: '', resultado_esperado: '' } // should be filtered
    ]);

    assert.equal(s.id, 'snip_1');
    assert.equal(s.nombre, 'Validación DTE Infile');
    assert.equal(s.pasos.length, 1);
    assert.equal(s.pasos[0].accion, 'Consultar API Infile');
    assert.equal(s.pasos[0].resultado_esperado, 'Respuesta 200 OK');
});

test('createSnippet throws error on missing title or empty steps', () => {
    assert.throws(() => createSnippet('snip_1', '', [{ accion: 'Paso 1' }]), /El nombre del snippet es obligatorio/);
    assert.throws(() => createSnippet('snip_1', 'Snippet Vacio', []), /al menos un paso/);
});

test('updateSnippet modifies an existing snippet in the list', () => {
    let list = [
        createSnippet('snip_1', 'Original', [{ accion: 'Paso 1', resultado_esperado: 'Res 1' }])
    ];

    updateSnippet(list, 'snip_1', 'Modificado', [
        { accion: 'Paso A', resultado_esperado: 'Res A' },
        { accion: 'Paso B', resultado_esperado: 'Res B' }
    ]);

    assert.equal(list.length, 1);
    assert.equal(list[0].nombre, 'Modificado');
    assert.equal(list[0].pasos.length, 2);
});

test('deleteSnippet removes the snippet correctly', () => {
    let list = [
        { id: '1', nombre: 'Uno' },
        { id: '2', nombre: 'Dos' }
    ];

    list = deleteSnippet(list, '1');
    assert.equal(list.length, 1);
    assert.equal(list[0].id, '2');
});

test('injectSnippetIntoCases appends snippet steps to selected test cases', () => {
    const cases = [
        { titulo: 'Caso 1', pasos: [{ accion: 'Paso inicial', resultado_esperado: 'OK' }] },
        { titulo: 'Caso 2', pasos: [] }
    ];

    const snip = createSnippet('snip_login', 'Login', [
        { accion: 'Ingresar usuario', resultado_esperado: 'Login exitoso' }
    ]);

    injectSnippetIntoCases(cases, [0, 1], snip);

    assert.equal(cases[0].pasos.length, 2);
    assert.equal(cases[0].pasos[1].accion, 'Ingresar usuario');
    assert.equal(cases[1].pasos.length, 1);
    assert.equal(cases[1].pasos[0].accion, 'Ingresar usuario');
});
