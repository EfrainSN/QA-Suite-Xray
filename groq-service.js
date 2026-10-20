/**
 * Servicio de integración con Groq Cloud API
 * Permite generar casos de prueba para Jira Xray mediante modelos de alta velocidad (Llama 3.3, DeepSeek R1, Qwen).
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';

const GROQ_MODELS = [
    {
        id: 'openai/gpt-oss-120b',
        nombre: 'OpenAI GPT-OSS 120B (Recomendado - Máxima capacidad)',
        descripcion: 'Alta capacidad de razonamiento lógico, estructuración precisa y diseño detallado de casos QA.',
        esPredeterminado: true
    },
    {
        id: 'qwen/qwen3.8-27b',
        nombre: 'Qwen 3.8 27B (Lógica y Criterios de Aceptación)',
        descripcion: 'Excelente modelo para análisis de historias de usuario y validación de reglas de negocio.',
        esPredeterminado: false
    },
    {
        id: 'openai/gpt-oss-20b',
        nombre: 'OpenAI GPT-OSS 20B (Ultra rápido)',
        descripcion: 'Generación instantánea de pruebas y alta disponibilidad.',
        esPredeterminado: false
    }
];

/**
 * Limpia posibles etiquetas de pensamiento (<think>...</think>) que DeepSeek R1
 * o modelos de razonamiento pueden incluir antes del JSON.
 */
function cleanModelJsonOutput(rawContent) {
    if (!rawContent || typeof rawContent !== 'string') {
        throw new Error('La respuesta del modelo está vacía o no es texto.');
    }

    let cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // Si viene envuelto en bloque markdown ```json ... ```
    const matchJsonBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (matchJsonBlock) {
        cleaned = matchJsonBlock[1].trim();
    }

    return cleaned;
}

/**
 * Valida la API Key consultando la lista de modelos activos en Groq
 * y devuelve los modelos de texto disponibles para la cuenta.
 */
async function validateGroqApiKey(apiKey, fetchImpl = fetch) {
    const key = (apiKey || '').trim();
    if (!key) {
        throw new Error('Debes ingresar una clave de API de Groq.');
    }

    const response = await fetchImpl(GROQ_MODELS_URL, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Clave de API inválida. Verifica tu clave en console.groq.com.');
        }
        throw new Error(`Error al validar clave con Groq (código ${response.status}).`);
    }

    const data = await response.json();
    const rawList = Array.isArray(data?.data) ? data.data : [];

    // Filtrar solo modelos útiles para chat/pruebas (excluir audio whisper/orpheus/canopylabs y guardrail)
    const activeTextModels = rawList
        .filter(m => {
            const id = (m?.id || '').toLowerCase();
            return !id.includes('whisper') &&
                   !id.includes('orpheus') &&
                   !id.includes('canopylabs') &&
                   !id.includes('guard') &&
                   !id.includes('safeguard') &&
                   !id.includes('embedding') &&
                   m?.active !== false;
        })
        .map(m => m.id);

    return {
        ok: true,
        models: activeTextModels,
        modelCount: activeTextModels.length
    };
}

/**
 * Genera casos de prueba utilizando Groq Cloud en formato JSON estricto.
 */
async function generateTestCasesWithGroq({
    apiKey,
    model = 'openai/gpt-oss-120b',
    userStory,
    count = 5,
    focus = 'balanced',
    ticket = '',
    fetchImpl = fetch
}) {
    const key = (apiKey || '').trim();
    if (!key) {
        throw new Error('Ingresa tu clave de API de Groq para continuar.');
    }

    // Modelos no disponibles o descontinuados
    const invalidOrDecommissioned = [
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
    let modeloFinal = (model || '').trim() || 'openai/gpt-oss-120b';
    if (invalidOrDecommissioned.includes(modeloFinal) || !modeloFinal) {
        modeloFinal = 'openai/gpt-oss-120b';
    }

    const promptUsuario = (userStory || '').trim();
    if (!promptUsuario) {
        throw new Error('Debes ingresar la descripción o criterios de aceptación del requerimiento.');
    }

    const cantidadCasos = Math.max(1, Math.min(Number(count) || 5, 15));

    let instruccionesEnfoque = 'Genera un balance equilibrado entre flujos felices (happy path), casos negativos (validaciones/errores) y casos de borde.';
    if (focus === 'positive') {
        instruccionesEnfoque = 'Enfócate exclusivamente en flujos felices (happy path), casos positivos y escenarios de éxito del usuario.';
    } else if (focus === 'negative') {
        instruccionesEnfoque = 'Enfócate principalmente en casos negativos: errores de usuario, datos inválidos, campos obligatorios, caídas de servicio y excepciones.';
    } else if (focus === 'security_boundary') {
        instruccionesEnfoque = 'Enfócate en pruebas de límites (boundary values), valores máximos/mínimos, caracteres especiales, inyección y permisos de acceso.';
    }

    const systemPrompt = `Eres un Ingeniero Senior de QA Automation y Testing Manual experto en Jira Xray.
Tu tarea es analizar el requerimiento o Historia de Usuario proporcionada y diseñar exactamente ${cantidadCasos} casos de prueba manuales, profesionales y exhaustivos.

Criterios de diseño:
1. ${instruccionesEnfoque}
2. Cada caso de prueba debe tener:
   - "titulo": Breve, descriptivo y directo (ej. "Validar inicio de sesión con credenciales correctas").
   - "precondiciones": Requisitos previos necesarios para ejecutar el caso (ej. "1. Usuario registrado y activo. 2. Navegador en pantalla de login.").
   - "pasos": Arreglo de pasos ordenados y secuenciales. Cada paso debe contener:
     - "accion": Descripción clara de la acción que realiza el tester (ej. "Ingresar correo válido en el campo email y pulsar Continuar.").
     - "resultado_esperado": Qué debe observar o verificar el tester exactamente (ej. "El sistema habilita el campo de contraseña sin errores.").
3. Evita pasos ambiguos como "Hacer pruebas". Cada paso debe ser verificable.

REGLA OBLIGATORIA DE FORMATO:
Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura:
{
  "casos": [
    {
      "titulo": "string",
      "precondiciones": "string",
      "pasos": [
        {
          "accion": "string",
          "resultado_esperado": "string"
        }
      ]
    }
  ]
}`;

    const userMessage = ticket.trim()
        ? `Ticket Jira / Historia: ${ticket.trim()}\n\nRequerimiento:\n${promptUsuario}`
        : `Requerimiento:\n${promptUsuario}`;

    const requestBody = {
        model: modeloFinal,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 4096
    };

    let response;
    try {
        response = await fetchImpl(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(60000)
        });
    } catch (err) {
        if (err.name === 'TimeoutError') {
            throw new Error('La solicitud a Groq tardó demasiado tiempo (timeout de 60s). Intenta con menos casos o vuelve a intentarlo.');
        }
        throw new Error(`Error de conexión con Groq: ${err.message}`);
    }

    if (!response.ok) {
        let detalle = '';
        try {
            const errJson = await response.json();
            detalle = errJson?.error?.message || '';
        } catch {
            // noop
        }

        if (response.status === 401) {
            throw new Error('Clave de API de Groq no autorizada (401). Verifica tu clave en console.groq.com.');
        }
        if (response.status === 429) {
            throw new Error('Se superó el límite de uso gratuito temporal de Groq (Rate Limit 429). Espera unos segundos y vuelve a pulsar Generar.');
        }

        throw new Error(`Error en Groq (${response.status}): ${detalle || response.statusText}`);
    }

    let rawData;
    try {
        rawData = await response.json();
    } catch {
        throw new Error('No se pudo interpretar la respuesta JSON enviada por Groq.');
    }

    const rawContent = rawData?.choices?.[0]?.message?.content;
    const cleanedJson = cleanModelJsonOutput(rawContent);

    let parsed;
    try {
        parsed = JSON.parse(cleanedJson);
    } catch (err) {
        throw new Error(`El modelo devolvió un JSON con formato inválido: ${err.message}`);
    }

    const casosCrudos = Array.isArray(parsed?.casos) ? parsed.casos : [];
    if (casosCrudos.length === 0) {
        throw new Error('El modelo no devolvió ningún caso de prueba en el arreglo "casos".');
    }

    // Normalizar la estructura exacta requerida por la suite QA
    let totalPasos = 0;
    const casos = casosCrudos.map((rawCaso, index) => {
        const titulo = typeof rawCaso.titulo === 'string' && rawCaso.titulo.trim()
            ? rawCaso.titulo.trim()
            : `Caso de Prueba ${index + 1}`;
        const precondiciones = typeof rawCaso.precondiciones === 'string'
            ? rawCaso.precondiciones.trim()
            : '';

        const pasosRaw = Array.isArray(rawCaso.pasos) ? rawCaso.pasos : [];
        const pasos = pasosRaw.map(p => {
            const accion = typeof p.accion === 'string' ? p.accion.trim() : '';
            const resultado = typeof p.resultado_esperado === 'string'
                ? p.resultado_esperado.trim()
                : (typeof p.resultado === 'string' ? p.resultado.trim() : '');
            return {
                accion: accion || 'Ejecutar acción correspondiente.',
                resultado_esperado: resultado || 'El sistema responde adecuadamente.'
            };
        });

        // Asegurar al menos 1 paso
        if (pasos.length === 0) {
            pasos.push({
                accion: 'Ejecutar la validación del caso según requerimiento.',
                resultado_esperado: 'El sistema cumple con el criterio de aceptación esperado.'
            });
        }

        totalPasos += pasos.length;

        return {
            titulo,
            precondiciones,
            status: 'pending',
            selected: false,
            pasos
        };
    });

    return {
        casos,
        totalPasos,
        modeloUsado: modeloFinal
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GROQ_API_URL,
        GROQ_MODELS_URL,
        GROQ_MODELS,
        cleanModelJsonOutput,
        validateGroqApiKey,
        generateTestCasesWithGroq
    };
}
