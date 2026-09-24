// Qué avisos tienen que sonar en el móvil y cuándo, calculados a partir de
// los datos de la app. Es una función pura: recibe los datos y las utilidades
// que necesita, y devuelve la lista. Así se prueba en Node sin navegador ni
// Firebase, y el servidor de avisos no tiene que saber nada de préstamos.
//
// Cada aviso: { id, cuando (ISO con zona), titulo, cuerpo, url }. El id es
// estable y lleva la fecha: si algo cambia de hora, cambia el id, y el
// servidor sustituye la lista entera en cada sincronización.

const DIAS_HORIZONTE = 30;
const HORA_COBROS = 9; // los cobros y las suscripciones avisan a las 9:00
const HORA_INNEGOCIABLES = 21; // igual que el aviso dentro de la app

const dosDigitos = (n) => String(n).padStart(2, "0");
const fechaLocalISO = (d) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
const aLasHoras = (fechaISO, h, m = 0) => new Date(`${fechaISO}T${dosDigitos(h)}:${dosDigitos(m)}:00`);
const slug = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);

export function calcularAvisos({ state, vida, bloquesDelDia, esCumplido, diaPorFecha, formatEUR, fromTimestamp, ahora = new Date(), avisosCobroActivos = true }) {
  const avisos = [];
  const limite = new Date(ahora.getTime() + DIAS_HORIZONTE * 86400000);
  const hoyISO = fechaLocalISO(ahora);
  const dentroDePlazo = (d) => d > ahora && d <= limite;
  const anadir = (id, cuando, titulo, cuerpo, url) => {
    if (!dentroDePlazo(cuando)) return;
    avisos.push({ id, cuando: cuando.toISOString(), titulo, cuerpo, url });
  };

  // ---- Cobros de préstamos: el día que toca, a las 9:00 ----
  if (avisosCobroActivos && state) {
    for (const p of state.prestamos ?? []) {
      if (p.estado === "Pagado") continue;
      const capital = Number(p.capital ?? p.capital_inicial ?? 0);
      const interes = p.interes_manual != null && p.interes_manual !== "" ? Number(p.interes_manual) : Math.round(capital * (Number(p.interes_porcentaje ?? 0) / 100) * 100) / 100;
      const pendiente = Math.max(0, Math.round((capital + interes - Number(p.pagado ?? 0)) * 100) / 100);
      const esPlan = p.tipo === "plan" || p.modo === "plan_pagos" || p.plan_pagos === true;
      if (esPlan) {
        // Los días del plan que están por venir y sin pagar.
        for (const pg of state.pagosPrestamos ?? []) {
          if (pg.prestamo_id !== p.id || pg.pagado) continue;
          const f = fromTimestamp(pg.fecha);
          if (!f) continue;
          const fISO = fechaLocalISO(f);
          anadir(`plan_${p.id}_${fISO}`, aLasHoras(fISO, HORA_COBROS), `💰 Hoy toca la cuota de ${p.persona}`, pg.importe ? `${formatEUR(Number(pg.importe))} del plan de pagos` : "Su cuota del plan de pagos", "./#/prestamos");
        }
        continue;
      }
      if (!p.fecha_interes) continue;
      anadir(
        `cobro_${p.id}_${p.fecha_interes}`,
        aLasHoras(p.fecha_interes, HORA_COBROS),
        `💰 A ${p.persona} le toca pagarte hoy`,
        pendiente > 0 ? `Te debe ${formatEUR(pendiente)}` : "Toca cobrar",
        "./#/prestamos"
      );
    }
  }

  // ---- Suscripciones: el día antes del próximo pago, a las 9:00 ----
  for (const s of state?.suscripciones ?? []) {
    if (s.activa === false || !s.proximo_pago) continue;
    const pago = new Date(`${String(s.proximo_pago).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(pago.getTime())) continue;
    const vispera = new Date(pago.getTime() - 86400000);
    anadir(`susc_${s.id}_${String(s.proximo_pago).slice(0, 10)}`, aLasHoras(fechaLocalISO(vispera), HORA_COBROS), `Mañana se cobra ${s.nombre}`, [s.precio != null ? formatEUR(Number(s.precio)) : "", s.frecuencia || ""].filter(Boolean).join(" · "), "./#/suscripciones");
  }

  // ---- Agenda: solo las citas (lo que se añade a mano), no la rutina ----
  if (typeof bloquesDelDia === "function") {
    for (let i = 0; i < DIAS_HORIZONTE; i++) {
      const dia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + i, 12);
      const dISO = fechaLocalISO(dia);
      let bloques = [];
      try {
        bloques = bloquesDelDia(dia) || [];
      } catch {
        bloques = [];
      }
      for (const b of bloques) {
        if (!b?.cita || b.hecho || !/^\d{1,2}:\d{2}$/.test(b.h || "")) continue;
        const [h, m] = b.h.split(":").map(Number);
        anadir(`cita_${dISO}_${b.h.replace(":", "")}_${slug(b.titulo)}`, aLasHoras(dISO, h, m), b.titulo || "Cita", `Hoy a las ${b.h}${b.detalle ? ` · ${b.detalle}` : ""}`, "./#/agenda");
      }
    }
  }

  // ---- Innegociables: a las 21:00 si aún queda alguno, cada día ----
  if (vida && vida.sistema?.aviso_innegociables !== false && typeof esCumplido === "function") {
    for (let i = 0; i < DIAS_HORIZONTE; i++) {
      const dia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + i, 12);
      const dISO = fechaLocalISO(dia);
      // El de hoy solo si todavía falta alguno por marcar.
      if (dISO === hoyISO && typeof diaPorFecha === "function" && esCumplido(diaPorFecha(dISO)?.innegociables)) continue;
      anadir(`innegociables_${dISO}`, aLasHoras(dISO, HORA_INNEGOCIABLES), "Tus innegociables de hoy", "Te falta alguno por marcar. ¿Cómo va el día?", "./#/hoy");
    }
  }

  avisos.sort((a, b) => a.cuando.localeCompare(b.cuando));
  return avisos.slice(0, 400);
}

// Una huella de la lista para no volver a mandarla si no ha cambiado.
export function huellaDeAvisos(avisos) {
  let h = 0;
  const texto = avisos.map((a) => `${a.id}|${a.cuando}|${a.titulo}|${a.cuerpo}`).join("\n");
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  return `${avisos.length}:${h.toString(16)}`;
}
