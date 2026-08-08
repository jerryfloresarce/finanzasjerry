---
description: Cambia lo que quieras de tu app contándomelo con tus palabras
---

Alguien quiere cambiar algo de su app. No hace falta que sepa cómo se llama
ni cómo se hace: lo cuenta con sus palabras y tú lo haces.

Esto es lo que de verdad distingue tener esta app de haberse bajado una del
móvil, así que **hazlo fácil y hazlo rápido**.

## Cómo se hace

1. **Entiende qué quiere ver**, no qué hay que programar. Si dice "quiero
   que se vea cuánto llevo gastado esta semana", lo que hay que averiguar es
   dónde quiere verlo y qué cuenta como semana — no si va en el Dashboard o
   en Gráficos.
2. **Si hay dudas, una sola pregunta.** No tres. Y si puedes deducirlo,
   dedúcelo y enséñaselo: es más rápido corregir algo que se ve que
   contestar preguntas en abstracto.
3. **Cámbialo solo en `mi-app/`.** La plantilla no se toca nunca.
4. **Enséñaselo funcionando.** Arranca el servidor, ábrele la página y que
   lo mire. Nada de "ya está hecho" sin que lo haya visto.
5. **Sube el número de versión** si tocaste `js/` o `css/`: los `?v=NN` de
   `index.html` y de los `import`. Sin eso, el navegador sigue enseñando lo
   viejo y parece que no has hecho nada.
6. Si su app está publicada, recuérdale que hay que volver a subirla para
   que el cambio llegue al móvil.

## Cosas que pide la gente, y dónde se tocan

| Lo que dice | Dónde se toca |
|---|---|
| "que los gastos grandes se vean en rojo" | la vista que los pinta, en `js/views/` |
| "quiero otro color" | `/personalizar`, apartado de colores |
| "que al abrir salga el calendario y no el resumen" | `DEFAULT_ROUTE` en `js/app.js` |
| "quítame la sección de préstamos" | los dos menús de `index.html` y su ruta en `js/app.js` |
| "quiero una sección para el coche" | un módulo nuevo: `referencias/modulos.md` |
| "que me avise cuando pase de X" | la vista del Dashboard, donde se pintan los límites |
| "en dólares, no en euros" | `formatEUR` en `js/db.js` |
| "que salga mi foto arriba" | `/personalizar`, apartado de fotos |

Y si lo que pide no está en esta lista, se hace igual. La lista es para ir
rápido, no para limitar.

## Lo que no se hace sin avisar

- **Nada que borre sus datos** sin preguntarlo dos veces y explicar qué se
  pierde exactamente.
- **Nada que toque las reglas de seguridad** sin explicar qué cambia y quién
  podría ver sus datos después.
- Si lo que pide rompería algo que ya usa, díselo antes de hacerlo. En una
  frase, sin sermón, y ofrécele la alternativa.

## Y díselo

Cuando termines, recuérdaselo una vez:

> Cualquier cosa que se te ocurra, me la dices y te la hago. No hace falta
> que sepas cómo se llama ni si "se puede": cuéntamelo y lo vemos.
