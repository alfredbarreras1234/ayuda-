const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;
const requestCounts = new Map();

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10kb'
    }
  }
};

function sendJson(response, status, payload) {
  response.status(status).json(payload);
}

function validateWebhookUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const validHost = url.hostname === 'discord.com' || url.hostname === 'discordapp.com';
    const validPath = /^\/api\/webhooks\/\d+\/[^/]+$/.test(url.pathname);
    return url.protocol === 'https:' && validHost && validPath ? url : null;
  } catch {
    return null;
  }
}

function allowedByRateLimit(ip) {
  const now = Date.now();
  const current = requestCounts.get(ip);
  if (!current || now - current.startedAt > RATE_WINDOW_MS) {
    requestCounts.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= RATE_LIMIT) return false;
  current.count += 1;
  return true;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Método no permitido.' });
    return;
  }

  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    sendJson(response, 415, { error: 'El formulario debe enviarse como JSON.' });
    return;
  }

  const ip = request.headers['x-real-ip'] || request.socket?.remoteAddress || 'unknown';
  if (!allowedByRateLimit(ip)) {
    sendJson(response, 429, { error: 'Has enviado varios pedidos. Espera unos minutos.' });
    return;
  }

  let data = request.body;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      sendJson(response, 400, { error: 'No se pudo leer el formulario.' });
      return;
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    sendJson(response, 400, { error: 'No se pudo leer el formulario.' });
    return;
  }

  if (typeof data.sitioWeb === 'string' && data.sitioWeb.trim()) {
    sendJson(response, 200, { ok: true });
    return;
  }

  const nombre = typeof data.nombre === 'string' ? data.nombre.trim() : '';
  const correo = typeof data.correo === 'string' ? data.correo.trim() : '';
  const peticion = typeof data.peticion === 'string' ? data.peticion.trim() : '';
  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
  if (!nombre || nombre.length > 100 || !correoValido || correo.length > 160
      || !peticion || peticion.length > 1500) {
    sendJson(response, 400, { error: 'Revisa el nombre, correo y pedido antes de enviar.' });
    return;
  }

  const webhookUrl = validateWebhookUrl(process.env.DISCORD_WEBHOOK_URL);
  if (!webhookUrl) {
    sendJson(response, 503, { error: 'El servicio de pedidos todavía no está configurado.' });
    return;
  }

  const discordMessage = {
    username: 'Pedidos SAZÓN ARTESANA',
    allowed_mentions: { parse: [] },
    embeds: [{
      title: 'Nuevo pedido desde la página',
      color: 0x7A2E1D,
      fields: [
        { name: 'Nombre', value: nombre, inline: true },
        { name: 'Correo', value: correo, inline: true }
      ],
      description: `**Pedido**\n${peticion}`,
      timestamp: new Date().toISOString()
    }]
  };

  try {
    const discordResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordMessage),
      signal: AbortSignal.timeout(8000)
    });
    if (!discordResponse.ok) throw new Error('Discord rejected the webhook request');
    sendJson(response, 200, { ok: true });
  } catch {
    sendJson(response, 502, { error: 'Discord no recibió el pedido. Inténtalo de nuevo más tarde.' });
  }
}
