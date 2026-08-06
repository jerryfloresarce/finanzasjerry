import { updateConfig } from "./db.js?v=38";
import { state } from "./store.js?v=38";

// Temas de la app. El aspecto de cada uno vive entero en css/temas.css:
// aquí solo está el catálogo (para pintar el selector) y la mecánica de
// aplicarlo y recordarlo.
//
// "muestra" son los tres colores que se ven en el cuadradito del selector,
// en el mismo orden que se perciben en el tema: fondo, acento y el color
// secundario que lo hace reconocible.
export const TEMAS = [
  {
    id: "original",
    nombre: "Original",
    grupo: "Por defecto",
    muestra: ["#0a0e0c", "#7a9b81", "#b6975f"],
  },
  {
    id: "luffy",
    nombre: "Luffy",
    grupo: "One Piece",
    muestra: ["#120a09", "#f5b324", "#e03b33"],
  },
  {
    id: "zoro",
    nombre: "Zoro",
    grupo: "One Piece",
    muestra: ["#060a07", "#23b24b", "#d9af37"],
  },
  {
    id: "sanji",
    nombre: "Sanji",
    grupo: "One Piece",
    muestra: ["#07080c", "#e7c15c", "#2e78c8"],
  },
  {
    id: "tanjiro",
    nombre: "Tanjiro",
    grupo: "Kimetsu no Yaiba",
    muestra: ["#080b0a", "#1f9e68", "#d93b2b"],
  },
  {
    id: "zenitsu",
    nombre: "Zenitsu",
    grupo: "Kimetsu no Yaiba",
    muestra: ["#0c0904", "#ffd028", "#f58021"],
  },
  {
    id: "inosuke",
    nombre: "Inosuke",
    grupo: "Kimetsu no Yaiba",
    muestra: ["#05080b", "#2fb6d9", "#c7d6de"],
  },
  {
    id: "akaza",
    nombre: "Akaza",
    grupo: "Kimetsu no Yaiba",
    muestra: ["#0a060c", "#ff4d8d", "#35d6e0"],
  },
];

export const TEMA_POR_DEFECTO = "original";
const CLAVE_LOCAL = "fj-tema";

export function esTemaValido(id) {
  return TEMAS.some((t) => t.id === id);
}

export function temaActual() {
  const id = document.documentElement.dataset.tema;
  return esTemaValido(id) ? id : TEMA_POR_DEFECTO;
}

// Se guarda también en localStorage —además de en Firestore— para poder
// pintar el tema correcto en el primer fotograma, antes de que haya dado
// tiempo a hablar con la base de datos. Si no, la app abriría siempre en
// verde y cambiaría de color un segundo después.
export function temaGuardadoEnLocal() {
  try {
    const id = localStorage.getItem(CLAVE_LOCAL);
    return esTemaValido(id) ? id : TEMA_POR_DEFECTO;
  } catch {
    return TEMA_POR_DEFECTO;
  }
}

function recordarEnLocal(id) {
  try {
    localStorage.setItem(CLAVE_LOCAL, id);
  } catch {
    /* modo privado o almacenamiento lleno: no es crítico */
  }
}

// aplicarTema pinta el tema y avisa al resto de la app. El aviso hace falta
// porque los gráficos (Chart.js) reciben sus colores como valores fijos al
// dibujarse: no se enteran solos de que han cambiado las variables CSS, hay
// que volver a pintarlos.
export function aplicarTema(id, { guardar = true } = {}) {
  const tema = esTemaValido(id) ? id : TEMA_POR_DEFECTO;
  if (tema === TEMA_POR_DEFECTO) delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;

  if (guardar) recordarEnLocal(tema);
  pintarBarraDelNavegador();
  document.dispatchEvent(new CustomEvent("tema-cambiado", { detail: { tema } }));
  return tema;
}

// Con la app instalada en la pantalla de inicio, iOS pinta la franja de
// arriba (la de la hora y la batería) con el color de esta etiqueta. Si no
// se actualiza, se queda verde por mucho que cambies de tema.
function pintarBarraDelNavegador() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const fondo = colorTema("--bg", "");
  if (fondo) meta.setAttribute("content", fondo);
}

// El tema elegido viaja en el documento de configuración, así que se ve
// igual en el móvil y en el ordenador. Esta función solo LEE: nunca vuelve
// a escribir, para no pisar lo que haya elegido el otro dispositivo.
export function sincronizarTemaDesdeConfig(config) {
  const id = config?.tema;
  if (!esTemaValido(id) || id === temaActual()) return;
  aplicarTema(id);
}

export async function elegirTema(id) {
  const tema = esTemaValido(id) ? id : TEMA_POR_DEFECTO;
  // El estado se apunta el tema elegido ANTES de aplicarlo, no después:
  // aplicarTema avisa en el acto y ese aviso provoca un repintado que
  // vuelve a leer la configuración. Si todavía tuviera el tema anterior,
  // desharía la elección a la vista (y sin conexión no se recuperaría
  // nunca, porque la confirmación de Firestore no llegaría).
  state.config = { ...state.config, tema };
  aplicarTema(tema);
  try {
    await updateConfig({ tema });
  } catch (err) {
    // Sin conexión el tema ya está aplicado y guardado en el teléfono; lo
    // único que se pierde es que llegue al resto de dispositivos.
    console.error("No se pudo guardar el tema:", err);
  }
}

// ---------- Colores para los gráficos ----------
// Chart.js no entiende var(--…): hay que darle el color ya resuelto. Estas
// dos funciones leen la variable del tema que esté puesto en ese momento.

export function colorTema(variable, respaldo = "#ffffff") {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return valor || respaldo;
}

export function paletaTema(variable, respaldo = []) {
  const valor = colorTema(variable, "");
  if (!valor) return respaldo;
  const colores = valor.split(",").map((c) => c.trim()).filter(Boolean);
  return colores.length ? colores : respaldo;
}

// Chart.js entiende los hex de ocho dígitos (#RRGGBBAA), así que para
// rellenos translúcidos basta con pegarle la transparencia al color del
// tema. Si el color no fuera un hex normal, se devuelve tal cual.
export function conAlfa(color, alfa) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const aa = Math.round(Math.max(0, Math.min(1, alfa)) * 255)
    .toString(16)
    .padStart(2, "0");
  return color + aa;
}

// ---------- Selector ----------

function botonTema(tema, activo) {
  const franjas = tema.muestra.map((c) => `<span style="background:${c}"></span>`).join("");
  return `
    <button type="button" class="tema-btn ${activo ? "is-active" : ""}" data-tema-id="${tema.id}">
      <span class="tema-btn__muestra" aria-hidden="true">${franjas}</span>
      <span class="tema-btn__nombre">${tema.nombre}</span>
    </button>`;
}

export function montarSelectorTemas(contenedor) {
  if (!contenedor) return;

  const pintar = () => {
    const actual = temaActual();
    const grupos = [];
    TEMAS.forEach((tema) => {
      const grupo = grupos.find((g) => g.nombre === tema.grupo);
      if (grupo) grupo.temas.push(tema);
      else grupos.push({ nombre: tema.grupo, temas: [tema] });
    });
    contenedor.innerHTML = grupos
      .map(
        (g) => `
          <p class="temas-grupo">${g.nombre}</p>
          <div class="temas-grid">${g.temas.map((t) => botonTema(t, t.id === actual)).join("")}</div>`
      )
      .join("");
  };

  pintar();
  contenedor.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tema-id]");
    if (!btn) return;
    elegirTema(btn.dataset.temaId);
  });
  // Si el tema cambia desde otro dispositivo, el selector se pone al día.
  document.addEventListener("tema-cambiado", pintar);
}
