# Los módulos: secciones que se añaden aparte

Un módulo es una sección entera de la app que no viene de serie. Se instala
con un comando, se quita con otro, y no deja restos: todo lo que añade queda
marcado en el código para poder recortarlo limpio.

```sh
node herramientas/instalar-modulo.mjs rutina         # instalar
node herramientas/instalar-modulo.mjs rutina quitar  # quitar
```

El instalador toca **siete** sitios distintos (los dos menús de `index.html`,
los dos de `demo.html`, el hueco de la sección, el router, la lista de datos
que escucha la app, los estilos y las reglas de la base de datos) y después
**comprueba** que todo cuadró. Si algo falla, lo dice y te pide que lo
quites, en vez de dejar la app a medio parchear.

**Después de instalar cualquier módulo hay que volver a publicar
`firestore.rules`** en Firebase. Si no, la sección se ve pero al guardar da
"sin permiso". Pásale tú el contenido del archivo y recuérdale el camino:
Firestore Database → Reglas → pegar → Publicar.

---

## `rutina` — los hábitos del día a día

Una lista de cosas que quiere hacer cada día, con un botón grande para
marcarlas, la racha de días seguidos y un calendario del mes.

Detalles que conviene saber para explicarlo:

- La racha **no se rompe porque hoy no esté marcado todavía**. A las nueve de
  la mañana nadie ha hecho aún lo del día, y ver un cero ahí desanima. Se
  cuenta desde ayer si hoy está en blanco.
- Se guarda una marca por día, no un contador. Por eso se puede desmarcar
  sin que se descuadre nada.
- Al quitar el módulo, **las marcas se quedan en la base de datos**. Si
  algún día lo vuelve a instalar, aparecen otra vez.

Cuando lo ofrezcas, no vendas productividad. Una frase basta: *"si quieres,
puedo añadirte una sección para las cosas que quieres hacer cada día, con su
calendario"*. Y si dice que no, no insistas.

---

## `ciclo` — el ciclo menstrual

Apuntar cuándo empieza y acaba la regla, ver la duración típica de sus
ciclos, la previsión de la siguiente y anotar cómo se sintió cada día.

### Cómo se ofrece

**Se ofrece, no se impone, y se dice una vez.** Algo así:

> Hay una sección más que puedo añadirte si te interesa: seguimiento del
> ciclo menstrual — cuándo empieza, cuánto dura, la previsión de la siguiente
> y cómo te sientes cada día. Es opcional y se puede quitar cuando quieras.
> ¿La quieres?

Sin rodeos y sin eufemismos, pero sin insistir. Si dice que no, se pasa al
siguiente punto y no se vuelve a mencionar.

Y **nunca lo des por hecho por el nombre de nadie**. Se ofrece a quien monta
la app, y punto: quien lo quiera lo dirá.

### Lo que hay que dejarle claro

Tres cosas, todas importantes, dichas en corto:

1. **Es suyo y solo suyo.** Va a su base de datos, detrás de su contraseña.
   No lo ve nadie más — ni tú, ni quien le pasó el kit. No sale de ahí.
2. **La previsión es una estimación.** Se calcula con la mediana de sus
   últimos ciclos, no con la media, precisamente para que un mes raro no la
   desvíe. Aun así es un cálculo, no una certeza.
3. **No es un consejo médico ni un método anticonceptivo.** La app lo dice
   en su propia pantalla, y tú no lo contradigas nunca. Si te pregunta algo
   de salud, la respuesta es que eso lo hable con su médica o su médico.

### Decisiones de la sección, por si pregunta

- **Con menos de tres ciclos apuntados no hay previsión.** Sale un "—" y un
  mensaje que lo explica. Un número sacado de un solo ciclo daría una falsa
  sensación de exactitud, y eso es peor que no dar nada.
- Los ciclos de menos de 15 días o más de 60 se ignoran en el cálculo:
  casi siempre es una fecha mal apuntada, y colarla estropearía la previsión
  de todo lo demás.
- Los días previstos salen **rayados** en el calendario, no rellenos, para
  que se distingan a simple vista de los que pasaron de verdad.

### Si le preocupa la privacidad

Es una preocupación razonable y muy común, así que no la despaches. Lo
concreto:

- Los datos están en **su** proyecto de Firebase, creado con **su** cuenta de
  Google. Nadie más tiene acceso.
- Las reglas solo dejan leer y escribir a quien ha iniciado sesión, y eso se
  comprueba con un comando antes de dar la app por lista.
- Si publica la app, **el código es público pero los datos no**.
- Y si algún día quiere borrarlo todo: quitar el módulo no borra los datos,
  eso se hace desde la consola de Firebase. Explícale dónde, si lo pide.

---

## Hacer un módulo nuevo

Si pide una sección que no existe —el gasto del coche, las plantas, lo que
sea— se puede hacer una. Se copia la forma de `modulos/rutina/`:

| Archivo | Qué es |
|---|---|
| `modulo.json` | El nombre de la vista y qué colecciones necesita |
| `nav.html` | El enlace del menú |
| `vista.html` | El hueco de la sección |
| `vista.js` | La sección: `mountX()` y `renderX(state)` |
| `estilos.css` | Sus estilos (opcional) |

Los `import` llevan `?v=[[V]]`: el instalador pone ahí la versión que tenga
la app. Y `renderX(state)` recibe el estado entero, así que puede leer
también los movimientos, las cuentas o lo que necesite.

Cuando lo tengas, **instálalo y pruébalo contra la demostración** antes de
decir que está: que la sección aparezca en los dos menús, que pinte, y que
el botón principal guarde de verdad. Un módulo que no se ha ejecutado no
está terminado.
