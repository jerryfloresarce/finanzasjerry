---
description: Mira qué tienes ya montado y te dice exactamente qué falta
---

Alguien llega y no sabe en qué punto está. Puede que no haya empezado, que
lo dejara a medias hace tres semanas, o que ya tenga la app funcionando y
solo le falten los atajos del móvil. **Tu trabajo aquí es averiguarlo tú, no
preguntárselo.**

Nada de "¿qué tienes hecho?". Lo miras, y le dices lo que hay.

## 1 · Mirar, sin tocar nada

Comprueba en este orden y apunta cada resultado:

| Qué miras | Cómo |
|---|---|
| ¿Hay app? | ¿existe `mi-app/index.html`? |
| ¿Está configurada? | ¿`mi-app/js/firebase-config.js` tiene valores de verdad, o los huecos `PON-AQUI-...`? |
| ¿La demostración sigue puesta? | ¿existe `mi-app/demo.html`? |
| ¿Qué módulos tiene? | busca `modulo:` en `mi-app/index.html` |
| ¿Está en git? | ¿existe `mi-app/.git`? ¿tiene un remoto? (`git -C mi-app remote -v`) |
| ¿Está publicada? | si hay remoto, prueba la dirección de GitHub Pages con `curl -s -o /dev/null -w "%{http_code}"` |
| ¿Funciona Firebase? | con la clave del archivo, las comprobaciones de `referencias/firebase-comprobado.md` |
| ¿Están sus datos protegidos? | la comprobación de las reglas, la más importante de todas |

Si la app está montada, haz **siempre** las dos últimas aunque todo lo demás
parezca correcto. Una app publicada con las reglas mal es peor que una app
sin publicar, y es un fallo que no se ve desde fuera.

## 2 · Contárselo

Una tabla corta, con ✓ y ✗, y **una sola frase** de qué toca ahora:

> Esto es lo que tienes:
>
> ✓ La app está montada
> ✓ Conectada a Firebase y entrando bien
> ✓ Tus datos están protegidos
> ✗ No está publicada: solo la puedes abrir en este ordenador
> ✗ Sin los atajos del móvil
>
> Lo siguiente sería publicarla, que son dos minutos. ¿Vamos?

Si todo está ✓, díselo y ofrécele lo que se puede añadir: los módulos, otra
paleta de color, los atajos, una foto suya en el Dashboard.

## 3 · Los casos que llegan de verdad

| Con lo que te encuentras | Por dónde sigues |
|---|---|
| No hay nada | `/probar`. Que la vea antes de decidir |
| Está la demostración, nada más | "ya la has visto, ¿la montamos con tus datos?" → skill, Paso 2 |
| App montada, config con huecos | Se quedó a medias en Firebase → skill, Paso 4, y **solo el paso que falle** |
| App montada y funcionando, sin publicar | `/publicar` |
| Publicada, sin atajos | `/atajos` |
| Todo hecho | Módulos, colores, o lo que se le ocurra. Recuérdale que puede pedir cambios escribiéndolos |
| Dice que tiene la app pero no está en `mi-app/` | Pregúntale dónde la tiene. Si está en otra carpeta, trabaja allí; no la muevas sin permiso |
| Las reglas dan 200 sin sesión | **Para todo.** Eso significa que cualquiera puede leer sus cuentas. Arreglar eso va antes que nada más |

## Cómo lo dices

Nadie llega aquí sintiéndose listo. La mayoría llega pensando que lo ha
hecho mal. Así que:

- **Nada de "te falta".** Es "lo que ya tienes" y "lo siguiente".
- Si dejó algo a medias hace un mes, eso no se comenta. Se retoma.
- Si algo está mal, se dice qué es y se arregla en el mismo mensaje. Sin
  regañar y sin explicar por qué pasó, a menos que lo pregunte.
- Una sola cosa que hacer al final del mensaje. Nunca tres.
