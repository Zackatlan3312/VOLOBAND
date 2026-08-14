// ── STICKER CHISPAS — solo al hacer click ──
const sticker = document.querySelector('.hero-sticker');
if (sticker) {
  sticker.style.pointerEvents = 'auto';
  sticker.style.cursor = 'pointer';
  sticker.addEventListener('click', () => {
    // Quita la clase por si quedó de antes
    sticker.classList.remove('sparking');
    // Fuerza reflow para reiniciar la animación
    void sticker.offsetWidth;
    sticker.classList.add('sparking');
    // Quita la clase cuando termina la animación más larga (0.9s delay 0.20s = 1.1s)
    setTimeout(() => sticker.classList.remove('sparking'), 1200);
  });
}

// ── NAVBAR SCROLL ──
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

// ── MOBILE NAV TOGGLE ──
document.getElementById('navToggle').addEventListener('click', () => {
  document.getElementById('navLinks').classList.toggle('open');
});
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    document.getElementById('navLinks').classList.remove('open');
  });
});

// ── COUNTER ANIMATION (+4,000) ──
function animateCounter(el, target, duration = 1800) {
  let start = 0;
  const step = Math.ceil(target / (duration / 16));
  const timer = setInterval(() => {
    start = Math.min(start + step, target);
    el.textContent = start.toLocaleString('es-MX');
    if (start >= target) clearInterval(timer);
  }, 16);
}

const counterEl = document.getElementById('playCounter');
if (counterEl) {
  const obs = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    animateCounter(counterEl, 4000);
    obs.disconnect();
  }, { threshold: 0.4 });
  obs.observe(counterEl);
}

// ── PRESENCIA CARDS ANIMATE IN ──
const presenciaCards = document.querySelectorAll('.presencia-card');
if (presenciaCards.length) {
  const presObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = parseInt(entry.target.dataset.delay || 0);
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);
        presObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  presenciaCards.forEach(card => presObserver.observe(card));
}

// ── VENUE POPUPS ──
const popupOverlay = document.getElementById('popupOverlay');

function openPopup(id) {
  const popup = document.getElementById(id);
  if (!popup) return;
  // close any open
  document.querySelectorAll('.popup.active').forEach(p => p.classList.remove('active'));
  popup.classList.add('active');
  popupOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeAllPopups() {
  document.querySelectorAll('.popup.active').forEach(p => p.classList.remove('active'));
  popupOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

// Venue buttons
document.querySelectorAll('.venue-item[data-popup]').forEach(btn => {
  btn.addEventListener('click', () => openPopup(btn.dataset.popup));
});

// Close buttons inside popups
document.querySelectorAll('.popup-close').forEach(btn => {
  btn.addEventListener('click', closeAllPopups);
});

// Click overlay to close
popupOverlay.addEventListener('click', closeAllPopups);

// ESC key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllPopups();
});

// ── FADE-IN SECTIONS ON SCROLL ──
const fadeEls = document.querySelectorAll('.section, .presencia-section');
const fadeObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

fadeEls.forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(28px)';
  el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
  fadeObserver.observe(el);
});

// ══════════════════════════════════════════
// CARTELERA — Próximas presentaciones
// Para agregar un show, copia un bloque {} y
// cambia los datos. Los eventos pasados se
// ocultan solos.
// ══════════════════════════════════════════
const SHOWS = [
  {
    fecha: '2026-08-23T17:00:00',
    titulo: 'Open House',
    rol: 'La Voloband en vivo',
    lugar: 'Teatro Piano Bar',
    direccion: 'Veracruz, Ver.',
    hora: '5:00 PM · Cover $50 · Consumo mínimo recomendado $200',
    flyer: 'assets/flyer-agosto23.jpg',
    boletos: 'https://wa.me/522292708672?text=Hola!%20Quiero%20informaci%C3%B3n%20para%20el%20show%20del%2023%20de%20agosto%20en%20el%20Teatro%20Piano%20Bar',
    boletosTexto: 'APARTAR POR WHATSAPP'
  },
  {
    fecha: '2026-10-24T18:00:00',
    titulo: 'VOLOFEST 2026',
    rol: 'Aniversario de la banda · Edición Halloween',
    lugar: 'Jardín y Salón de Fiestas Las Garzas',
    direccion: 'Hermenegildo Galeana 1028, El Coyol, Veracruz',
    hora: '6:00 PM a 1:00 AM · Ven disfrazado',
    flyer: 'assets/flyer-volofest.jpg',
    boletos: 'https://volofest.lavoloband.com',
    boletosTexto: 'VER EL EVENTO'
  },
  // Para agregar un show, copia un bloque {} y cambia los datos.
  // Los eventos pasados desaparecen solos.
  // "flyer" y "boletos" se pueden dejar vacíos ('').
];

const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

function renderCartelera() {
  const cont = document.getElementById('carteleraEvents');
  if (!cont) return;

  const ahora = new Date();
  const proximos = SHOWS
    .map(s => ({ ...s, date: new Date(s.fecha) }))
    .filter(s => s.date > ahora)
    .sort((a, b) => a.date - b.date);

  if (proximos.length === 0) {
    cont.innerHTML = `
      <div class="cartelera-empty">
        <strong>PRÓXIMAMENTE NUEVAS FECHAS</strong><br>
        Síguenos en redes para no perderte ningún show.
      </div>`;
    return;
  }

  cont.innerHTML = proximos.map(s => {
    const dias = Math.ceil((s.date - ahora) / 86400000);
    const countdown = dias === 0 ? '¡ES HOY!' : dias === 1 ? '¡ES MAÑANA!' : `FALTAN ${dias} DÍAS`;

    const boletosBtn = s.boletos
      ? `<a href="${s.boletos}" target="_blank" rel="noopener" class="evento-boletos">${s.boletosTexto || 'BOLETOS'} →</a>`
      : '';

    const flyer = s.flyer
      ? `<a class="evento-flyer" href="${s.flyer}" target="_blank" rel="noopener" aria-label="Ver el flyer de ${s.titulo}">
           <img src="${s.flyer}" alt="Flyer — ${s.titulo}" loading="lazy">
         </a>`
      : '';

    return `
      <article class="evento-card${s.flyer ? ' evento-card--flyer' : ''}">
        ${flyer}
        <div class="evento-cuerpo">
          <div class="evento-fecha">
            <span class="evento-dia">${s.date.getDate()}</span>
            <span class="evento-mes">${MESES[s.date.getMonth()]}</span>
          </div>
          <div class="evento-info">
            <h3 class="evento-titulo">${s.titulo}</h3>
            <p class="evento-rol">${s.rol}</p>
            <p class="evento-lugar"><strong>${s.lugar}</strong> · ${s.direccion}</p>
            <p class="evento-hora">${s.hora}</p>
            <div class="evento-footer">
              <span class="evento-countdown">${countdown}</span>
              ${boletosBtn}
            </div>
          </div>
        </div>
      </article>`;
  }).join('');

  // Animación de entrada al hacer scroll
  const cards = cont.querySelectorAll('.evento-card');
  const obs = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 140);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  cards.forEach(c => obs.observe(c));
}

renderCartelera();
