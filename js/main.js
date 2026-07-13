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

// ── COUNTER ANIMATION (+2,000) ──
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
  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      animateCounter(counterEl, 2000);
      entries[0].target._obs.disconnect();
    }
  }, { threshold: 0.4 }).observe(counterEl);
  counterEl._obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      animateCounter(counterEl, 2000);
      counterEl._obs.disconnect();
    }
  }, { threshold: 0.4 });
  counterEl._obs.observe(counterEl);
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
    fecha: '2026-07-31T19:00:00',
    titulo: 'Victor Meza — Tour 2026',
    rol: 'Banda invitada · junto a Elefantes de Dalí',
    lugar: 'Casa Efecto',
    direccion: 'C. Mario Molina 23, Centro, Veracruz',
    hora: '7:00 PM · Todas las edades',
    boletos: 'https://passline.com'
  },
  // {
  //   fecha: '2026-08-15T20:00:00',
  //   titulo: 'Nombre del evento',
  //   rol: 'Descripción corta',
  //   lugar: 'Nombre del lugar',
  //   direccion: 'Dirección, Ciudad',
  //   hora: '8:00 PM',
  //   boletos: ''   // deja vacío si no hay link
  // },
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
      ? `<a href="${s.boletos}" target="_blank" class="evento-boletos">BOLETOS →</a>`
      : '';
    return `
      <div class="evento-card">
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
      </div>`;
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
