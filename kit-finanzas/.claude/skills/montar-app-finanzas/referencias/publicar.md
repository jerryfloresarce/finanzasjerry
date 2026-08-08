# Publicar la app en internet

La app es una web normal: archivos sueltos, sin nada que compilar ni ningún
servidor que mantener. Eso hace que publicarla sea barato — gratis, de
hecho — y que se pueda abrir desde el móvil, el ordenador y la tablet a la
vez, todos viendo los mismos datos.

---

## Lo que hay que decirle ANTES de que decida

**Para que GitHub Pages sea gratis, el repositorio tiene que ser público.**
Eso significa que cualquiera que dé con la dirección puede leer el código de
su app y el archivo `js/firebase-config.js`.

Lo que **no** puede ver nadie son sus movimientos, sus cuentas ni sus
saldos: eso vive en Firestore, detrás de su contraseña y de las reglas que
publicó. Las claves que quedan a la vista están pensadas para ir dentro de
una web y no sirven para entrar sin la contraseña.

Aun así, la decisión es suya. Si prefiere que no haya nada público, dejar la
app en su ordenador es una opción perfectamente válida: la abre cuando
quiere y no la ve nadie. Lo que pierde es poder abrirla desde el móvil.

Un repositorio privado con Pages existe, pero va en los planes de pago de
GitHub. Si le interesa, que lo mire él; no se lo montes por tu cuenta.

---

## Publicar en GitHub Pages

### Si tiene la herramienta `gh` instalada

Compruébalo con `gh auth status`. Si dice que está autenticado, puedes
hacerlo casi todo tú:

```sh
cd mi-app
git init -b main
git add -A
git commit -m "Mi app de finanzas"
gh repo create NOMBRE --public --source=. --push
```

Y después, activar Pages:

```sh
gh api -X POST "repos/USUARIO/NOMBRE/pages" \
  -f "source[branch]=main" -f "source[path]=/"
```

Si `gh` no está o no ha iniciado sesión, **no le pidas que abra una
terminal**: pásale la ruta de los clics del apartado siguiente.

### Si no la tiene: los clics

> 1. Entra en **github.com** y crea una cuenta si no tienes.
> 2. Arriba a la derecha, el **+** → **New repository**. Ponle un nombre,
>    marca **Public** y créalo.
> 3. En la página que sale, busca **uploading an existing file**, y arrastra
>    ahí todo lo que hay dentro de tu carpeta `mi-app`. Ojo: el contenido de
>    la carpeta, no la carpeta.
> 4. Cuando termine de subir, ve a **Settings → Pages**.
> 5. En "Build and deployment", Source: **Deploy from a branch**. Branch:
>    **main**, carpeta **/ (root)**. Guardar.
> 6. En un par de minutos tu app está en
>    `https://TU-USUARIO.github.io/NOMBRE/`.

### Comprobación

```sh
curl -s -o /dev/null -w "%{http_code}\n" "https://TU-USUARIO.github.io/NOMBRE/"
```

`200` es que está publicada. `404` casi siempre es que **todavía no ha
terminado**: la primera vez tarda un par de minutos. Espera y repite antes
de tocar nada.

Comprueba también que el `index.html` está en la raíz del repositorio y no
dentro de una carpeta: es el fallo más habitual de la subida por
arrastrar, y da un 404 que no se arregla esperando.

---

## Un dominio propio

Solo si lo pide. Cuesta entre 10 y 15 € al año y hay que renovarlo.

1. Que lo compre donde quiera (los sitios de dominios son todos parecidos).
2. En el repositorio, crea un archivo llamado `CNAME`, sin extensión, con el
   dominio dentro y nada más: `misfinanzas.com`.
3. En el panel del sitio donde compró el dominio, en la parte de **DNS**:

| Si quiere | Tipo | Nombre | Valor |
|---|---|---|---|
| `www.sudominio.com` | CNAME | `www` | `TU-USUARIO.github.io` |
| `sudominio.com` a secas | A | `@` | `185.199.108.153`, `185.199.109.153`, `185.199.110.153` y `185.199.111.153` (los cuatro) |

4. En **Settings → Pages → Custom domain**, escribe el dominio y guarda.
5. Espera a que se marque sola la casilla **Enforce HTTPS**. Puede tardar
   desde unos minutos hasta un día: es normal, y hasta entonces el
   navegador avisará de que el sitio no es seguro.

Dile que los cambios de DNS tardan, para que no piense que está roto.

---

## Instalarla en el móvil

Esto no cuesta nada y es lo que hace que parezca una app de verdad:

> Abre la dirección en el móvil. En iPhone, con **Safari**: botón de
> compartir (el cuadrado con la flecha) → **Añadir a pantalla de inicio**.
> En Android, con Chrome: los tres puntos → **Instalar aplicación** o
> **Añadir a pantalla de inicio**.

A partir de ahí tiene su icono y se abre a pantalla completa, sin la barra
del navegador.

**Lo que hay que aclararle:** esto no es una app de la App Store. Se ve y se
usa igual, pero no está en la tienda de Apple ni en la de Google. Para eso
haría falta pagar la cuota de desarrollador (99 $ al año en Apple), tener un
Mac y pasar una revisión. Si lo que quería era eso, díselo claro ahora, no
al final.

---

## Cuando la app cambie

Si más adelante se le añade algo a la app, lo publicado no se entera solo.
Hay que volver a subir los archivos cambiados: con `git push` si se montó
con `gh`, o arrastrándolos otra vez en la web de GitHub.

Y un detalle que da problemas: los navegadores guardan copias de los
archivos. Si cambia algo y no lo ve, hay que subir el número de versión de
`?v=NN` que llevan los enlaces de `index.html` y los `import` de los `js/`.
Están todos con el mismo número justamente para poder subirlos de golpe.
