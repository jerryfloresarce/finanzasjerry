# Los Atajos del iPhone

Apuntar un gasto sin abrir la app: se desliza el Centro de Control, se toca
un botón, se escribe el importe y ya está. Aparece en la web al instante.

Son tres Atajos separados —**Gasto**, **Ingreso** y **Transferencia**—
en vez de uno con menú, porque así cada uno se puede poner como control del
Centro de Control y se llega a él de un toque.

Esto es de las pocas cosas del kit que **no puedes hacer tú**: los Atajos se
montan en el móvil, paso a paso. Tu trabajo es prepararle todos los datos y
guiarla acción por acción.

---

## Antes de empezar: comprobar que hay algo que atajar

No la mandes a montar nada sin esto:

1. Que la app esté montada y **funcionando** (que entre y guarde de verdad).
2. Que sepa su correo y su contraseña de Firebase.
3. La comprobación de las reglas, otra vez: si sus datos están abiertos, eso
   se arregla antes.

Si la app no está lista, dilo y ofrécele terminarla primero. Un Atajo contra
una app a medias no funciona y es un lío desmontarlo.

## Los datos que necesita a mano

Prepáraselos tú, en un solo mensaje, listos para copiar:

| Dato | De dónde sale |
|---|---|
| **API key** | de `mi-app/js/firebase-config.js`, el campo `apiKey` |
| **Project ID** | del mismo archivo, `projectId` |
| Su correo y su contraseña | los suyos de Firebase. No te los diga: los escribe ella en el Atajo |
| Los IDs de sus cuentas y categorías | de la propia app |

Para los IDs: en **Cuentas** y en **Categorías**, cada tarjeta tiene un
botón pequeño de copiar al lado de Editar. Se toca y el ID se copia. Que lo
haga una vez por cada cuenta y categoría que vaya a usar desde el móvil y
los pegue en una nota. Son cadenas largas tipo `k3Jd82ndPQ...`; no
significan nada, solo hay que copiarlas tal cual.

Dile de paso lo de siempre: la API key **no es un secreto** (va dentro de la
web), pero el Atajo llevará su contraseña escrita dentro, así que **ese
Atajo no se comparte con nadie**.

---

## El Atajo de Gasto, paso a paso

Dáselo en trozos de tres o cuatro acciones, esperando confirmación entre
tanda y tanda. Doce pasos de golpe en una app que no conoce es donde se
abandona.

Abre la app **Atajos** → **+** (arriba a la derecha).

### A · Preguntar el importe

> Añade **Preguntar por entrada**. Tipo: **Número**. Pregunta: "¿Cuánto?".
> Luego, abajo del todo, ponle nombre al resultado: **Importe**.

Si su iPhone está en español el teclado usará coma decimal (`12,50`): no
importa, esa acción siempre devuelve un número válido.

### B · Iniciar sesión

> Añade **Obtener contenido de URL**. En la URL pon:
>
> `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=SU_API_KEY`
>
> Toca la flecha para abrir las opciones: Método **POST**, una cabecera
> `Content-Type` con valor `application/json`, y el cuerpo en **JSON** con
> tres campos: `email` (el tuyo), `password` (la tuya) y `returnSecureToken`
> con valor `true`.
>
> Nombra el resultado **LoginResponse**.

### C · Sacar el permiso de entrada

> Añade **Obtener valor de diccionario**. Clave: `idToken`. Diccionario:
> **LoginResponse**. Nombra el resultado **Token**.

### D · La fecha

> Añade **Fecha** (la de "fecha actual"). Después **Formatear fecha**, con
> formato personalizado: `yyyy-MM-dd'T'HH:mm:ss'Z'` y zona horaria **UTC**.
>
> Ahora, importante: añade una acción **Texto**, mete dentro el resultado de
> Formatear fecha, y después un **Definir variable** llamada **Fecha**.

Ese rodeo del "Texto" + "Definir variable" no es un capricho. Atajos a veces
lee el resultado de una acción bastante después de generarlo y coge un valor
viejo o vacío, aunque en el editor la burbuja se vea bien. Pasarlo por un
Texto y congelarlo en una variable justo ahí lo evita. Dile que lo siga tal
cual aunque parezca un paso de más.

### E · Guardar el movimiento

> Otra vez **Obtener contenido de URL**:
>
> `https://firestore.googleapis.com/v1/projects/SU_PROJECT_ID/databases/(default)/documents/movimientos`
>
> Método **POST**. Dos cabeceras: `Content-Type` = `application/json`, y
> `Authorization` con valor `Bearer ` (con el espacio) seguido de la variable
> **Token**.
>
> Y el cuerpo, en **JSON**, con esta forma:

```json
{
  "fields": {
    "tipo":        { "stringValue": "Gasto" },
    "importe":     { "doubleValue": IMPORTE },
    "categoria_id":{ "stringValue": "EL_ID_DE_LA_CATEGORIA" },
    "cuenta_id":   { "stringValue": "EL_ID_DE_LA_CUENTA" },
    "fecha":       { "timestampValue": "LA_VARIABLE_FECHA" },
    "subcategoria":{ "stringValue": "" },
    "nota":        { "stringValue": "" }
  }
}
```

Donde pone `IMPORTE` va la variable **Importe**, y donde pone
`LA_VARIABLE_FECHA` va la variable **Fecha**.

Firestore necesita que cada campo diga de qué tipo es (`stringValue`,
`doubleValue`, `timestampValue`). Es raro de ver pero es así, y si se
equivoca de tipo el movimiento entra mal.

### F · Que elija categoría y cuenta

Para no tener que crear un Atajo por categoría, entre A y E se le añade:

> **Elegir de menú**, con una opción por categoría. Dentro de cada opción,
> un **Texto** con el ID de esa categoría y un **Definir variable** llamada
> **Categoria**. Igual con las cuentas y la variable **Cuenta**.

Y en el JSON van esas variables en vez de los IDs escritos a mano.

### G · Probarlo

> Dale al play. Pon 1 euro de prueba, y mira la web: tiene que aparecer al
> instante. Si aparece, bórralo desde la web deslizando la fila.

**No lo des por bueno hasta que ella te diga que lo ha visto en la web.**

---

## Los otros dos

Cuando el de Gasto funcione, se duplica (mantener pulsado → Duplicar) y se
cambia solo lo que toque:

| Atajo | Qué cambia |
|---|---|
| **Ingreso** | `"tipo"` pasa a `"Ingreso"` |
| **Transferencia** | `"tipo"` pasa a `"Transferencia"`, se quita `categoria_id`, y se añade `cuenta_destino_id` con la cuenta de destino |

Una transferencia mueve dinero entre sus propias cuentas (o saca efectivo):
no es gasto ni ingreso, no cuenta en los totales ni en los gráficos, solo
cambia el saldo de una cuenta a otra.

## El Centro de Control

El remate, y lo que hace que se use de verdad:

> Ajustes → **Centro de Control** → busca **Atajos** y añade uno por cada
> uno de los tres. Ahora, deslizando desde arriba a la derecha, tienes los
> tres botones a un toque.

---

## Si algo no funciona

| Lo que ve | Qué pasa | Solución |
|---|---|---|
| `INVALID_LOGIN_CREDENTIALS` | El correo o la contraseña del paso B | Que los revise. Ojo con los espacios al copiar |
| `Missing or insufficient permissions` | Las reglas de Firestore | Volver a publicarlas |
| El Atajo va pero no aparece nada en la web | Casi siempre el Project ID mal escrito en la URL del paso E | Comprobarlo contra `firebase-config.js` |
| Aparece con fecha rara o en 1970 | La fecha no se congeló en su variable | Repetir el paso D con el Texto + Definir variable |
| El importe entra como texto | Se usó `stringValue` en vez de `doubleValue` | Cambiarlo en el JSON |
| "No se ha podido conectar" | Sin cobertura, o la URL mal copiada | Revisar la URL entera |

Y si se atasca de verdad, ofrécele dejarlo: la app funciona perfectamente
sin los Atajos, y esto se puede retomar otro día. Que no acabe la sesión con
la sensación de que no ha podido.
