# SAZÓN ARTESANA

Sitio web adaptable para mostrar el menú, filtrar platillos y enviar pedidos a un canal de Discord mediante un webhook protegido en el servidor.

## Estructura

- `index.html`: contenido y secciones de la página.
- `style.css`: estilos y ajustes para escritorio y celular.
- `js/main.js`: navegación, filtros, tema, botón superior, traducción y formulario.
- `api/contact.js`: función de Vercel para enviar los pedidos a Discord.
- `imagenes/`: fotografías locales usadas por la página.
- `server.mjs`: servidor web y ruta privada `POST /api/contact`.
- `.env`: configuración local del webhook; no se comparte ni se sube a Git.

## Requisitos

Instala Node.js 18 o posterior. El proyecto no requiere instalar paquetes.

## Configurar pedidos de Discord

1. Revoca y reemplaza el webhook que se compartió en el chat. Cualquiera que tenga esa URL puede publicar mensajes en el canal asociado.
2. Copia `.env.example` con el nombre `.env` en la raíz del proyecto.
3. Abre `.env` y pega únicamente el webhook nuevo después de `DISCORD_WEBHOOK_URL=`.
4. No publiques, compartas ni agregues `.env` a Git. `.gitignore` ya lo excluye.
5. Inicia el servidor con `npm start` y visita `http://localhost:3000`.
6. Envía un pedido de prueba desde la sección «Pedidos» y confirma que llegó al canal de Discord.

El webhook nunca está en el HTML ni en el navegador. El servidor valida los campos, limita el tamaño del mensaje y los envíos por IP, ignora menciones y responde con un estado visible en el formulario.

### Configurar Vercel

1. Revoca el webhook que se compartió y crea uno nuevo en Discord.
2. En el proyecto de Vercel, abre **Settings → Environment Variables**.
3. Añade `DISCORD_WEBHOOK_URL` con la URL del webhook nuevo y habilítala para los entornos que uses.
4. Guarda y vuelve a desplegar el proyecto para que la función reciba la variable.
5. Envía un pedido de prueba desde la sección «Pedidos» y confirma que llegó al canal.

Vercel detecta `api/contact.js` como la ruta `POST /api/contact`; no es necesario exponer el webhook ni configurar una URL distinta en el formulario.

## Cambiar contenido

- Para modificar platillos, precios y descripciones, edita las tarjetas de `index.html`.
- Para añadir o cambiar fotografías, guarda el archivo en `imagenes/` y actualiza el atributo `src` de la tarjeta correspondiente.
- Para cambiar colores, tipografías, espaciado o diseño adaptable, modifica las variables y reglas comentadas de `style.css`.
- Para editar filtros, tema, botón de volver arriba o envío, busca la sección comentada correspondiente en `js/main.js`.
- Para cambiar el límite de envíos o las reglas del formulario, edita las constantes y la ruta de contacto de `server.mjs`.

## Publicar

En Vercel, la función `api/contact.js` atiende el formulario. En otros proveedores, usa el servidor `server.mjs`. En ambos casos configura `DISCORD_WEBHOOK_URL` como variable de entorno privada en el panel del proveedor; el webhook no debe incluirse en archivos públicos.

Las dependencias de Bootstrap, Bootstrap Icons, Google Fonts, Google Translate y el mapa se cargan desde servicios externos; el resto de imágenes es local.
# ayuda-
