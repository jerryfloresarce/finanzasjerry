# Kit · Tu app de finanzas

Le montas a cualquiera **su propia app para llevar sus cuentas**: lo que
entra, lo que sale, en qué se le va el mes, sus gastos fijos, sus límites y
sus gráficos. Se abre desde el móvil y desde el ordenador, y los dos ven lo
mismo.

No hace falta saber programar. No hay nada que compilar ni ningún servidor
que mantener.

```
/probar        →  la ves funcionando en 2 minutos, sin crear cuenta de nada
quiero la mía  →  te la monta con tus datos, guiándote paso a paso
publícala      →  la sube a internet gratis, para abrirla desde el móvil
```

---

## Qué app sale de aquí

| Sección | Qué hace |
|---|---|
| **Dashboard** | El saldo total, el gráfico de gastos del mes, tus cuentas, los últimos movimientos, cómo vas de límites |
| **Calendario** | Todos tus movimientos, con filtros. Añadir gastos, ingresos y traspasos entre tus cuentas |
| **Cuentas** | Tus bancos y tu efectivo, con el saldo calculado a partir de los movimientos (no se puede descuadrar) |
| **Categorías** | Fijas y variables, con límite mensual opcional |
| **Gastos fijos** | Suscripciones y cuotas, mensuales, anuales o bimensuales |
| **Préstamos** | Dinero que te deben, con intereses y planes de pago. Se puede quitar entera |
| **Gráficos** | Por categoría, por sitio, por rango de fechas |
| **Mi cuenta** | Cambiar contraseña, temas, y exportar/importar toda tu copia |

Y siete temas de color, con sus animaciones al entrar.

---

## Cómo funciona por dentro

La app **no se escribe cada vez**. Vive ya hecha y probada en
`plantilla-app/`, y lo que hace este kit es copiarla y adaptarla. Por eso
tarda minutos y no horas, y por eso sale igual de bien la vez número treinta.

```
kit-finanzas/
├── EMPIEZA-AQUI.md      Arrancar en 5 minutos
├── README.md            Este archivo
├── CLAUDE.md            Cómo se comporta el asistente
├── plantilla-app/       La app, lista para copiar. NO se toca
│   └── demo.html        La misma app pero con datos de mentira
├── mi-app/              Aquí aparece TU app
├── herramientas/        El guion que genera la plantilla desde la app real
└── .claude/
    ├── commands/        /probar · /mi-app · /publicar
    └── skills/montar-app-finanzas/
        ├── SKILL.md     Los ocho pasos
        └── referencias/ Firebase paso a paso, y cómo publicar
```

---

## Lo que hago yo y lo que tienes que hacer tú

Esto se dice al principio, no al final:

| Yo | Tú |
|---|---|
| Copio la app y la adapto a lo tuyo | Creas una cuenta gratis de Firebase |
| Escribo la configuración | Pulsas los botones que te voy diciendo, uno a uno |
| La arranco en tu ordenador | Eliges tu contraseña. Yo no la sé ni la necesito |
| Compruebo con llamadas reales que funciona | Compras un dominio, solo si quieres |
| La subo a internet | |

Las pantallas de Firebase están detrás de una cuenta de Google y yo no las
veo. Lo que sí hago es pedirte **una cosa a la vez** y **comprobar cada una
antes de seguir**: si la clave está mal, o falta activar el acceso por
correo, o las reglas no se publicaron, te lo digo con el motivo exacto y el
botón que hay que tocar. Un manual te deja tirado en el paso 7; esto no.

---

## La demostración

`/probar` abre la app con los datos de una persona que no existe: cuatro
meses de movimientos, tres cuentas, gastos fijos, límites y un par de
préstamos. Puedes tocarlo todo. Al recargar, vuelve a empezar.

Por debajo no hay ninguna nube: la app carga unos archivos de mentira en vez
de los de Firebase, y no sale ni una petición a internet. Está comprobado.

---

## Qué NO hace este kit

- **No es una app de la App Store.** La que sale de aquí se instala en la
  pantalla de inicio del móvil y se usa igual, pero no está en la tienda de
  Apple ni de Google. Para eso hacen falta 99 $ al año, un Mac y pasar una
  revisión.
- **No funciona sin cuenta de Firebase.** La demostración sí; tu app de
  verdad no. Es lo que permite que el móvil y el ordenador vean lo mismo.
- **No te mete tus movimientos de antes.** Empiezas desde el saldo de hoy.
  Lo que sí puedes es importar una copia si vienes de otra app y la exportas
  en el formato de esta.
- **No lee tu banco.** Los movimientos los metes tú.
- **No mantiene tu app.** Es tuya desde que sale: si un día quieres cambiar
  algo, vuelves aquí y lo dices.
- **Todavía no monta los Atajos del iPhone.** Está pensado para más
  adelante.

---

## Qué cuesta

**Nada.** La app es gratis, el plan gratuito de Firebase da de sobra para
las finanzas de una persona (y no te pide tarjeta), y publicarla en GitHub
Pages también es gratis.

Lo único que se paga es un dominio propio, si lo quieres: 10-15 € al año.

Lo que sí consume es tiempo de tu plan de Claude: montar una app entera es
un trabajo largo. Si se corta a la mitad no pierdes nada — se retoma
diciendo "continúa".

---

## Seguridad

- **Tus movimientos no los ve nadie.** Están en Firebase, detrás de tu
  contraseña y de unas reglas que solo dejan entrar a quien ha iniciado
  sesión. Eso se comprueba de verdad antes de dar la app por lista.
- **No hay registro público.** Tu usuario se crea a mano en Firebase, así
  que nadie puede darse de alta en tus datos.
- **Las contraseñas nunca pasan por el chat.** Ni la de Firebase, ni la de
  GitHub. Todo lo que hay que comprobar se comprueba sin ellas.
- **Si publicas, el código es público** (es lo que hace gratis a GitHub
  Pages), y con él el archivo de configuración de Firebase. Esas claves
  están pensadas para ir dentro de una web y no sirven para entrar sin tu
  contraseña. Aun así, se te dice antes de decidir, no después.

---

## Para quien mantiene el kit

`plantilla-app/` **está generada**, no escrita a mano:

```sh
node kit-finanzas/herramientas/construir-plantilla.mjs
```

Saca la app del repositorio donde vive el kit, le quita lo personal (las
claves, los datos de su dueño, las correcciones de un solo uso), le quita las
fotos con derechos, le pone un nombre neutro, añade el modo demostración y
**comprueba** que no se ha escapado nada: ni un nombre propio, ni una clave
de verdad, ni un import roto. Si algo se escapa, no genera nada y lo dice.

Así, cuando la app mejora, la plantilla se pone al día con un comando y no
hay dos copias que se van separando con el tiempo.
