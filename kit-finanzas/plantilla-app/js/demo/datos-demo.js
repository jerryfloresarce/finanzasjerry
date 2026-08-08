// Los datos de mentira de la demostración.
//
// Todo lo de aquí está inventado: no es de ninguna persona real. Se genera
// a partir del día de hoy, así que la demostración siempre enseña "este mes"
// y "el mes pasado" con datos frescos, en vez de un histórico de hace dos
// años que daría sensación de app abandonada.
//
// Los importes salen de un generador con semilla fija: parecen aleatorios
// pero son siempre los mismos, para que dos personas que abran la
// demostración vean exactamente lo mismo y se pueda hablar de ella.

function aleatorio(semilla) {
  let a = semilla;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const marcaDeTiempo = (fecha) => ({ toDate: () => fecha });

function diasAtras(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

const iso = (fecha) => fecha.toISOString().slice(0, 10);

export function datosDeDemostracion() {
  const rnd = aleatorio(2026);
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  const inicio = iso(diasAtras(120));

  const cuentas = [
    { id: "c1", nombre: "Cuenta corriente", tipo: "Corriente", saldo_inicial: 1240.5, fecha_inicio: inicio, activa: true },
    { id: "c2", nombre: "Ahorro", tipo: "Ahorro", saldo_inicial: 3800, fecha_inicio: inicio, activa: true },
    { id: "c3", nombre: "Efectivo", tipo: "Efectivo", saldo_inicial: 120, fecha_inicio: inicio, activa: true },
  ];

  const categorias = [
    { id: "k1", nombre: "Vivienda", tipo: "Fijo", limite_mensual: null },
    { id: "k2", nombre: "Suministros y facturas", tipo: "Fijo", limite_mensual: null },
    { id: "k3", nombre: "Suscripciones digitales", tipo: "Fijo", limite_mensual: 60 },
    { id: "k4", nombre: "Transporte", tipo: "Fijo", limite_mensual: null },
    { id: "k5", nombre: "Compra del súper", tipo: "Variable", limite_mensual: 400 },
    { id: "k6", nombre: "Comer fuera", tipo: "Variable", limite_mensual: 150 },
    { id: "k7", nombre: "Ocio", tipo: "Variable", limite_mensual: 120 },
    { id: "k8", nombre: "Salud", tipo: "Variable", limite_mensual: null },
    { id: "k9", nombre: "Nómina", tipo: "Fijo", limite_mensual: null },
  ];

  // Cada gasto de mentira: categoría, dónde se hizo, y entre cuánto y cuánto
  // suele costar. Los sitios son nombres corrientes, no marcas concretas.
  const GASTOS = [
    ["k5", "Supermercado del barrio", 18, 74],
    ["k5", "Frutería", 6, 19],
    ["k6", "Bar de la esquina", 9, 32],
    ["k6", "Comida a domicilio", 12, 28],
    ["k7", "Cine", 8, 22],
    ["k7", "Librería", 11, 34],
    ["k4", "Abono de transporte", 20, 20],
    ["k8", "Farmacia", 5, 24],
    ["k2", "Luz", 42, 78],
    ["k2", "Internet y móvil", 39, 39],
  ];

  const movimientos = [];
  let n = 0;
  const nuevoId = () => `m${++n}`;

  // Cuatro meses de nóminas y de alquiler, para que los gráficos por meses
  // tengan de dónde tirar.
  for (let mes = 3; mes >= 0; mes--) {
    const paga = new Date(hoy.getFullYear(), hoy.getMonth() - mes, 1, 12);
    if (paga <= hoy) {
      movimientos.push({
        id: nuevoId(),
        tipo: "Ingreso",
        importe: 1850,
        categoria_id: "k9",
        cuenta_id: "c1",
        subcategoria: "",
        nota: "Nómina",
        fecha: marcaDeTiempo(paga),
      });
      movimientos.push({
        id: nuevoId(),
        tipo: "Gasto",
        importe: 690,
        categoria_id: "k1",
        cuenta_id: "c1",
        subcategoria: "Alquiler",
        nota: "Alquiler del piso",
        fecha: marcaDeTiempo(new Date(paga.getFullYear(), paga.getMonth(), 3, 12)),
      });
    }
  }

  // Y el día a día de los últimos cuatro meses.
  for (let dia = 118; dia >= 0; dia--) {
    if (rnd() > 0.42) continue;
    const [categoria_id, subcategoria, min, max] = GASTOS[Math.floor(rnd() * GASTOS.length)];
    const importe = Math.round((min + rnd() * (max - min)) * 100) / 100;
    movimientos.push({
      id: nuevoId(),
      tipo: "Gasto",
      importe,
      categoria_id,
      cuenta_id: rnd() > 0.82 ? "c3" : "c1",
      subcategoria,
      nota: "",
      fecha: marcaDeTiempo(diasAtras(dia)),
    });
  }

  // Dos traspasos al mes: uno al ahorro y una retirada de efectivo. Sirven
  // para enseñar que una transferencia mueve dinero entre cuentas propias y
  // no cuenta como gasto — y de paso el efectivo no se queda en negativo,
  // que es lo que pasaba antes de meter la retirada: los gastos en metálico
  // se comían los 120 € del principio y el saldo salía en rojo, con pinta de
  // fallo de la app cuando era un fallo de estos datos de mentira.
  const TRASPASOS = [
    { destino: "c2", importe: 200, dia: 5, nota: "Al ahorro" },
    { destino: "c3", importe: 150, dia: 6, nota: "Sacar efectivo" },
  ];
  for (let mes = 3; mes >= 0; mes--) {
    for (const t of TRASPASOS) {
      const cuando = new Date(hoy.getFullYear(), hoy.getMonth() - mes, t.dia, 12);
      if (cuando > hoy) continue;
      movimientos.push({
        id: nuevoId(),
        tipo: "Transferencia",
        importe: t.importe,
        cuenta_id: "c1",
        cuenta_destino_id: t.destino,
        categoria_id: null,
        subcategoria: "",
        nota: t.nota,
        fecha: marcaDeTiempo(cuando),
      });
    }
  }

  const suscripciones = [
    { id: "s1", nombre: "Plataforma de series", precio: 12.99, frecuencia: "Mensual", categoria_id: "k3", cuenta_id: "c1", activa: true },
    { id: "s2", nombre: "Música", precio: 10.99, frecuencia: "Mensual", categoria_id: "k3", cuenta_id: "c1", activa: true },
    { id: "s3", nombre: "Gimnasio", precio: 29.9, frecuencia: "Mensual", categoria_id: "k7", cuenta_id: "c1", activa: true },
    { id: "s4", nombre: "Seguro del hogar", precio: 148, frecuencia: "Anual", categoria_id: "k1", cuenta_id: "c1", activa: true },
  ];

  // Dos préstamos, para que se vea la sección. Si te sobra, se quita entera
  // y la app funciona igual.
  const prestamos = [
    {
      id: "p1",
      persona: "Un amigo",
      capital: 300,
      interes_porcentaje: 0,
      fecha_interes: iso(diasAtras(-25)),
      estado: "Activo",
      notas: "Sin intereses, me lo devuelve cuando pueda.",
    },
    {
      id: "p2",
      persona: "Mi hermana",
      capital: 150,
      interes_porcentaje: 0,
      fecha_interes: iso(diasAtras(-10)),
      estado: "Activo",
      notas: "",
    },
  ];

  // ---- Datos de los módulos que se pueden añadir aparte (rutina, ciclo).
  // Van siempre: si el módulo no está instalado, la app ni los mira; y si
  // está, la demostración lo enseña lleno en vez de vacío, que es lo que
  // permite entender de un vistazo para qué sirve.

  const habitos = [
    { id: "h1", nombre: "Beber 2 litros de agua", icono: "💧" },
    { id: "h2", nombre: "Moverme 30 minutos", icono: "🏃" },
    { id: "h3", nombre: "Leer antes de dormir", icono: "📖" },
  ];

  // Rachas distintas a propósito: una larga, una a medias y una floja. Con
  // las tres iguales no se entendería qué hace el calendario.
  const constancia = { h1: 0.92, h2: 0.6, h3: 0.35 };
  const habitos_hechos = [];
  let idHecho = 0;
  habitos.forEach((h) => {
    for (let dia = 45; dia >= 0; dia--) {
      // Los últimos días del más constante se marcan siempre, para que la
      // racha que sale en pantalla sea visible y no dependa del azar.
      const seguro = h.id === "h1" && dia <= 11;
      if (!seguro && rnd() > constancia[h.id]) continue;
      habitos_hechos.push({ id: `hh${++idHecho}`, habito_id: h.id, fecha: iso(diasAtras(dia)) });
    }
  });

  // Cuatro ciclos de duración parecida pero no idéntica: suficiente para que
  // haya previsión (hacen falta tres) y realista, porque no hay dos meses
  // exactamente iguales.
  const ciclos = [];
  const cicloNotas = [];
  let atras = 96;
  [29, 28, 30].forEach((duracion, i) => {
    ciclos.push({
      id: `cc${i + 1}`,
      inicio: iso(diasAtras(atras)),
      fin: iso(diasAtras(atras - 4)),
    });
    atras -= duracion;
  });
  ciclos.push({ id: "cc4", inicio: iso(diasAtras(atras)), fin: iso(diasAtras(Math.max(atras - 4, 0))) });
  cicloNotas.push(
    { id: "cn1", fecha: iso(diasAtras(atras)), sensaciones: ["Dolor", "Cansada"], texto: "" },
    { id: "cn2", fecha: iso(diasAtras(Math.max(atras - 2, 0))), sensaciones: ["Bien"], texto: "Mucho mejor hoy" }
  );

  return {
    cuentas,
    categorias,
    movimientos,
    suscripciones,
    prestamos,
    pagos_prestamos: [],
    configuracion: [{ id: "app", tema: "original" }],
    habitos,
    habitos_hechos,
    ciclos,
    ciclo_notas: cicloNotas,
  };
}
