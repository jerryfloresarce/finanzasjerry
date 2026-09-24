// Genera el par de claves VAPID del servidor de avisos. Se hace UNA vez.
// La privada va como secreto del Worker; la pública la deriva el worker
// solo, así que basta con guardar el secreto:
//   node worker/herramientas/generar-claves.mjs
//   npx wrangler secret put VAPID_PRIVADA_JWK   (y pegar el JWK entero)
const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwk = await crypto.subtle.exportKey("jwk", par.privateKey);
const privada = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d };
const b64u = (u8) => Buffer.from(u8).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const publica = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]));
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ privada, publica }));
} else {
  console.log("VAPID_PRIVADA_JWK (secreto del Worker):\n" + JSON.stringify(privada));
  console.log("\nClave pública (la deriva el worker; solo informativa):\n" + publica);
}
