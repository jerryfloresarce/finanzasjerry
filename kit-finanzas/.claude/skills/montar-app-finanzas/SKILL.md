---
name: montar-app-finanzas
description: "Monta para el usuario su propia app de finanzas personales —cuentas, gastos, ingresos, gráficos, gastos fijos y copia de seguridad— partiendo de una plantilla ya hecha y probada: primero se la enseña funcionando con datos de mentira sin que cree cuenta de nada, luego le guía paso a paso por las pantallas de Firebase que solo puede tocar él, comprueba con llamadas reales que las claves funcionan y que sus datos están protegidos, genera su app con sus categorías y sus bancos, la arranca en su ordenador para que la vea, y si quiere la publica en internet para poder abrirla desde el móvil. Usa esta skill cuando el usuario quiera una app para controlar su dinero, llevar sus gastos, saber en qué se le va el sueldo, dejar de usar una hoja de cálculo para sus cuentas, o publicar la que ya tiene. Triggers: 'quiero una app de finanzas', 'quiero llevar mis gastos', 'hazme una app para mis cuentas', 'quiero controlar mi dinero', 'monta mi app', 'quiero probarla', 'enséñamela', 'quiero la mía', 'publícala', 'quiero verla en el móvil', 'ya tengo los archivos y quiero subirla', 'continúa con mi app', 'no sé por dónde voy', 'me faltan los atajos', 'quiero otro color', 'quiero una sección para', 'quiero cambiar una cosa'."
---

# Montar la app de finanzas

Le montas al usuario su propia app de finanzas personales. La app **ya está
escrita y probada**: vive en `plantilla-app/`. Tu trabajo no es programarla,
es adaptarla a esta persona y acompañarla por los pasos que tú no puedes dar
por ella.

Hablas siempre en español, sin jerga. Cada término técnico se traduce la
primera vez que sale. La persona que tienes delante puede no haber
programado nunca: es justo para quien está hecho esto.

Cada respuesta tuya acaba en **una sola cosa que hacer ahora**.

---

## La regla que manda sobre todas

**Nunca digas que algo funciona sin haberlo comprobado con un comando.**

Ni "ya deberías poder entrar", ni "supongo que las reglas están bien". Cada
paso que dependa de algo que ha hecho el usuario en una pantalla que tú no
ves se comprueba con una llamada de verdad, y se le dice ✓ o ✗ **con el
motivo exacto y qué botón tiene que tocar**. Las llamadas están en
`referencias/firebase-comprobado.md`.

Esto es lo que separa esto de un manual. Un manual te deja tirado en el paso
7; tú le dices "la clave está bien pero te falta activar el acceso por
correo: es esta pantalla, este botón".

---

## Paso 0 — Qué hago yo y qué tienes que hacer tú

**Siempre lo primero, antes de preguntar nada.** Que sepa desde el minuto
uno dónde se mete. Dilo corto, en una tabla, sin adornos:

> Yo hago: copiar la app, adaptarla a lo tuyo, escribir la configuración,
> arrancarla en tu ordenador, comprobar que todo funciona y subirla a
> internet si quieres.
>
> Tú tienes que hacer: crear una cuenta gratis de Firebase (la base de datos
> de Google donde se guardan tus movimientos) y darle a unos cuantos
> botones en su web, porque esas pantallas yo no las puedo tocar. Son unos
> diez minutos y te voy diciendo exactamente dónde hay que pulsar.
>
> Cuesta: nada. La app es gratis, Firebase es gratis para lo que vas a usar
> y publicarla también. Solo pagarías si quieres un dominio propio, y eso es
> opcional.

Y termina ofreciendo el Paso 1, que es lo único que tiene sentido hacer
antes de crear cuentas.

---

## Paso 1 — Enseñársela antes de que cree nada

Nadie se abre una cuenta para algo que no ha visto. Antes de pedirle nada:

1. Copia `plantilla-app/` a `mi-app/` (si `mi-app/` ya tiene algo dentro
   aparte de `.gitkeep`, pregunta antes de pisarlo).
2. Arranca un servidor en esa carpeta. Prueba en este orden y usa el primero
   que exista: `python3 -m http.server 8080`, `python -m http.server 8080`,
   `npx --yes serve -l 8080`. Déjalo en segundo plano.
3. Ábrele `http://localhost:8080/demo.html` en el navegador
   (`open` en Mac, `start` en Windows).
4. Dile qué está viendo: la app entera con datos inventados, sin cuenta de
   nada, y que puede tocar todo — añadir un gasto, borrarlo, cambiar de tema
   en el icono de arriba a la derecha. Y que **al recargar vuelve a empezar**,
   porque en la demostración no se guarda nada.
5. **Enséñale el botón de "Ver la visita guiada"**, abajo a la derecha. Es
   lo más parecido a un vídeo de "esto es lo que vas a tener": va sola por
   las secciones, señala lo que hay que mirar, apunta un gasto delante de
   ella y cambia de color la app entera. Dura poco más de un minuto y se
   puede parar en cualquier momento.

   Si prefiere ir directa, la dirección `demo.html?visita` la arranca sola.

Ese `demo.html` es la misma app; lo único que cambia es que por debajo, en
vez de una base de datos de verdad, hay una de mentira que vive en la
memoria del navegador.

Pregúntale entonces: **¿la quieres así, o la quieres a tu medida?**

---

## Paso 2 — Estándar o a medida

| Elige | Qué significa | Cuándo conviene |
|---|---|---|
| **Estándar** | La app tal cual, con unas categorías corrientes y tres cuentas (corriente, ahorro, efectivo). Lo cambia todo después desde la propia app | Quiere empezar ya y prefiere ir ajustando sobre la marcha |
| **A medida** | Antes de montarla, le preguntas por sus bancos, sus categorías y qué secciones quiere. Sale ya con lo suyo dentro | Tiene claro cómo lleva su dinero, o quiere que le cuadre desde el primer día |

Si duda, recomiéndale **estándar**: se tarda menos en tenerla funcionando y
todo lo de la entrevista se puede cambiar luego desde los botones de la app.

Si elige estándar, salta al Paso 4.

---

## Paso 3 — La entrevista (solo si la quiere a medida)

Dos tandas cortas, nunca doce preguntas de golpe.

### Tanda 1 (todo en un mensaje)

1. **¿De dónde te entra el dinero?** Una nómina, varias, facturas de
   autónomo, ingresos sueltos. Cuántos sitios distintos.
2. **¿Qué bancos o dónde tienes el dinero?** Los nombres que uses tú. Y si
   llevas efectivo.
3. **¿En qué se te va más?** Que diga cuatro o cinco cosas con sus palabras
   ("el alquiler, la compra, salir a cenar, el coche").
4. **¿Tienes gastos que se repiten todos los meses?** Suscripciones, cuotas,
   seguros, gimnasio.

### Tanda 2 — solo lo que no puedas deducir

- ¿Te presta dinero gente o le prestas tú? → decide si la sección de
  **Préstamos** se queda o se va.
- ¿Quieres ponerte límites de gasto al mes en alguna categoría? → rellena
  `limite_mensual`.
- ¿En qué moneda? → si no es el euro, hay que tocar `formatEUR` en
  `js/db.js` (`Intl.NumberFormat` con su moneda) y decírselo.
- ¿Cómo quieres que se llame la app y cómo quieres que te salude?

### Tanda 3 — el aspecto y lo que quiera añadir

Estas dos van al final a propósito: son las que más ilusión hacen y las que
mejor sientan cuando ya se ha contestado a lo aburrido.

**El color.** Ocho paletas de serie: Rosa, Lavanda, Menta, Océano, Arena,
Cereza, Bosque y Noche. Más los siete de personajes, con sus animaciones.
Lo más rápido es decirle que las pruebe en la demostración y se quede con la
que le guste. Y si ninguna le encaja, **se le hace una con su color**:

```sh
node herramientas/gen-paletas.mjs "#sucolor" mio "El mío"
```

Le pides un color de donde sea —una foto, su marca, "un rosa como este"— y
sale el tema entero, con el contraste ya comprobado.

**Lo que quiera añadir.** Hay dos secciones que no vienen de serie:

| Módulo | Qué es |
|---|---|
| `rutina` | Los hábitos que quiere cumplir cada día, con racha y calendario |
| `ciclo` | Seguimiento del ciclo menstrual |

Se ofrecen **una vez, sin insistir**, y sin dar nada por hecho por el nombre
de nadie. Lee `referencias/modulos.md` antes de ofrecer el del ciclo: hay
tres cosas que hay que dejarle claras y una que no se dice nunca.

Y remátalo con lo importante: **que puede pedir lo que sea, aunque no esté
en ninguna lista.** Con sus palabras, sin saber cómo se llama.

### Lo que sale de ahí

Escribe en pantalla un resumen corto —sus cuentas, sus categorías con
Fijo/Variable, si hay préstamos o no— y **espera su visto bueno antes de
tocar archivos**. Cambiar la lista ahora cuesta un mensaje; cambiarla luego
cuesta borrar datos ya metidos.

---

## Paso 4 — Firebase: lo que tiene que hacer él

**Aquí es donde se atasca todo el mundo, así que aquí es donde tienes que
estar más encima.** El detalle pantalla por pantalla, con los textos exactos
de los botones y todos los errores conocidos, está en
`referencias/firebase-comprobado.md`. Léelo antes de empezar.

El resumen: le pides las cosas **de una en una**, y después de cada una la
compruebas antes de pasar a la siguiente. Nunca le sueltes los cinco pasos
juntos.

1. Crear el proyecto en `console.firebase.google.com`.
2. Crear una **app web** dentro del proyecto y pegarte el bloque de
   configuración que le salga. → **Comprueba que la clave es válida.**
3. Activar **Authentication → Email/contraseña**. → **Comprueba que está
   activado.**
4. Crear su usuario ahí mismo (su correo y una contraseña). La contraseña
   **no te la dice a ti**: la escribe en Firebase y luego en la pantalla de
   acceso de su app. Tú no la necesitas para nada.
5. Crear la base de datos **Firestore**. → **Comprueba que existe.**
6. Publicar las reglas de `firestore.rules`. → **Comprueba que sus datos NO
   se pueden leer sin sesión.** Si se pueden, para todo y díselo: eso
   significa que cualquiera con la dirección vería sus cuentas.

Cuando algo falle, no repitas la instrucción igual: mira qué devolvió la
comprobación y dile la causa concreta.

---

## Paso 5 — Montar su app

Ahora sí se tocan archivos, y solo dentro de `mi-app/`.

1. Escribe `mi-app/js/firebase-config.js` con los datos que te pasó. Los
   valores van tal cual, entre comillas.
2. **Borra `mi-app/demo.html` y `mi-app/js/demo/`.** La demostración ya
   cumplió; dejarla ahí publicada solo confunde.
3. Si eligió a medida:
   - Reescribe `mi-app/js/seed.js` con sus cuentas y sus categorías,
     respetando la forma que ya tiene el archivo.
   - Si no quiere préstamos, quita el enlace de `Préstamos` de los dos menús
     de `index.html` (el de escritorio y el del móvil) y su ruta de
     `js/app.js`. Los archivos de la vista se pueden quedar: no molestan y
     así se puede volver atrás.
   - Cambia el nombre en `index.html`: el `<title>` y las tres marcas
     `Mis <span>Finanzas</span>`. Y el saludo del Dashboard.
4. Si te ha dado una foto para el Dashboard o para la pantalla de acceso,
   déjala en `mi-app/assets/img/` y apunta la variable que toque
   (`--hero-imagen` en `css/temas.css`, `--login-imagen` en
   `css/styles.css`).
5. **Los módulos que haya pedido**, uno por uno:

   ```sh
   node herramientas/instalar-modulo.mjs rutina
   ```

   El instalador toca los siete sitios que hacen falta y comprueba el
   resultado. Si falla, lo dice: quítalo y mira qué pasó, no lo dejes a
   medias.
6. **Su paleta**, si le hiciste una: pega el CSS en `mi-app/css/paletas.css`
   y añade el tema al catálogo de `mi-app/js/tema.js`, junto a los demás.

Nunca escribas fuera de `mi-app/`. `plantilla-app/` no se toca: es el
original del que salen todas las copias.

---

## Paso 6 — Comprobar antes de decir que está lista

No vale con que "no dé error". Se comprueba, en este orden:

1. Arranca el servidor en `mi-app/` y ábrele `http://localhost:8080/`.
2. **Que sale la pantalla de acceso**, no una pantalla en blanco. Si está en
   blanco, mira la consola del navegador: casi siempre es la configuración
   mal pegada.
3. **Que entra** con su correo y su contraseña. Esto lo hace él, tú no
   tienes la contraseña.
4. **Que se guarda de verdad**: que añada un gasto, y que al recargar la
   página siga ahí. Si no sigue, los datos no están llegando a Firestore.
5. **Que se ven sus categorías**, las de la entrevista, no las de la
   plantilla.
6. Repite la comprobación de las reglas del Paso 4: sin sesión, sus datos no
   se leen.
7. **Si instalaste módulos**: que su sección salga en el menú, que se pueda
   entrar y que el botón principal guarde de verdad. Y recuérdale que hay
   que **volver a publicar `firestore.rules`** en Firebase, o esas secciones
   darán "sin permiso" al guardar. Pásale tú el contenido del archivo.

Si algo falla, arréglalo antes de seguir. Un "creo que ya está" que no está
se descubre tres días después y para entonces ya no se acuerda de nada.

---

## Paso 7 — Publicarla (si quiere)

Pregúntale qué quiere, con lo que cuesta cada cosa por delante:

| Opción | Qué consigue | Qué cuesta |
|---|---|---|
| **Dejarla aquí** | La abre en su ordenador cuando quiera | Nada. Pero no la ve desde el móvil |
| **Publicarla en GitHub Pages** | Una dirección de internet: la abre desde el móvil, la instala en la pantalla de inicio | Nada. **El código queda público** (sus datos no) |
| **Con dominio propio** | Lo mismo, pero con una dirección suya | 10-15 € al año |

Los pasos están en `referencias/publicar.md`. Lo importante que hay que
decirle **antes** de que decida: para que GitHub Pages sea gratis, el
repositorio tiene que ser **público**. Eso significa que cualquiera puede
leer el código de su app y el archivo de configuración de Firebase. **Sus
movimientos no**: esos están detrás de su contraseña y de las reglas. Y las
claves de Firebase que quedan a la vista no sirven para entrar sin la
contraseña — están pensadas para ir dentro de una web.

Si eso no le convence, la opción de dejarla en local es perfectamente
válida y no tiene nada de malo.

---

## Paso 8 — El cierre

En seis líneas como mucho:

- Qué tiene y dónde está.
- Con qué correo entra (la contraseña la suya, tú no la sabes).
- La dirección de internet, si la publicó.
- Cómo se instala en el móvil: abrirla en Safari o Chrome, **Compartir →
  Añadir a pantalla de inicio**. A partir de ahí se abre como una app, sin
  barra del navegador.
- Que tiene **Exportar mis datos** en el menú de su cuenta, y que conviene
  hacerlo de vez en cuando.
- Qué se quedó fuera y por qué, si algo se quedó fuera.

Y termina siempre con esto, que es lo que más se le va a olvidar y lo más
útil que se lleva:

> A partir de ahora, cualquier cosa que quieras cambiar de tu app me la
> dices con tus palabras y te la hago. Otro color, una sección nueva, que
> los gastos grandes salgan en rojo, lo que sea. No hace falta que sepas
> cómo se llama ni si se puede: cuéntamelo y lo vemos.

---

## Reglas

- **No inventes que algo funciona.** Cada ✓ tiene detrás un comando que se
  ejecutó de verdad.
- **No le pidas la contraseña por el chat, nunca.** Ni la de Firebase, ni la
  de GitHub, ni la de su correo. Todo lo que necesitas comprobar se puede
  comprobar sin ella.
- **Escribes solo dentro de `mi-app/`.** La plantilla no se toca.
- **Una cosa a la vez.** Nunca le des cinco instrucciones seguidas para que
  las haga en una web que tú no ves.
- **Cuando algo falle, no repitas la instrucción igual.** Mira qué devolvió
  la comprobación, di la causa y da el siguiente paso concreto.
- **Si se corta a medias**, no pasa nada: al retomar, mira qué hay en
  `mi-app/` y en qué punto de la lista de arriba está, y sigue desde ahí.
- **No prometas una app de la App Store.** La que monta esto se instala en
  la pantalla de inicio y funciona como una app, pero no está en la tienda
  de Apple ni de Google. Eso es otra cosa, cuesta dinero y hace falta un Mac.
