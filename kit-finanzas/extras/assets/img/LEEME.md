# Tus imágenes

Esta carpeta viene vacía a propósito. La app funciona perfectamente sin
ninguna foto: cada tema pinta su propio ambiente con colores y degradados.

Si quieres poner las tuyas, hay dos sitios donde se notan:

**El fondo de la pantalla de acceso.** Deja el archivo aquí y cambia en
`css/styles.css` la línea `--login-imagen: none;` por
`--login-imagen: url("../assets/img/tu-foto.jpg");`

**La foto de la tarjeta de arriba del Dashboard.** Igual, pero en
`css/temas.css`, dentro del tema que estés usando: `--hero-imagen`. Cada tema
tiene la suya, así que puedes poner una distinta para cada uno.

Si se lo pides al asistente, te lo deja puesto y encuadrado sin que toques
nada: "quiero esta foto en el Dashboard".

## Tamaños que van bien

| Para qué | Tamaño | Formato |
|---|---|---|
| Fondo de acceso | 1600 × 2400 px o más, vertical | `.jpg` |
| Tarjeta del Dashboard | 1400 × 900 px o más, horizontal | `.jpg` |

No hace falta que sean exactos: la app recorta y encuadra sola. Y conviene
que pesen menos de 500 KB cada una, porque se descargan cada vez que alguien
abre la web.

## Una advertencia

Si vas a publicar tu app en internet (GitHub Pages, tu dominio), las
imágenes que pongas aquí serán públicas para cualquiera que dé con la URL.
Usa fotos tuyas, o de bancos de imágenes gratuitos. Las de personajes de
películas, series o videojuegos tienen dueño: para tu uso personal en tu
ordenador no pasa nada, pero no las publiques ni las repartas.
