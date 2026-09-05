// El idioma de la app. El español es el idioma de origen: TODO el código
// escribe sus textos en español, y este módulo los traduce al vuelo cuando
// el usuario elige otro idioma. Así el código no se llena de claves raras,
// el español nunca puede "romperse", y añadir un idioma es añadir un
// diccionario.
//
// Cómo traduce: un observador vigila el documento entero; cada texto que
// aparece (pantallas, modales, avisos que llegan tarde) pasa por el
// diccionario — primero por frase exacta, luego por patrones (para los
// textos con números o datos dentro, tipo "Historial: 3 pagos"). El texto
// original se recuerda para poder volver a español al instante.
//
// La elección vive en este dispositivo (localStorage): el móvil puede ir
// en portugués y el ordenador en español sin pelearse.

import { DICCIONARIO_PT, PATRONES_PT } from "./idiomas/pt.js?v=115";

const CLAVE = "fj-idioma";

export const IDIOMAS = [
  { id: "es", nombre: "Español", locale: "es-ES" },
  { id: "pt", nombre: "Português (Brasil)", locale: "pt-BR" },
];

const DICCIONARIOS = { pt: { exactas: DICCIONARIO_PT, patrones: PATRONES_PT } };

let idioma = "es";
try {
  const guardado = localStorage.getItem(CLAVE);
  if (IDIOMAS.some((i) => i.id === guardado)) idioma = guardado;
} catch (e) {}

export function idiomaActual() {
  return idioma;
}

export function localeActual() {
  return IDIOMAS.find((i) => i.id === idioma)?.locale || "es-ES";
}

// Traduce una frase suelta (para los textos que no viven en el DOM: las
// etiquetas de las gráficas en canvas, los confirm() del navegador…).
export function t(texto) {
  if (idioma === "es" || texto == null) return texto;
  return traducirTexto(String(texto)) ?? texto;
}

// Los textos que el diccionario no conoce se apuntan aquí: es la lista de
// deberes del traductor (window.__faltantes en la consola).
const faltantes = new Set();
if (typeof window !== "undefined") window.__faltantes = faltantes;

function traducirTexto(texto) {
  const dic = DICCIONARIOS[idioma];
  if (!dic) return null;
  // Ojo: los importes llevan espacios duros (NBSP) que la clave del
  // diccionario no tiene. Se normaliza para BUSCAR, y el resultado se
  // reconstruye (prefijo + traducción + sufijo) en vez de sustituir con
  // .replace, que fallaba en silencio cuando los espacios no coincidían.
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (!limpio) return null;
  const prefijo = texto.match(/^\s*/)[0];
  const sufijo = texto.match(/\s*$/)[0];
  const exacta = dic.exactas[limpio];
  if (exacta !== undefined) return prefijo + exacta + sufijo;
  for (const [patron, plantilla] of dic.patrones) {
    if (patron.test(limpio)) return prefijo + limpio.replace(patron, plantilla) + sufijo;
  }
  // Solo cuenta como pendiente si parece texto de la interfaz (tiene
  // letras); los números, fechas y símbolos no se traducen.
  if (/[a-záéíóúñü]{3}/i.test(limpio)) faltantes.add(limpio);
  return null;
}

// Se recuerda el texto español original de cada nodo para poder volver.
const originales = new WeakMap();
const ATRIBUTOS = ["placeholder", "title", "aria-label"];
let observador = null;
let traduciendo = false;

function traducirNodoTexto(nodo) {
  if (!originales.has(nodo)) originales.set(nodo, nodo.nodeValue);
  const base = originales.get(nodo);
  if (idioma === "es") {
    if (nodo.nodeValue !== base) nodo.nodeValue = base;
    return;
  }
  const traducido = traducirTexto(base);
  if (traducido !== null && nodo.nodeValue !== traducido) nodo.nodeValue = traducido;
  else if (traducido === null && nodo.nodeValue !== base) nodo.nodeValue = base;
}

function traducirAtributos(el) {
  for (const attr of ATRIBUTOS) {
    if (!el.hasAttribute?.(attr)) continue;
    const clave = `__orig_${attr}`;
    if (el[clave] === undefined) el[clave] = el.getAttribute(attr);
    const base = el[clave];
    const valor = idioma === "es" ? base : (traducirTexto(base) ?? base);
    if (el.getAttribute(attr) !== valor) el.setAttribute(attr, valor);
  }
}

function recorrer(raiz) {
  if (!raiz) return;
  const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(n) {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const tag = n.tagName;
        if (tag === "SCRIPT" || tag === "STYLE") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const textos = [];
  let n;
  while ((n = walker.nextNode())) textos.push(n);
  textos.forEach(traducirNodoTexto);
  if (raiz.querySelectorAll) {
    raiz.querySelectorAll("[placeholder], [title], [aria-label]").forEach(traducirAtributos);
    if (raiz.nodeType === Node.ELEMENT_NODE) traducirAtributos(raiz);
  }
}

export function traducirDocumento() {
  traduciendo = true;
  recorrer(document.body);
  document.documentElement.lang = idioma;
  traduciendo = false;
}

export function arrancarIdioma() {
  if (observador) return;
  observador = new MutationObserver((mutaciones) => {
    if (traduciendo || idioma === "es") return;
    traduciendo = true;
    for (const m of mutaciones) {
      if (m.type === "characterData") traducirNodoTexto(m.target);
      else for (const nodo of m.addedNodes) {
        if (nodo.nodeType === Node.TEXT_NODE) traducirNodoTexto(nodo);
        else recorrer(nodo);
      }
    }
    traduciendo = false;
  });
  observador.observe(document.body, { childList: true, characterData: true, subtree: true });
  if (idioma !== "es") traducirDocumento();
  else document.documentElement.lang = "es";
}

export function elegirIdioma(id) {
  if (!IDIOMAS.some((i) => i.id === id) || id === idioma) return;
  idioma = id;
  try {
    localStorage.setItem(CLAVE, id);
  } catch (e) {}
  traducirDocumento();
  document.dispatchEvent(new CustomEvent("idioma-cambiado", { detail: { idioma: id } }));
}

// El selector del panel de Mi cuenta.
export function montarSelectorIdioma(contenedor) {
  if (!contenedor) return;
  const pintar = () => {
    contenedor.innerHTML = IDIOMAS.map(
      (i) => `
      <button type="button" class="tema-btn ${i.id === idioma ? "is-active" : ""}" data-idioma-id="${i.id}">
        <span class="tema-btn__nombre">${i.nombre}</span>
      </button>`
    ).join("");
  };
  pintar();
  contenedor.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-idioma-id]");
    if (!btn) return;
    elegirIdioma(btn.dataset.idiomaId);
    pintar();
  });
}
