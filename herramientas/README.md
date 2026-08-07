# Herramientas

Guiones que **generan** los dibujos que luego viven pegados dentro de
`css/temas.css`. No los ejecuta la app: se ejecutan a mano cuando hay que
retocar un dibujo, y su salida se copia al CSS.

Están aquí porque esos `url("data:image/svg+xml,…")` del CSS son ilegibles
—son cientos de coordenadas ya calculadas— y sin el guion que los produjo
no habría forma de tocar uno sin rehacerlo entero.

| Guion | Qué genera | Variables que produce |
| --- | --- | --- |
| `gen-svgs.mjs` | El relámpago de Zenitsu y el símbolo de escarcha de Akaza | `--rayo`, `--rayo-nucleo`, `--escarcha` |
| `gen-tajos.mjs` | Los tres tajos de Zoro y el aspa mellada de Inosuke | `--tajos`, `--aspa` |

```sh
node herramientas/gen-svgs.mjs     # deja variables.css y varias vistas previas
node herramientas/gen-tajos.mjs    # deja variables-tajos.css
```

Los dos escriben también un `previa-*.html` que se abre en el navegador para
ver el dibujo antes de meterlo en el CSS.

El relámpago sale de una semilla fija (`SEMILLA_RAYO`). Cambiándola sale
otro rayo distinto, igual de válido; se dejó la que mejor quedaba de una
tanda de diez, que se pueden comparar en `previa-rayos.html`.
