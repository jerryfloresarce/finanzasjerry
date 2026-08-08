---
description: Abre la app con datos de mentira para verla antes de crear ninguna cuenta
---

Le enseñas la app funcionando, sin que tenga que crear cuenta de nada. Es lo
primero que hay que hacer siempre: nadie se abre una cuenta de Firebase para
algo que no ha visto por dentro.

## 1 · Preparar la copia

Mira `mi-app/`:

- Si solo tiene `.gitkeep`, copia todo el contenido de `plantilla-app/` ahí
  dentro.
- Si ya tiene la app y existe `mi-app/demo.html`, no copies nada: sigue al
  paso 2.
- Si ya tiene la app y **no** existe `demo.html`, es que ya está montada de
  verdad. **Pregunta antes de tocar nada**: puedes volver a poner la
  demostración copiando solo `demo.html` y `js/demo/` desde la plantilla, sin
  pisarle su configuración ni sus cambios.

## 2 · Arrancar el servidor

Un archivo HTML abierto a pelo desde el disco no vale: los navegadores no
dejan que una página cargue módulos así. Hace falta servirla.

Prueba en este orden y usa el primero que exista, dejándolo en segundo plano:

```sh
python3 -m http.server 8080
python -m http.server 8080
npx --yes serve -l 8080
```

Todos desde dentro de `mi-app/`. Si el puerto 8080 está ocupado, sube al
8081 y así.

Comprueba que responde antes de decirle nada:

```sh
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/demo.html
```

Tiene que dar `200`. Si da otra cosa, mira si el servidor arrancó desde la
carpeta correcta — el fallo típico es lanzarlo desde un nivel de más.

## 3 · Abrírsela

`open http://localhost:8080/demo.html` en Mac, `start` en Windows,
`xdg-open` en Linux. Si nada de eso funciona, dale la dirección para que la
pegue él.

## 4 · Contarle qué está viendo

En cuatro líneas, no más:

- Es la app entera, con datos inventados de una persona que no existe.
- Puede tocar todo: añadir un gasto, borrarlo deslizando una fila, cambiar
  de tema en el icono de arriba a la derecha, mirar los gráficos.
- **Al recargar vuelve a empezar.** En la demostración no se guarda nada, y
  eso es a propósito.
- Cuando la haya visto, que diga **"quiero la mía"** y se monta con sus
  datos de verdad.

Y una advertencia si la pide: los préstamos que salen ahí son de mentira,
como todo lo demás. Si esa sección le sobra, se puede quitar entera cuando
monte la suya.
