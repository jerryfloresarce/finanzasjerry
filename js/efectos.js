// Efectos con carácter de cada personaje: el destello al abrir el
// Dashboard, el que confirma que algo se ha guardado, y la forma en que una
// fila se despide al eliminarla.
//
// Aquí solo está la MECÁNICA (cuándo se dispara, cuánto dura, cuándo se
// limpia). El dibujo de cada efecto —los tres tajos de Zoro, el relámpago
// de Zenitsu, el sombrero que cae de Luffy— vive en css/temas.css, igual
// que los colores. Sin tema puesto (Original) no se dispara ninguno: la app
// se queda tan sobria como estaba.

const DURACION_HERO_MS = 1200;
const DURACION_ACCION_MS = 900;
const DURACION_FILA_MS = 420;

// Si alguien ha pedido en su sistema que se reduzca el movimiento, no se
// anima nada: el efecto se salta y la acción ocurre igual de rápido.
function prefiereQuieto() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function hayTema() {
  return Boolean(document.documentElement.dataset.tema);
}

// Reiniciar una animación de CSS obliga a quitar la clase, forzar al
// navegador a recalcular, y volver a ponerla. Sin ese recálculo por medio
// el navegador agrupa las dos operaciones y la animación no se repite.
function reproducir(el, duracionMs, temporizadores) {
  if (!el) return;
  clearTimeout(temporizadores.get(el));
  el.classList.remove("is-activo");
  void el.offsetWidth;
  el.classList.add("is-activo");
  temporizadores.set(
    el,
    setTimeout(() => el.classList.remove("is-activo"), duracionMs)
  );
}

const temporizadores = new WeakMap();

// Al abrir el Dashboard o al cambiar de tema: el destello del personaje
// cruza el hero una vez.
export function efectoEntradaHero() {
  if (!hayTema() || prefiereQuieto()) return;
  reproducir(document.querySelector(".hero__efecto"), DURACION_HERO_MS, temporizadores);
}

// Al guardar cualquier cosa: el mismo destello, pero sobre toda la pantalla
// y más corto. Sirve de confirmación de que se ha guardado.
export function efectoAlGuardar() {
  if (!hayTema() || prefiereQuieto()) return;
  reproducir(document.getElementById("efecto-accion"), DURACION_ACCION_MS, temporizadores);
}

// Al eliminar: la fila se despide a la manera del personaje (cortada,
// fulminada, encogida…) ANTES de que se borre de verdad. Devuelve una
// promesa para que quien llama espere a que termine antes de tocar los
// datos: si se borrara al momento, la lista se volvería a pintar y la fila
// desaparecería de golpe sin que diera tiempo a ver nada.
export function animarFilaAlEliminar(fila) {
  if (!fila || !hayTema() || prefiereQuieto()) return Promise.resolve();
  fila.classList.add("is-eliminando");
  return new Promise((resolve) => setTimeout(resolve, DURACION_FILA_MS));
}
