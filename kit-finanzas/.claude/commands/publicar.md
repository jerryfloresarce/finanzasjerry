---
description: Sube la app a internet para poder abrirla desde el móvil
---

Publicas su app para que pueda abrirla desde cualquier sitio. La receta
completa, con las dos vías (la automática y la de clics) y lo del dominio
propio, está en `.claude/skills/montar-app-finanzas/referencias/publicar.md`.
Léela antes de empezar.

## 1 · Comprobar que hay algo que publicar

- Que `mi-app/` tenga la app montada.
- Que `mi-app/js/firebase-config.js` tenga valores de verdad y no los huecos
  de ejemplo. Si tiene huecos, **para**: publicaría una app que no funciona.
  Ofrécele terminar el montaje con `/mi-app`.
- Que **no** exista `mi-app/demo.html` ni `mi-app/js/demo/`. Si están,
  bórralos: son la demostración, y publicada solo confunde a quien entre.

## 2 · Contarle lo del repositorio público, antes de decidir

Con estas palabras o parecidas, y esperando su respuesta:

> Para que sea gratis, el código de tu app tiene que quedar público: quien dé
> con la dirección puede leerlo. **Tus movimientos no se ven** — esos están
> en Firebase, detrás de tu contraseña. Lo que queda a la vista es el código
> y el archivo de configuración, y esas claves no sirven para entrar sin tu
> contraseña.
>
> Si prefieres que no haya nada público, dejar la app solo en tu ordenador es
> igual de válido. Lo que pierdes es poder abrirla desde el móvil.

No sigas sin que conteste.

## 3 · Publicar

Mira si tiene `gh` y ha iniciado sesión (`gh auth status`):

- **Sí** → haces tú casi todo: `git init`, primer commit, `gh repo create
  --public --source=. --push` y activar Pages por API. Los comandos exactos
  están en la referencia.
- **No** → pásale la ruta de clics de la referencia. **No le pidas que abra
  una terminal ni que instale nada.**

## 4 · Comprobar que está de verdad

```sh
curl -s -o /dev/null -w "%{http_code}\n" "https://USUARIO.github.io/NOMBRE/"
```

`200` y listo. `404` la primera vez casi siempre es que aún está publicando:
espera un par de minutos y repite antes de tocar nada. Si sigue en 404,
comprueba que `index.html` está en la raíz del repositorio y no dentro de
una carpeta — es el fallo típico de subir arrastrando.

## 5 · El móvil

Termina siempre con esto, que es lo que quería de verdad:

> Abre esa dirección en el móvil. En iPhone con Safari: botón de compartir →
> **Añadir a pantalla de inicio**. En Android con Chrome: los tres puntos →
> **Instalar aplicación**. Te queda el icono y se abre a pantalla completa.

Y recuérdale que **no es una app de la App Store**: se usa igual, pero no
está en la tienda. Mejor decirlo ahora que dejar que lo descubra buscándola.
