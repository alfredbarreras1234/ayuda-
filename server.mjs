import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = 10_000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;
const requestCounts = new Map();

// Carga .env para desarrollo local sin instalar paquetes adicionales.
async function loadLocalEnvironment() {
  try {
    const contents = await readFile(path.join(ROOT, '.env'), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || Object.hasOwn(process.env, match[1])) continue;
      process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
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

async function handleContact(request, response) {
  const ip = request.socket.remoteAddress || 'unknown';
  if (!allowedByRateLimit(ip)) {
    sendJson(response, 429, { error: 'Has enviado varios pedidos. Espera unos minutos.' });
    return;
  }

  let data;
  try {
    data = await readJson(request);
  } catch (error) {
    const status = error.message === 'BODY_TOO_LARGE' ? 413 : 400;
    sendJson(response, status, { error: 'No se pudo leer el formulario.' });
    return;
  }

  // Campo trampa para bots: no se envía nada si fue completado.
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
        { name: 'Correo', value: correo, inline: true },
        { name: 'Pedido', value: peticion }
      ],
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

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

async function serveStatic(request, response) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Ruta no válida.');
    return;
  }

  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const publicFiles = new Set(['/index.html', '/style.css', '/js/main.js']);
  const isPublicImage = requestedPath.startsWith('/imagenes/')
    && !requestedPath.split('/').some(segment => segment.startsWith('.'));
  if (!publicFiles.has(requestedPath) && !isPublicImage) {
    response.writeHead(404).end('No encontrado.');
    return;
  }

  const filePath = path.resolve(ROOT, `.${requestedPath}`);
  if (!filePath.startsWith(`${ROOT}${path.sep}`)) {
    response.writeHead(404).end('No encontrado.');
    return;
  }

  try {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404).end('No encontrado.');
      return;
    }
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff'
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end('No encontrado.');
  }
}

await loadLocalEnvironment();
const server = createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/api/contact') {
    void handleContact(request, response);
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD, POST' }).end('Método no permitido.');
    return;
  }
  void serveStatic(request, response);
});

server.listen(PORT, () => {
  console.log(`SAZÓN ARTESANA disponible en http://localhost:${PORT}`);
});
