// Modo demostración: sustituto de firebase-app.js.
//
// Cuando la app se abre por demo.html, un "importmap" hace que todos los
// import de Firebase apunten a estos tres archivos en vez de a los de
// Google. La app no se entera: recibe las mismas funciones con los mismos
// nombres, solo que por debajo no hay ninguna nube, sino datos de mentira
// que viven en la memoria del navegador.
//
// Sirve para ver la app funcionando en dos minutos, sin crear cuenta de
// nada. Lo que toques aquí no se guarda: al recargar vuelve a empezar.

export function initializeApp() {
  return { name: "demostracion" };
}
