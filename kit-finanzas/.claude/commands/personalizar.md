---
description: Cambia los colores, el nombre, la foto o añade secciones nuevas a tu app
---

La app no tiene por qué quedarse como viene. Aquí se cambia lo que sea:
los colores, el nombre, la foto, las secciones. Todo lo de este comando se
puede hacer antes o después de montarla, y las veces que haga falta.

Empieza preguntando **una sola cosa**: qué le gustaría cambiar. Y si no lo
tiene claro, enséñale la lista de abajo — es mucho más fácil elegir de una
lista que imaginárselo en abstracto.

---

## Los colores

Hay ocho paletas de serie, sin ninguna temática: **Rosa, Lavanda, Menta,
Océano, Arena, Cereza, Bosque y Noche**. Se cambian desde la propia app
(icono de arriba a la derecha → Temas), así que lo más rápido es decirle que
las pruebe ella y se quede con la que le guste. Se cambia en un toque y se
ve al momento.

Si ninguna le encaja, **se le hace una con su color**:

```sh
node herramientas/gen-paletas.mjs "#c2185b" mio "El mío"
```

Le pides un color —el de una foto que le guste, el de su marca, "un rosa
como el de esta flor"— y ese comando calcula el tema entero a partir de él:
fondos, textos, gráficos, todo. Y **comprueba el contraste** antes de dártelo:
si con ese color el texto no se leería, lo dice y no lo genera. Después pegas
lo que salga en `mi-app/css/paletas.css` y añades el tema al catálogo de
`mi-app/js/tema.js`, junto a los demás.

También están los siete temas de personajes (One Piece y Kimetsu no Yaiba),
con sus animaciones al entrar. Vienen sin foto: si quiere una, se la pone
ella y se apunta en `--hero-imagen`.

## El nombre y el saludo

En `mi-app/index.html`: el `<title>`, las tres marcas del menú y el saludo
del Dashboard. Y en `mi-app/js/firebase-config.js` no hay que tocar nada.

Pregúntale cómo quiere que se llame y **cómo quiere que la salude**. Es un
detalle tonto y es lo primero que ve cada mañana.

## Las fotos

Dos sitios: el fondo de la pantalla de acceso (`--login-imagen` en
`css/styles.css`) y la foto de la tarjeta del Dashboard (`--hero-imagen` en
`css/temas.css`, dentro del tema que use). Deja el archivo en
`mi-app/assets/img/` y apunta la variable.

Si la foto queda mal encuadrada, se ajusta con `--hero-imagen-encuadre`
(dos porcentajes: horizontal y vertical) y `--hero-imagen-zoom`. Pruébalo y
enséñaselo: es más rápido que explicárselo.

**Avísale de una cosa**: si publica la app, esas fotos serán públicas para
quien dé con la dirección.

## Secciones nuevas (los módulos)

Están en `modulos/`. Cada uno se instala con un comando y se quita con otro:

```sh
node herramientas/instalar-modulo.mjs rutina
node herramientas/instalar-modulo.mjs rutina quitar
```

| Módulo | Qué añade |
|---|---|
| `rutina` | Los hábitos que quiere cumplir cada día, con racha y calendario del mes |
| `ciclo` | Seguimiento del ciclo menstrual: fechas, media de sus ciclos, previsión y cómo se sintió cada día |

Después de instalar uno hay que **volver a publicar `firestore.rules`** en
Firebase, o la sección nueva dirá "sin permiso" al guardar. El instalador lo
recuerda; recuérdaselo tú también, con el archivo delante.

Los detalles del módulo del ciclo, y cómo hablar de él, están en
`referencias/modulos.md`. Léelo antes de ofrecerlo.

## Quitar lo que le sobre

Si no presta dinero a nadie, la sección de Préstamos estorba. Se quitan los
dos enlaces del menú (escritorio y móvil) y su ruta de `js/app.js`. Los
archivos se quedan, por si algún día la quiere de vuelta.

Lo mismo con cualquier otra: pregúntale si hay algo que no vaya a usar.

## Y lo que no está en esta lista

Que sepa que **esto no es un menú cerrado**. Díselo tal cual:

> Y si quieres cualquier otra cosa que no esté aquí, me la dices con tus
> palabras y te la hago. "Quiero que los gastos de más de 100 € salgan en
> rojo", "quiero una sección para el gasto del coche", "quiero que la
> pantalla de inicio sea el calendario". No hace falta que sepas cómo se
> hace ni cómo se llama: cuéntamelo y ya está.

Eso es lo que de verdad diferencia esto de bajarse una app. Que lo sepa
desde el principio.
