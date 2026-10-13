const test = require('node:test');
const assert = require('node:assert/strict');
const {
    parseCsvRows,
    extractPreconditions,
    parseXrayCsv
} = require('../csv-importer');

test('parseCsvRows handles basic values, quotes, commas and newlines', () => {
    const csv = `"TCID","Resumen","Acción"\n"CP-001","Caso con, comas","Acción 1"\n"CP-002","Caso con\nsalto de línea","Acción ""entrecomillada"""`;
    const rows = parseCsvRows(csv);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0], ['TCID', 'Resumen', 'Acción']);
    assert.deepEqual(rows[1], ['CP-001', 'Caso con, comas', 'Acción 1']);
    assert.deepEqual(rows[2], ['CP-002', 'Caso con\nsalto de línea', 'Acción "entrecomillada"']);
});

test('parseCsvRows strips UTF-8 BOM correctly', () => {
    const csv = `\uFEFF"TCID","Resumen"\n"CP-001","Test"`;
    const rows = parseCsvRows(csv);
    assert.equal(rows[0][0], 'TCID');
});

test('extractPreconditions extracts text following Precondiciones: prefix', () => {
    const descConPre = `Título del caso\n\nPrecondiciones:\nUsuario con rol cajero en terminal 01`;
    assert.equal(extractPreconditions(descConPre, 'Título del caso'), 'Usuario con rol cajero en terminal 01');

    const descSimple = `Título del caso`;
    assert.equal(extractPreconditions(descSimple, 'Título del caso'), '');

    const descVacia = '';
    assert.equal(extractPreconditions(descVacia, 'Título'), '');
});

test('parseXrayCsv reconstructs multi-step test cases grouped by TCID', () => {
    const csvContent = `"TCID","Resumen","Descripción","Tipo de Test","Acción","Datos de Prueba","Resultado Esperado","Componentes","Etiquetas","HU Relacionada"
"CP-001","Login y apertura","Login y apertura\n\nPrecondiciones:\nCaja cerrada","Manual","Abrir turno","","Turno abierto","SV-FEL","OMP-18704, Regresion","OMP-18704"
"CP-001","Login y apertura","Login y apertura\n\nPrecondiciones:\nCaja cerrada","Manual","Ingresar clave","","Dashboard visible","SV-FEL","OMP-18704, Regresion","OMP-18704"
"CP-002","Venta contado","Venta contado","Manual","Escanear producto","","Producto en pantalla","SV-FEL","OMP-18704, Regresion","OMP-18704"`;

    const result = parseXrayCsv(csvContent);

    assert.equal(result.casos.length, 2);
    assert.equal(result.totalPasos, 3);
    assert.equal(result.ticket, 'OMP-18704');
    assert.equal(result.tags, 'OMP-18704, Regresion');

    // Caso 1
    const caso1 = result.casos[0];
    assert.equal(caso1.titulo, 'Login y apertura');
    assert.equal(caso1.precondiciones, 'Caja cerrada');
    assert.equal(caso1.pasos.length, 2);
    assert.equal(caso1.pasos[0].accion, 'Abrir turno');
    assert.equal(caso1.pasos[0].resultado_esperado, 'Turno abierto');
    assert.equal(caso1.pasos[1].accion, 'Ingresar clave');
    assert.equal(caso1.pasos[1].resultado_esperado, 'Dashboard visible');

    // Caso 2
    const caso2 = result.casos[1];
    assert.equal(caso2.titulo, 'Venta contado');
    assert.equal(caso2.precondiciones, '');
    assert.equal(caso2.pasos.length, 1);
    assert.equal(caso2.pasos[0].accion, 'Escanear producto');
    assert.equal(caso2.pasos[0].resultado_esperado, 'Producto en pantalla');
});

test('parseXrayCsv handles empty or invalid inputs gracefully', () => {
    assert.deepEqual(parseXrayCsv(''), { casos: [], ticket: '', tags: '', totalPasos: 0 });
    assert.deepEqual(parseXrayCsv('"TCID","Resumen"'), { casos: [], ticket: '', tags: '', totalPasos: 0 });
});
