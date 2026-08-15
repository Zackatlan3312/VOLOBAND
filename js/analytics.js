/* ============================================================
   ANALYTICS — La Voloband
   ------------------------------------------------------------
   1) Pega aqui abajo tu ID de medicion de Google Analytics 4.
      Se ve asi: G-ABC1234XYZ  (lo sacas en analytics.google.com)
   2) Ya no tienes que tocar nada mas: cuenta las visitas y los
      clics en botones, WhatsApp, redes y musica automaticamente.
   ============================================================ */

const GA_ID   = 'G-E8B07VWJPE';   // La Voloband
const SITIO   = 'lavoloband';     // para distinguir de volofest

/* ---------- Carga de Google Analytics ---------- */
(function () {
  if (!GA_ID || GA_ID === 'G-XXXXXXXXXX') return;  // sin ID, no carga nada

  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', GA_ID, { sitio: SITIO });
})();

/* ---------- Helper por si quieres mandar eventos a mano ---------- */
window.trackEvent = function (nombre, datos) {
  if (typeof gtag === 'function') gtag('event', nombre, Object.assign({ sitio: SITIO }, datos || {}));
};

/* ---------- Clics en enlaces y botones (automatico) ---------- */
document.addEventListener('click', function (e) {
  const a = e.target.closest('a[href]');
  if (!a) return;

  const href = a.getAttribute('href') || '';
  const texto = (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 60);
  let evento = null;

  if (href.startsWith('mailto:'))                       evento = 'clic_mail';
  else if (href.startsWith('tel:'))                     evento = 'clic_telefono';
  else if (href.includes('wa.me'))                      evento = 'clic_whatsapp';
  else if (href.includes('whatsapp.com/channel'))       evento = 'clic_canal_whatsapp';
  else if (href.includes('open.spotify.com'))           evento = 'clic_spotify';
  else if (href.includes('music.apple.com'))            evento = 'clic_apple_music';
  else if (href.includes('youtube.com'))                evento = 'clic_youtube';
  else if (href.includes('instagram.com'))              evento = 'clic_instagram';
  else if (href.includes('tiktok.com'))                 evento = 'clic_tiktok';
  else if (href.includes('maps.app.goo.gl'))            evento = 'clic_mapa';
  else if (/^https?:\/\//.test(href))                   evento = 'clic_enlace_externo';
  else if (href.startsWith('#'))                        evento = 'clic_menu';

  if (!evento) return;
  window.trackEvent(evento, { link_text: texto, link_url: href });
}, true);
