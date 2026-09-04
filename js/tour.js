// La guía de bienvenida: la primera vez que alguien entra en la app, un
// recorrido corto le enseña dónde está cada cosa — como un vídeo, pero
// tocándolo. Cada paso ilumina una parte real de la pantalla con su
// explicación, y se puede saltar en cualquier momento. Después queda
// disponible en Mi cuenta ("Ver la guía otra vez") para repetirla.

const CLAVE_VISTO = "fj-tour-visto";

// Los pasos. Cada uno señala un elemento real (el primero de sus selectores
// que exista Y se vea — el menú del móvil y el de escritorio son elementos
// distintos). Sin selector, el paso sale centrado, de presentación.
const PASOS = [
  {
    titulo: "¡Bienvenido! 👋",
    texto: "Esta es tu app: tu día a día y tu dinero, en un solo sitio y a tu manera. Te enseño lo básico en cuatro pasos — medio minuto.",
  },
  {
    selector: ["#topbar-menu-btn", "#main-nav"],
    titulo: "El menú",
    texto: "Aquí está TODO, en dos bloques: «Tu día» (rutina, calendario, comidas…) y «Tu dinero» (cuentas, movimientos, préstamos…). Ninguna pantalla escondida.",
  },
  {
    selector: ["#btn-open-cuenta-topbar", "#btn-account-desktop"],
    titulo: "Tu cuenta y tus colores",
    texto: "Desde aquí eliges el tema de la app — claro u oscuro, o uno con carácter (países y más) — y gestionas tu perfil.",
  },
  {
    titulo: "Tuya de verdad",
    texto: "Toca todo sin miedo: cualquier cosa que borre algo te pregunta antes y te dice qué va a pasar. Y si algo no encaja con tu vida, se cambia — para eso es tuya. ¡A por ello!",
  },
];

let paso = 0;
let capa = null;

function elementoDe(p) {
  for (const sel of p.selector || []) {
    const el = document.querySelector(sel);
    if (el && el.offsetParent !== null) return el;
  }
  return null;
}

function pintarPaso() {
  const p = PASOS[paso];
  if (!p) return cerrarTour(true);
  const el = elementoDe(p);
  const foco = capa.querySelector(".tour-foco");
  const burbuja = capa.querySelector(".tour-burbuja");

  capa.classList.toggle("tour-capa--velo", !el);
  if (el) {
    const r = el.getBoundingClientRect();
    foco.style.display = "block";
    foco.style.top = `${r.top - 6}px`;
    foco.style.left = `${r.left - 6}px`;
    foco.style.width = `${r.width + 12}px`;
    foco.style.height = `${r.height + 12}px`;
    // La burbuja, debajo del elemento señalado si cabe; si no, encima.
    const abajo = r.bottom + 190 < window.innerHeight;
    burbuja.style.top = abajo ? `${r.bottom + 14}px` : "auto";
    burbuja.style.bottom = abajo ? "auto" : `${window.innerHeight - r.top + 14}px`;
    burbuja.classList.remove("tour-burbuja--centrada");
  } else {
    foco.style.display = "none";
    burbuja.style.top = "50%";
    burbuja.style.bottom = "auto";
    burbuja.classList.add("tour-burbuja--centrada");
  }

  burbuja.querySelector(".tour-burbuja__titulo").textContent = p.titulo;
  burbuja.querySelector(".tour-burbuja__texto").textContent = p.texto;
  burbuja.querySelector(".tour-burbuja__paso").textContent = `${paso + 1} de ${PASOS.length}`;
  burbuja.querySelector("#tour-siguiente").textContent = paso === PASOS.length - 1 ? "¡Listo!" : "Siguiente →";
}

function cerrarTour(completado) {
  try {
    localStorage.setItem(CLAVE_VISTO, "1");
  } catch (e) {}
  capa?.remove();
  capa = null;
  void completado;
}

export function arrancarTour() {
  if (capa) return;
  paso = 0;
  capa = document.createElement("div");
  capa.className = "tour-capa";
  capa.innerHTML = `
    <div class="tour-foco" aria-hidden="true"></div>
    <div class="tour-burbuja" role="dialog" aria-label="Guía de la app">
      <p class="tour-burbuja__paso"></p>
      <h2 class="tour-burbuja__titulo"></h2>
      <p class="tour-burbuja__texto"></p>
      <div class="tour-burbuja__botones">
        <button type="button" class="btn btn--ghost btn--sm" id="tour-saltar">Saltar</button>
        <button type="button" class="btn btn--primary btn--sm" id="tour-siguiente">Siguiente →</button>
      </div>
    </div>`;
  document.body.appendChild(capa);
  capa.querySelector("#tour-saltar").addEventListener("click", () => cerrarTour(false));
  capa.querySelector("#tour-siguiente").addEventListener("click", () => {
    paso += 1;
    if (paso >= PASOS.length) cerrarTour(true);
    else pintarPaso();
  });
  window.addEventListener("resize", () => capa && pintarPaso());
  pintarPaso();
}

// La primera vez (y solo la primera), la guía arranca sola al entrar.
export function tourSiPrimeraVez() {
  let visto = null;
  try {
    visto = localStorage.getItem(CLAVE_VISTO);
  } catch (e) {}
  if (visto) return;
  // Un respiro para que la pantalla esté pintada del todo.
  setTimeout(arrancarTour, 900);
}
