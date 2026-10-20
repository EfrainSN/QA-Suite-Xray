const test = require('node:test');
const assert = require('node:assert/strict');
const {
    cleanModelJsonOutput,
    validateGroqApiKey,
    generateTestCasesWithGroq,
    GROQ_MODELS
} = require('../groq-service');

test('GROQ_MODELS contains default models', () => {
    assert.ok(Array.isArray(GROQ_MODELS));
    assert.ok(GROQ_MODELS.some(m => m.id === 'openai/gpt-oss-120b'));
    assert.ok(GROQ_MODELS.some(m => m.id === 'qwen/qwen3.8-27b'));
});

test('cleanModelJsonOutput strips thinking tags and markdown code blocks', () => {
    const rawWithThink = '<think>Analizando el requerimiento...</think>{"casos":[]}';
    assert.equal(cleanModelJsonOutput(rawWithThink), '{"casos":[]}');

    const rawWithMarkdown = '```json\n{"casos":[{"titulo":"Prueba"}]}\n```';
    assert.equal(cleanModelJsonOutput(rawWithMarkdown), '{"casos":[{"titulo":"Prueba"}]}');

    const mixed = '<think>Pensando...</think>\n```json\n{"casos":[]}\n```';
    assert.equal(cleanModelJsonOutput(mixed), '{"casos":[]}');
});

test('validateGroqApiKey validates successfully with mock fetch', async () => {
    const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
            data: [
                { id: 'openai/gpt-oss-120b', active: true },
                { id: 'whisper-large-v3', active: true } // should be filtered out
            ]
        })
    });

    const result = await validateGroqApiKey('gsk_test_key', mockFetch);
    assert.equal(result.ok, true);
    assert.equal(result.modelCount, 1);
    assert.deepEqual(result.models, ['openai/gpt-oss-120b']);
});

test('validateGroqApiKey handles 401 error', async () => {
    const mockFetch = async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
    });

    await assert.rejects(
        () => validateGroqApiKey('invalid_key', mockFetch),
        /Clave de API inválida/
    );
});

test('generateTestCasesWithGroq generates and normalizes test cases', async () => {
    const mockResponsePayload = {
        choices: [
            {
                message: {
                    content: JSON.stringify({
                        casos: [
                            {
                                titulo: 'Validar login exitoso',
                                precondiciones: 'Usuario registrado',
                                pasos: [
                                    {
                                        accion: 'Ingresar usuario y clave',
                                        resultado_esperado: 'Acceso concedido al dashboard'
                                    }
                                ]
                            },
                            {
                                titulo: 'Validar login con contraseña errónea',
                                precondiciones: '',
                                pasos: [
                                    {
                                        accion: 'Ingresar contraseña incorrecta',
                                        resultado: 'Mensaje de error visible'
                                    }
                                ]
                            }
                        ]
                    })
                }
            }
        ]
    };

    const mockFetch = async (url, options) => {
        assert.ok(options.headers.Authorization.includes('gsk_valid_key'));
        const body = JSON.parse(options.body);
        assert.equal(body.response_format.type, 'json_object');
        return {
            ok: true,
            status: 200,
            json: async () => mockResponsePayload
        };
    };

    const result = await generateTestCasesWithGroq({
        apiKey: 'gsk_valid_key',
        userStory: 'Historia de usuario de login',
        count: 2,
        fetchImpl: mockFetch
    });

    assert.equal(result.casos.length, 2);
    assert.equal(result.totalPasos, 2);
    assert.equal(result.casos[0].titulo, 'Validar login exitoso');
    assert.equal(result.casos[0].status, 'pending');
    assert.equal(result.casos[0].selected, false);
    assert.equal(result.casos[0].pasos[0].resultado_esperado, 'Acceso concedido al dashboard');
    // Verifica que resultado alternativo "resultado" se normalizó a "resultado_esperado"
    assert.equal(result.casos[1].pasos[0].resultado_esperado, 'Mensaje de error visible');
});

test('generateTestCasesWithGroq handles 429 rate limit error', async () => {
    const mockFetch = async () => ({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: { message: 'Rate limit reached' } })
    });

    await assert.rejects(
        () => generateTestCasesWithGroq({
            apiKey: 'gsk_test',
            userStory: 'Historia',
            fetchImpl: mockFetch
        }),
        /Rate Limit 429/
    );
});

test('generateTestCasesWithGroq automatically falls back from decommissioned models', async () => {
    let capturedModel = '';
    const mockFetch = async (url, options) => {
        const body = JSON.parse(options.body);
        capturedModel = body.model;
        return {
            ok: true,
            status: 200,
            json: async () => ({
                choices: [{ message: { content: JSON.stringify({ casos: [{ titulo: 'Prueba' }] }) } }]
            })
        };
    };

    const res = await generateTestCasesWithGroq({
        apiKey: 'gsk_test',
        model: 'deepseek-r1-distill-llama-70b',
        userStory: 'Prueba',
        fetchImpl: mockFetch
    });

    assert.equal(capturedModel, 'openai/gpt-oss-120b');
    assert.equal(res.modeloUsado, 'openai/gpt-oss-120b');
});
