document.addEventListener('DOMContentLoaded', () => {
  // Navegación suave para las secciones de la página.
  document.querySelectorAll('a[href^="#"]').forEach(enlace => {
    enlace.addEventListener('click', evento => {
      const selector = enlace.getAttribute('href');
      const destino = selector.length > 1 ? document.querySelector(selector) : null;
      if (destino) {
        evento.preventDefault();
        destino.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Actualiza el año del pie de página sin editar el HTML cada enero.
  document.querySelectorAll('#anioActual, [data-anio]').forEach(elemento => {
    elemento.textContent = new Date().getFullYear();
  });

  // Cambia los productos visibles según la categoría seleccionada.
  const botonesFiltro = document.querySelectorAll('.menu-filtro');
  const productos = document.querySelectorAll('.menu-item');
  botonesFiltro.forEach(boton => {
    boton.addEventListener('click', () => {
      botonesFiltro.forEach(otroBoton => {
        const seleccionado = otroBoton === boton;
        otroBoton.classList.toggle('active', seleccionado);
        otroBoton.classList.toggle('btn-sazon', seleccionado);
        otroBoton.classList.toggle('btn-outline-secondary', !seleccionado);
      });

      productos.forEach(producto => {
        const coincide = boton.dataset.filtro === 'todos'
          || producto.dataset.categoria === boton.dataset.filtro;
        producto.classList.toggle('d-none', !coincide);
      });
    });
  });

  // Completa el campo del pedido cuando se elige un producto del menú.
  document.querySelectorAll('[data-producto]').forEach(enlace => {
    enlace.addEventListener('click', () => {
      const campo = document.getElementById('mensajePeticion');
      if (campo) campo.value = `Me interesa pedir: ${enlace.dataset.producto}`;
    });
  });

  // Guarda la preferencia del tema solo en este navegador.
  const botonTema = document.getElementById('themeToggle');
  if (botonTema) {
    const iconoTema = botonTema.querySelector('i');
    const actualizarTema = modoOscuro => {
      document.body.classList.toggle('dark-mode', modoOscuro);
      if (iconoTema) iconoTema.className = modoOscuro
        ? 'bi bi-sun-fill'
        : 'bi bi-moon-stars-fill';
      botonTema.setAttribute('aria-label', modoOscuro ? 'Usar tema claro' : 'Usar tema oscuro');
    };

    try {
      actualizarTema(localStorage.getItem('sazon-tema') === 'oscuro');
    } catch {
      actualizarTema(false);
    }

    botonTema.addEventListener('click', () => {
      const modoOscuro = !document.body.classList.contains('dark-mode');
      actualizarTema(modoOscuro);
      try {
        localStorage.setItem('sazon-tema', modoOscuro ? 'oscuro' : 'claro');
      } catch {
        // El cambio visual sigue funcionando si el navegador bloquea el almacenamiento.
      }
    });
  }

  // Muestra el acceso para volver arriba después de desplazarse.
  const botonArriba = document.getElementById('volverArriba');
  if (botonArriba) {
    const actualizarBotonArriba = () => {
      botonArriba.classList.toggle('visible', window.scrollY > 450);
    };
    window.addEventListener('scroll', actualizarBotonArriba, { passive: true });
    botonArriba.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    actualizarBotonArriba();
  }

  // Envía los pedidos al servidor; la URL privada de Discord nunca va al navegador.
  const formulario = document.getElementById('formPeticion');
  if (formulario) {
    formulario.addEventListener('submit', async evento => {
      evento.preventDefault();
      const estado = document.getElementById('estadoPeticion');
      const botonEnviar = document.getElementById('enviarPeticion');
      const datos = {
        nombre: document.getElementById('nombrePeticion').value.trim(),
        correo: document.getElementById('correoPeticion').value.trim(),
        peticion: document.getElementById('mensajePeticion').value.trim(),
        sitioWeb: document.getElementById('sitioWeb').value.trim()
      };

      estado.classList.remove('error');
      botonEnviar.disabled = true;
      estado.textContent = 'Enviando tu pedido...';

      try {
        const respuesta = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos)
        });
        const resultado = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo enviar el pedido.');

        estado.textContent = '¡Gracias! Tu pedido se envió correctamente.';
        formulario.reset();
      } catch (error) {
        estado.classList.add('error');
        estado.textContent = error.message || 'No se pudo enviar. Inténtalo de nuevo.';
      } finally {
        botonEnviar.disabled = false;
      }
    });
  }
});

// Callback global requerido por el widget de Google Translate.
function googleTranslateElementInit() {
  if (window.google?.translate?.TranslateElement) {
    new window.google.translate.TranslateElement({
      pageLanguage: 'es',
      autoDisplay: false
    }, 'google_translate_element');
  }
}
