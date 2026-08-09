// La visita guiada de la demostración.
//
// Es lo más parecido a un vídeo de "esto es lo que vas a tener", pero es la
// app de verdad: va sola por las secciones, señala lo que hay que mirar,
// añade un gasto delante de ti y cambia de tema para que se vean las
// animaciones. Se puede parar en cualquier momento y seguir tocando tú.
//
// Se enciende con ?visita en la dirección, o pulsando el botón que aparece
// abajo a la derecha en demo.html.

const ESPERA_LARGA = 5200;
const ESPERA_CORTA = 3400;

// Cada parada: dónde llevar la app, qué señalar y qué contar. "hacer" es lo
// que ocurre al llegar, para las paradas donde se demuestra algo de verdad.
const PARADAS = [
  {
    ruta: "dashboard",
    foco: ".hero",
    titulo: "Todo tu dinero, de un vistazo",
    texto: "Lo primero que ves al abrir: cuánto tienes en total, sumando todas tus cuentas. Se calcula solo a partir de tus movimientos, así que nunca se descuadra.",
  },
  {
    ruta: "dashboard",
    foco: "#dashboard-content .card:nth-of-type(2)",
    titulo: "En qué se te va el mes",
    texto: "El gráfico de gastos por categoría, del mes en curso. Sin tocar nada: se dibuja con lo que vas apuntando.",
  },
  {
    ruta: "dashboard",
    foco: "#dashboard-cuentas, #dashboard-content .card:nth-of-type(3)",
    titulo: "Tus cuentas",
    texto: "Tus bancos y tu efectivo, cada uno con su saldo al día. Puedes tener las que quieras y desactivar las que ya no uses.",
  },
  {
    ruta: "movimientos",
    titulo: "Apuntar un gasto tarda tres segundos",
    texto: "Mira: abro el formulario, pongo el importe y ya está. Desde el iPhone se puede hacer incluso sin abrir la app, con un atajo del Centro de Control.",
    hacer: async () => {
      document.getElementById("btn-add-movimiento")?.click();
      await esperar(900);
      const campo = document.querySelector('.modal input[name="importe"]');
      if (campo) {
        await escribirComoUnaPersona(campo, "24.90");
        await esperar(700);
        document.querySelector(".modal form button[type=submit]")?.click();
      }
      await esperar(1200);
    },
  },
  {
    ruta: "dashboard",
    foco: ".hero",
    titulo: "Y el saldo ya lo sabe",
    texto: "No hay que darle a guardar en ningún sitio ni refrescar nada. Lo que apuntas en el móvil aparece en el ordenador al instante, y al revés.",
  },
  {
    ruta: "dashboard",
    foco: "#dashboard-limites, #dashboard-content .card:nth-of-type(5)",
    titulo: "Límites, para no pasarte",
    texto: "Le pones un tope al mes a lo que quieras —comer fuera, ocio, lo que sea— y la barra te dice cómo vas antes de que sea tarde.",
  },
  {
    ruta: "suscripciones",
    titulo: "Los gastos fijos, controlados",
    texto: "Suscripciones, cuotas, seguros. Mensuales, anuales o cada dos meses. Aquí se ve de golpe cuánto se te va todos los meses sin que te enteres.",
  },
  {
    ruta: "graficos",
    titulo: "Y si quieres mirar más a fondo",
    texto: "Gráficos por categoría, por sitio y por el rango de fechas que elijas. Para cuando quieres saber de verdad a dónde fue el dinero.",
  },
  {
    ruta: "dashboard",
    titulo: "Del color que tú quieras",
    texto: "Hay varias paletas de serie, y si ninguna te encaja se te hace una con tu color. Mira cómo cambia entera:",
    hacer: async () => {
      const tema = await import("../tema.js?v=[[V]]");
      for (const id of ["rosa", "lavanda", "oceano"]) {
        // elegirTema y no aplicarTema: aplicarTema solo pinta, y el
        // repintado que viene detrás vuelve a leer la configuración y
        // deshace el cambio al instante. elegirTema apunta el tema elegido
        // antes de pintarlo, que es lo que hace que se quede.
        await tema.elegirTema(id);
        await esperar(1900);
      }
    },
    espera: 900,
  },
  {
    ruta: "dashboard",
    titulo: "Esto es lo que vas a tener",
    texto: "Tuya, en tu móvil y en tu ordenador, con tus categorías y tus bancos. Y si algún día quieres cambiar algo, se lo dices y ya está.\n\nCuando quieras, escribe: quiero la mía",
    ultima: true,
  },
];

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Escribir letra a letra en vez de rellenar el campo de golpe: se entiende
// mucho mejor lo que está pasando, y es la diferencia entre "ha aparecido
// un número" y "está apuntando un gasto".
async function escribirComoUnaPersona(campo, texto) {
  campo.focus();
  campo.value = "";
  for (const letra of texto) {
    campo.value += letra;
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    await esperar(110);
  }
}

let cancelada = false;

function montarPanel() {
  const panel = document.createElement("div");
  panel.className = "visita";
  panel.innerHTML = `
    <div class="visita__barra"><span class="visita__progreso"></span></div>
    <div class="visita__cuerpo">
      <p class="visita__titulo"></p>
      <p class="visita__texto"></p>
    </div>
    <div class="visita__pie">
      <button type="button" class="visita__salir">Salir y tocar yo</button>
      <button type="button" class="visita__siguiente">Siguiente</button>
    </div>`;
  document.body.appendChild(panel);
  return panel;
}

function señalar(selector) {
  document.querySelectorAll(".visita-foco").forEach((e) => e.classList.remove("visita-foco"));
  if (!selector) return;
  // Varios selectores separados por coma: vale el primero que exista, para
  // que la visita no se rompa si una sección se llama distinto en la app de
  // alguien que la haya personalizado.
  for (const parte of selector.split(",")) {
    const el = document.querySelector(parte.trim());
    if (el) {
      el.classList.add("visita-foco");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
  }
}

export async function empezarVisita() {
  if (document.querySelector(".visita")) return;
  cancelada = false;
  const panel = montarPanel();
  const titulo = panel.querySelector(".visita__titulo");
  const texto = panel.querySelector(".visita__texto");
  const progreso = panel.querySelector(".visita__progreso");
  const btnSiguiente = panel.querySelector(".visita__siguiente");

  const terminar = () => {
    cancelada = true;
    document.querySelectorAll(".visita-foco").forEach((e) => e.classList.remove("visita-foco"));
    panel.classList.add("is-saliendo");
    setTimeout(() => panel.remove(), 300);
  };
  panel.querySelector(".visita__salir").addEventListener("click", terminar);

  requestAnimationFrame(() => panel.classList.add("is-visible"));

  for (let i = 0; i < PARADAS.length; i++) {
    if (cancelada) return;
    const parada = PARADAS[i];

    if (location.hash !== `#/${parada.ruta}`) {
      location.hash = `#/${parada.ruta}`;
      await esperar(700);
    }
    if (cancelada) return;

    progreso.style.width = `${((i + 1) / PARADAS.length) * 100}%`;
    titulo.textContent = parada.titulo;
    texto.textContent = parada.texto;
    btnSiguiente.textContent = parada.ultima ? "Cerrar" : "Siguiente";
    señalar(parada.foco);

    if (parada.hacer) {
      // Mientras la visita está haciendo algo —escribiendo un importe,
      // cambiando de tema— el botón se apaga y lo dice. Antes se quedaba
      // encendido, la gente lo pulsaba, el clic se perdía porque la escucha
      // todavía no existía, y parecía que la visita se había colgado.
      btnSiguiente.disabled = true;
      btnSiguiente.textContent = "Un momento…";
      await esperar(parada.espera ?? 1400);
      if (cancelada) return;
      await parada.hacer();
      if (cancelada) return;
      btnSiguiente.disabled = false;
      btnSiguiente.textContent = parada.ultima ? "Cerrar" : "Siguiente";
    }

    // Avanza sola pasado un rato, o antes si pulsan "Siguiente". Lo primero
    // que ocurra: quien lee despacio no se pierde nada y quien tiene prisa
    // no espera.
    const avance = await Promise.race([
      esperar(parada.hacer ? ESPERA_CORTA : ESPERA_LARGA).then(() => "tiempo"),
      new Promise((r) => btnSiguiente.addEventListener("click", () => r("botón"), { once: true })),
    ]);
    if (cancelada) return;
    if (parada.ultima && avance === "botón") break;
  }

  terminar();
}

// El botón flotante para volver a verla, y el arranque automático si la
// dirección lleva ?visita.
export function montarBotonDeVisita() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "visita-lanzar";
  btn.textContent = "Ver la visita guiada";
  btn.addEventListener("click", () => empezarVisita());
  document.body.appendChild(btn);
  if (new URLSearchParams(location.search).has("visita")) {
    setTimeout(() => empezarVisita(), 1600);
  }
}
