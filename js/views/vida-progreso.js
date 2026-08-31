// vida:inicio
// Progreso: los logros, las metas, el bote de recompensas y las gráficas
// de peso y de fuerza. La pantalla que responde "¿esto está funcionando?".

import {
  vida,
  calcularRacha,
  semanas,
  faseEstudio,
  FASES_ESTUDIO,
  calcularBote,
  calcularCosteReferencia,
  gastoComidaFueraPorDia,
  talonDeAquiles,
  calcularLogros,
  progresionDe,
  PLANES,
  METAS_MANUALES,
  PESO_OBJETIVO_KG,
  guardarSistema,
  addRecompensa,
  updateRecompensa,
  deleteRecompensa,
  lunesDe,
  rutinaEmpezada,
  diaDeRutina,
  rachasCaraACara,
  dueloSemanal,
  retosDeFuerza,
  pesoCorporalActual,
  INNEGOCIABLES,
} from "../vida.js?v=102";
import { fechaISO, fromTimestamp, formatEUR, formatFecha } from "../db.js?v=102";
import { esc } from "../modal.js?v=102";
import { colorTema } from "../tema.js?v=102";
import { efectoDeCelebracion } from "../efectos.js?v=102";

let currentState = null;
let chartPeso = null;
let chartFuerza = null;
let ejercicioElegido = null;
let referenciaCalculada = false;
const draftRecompensa = { nombre: "", coste: "" };

export function mountVidaProgreso() {
  const root = document.getElementById("view-progreso");
  root.addEventListener("input", (e) => {
    if (e.target.id === "rec-nombre") draftRecompensa.nombre = e.target.value;
    if (e.target.id === "rec-coste") draftRecompensa.coste = e.target.value;
  });
  root.addEventListener("change", (e) => {
    if (e.target.id === "fuerza-ejercicio") {
      ejercicioElegido = e.target.value;
      renderVidaProgreso(currentState);
    }
  });
  root.addEventListener("click", async (e) => {
    // El banner de "reto superado" se celebra una vez: se apunta hasta qué
    // nivel se ha visto de cada reto y no vuelve a salir hasta el próximo.
    if (e.target.closest("#btn-retos-celebrar")) {
      const vistos = { ...(vida.sistema.retos_niveles || {}) };
      for (const r of retosDeFuerza()) vistos[r.id] = r.nivel;
      await guardarSistema({ retos_niveles: vistos });
      efectoDeCelebracion();
      return;
    }
    const meta = e.target.closest("[data-meta]");
    if (meta) {
      const id = meta.dataset.meta;
      const metas = { ...(vida.sistema.metas || {}) };
      metas[id] = !metas[id];
      await guardarSistema({ metas });
      if (metas[id]) efectoDeCelebracion();
      return;
    }
    if (e.target.closest("#btn-add-recompensa")) {
      const nombre = document.getElementById("rec-nombre").value.trim();
      const coste = Number(document.getElementById("rec-coste").value || 0);
      if (!nombre || !coste) return;
      await addRecompensa({ nombre, coste, estado: "pendiente", fecha_canje: null });
      draftRecompensa.nombre = "";
      draftRecompensa.coste = "";
      return;
    }
    const canjear = e.target.closest("[data-canjear]");
    if (canjear) {
      await updateRecompensa(canjear.dataset.canjear, { estado: "canjeada", fecha_canje: fechaISO() });
      efectoDeCelebracion();
      return;
    }
    const deshacer = e.target.closest("[data-descanjear]");
    if (deshacer) {
      await updateRecompensa(deshacer.dataset.descanjear, { estado: "pendiente", fecha_canje: null });
      return;
    }
    const borrar = e.target.closest("[data-borrar-recompensa]");
    if (borrar) {
      if (confirm("¿Quitar esta recompensa de la lista?")) await deleteRecompensa(borrar.dataset.borrarRecompensa);
      return;
    }
    if (e.target.closest("#btn-editar-referencia")) {
      const actual = vida.sistema.coste_referencia_dia ?? 0;
      const nuevo = prompt("Coste de referencia diario (lo que gastabas de media al día en comida fuera):", String(actual));
      if (nuevo !== null && nuevo !== "") await guardarSistema({ coste_referencia_dia: Number(nuevo.replace(",", ".")) });
      return;
    }
  });
}

// Gasto en comida fuera de la semana actual contra la media de las 4
// anteriores: la gráfica que engancha, en versión número.
function comparativaSemanal(state) {
  const porDia = gastoComidaFueraPorDia(state.movimientos, state.categorias, fromTimestamp);
  const lunesActual = lunesDe(new Date());
  const sumaSemana = (lunesISO) => {
    let total = 0;
    const d = new Date(lunesISO + "T12:00:00");
    for (let i = 0; i < 7; i++) {
      total += porDia.get(fechaISO(d)) || 0;
      d.setDate(d.getDate() + 1);
    }
    return total;
  };
  const estaSemana = sumaSemana(lunesActual);
  let anteriores = 0;
  for (let s = 1; s <= 4; s++) {
    const d = new Date(lunesActual + "T12:00:00");
    d.setDate(d.getDate() - 7 * s);
    anteriores += sumaSemana(fechaISO(d));
  }
  return { estaSemana, media4: anteriores / 4 };
}

export function renderVidaProgreso(state) {
  currentState = state;
  const el = document.getElementById("progreso-content");
  if (!el || !state) return;

  // El coste de referencia se calcula solo la primera vez, del histórico
  // real de la app: media diaria de comida fuera de los últimos 90 días.
  if (
    !referenciaCalculada &&
    vida.listo &&
    !vida.sinPermisos &&
    vida.sistema.coste_referencia_dia == null &&
    state.movimientos.length > 0
  ) {
    referenciaCalculada = true;
    const ref = calcularCosteReferencia(state.movimientos, state.categorias, fromTimestamp);
    const extras = PESO_OBJETIVO_KG ? { peso_objetivo_kg: PESO_OBJETIVO_KG, proteina_objetivo_g: 145 } : {};
    guardarSistema({ coste_referencia_dia: ref, ...extras }).catch(() => {});
  }

  const { actual, mejor } = calcularRacha();
  const listaSemanas = semanas();
  const semanasCumplidas = listaSemanas.filter((s) => s.cumplida).length;
  const fase = faseEstudio();
  const bote = calcularBote(state.movimientos, state.categorias, fromTimestamp);
  const logros = calcularLogros(103);
  const conseguidos = logros.filter((l) => l.ok);
  const talon = talonDeAquiles();
  const comp = comparativaSemanal(state);
  const metas = vida.sistema.metas || {};
  const pesos = vida.dias.filter((d) => Number(d.peso_kg) > 0);
  const ultimoPeso = pesos.length ? Number(pesos[pesos.length - 1].peso_kg) : null;

  const recompensas = [...vida.recompensas].sort((a, b) => (a.estado === "canjeada") - (b.estado === "canjeada") || a.coste - b.coste);
  const siguiente = recompensas.find((r) => r.estado !== "canjeada" && r.coste > bote.disponible);

  const ejercicios = Object.values(PLANES).flat().map((p) => p.nombre);
  if (!ejercicioElegido) ejercicioElegido = ejercicios[0] || "";
  const pesoObjetivo = vida.sistema.peso_objetivo_kg ?? PESO_OBJETIVO_KG;
  const hayEstudio = INNEGOCIABLES.some((i) => i.id === "estudio");
  const caraACara = rachasCaraACara();
  const duelo = dueloSemanal();
  // Los retos de fuerza: la mejor marca de cada ejercicio clave sale sola
  // del historial; superar un nivel enseña el banner de recompensa UNA vez.
  const retos = retosDeFuerza();
  const nuevosRetos = retos.filter((r) => r.nivel > (vida.sistema.retos_niveles?.[r.id] ?? 0));
  const fmtReto = (n, unidad) => (unidad === "s" ? `${n} s` : unidad === "reps" ? `${n}` : `${String(n).replace(".", ",")} kg`);

  el.innerHTML = `
    ${
      rutinaEmpezada()
        ? `<p class="entity-card__meta" style="margin:0 0 10px;">Día <strong>${diaDeRutina()}</strong> · empezaste el ${formatFecha(new Date(vida.sistema.fecha_inicio + "T12:00:00"))}</p>`
        : `<div class="card hoy-aviso"><p class="entity-card__meta" style="margin:0;">
            La rutina todavía no ha empezado: todo esto arranca en cero el día
            que pulses <strong>START</strong> en <a href="#/hoy">Hoy</a>.
          </p></div>`
    }
    <div class="progreso-kpis">
      <div class="kpi-tile"><span class="kpi-tile__label">Racha</span><span class="kpi-tile__value">🔥 ${actual}</span><span class="entity-card__meta">mejor: ${mejor}</span></div>
      <div class="kpi-tile"><span class="kpi-tile__label">Semanas 6/7</span><span class="kpi-tile__value">${semanasCumplidas}</span></div>
      <div class="kpi-tile"><span class="kpi-tile__label">Entrenos</span><span class="kpi-tile__value">${vida.entrenos.length}</span></div>
      <div class="kpi-tile"><span class="kpi-tile__label">Peso</span><span class="kpi-tile__value">${ultimoPeso ? ultimoPeso + " kg" : "—"}</span>${pesoObjetivo ? `<span class="entity-card__meta">objetivo ${pesoObjetivo}</span>` : ""}</div>
    </div>

    ${
      caraACara.jerry || caraACara.gaby
        ? `<article class="card duelo" style="margin-bottom:14px;">
        <div class="card__header">
          <h2 class="card__title">El duelo de la semana</h2>
          <span class="entity-card__tag">${
            duelo.jerry.puntos === duelo.gaby.puntos
              ? "Empate"
              : duelo.jerry.puntos > duelo.gaby.puntos
                ? "Va ganando Jerry 💚"
                : "Va ganando Gaby 💗"
          }</span>
        </div>
        <p class="entity-card__meta" style="margin-top:-6px;">
          Puntos de esta semana, de lunes a hoy. Gana quien se cuida — no
          quien se machaca: los puntos salen de dormir, moverse, comer bien
          y cumplir lo tuyo. Perder este duelo también es ganar.
        </p>
        <div class="duelo-tabla">
          <div class="duelo-fila duelo-fila--cabecera"><span></span><span>💚 Jerry</span><span>💗 Gaby</span></div>
          <div class="duelo-fila"><span>Puntos</span><span>${duelo.jerry.puntos}</span><span>${duelo.gaby.puntos}</span></div>
          <div class="duelo-fila"><span>Días redondos</span><span>${duelo.jerry.cumplidos}</span><span>${duelo.gaby.cumplidos}</span></div>
          <div class="duelo-fila"><span>Entrenos</span><span>${duelo.jerry.entrenos}</span><span>${duelo.gaby.entrenos}</span></div>
          <div class="duelo-fila"><span>Racha</span><span>🔥 ${duelo.jerry.racha}</span><span>🔥 ${duelo.gaby.racha}</span></div>
        </div>
      </article>`
        : ""
    }

    ${
      retos.length
        ? `<article class="card" style="margin-bottom:14px;">
        <div class="card__header">
          <h2 class="card__title">Retos de fuerza</h2>
          <span class="entity-card__tag">🏅 ${retos.reduce((a, r) => a + r.nivel, 0)} ${retos.reduce((a, r) => a + r.nivel, 0) === 1 ? "medalla" : "medallas"}</span>
        </div>
        ${
          nuevosRetos.length
            ? `<div class="reto-banner">🏅 <strong>¡Reto superado!</strong> ${nuevosRetos
                .map((r) => `${r.nombre} → nivel <strong>${r.nombreNivel}</strong> (${fmtReto(r.metas[r.nivel - 1], r.unidad)})`)
                .join(" · ")}. Date un capricho de tu lista de recompensas: te lo has ganado.
              <button type="button" class="btn btn--ghost btn--sm" id="btn-retos-celebrar">Celebrado ✓</button></div>`
            : ""
        }
        <div class="retos-lista">
        ${retos
          .map(
            (r) => `
          <div class="reto-fila">
            <div class="reto-fila__cab"><strong>${r.nombre}</strong><span class="reto-medallas">${r.nivel ? "🏅".repeat(r.nivel) : "—"}</span></div>
            ${
              r.sinPesoCorporal
                ? `<p class="entity-card__meta reto-fila__datos">Apunta tu peso en Hoy y salen sus niveles (van en proporción a tu peso).</p>`
                : r.mejor <= 0
                  ? `<p class="entity-card__meta reto-fila__datos">Aún sin marca: registra un entreno con este ejercicio. Primer reto: <strong>${fmtReto(r.metas[0], r.unidad)}</strong>.</p>`
                  : `
            <p class="entity-card__meta reto-fila__datos">Tu mejor: <strong>${fmtReto(r.mejor, r.unidad)}</strong>${r.nombreNivel ? ` · nivel ${r.nombreNivel}` : ""}${
              r.siguiente ? ` · siguiente reto: <strong>${fmtReto(r.siguiente, r.unidad)}</strong>` : " · escalera COMPLETA 👑"
            }</p>
            <div class="reto-barra"><span style="width:${r.progreso}%"></span></div>
            ${r.valoracion ? `<p class="entity-card__meta reto-valoracion">${r.valoracion}</p>` : ""}
            ${r.nota ? `<p class="entity-card__meta reto-valoracion">${r.nota}</p>` : ""}`
            }
          </div>`
          )
          .join("")}
        </div>
        <p class="entity-card__meta" style="margin-bottom:0;">
          Valoraciones estimadas con estándares de fuerza internacionales, entre
          gente que entrena — comparado con la población general estás bastante
          más arriba. Los retos con kilos van en proporción a tu peso corporal${
            pesoCorporalActual() ? ` (ahora ${String(pesoCorporalActual()).replace(".", ",")} kg)` : ""
          }: si tú bajas, ellos bajan contigo.
        </p>
      </article>`
        : ""
    }

    <div class="grid grid--hoy">
      <article class="card">
        <h2 class="card__title">El bote</h2>
        <p class="entity-card__meta" style="margin-top:-8px;">
          Referencia: ${formatEUR(bote.referencia)}/día
          <button type="button" class="row-edit-btn" id="btn-editar-referencia" title="Cambiar"><i class="ph-thin ph-pencil-simple"></i></button>
          · Cada día cumplido suma lo que NO te gastas en comida fuera.
        </p>
        <div class="bote-cifras">
          <div><span class="bote-cifras__num">${formatEUR(bote.disponible)}</span><span class="entity-card__meta">disponible para gastar</span></div>
          <div><span class="bote-cifras__num bote-cifras__num--total">${formatEUR(bote.total)}</span><span class="entity-card__meta">bote total</span></div>
        </div>
        ${
          siguiente
            ? `<div class="progress-track" style="margin:10px 0 4px;"><div class="progress-fill" style="width:${Math.min(100, Math.round((bote.disponible / siguiente.coste) * 100))}%"></div></div>
               <p class="entity-card__meta">A ${formatEUR(Math.max(0, siguiente.coste - bote.disponible))} de: ${esc(siguiente.nombre)}</p>`
            : ""
        }
        <div class="mini-list" style="margin-top:10px;">
          ${
            recompensas.length === 0
              ? `<p class="empty-state">Añade recompensas: pavos, piezas del PC, el voucher del AZ-900… Nunca comida.</p>`
              : recompensas
                  .map((r) => {
                    const canjeada = r.estado === "canjeada";
                    const alcanzable = bote.disponible >= r.coste;
                    return `
              <div class="mini-row ${canjeada ? "susc-row--inactiva" : ""}">
                <div class="mini-row__main" style="flex:1; min-width:0;">
                  <span class="mini-row__title">${canjeada ? "✓ " : ""}${esc(r.nombre)}</span>
                  <span class="mini-row__sub">${formatEUR(r.coste)}${canjeada ? ` · canjeada ${r.fecha_canje ?? ""}` : alcanzable ? " · ¡la tienes!" : ""}</span>
                </div>
                ${
                  canjeada
                    ? `<button type="button" class="btn btn--ghost btn--sm" data-descanjear="${r.id}">Deshacer</button>`
                    : `<button type="button" class="btn ${alcanzable ? "btn--primary" : "btn--ghost"} btn--sm" data-canjear="${r.id}" ${alcanzable ? "" : "disabled"}>Canjear</button>`
                }
                <button type="button" class="row-edit-btn" data-borrar-recompensa="${r.id}" title="Quitar"><i class="ph-thin ph-trash"></i></button>
              </div>`;
                  })
                  .join("")
          }
        </div>
        <div class="form-grid" style="margin-top:12px;">
          <label class="field"><span class="field__label">Nueva recompensa</span><input type="text" id="rec-nombre" value="${esc(draftRecompensa.nombre)}" placeholder="Muñequeras" /></label>
          <label class="field"><span class="field__label">Cuesta (€)</span><input type="number" id="rec-coste" value="${draftRecompensa.coste}" placeholder="25" /></label>
          <button type="button" class="btn btn--ghost btn--sm field--full" id="btn-add-recompensa">+ Añadir a la lista</button>
        </div>
        <p class="entity-card__meta" style="margin-top:10px;">
          Comida fuera esta semana: <strong>${formatEUR(comp.estaSemana)}</strong> · media de las 4 anteriores: ${formatEUR(comp.media4)}
          ${comp.estaSemana <= comp.media4 ? " · vas por debajo ✓" : ""}
        </p>
      </article>

      <article class="card">
        <h2 class="card__title">Logros · ${conseguidos.length}/${logros.length}</h2>
        <div class="logros-grid">
          ${logros
            .map(
              (l) => `
            <div class="logro ${l.ok ? "logro--ok" : ""}" title="${l.nombre}">
              <i class="${l.ok ? "ph-fill" : "ph-thin"} ph-${l.icono}" aria-hidden="true"></i>
              <span>${l.nombre}</span>
            </div>`
            )
            .join("")}
        </div>

        <h2 class="card__title" style="margin-top:18px;">Metas</h2>
        ${hayEstudio ? `<p class="entity-card__meta" style="margin-top:-8px;">Estudio: fase ${fase} · ${FASES_ESTUDIO[fase]} min/día. Sube sola con 2 semanas seguidas a 6 de 7.</p>` : ""}
        ${[...new Set(METAS_MANUALES.map((m) => m.grupo))]
          .map(
            (grupo) => `
          <p class="progreso-grupo">${grupo}</p>
          ${METAS_MANUALES.filter((m) => m.grupo === grupo)
            .map(
              (m) => `
            <button type="button" class="hoy-check hoy-check--bonus ${metas[m.id] ? "hoy-check--on" : ""}" data-meta="${m.id}">
              <span class="hoy-check__nombre">${m.nombre}</span>
              <span class="hoy-check__marca"><i class="ph-bold ph-check" aria-hidden="true"></i></span>
            </button>`
            )
            .join("")}`
          )
          .join("")}
      </article>
    </div>

    <div class="grid grid--hoy" style="margin-top:16px;">
      <article class="card">
        <h2 class="card__title">${pesoObjetivo ? `Peso — hacia ${pesoObjetivo} kg` : "Peso"}</h2>
        ${pesos.length < 2 ? `<p class="empty-state">Apunta el peso una vez por semana en Hoy → Apuntes del día.</p>` : `<div class="chart-wrap" style="height:220px;"><canvas id="chart-peso"></canvas></div>`}
      </article>
      <article class="card">
        ${ejercicios.length ? `<h2 class="card__title">Fuerza — mejor serie por sesión</h2>
        <label class="field" style="margin-bottom:10px;">
          <select id="fuerza-ejercicio">${ejercicios.map((n) => `<option ${n === ejercicioElegido ? "selected" : ""}>${n}</option>`).join("")}</select>
        </label>
        <div class="chart-wrap" style="height:200px;"><canvas id="chart-fuerza"></canvas></div>` : `<h2 class="card__title">Dónde se falla más</h2>
        <p class="entity-card__meta" style="margin-top:-6px;">Para saber qué cuesta, no para castigarse.</p>`}
        ${
          talon.length && talon[0].fallos > 0
            ? `<p class="entity-card__meta" style="margin-top:12px;"><strong>Tu talón de Aquiles</strong> (últimos ${talon[0].total} días): ${talon
                .filter((t) => t.fallos > 0)
                .map((t) => `${t.nombre.toLowerCase()} ×${t.fallos}`)
                .join(" · ")}</p>`
            : ""
        }
      </article>
    </div>
  `;

  pintarGraficas(pesos);
}

function pintarGraficas(pesos) {
  if (typeof Chart === "undefined") return;
  const linea = colorTema("--success", "#7a9b81");
  const rejilla = colorTema("--chart-rejilla", "rgba(233,238,234,0.06)");
  const eje = colorTema("--chart-eje", "#6d7a72");

  const canvasPeso = document.getElementById("chart-peso");
  if (chartPeso) {
    chartPeso.destroy();
    chartPeso = null;
  }
  if (canvasPeso && pesos.length >= 2) {
    const objetivo = Number(vida.sistema.peso_objetivo_kg ?? PESO_OBJETIVO_KG ?? 0);
    chartPeso = new Chart(canvasPeso, {
      type: "line",
      data: {
        labels: pesos.map((d) => d.id.slice(5)),
        datasets: [
          { label: "Peso", data: pesos.map((d) => Number(d.peso_kg)), borderColor: linea, tension: 0.3, pointRadius: 3 },
          ...(objetivo ? [{ label: "Objetivo", data: pesos.map(() => objetivo), borderColor: eje, borderDash: [6, 6], pointRadius: 0 }] : []),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { color: rejilla }, ticks: { color: eje } }, y: { grid: { color: rejilla }, ticks: { color: eje } } },
      },
    });
  }

  const canvasFuerza = document.getElementById("chart-fuerza");
  if (chartFuerza) {
    chartFuerza.destroy();
    chartFuerza = null;
  }
  if (canvasFuerza && ejercicioElegido) {
    const prog = progresionDe(ejercicioElegido);
    chartFuerza = new Chart(canvasFuerza, {
      type: "line",
      data: {
        labels: prog.map((p) => p.fecha.slice(5)),
        datasets: [{ label: "kg", data: prog.map((p) => p.peso), borderColor: linea, tension: 0.25, pointRadius: 3 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${prog[ctx.dataIndex].peso} kg × ${prog[ctx.dataIndex].reps}` } },
        },
        scales: { x: { grid: { color: rejilla }, ticks: { color: eje } }, y: { grid: { color: rejilla }, ticks: { color: eje } } },
      },
    });
  }
}
// vida:fin
