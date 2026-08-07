// Efectos con carácter de cada personaje.
//
// Aquí solo está la MECÁNICA (cuándo se dispara, cuánto dura, cuándo se
// limpia). El dibujo de cada efecto —el estirón de goma de Luffy, el rayo
// de Zenitsu atravesando la pantalla, los tres tajos de Zoro— vive en
// css/temas.css, igual que los colores. Sin tema puesto (Original) no se
// dispara ninguno: la app se queda tan sobria como estaba.
//
// Momentos:
//   entrada      al abrir la app y al cambiar de tema. Es el grande: ocupa
//                toda la pantalla, la tarjeta del hero reacciona y el saldo
//                se ilumina, los tres a la vez.
//   guardar      confirmación corta al guardar algo.
//   celebración  al liquidar un préstamo entero. El más largo de todos.
//   número       una cifra que cambia de valor.
//   fila         una fila que se está eliminando.

const temporizadores = new WeakMap();

const DURACION_ENTRADA_MS = 1600;
const DURACION_ACCION_MS = 900;
const DURACION_CELEBRACION_MS = 2200;
const DURACION_FILA_MS = 420;
const DURACION_NUMERO_MS = 700;

// Si alguien ha pedido en su sistema que se reduzca el movimiento, no se
// anima nada: el efecto se salta y la acción ocurre igual de rápido.
function prefiereQuieto() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function hayTema() {
  return Boolean(document.documentElement.dataset.tema);
}

function noToca() {
  return !hayTema() || prefiereQuieto();
}

// Reiniciar una animación de CSS obliga a quitar la clase, forzar al
// navegador a recalcular, y volver a ponerla. Sin ese recálculo por medio
// el navegador agrupa las dos operaciones y la animación no se repite.
function reproducir(el, duracionMs, clase = "is-activo") {
  if (!el) return;
  clearTimeout(temporizadores.get(el));
  el.classList.remove(clase);
  void el.offsetWidth;
  el.classList.add(clase);
  temporizadores.set(el, setTimeout(() => el.classList.remove(clase), duracionMs));
}

// La entrada mueve cuatro cosas a la vez, y es lo que hace que se note en
// toda la app y no solo en un rincón:
//   1. una capa a pantalla completa con el gesto del personaje,
//   2. la capa de dentro del hero,
//   3. la propia tarjeta del hero (que se estira, tiembla o se ilumina),
//   4. el saldo total, que se enciende.
export function efectoDeEntrada() {
  if (noToca()) return;
  reproducir(document.getElementById("efecto-entrada"), DURACION_ENTRADA_MS);
  reproducir(document.querySelector(".hero__efecto"), DURACION_ENTRADA_MS);
  reproducir(document.querySelector(".hero"), DURACION_ENTRADA_MS, "is-entrando");
  reproducir(document.getElementById("saldo-total"), DURACION_ENTRADA_MS, "is-destacado");
}

// Mientras dura una celebración se silencia el destello normal de guardado:
// liquidar un préstamo también guarda, y si no los dos efectos se pisarían
// uno encima del otro.
let celebrandoHasta = 0;

// Al liquidar un préstamo entero: la marca del personaje revienta en el
// centro de la pantalla con ondas alrededor. Es el efecto más largo de la
// app, y a propósito: pasa pocas veces y es un buen momento.
export function efectoDeCelebracion() {
  if (noToca()) return;
  celebrandoHasta = Date.now() + DURACION_CELEBRACION_MS;
  reproducir(document.getElementById("efecto-entrada"), DURACION_CELEBRACION_MS, "is-celebrando");
  reproducir(document.querySelector(".hero"), DURACION_CELEBRACION_MS, "is-entrando");
  reproducir(document.getElementById("saldo-total"), DURACION_CELEBRACION_MS, "is-destacado");
}

// Al guardar cualquier cosa: el gesto del personaje, corto y a pantalla
// completa. Sirve de confirmación de que se ha guardado.
export function efectoAlGuardar() {
  if (noToca() || Date.now() < celebrandoHasta) return;
  reproducir(document.getElementById("efecto-accion"), DURACION_ACCION_MS);
}

// Cuando una cifra cambia de valor (el saldo total, los totales del mes),
// se enciende un momento con el color del tema. Solo en los cambios de
// verdad: quien llama a esto ya ha decidido que hay algo que contar, así
// que no salta al abrir la app ni con cada llegada de datos de Firestore.
export function destelloEnNumero(el) {
  if (!el || noToca()) return;
  reproducir(el, DURACION_NUMERO_MS, "is-cambiando");
}

// Al eliminar: la fila se despide a la manera del personaje (cortada,
// fulminada, encogida…) ANTES de que se borre de verdad. Devuelve una
// promesa para que quien llama espere a que termine antes de tocar los
// datos: si se borrara al momento, la lista se volvería a pintar y la fila
// desaparecería de golpe sin que diera tiempo a ver nada.
export function animarFilaAlEliminar(fila) {
  if (!fila || noToca()) return Promise.resolve();
  fila.classList.add("is-eliminando");
  return new Promise((resolve) => setTimeout(resolve, DURACION_FILA_MS));
}
