// Correcciones puntuales de datos: aquí, ninguna.
//
// En la app original este archivo tenía arreglos de un solo uso para los
// datos de una persona concreta ("a este préstamo le falta una fecha", "el
// gasto fijo de agosto se registró dos veces"). Eso no le sirve a nadie más,
// así que en la plantilla va vacío.
//
// No se borra el archivo porque el Dashboard lo importa: dejándolo con las
// mismas funciones sin nada dentro, el aviso correspondiente no aparece
// nunca y no hay que tocar el Dashboard. Si algún día necesitas arreglar
// algo raro de tus datos, este es el sitio: una función pendingX() que mira
// si hace falta, una applyX() que lo arregla y una dismissX() que esconde el
// aviso, y el Dashboard ya sabe pintarlo.

const nunca = () => false;
const nada = () => {};
const nadaAsync = async () => {};

export const pendingCorrections = nunca;
export const dismissCorrections = nada;
export const applyAugustCorrections = nadaAsync;

export const pendingPrestamosReset = nunca;
export const dismissPrestamosReset = nada;
export const resetPrestamos = nadaAsync;

export const pendingGastosFijosAgosto = nunca;
export const dismissGastosFijosAgosto = nada;
export const applyGastosFijosAgosto = nadaAsync;

export const pendingLizFecha = nunca;
export const dismissLizFecha = nada;
export const fixLizFecha = nadaAsync;

export const pendingPlanPagosAna = nunca;
export const dismissPlanPagosAna = nada;
export const activarPlanPagosAna = nadaAsync;
