// Los dos perfiles de la casa: Jerry y Gaby. Mismo proyecto de Firebase,
// misma app, y cada dato lleva un campo `perfil` que dice de quién es
// ("jerry", "gaby" o "ambos" para lo compartido, como la Revolut conjunta).
// Los datos antiguos, sin campo, cuentan como de Jerry.
//
// El módulo se engancha a los puntos de extensión de db.js: filtra lo que
// llega de cada colección según el perfil que se está VIENDO, y sella el
// perfil en todo lo que se crea. Ninguna vista de finanzas sabe que esto
// existe. Cambiar de perfil recarga la app: es como cambiar de cuenta, y
// así no hay ni un render a medio camino entre los dos mundos.
//
// Este archivo es PERSONAL (vida-*): el kit lo excluye entero.

import { registrarGanchosDeDatos, refiltrarColeccion } from "./db.js?v=97";
import { usarClaveDeTema, aplicarTema, temaGuardadoEnLocal } from "./tema.js?v=97";

export const PERFILES = {
  jerry: {
    id: "jerry",
    nombre: "Jerry",
    titulo: "Jerry’s Life",
    marca: "Jerry’s <span>Life</span>",
    saludo: "Hola, Jerry",
    emoji: "💚",
    email: "arce.jerry54@gmail.com",
  },
  gaby: {
    id: "gaby",
    nombre: "Gaby",
    titulo: "Gaby’s Life",
    marca: "Gaby’s <span>Life</span>",
    saludo: "Hola, Gaby",
    emoji: "💗",
    email: "gabryela.knauft.mrg@gmail.com",
  },
};

const CLAVE_VISTO = "fj-perfil-visto";
let propio = null; // no se sabe hasta el login (sale del email)

function leerVisto() {
  try {
    const v = localStorage.getItem(CLAVE_VISTO);
    return PERFILES[v] ? v : null;
  } catch {
    return null;
  }
}

// El perfil que se está viendo ahora mismo. Antes del primer login de un
// dispositivo no hay nada guardado y se asume Jerry; initPerfil lo corrige.
export function perfilVisto() {
  return leerVisto() || propio || "jerry";
}

export const perfilActivo = () => PERFILES[perfilVisto()];
export const esGaby = () => perfilVisto() === "gaby";
export const perfilPropio = () => propio || "jerry";

// ---------- El filtro y el sello ----------

const duenoDe = (d) => d.perfil || "jerry";
export const esVisible = (d) => duenoDe(d) === perfilVisto() || d.perfil === "ambos";

// Copia SIN filtrar de lo que llega de cada colección: hace falta para lo
// poco que necesita ver los dos mundos a la vez (marcar la cuenta conjunta
// como compartida, la comparativa de rachas).
export const crudos = {};

const duenoDeCuenta = (id) => {
  const c = (crudos.cuentas || []).find((x) => x.id === id);
  return c ? c.perfil || "jerry" : null;
};

// El dueño REAL de un movimiento no siempre es el que lleva escrito: los
// Atajos del iPhone no saben de perfiles. Si toca una cuenta compartida es
// de los dos (así el saldo de la conjunta cuadra se mire desde donde se
// mire), y un Bizum entre los dos (origen de uno, destino del otro)
// también: tiene que restar en un perfil y sumar en el otro con un solo
// apunte. Se decide mirando las CUENTAS, ponga lo que ponga el campo — por
// eso el Atajo de transferencia de siempre sirve tal cual: basta con
// elegir una cuenta del otro como destino.
function duenoEfectivo(coleccion, d) {
  if (coleccion === "movimientos") {
    const origen = duenoDeCuenta(d.cuenta_id);
    const destino = duenoDeCuenta(d.cuenta_destino_id);
    if (origen === "ambos" || destino === "ambos") return "ambos";
    if (origen && destino && origen !== destino) return "ambos";
  }
  return duenoDe(d);
}

registrarGanchosDeDatos({
  leer: (coleccion, items) => {
    crudos[coleccion] = items;
    // El dueño efectivo de un movimiento depende de las cuentas, y las
    // colecciones llegan en el orden que quiera Firestore: cuando llegan
    // (o cambian) las cuentas, los movimientos ya filtrados se repasan
    // con la información nueva.
    if (coleccion === "cuentas") queueMicrotask(() => refiltrarColeccion("movimientos"));
    return items.filter((d) => {
      const dueno = duenoEfectivo(coleccion, d);
      return dueno === perfilVisto() || dueno === "ambos";
    });
  },
  crear: (coleccion, data) => ({ ...data, perfil: duenoEfectivo(coleccion, { ...data, perfil: perfilVisto() }) }),
  // El nombre de una cuenta del OTRO perfil, para que un Bizum no enseñe
  // "—" como destino: se busca en los crudos y se firma con su dueño.
  nombrarCuenta: (id) => {
    const c = (crudos.cuentas || []).find((x) => x.id === id);
    if (!c) return null;
    const dueno = PERFILES[c.perfil || "jerry"];
    return dueno && c.perfil !== "ambos" ? `${c.nombre} · ${dueno.nombre}` : c.nombre;
  },
});

// ---------- El tema de cada uno ----------

// El tema de Gaby vive en su propia clave (tema_gaby en la configuración y
// su propio localStorage), así que el rosa de una no pisa el verde del
// otro. Si nunca ha elegido nada, arranca en rosa pastel.
if (esGaby()) {
  usarClaveDeTema({ config: "tema_gaby", local: "fj-tema-gaby", porDefecto: "rosa" });
  aplicarTema(temaGuardadoEnLocal(), { guardar: false });

  // El banner de "importar mis datos iniciales" del Dashboard es el de los
  // datos de JERRY (seed.js): en el perfil de Gaby no pinta nada — lo suyo
  // se crea desde su tarjeta de arranque en Hoy.
  const estilo = document.createElement("style");
  // Además del banner de datos de Jerry, en su app se esconde Préstamos:
  // ella no presta dinero, y un apartado que no se usa solo estorba. La
  // ruta sigue existiendo por si algún día lo quiere.
  estilo.textContent = "#seed-banner{display:none!important} .nav__link[data-route=\"prestamos\"]{display:none!important} .nav__link[data-route=\"oficina\"]{display:none!important}";
  document.head.appendChild(estilo);
} else {
  // Y al revés: el apartado Ciclo (su regla) es de Gaby. En la app de
  // Jerry no sale en el menú — la ruta sigue existiendo, sin más.
  const estilo = document.createElement("style");
  estilo.textContent = '.nav__link[data-route="ciclo"]{display:none!important}';
  document.head.appendChild(estilo);
}

// ---------- La marca ----------

export function aplicarMarca() {
  const p = perfilActivo();
  document.title = p.titulo;
  document.querySelectorAll(".brand-mark").forEach((el) => {
    const icono = el.querySelector(".brand-mark__icon")?.outerHTML || "";
    el.innerHTML = icono + p.marca;
  });
  const saludo = document.querySelector(".hero__greeting");
  if (saludo) saludo.textContent = p.saludo;
}

// ---------- Cambiar de perfil ----------

export function cambiarPerfilVisto() {
  const nuevo = perfilVisto() === "gaby" ? "jerry" : "gaby";
  try {
    localStorage.setItem(CLAVE_VISTO, nuevo);
  } catch {
    /* sin almacenamiento no hay cambio de perfil, pero tampoco error */
  }
  location.reload();
}

function montarBotonesPerfil() {
  const esAjeno = perfilVisto() !== perfilPropio();
  const otro = PERFILES[perfilVisto() === "gaby" ? "jerry" : "gaby"];
  document.querySelectorAll("[data-cambiar-perfil]").forEach((btn) => {
    btn.textContent = esAjeno ? `Volver a mi app ${PERFILES[perfilPropio()].emoji}` : `Ver la app de ${otro.nombre} ${otro.emoji}`;
    btn.onclick = cambiarPerfilVisto;
  });
}

// ---------- Arranque ----------

// Se llama al iniciar sesión, con el usuario de Firebase: el email dice
// quién es. La primera vez en un dispositivo no hay elección guardada; se
// apunta el perfil propio y, si la pantalla ya se había pintado como el
// otro, se recarga una única vez para arrancar con lo suyo.
export function initPerfil(user) {
  const email = (user?.email || "").toLowerCase().trim();
  propio = email === PERFILES.gaby.email ? "gaby" : "jerry";
  if (!leerVisto()) {
    try {
      localStorage.setItem(CLAVE_VISTO, propio);
    } catch {
      /* da igual: perfilVisto ya cae en `propio` */
    }
    if (propio === "gaby") {
      location.reload();
      return;
    }
  }
  aplicarMarca();
  montarBotonesPerfil();
}

// La marca correcta desde el primer fotograma en los dispositivos que ya
// saben qué perfil ven (todos menos la primerísima visita).
aplicarMarca();
