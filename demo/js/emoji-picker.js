// Selector de emoji simple para el campo opcional "icono" de cuentas y
// categorías: un input de texto (acepta pegar/escribir cualquier emoji,
// incluido el selector nativo del teclado) más una fila de sugerencias.

export const CUENTA_EMOJIS = ["🏦", "💳", "💵", "🐷", "💰", "🪙", "📱", "🏧"];
export const CATEGORIA_EMOJIS = ["🍔", "🎬", "🏠", "🛒", "📱", "👕", "💊", "🚗", "✈️", "🎮", "☕", "🎓", "🐾", "🎁"];

export function emojiFieldHTML(value = "", emojis = CATEGORIA_EMOJIS) {
  return `
    <label class="field field--full emoji-field">
      <span class="field__label">Icono (opcional)</span>
      <div class="emoji-picker">
        <input type="text" name="icono" maxlength="4" value="${value ?? ""}" placeholder="🏷️" class="emoji-input" autocomplete="off" />
        <div class="emoji-picker__options">
          ${emojis.map((e) => `<button type="button" class="emoji-opt" data-emoji="${e}">${e}</button>`).join("")}
        </div>
      </div>
    </label>`;
}

export function attachEmojiPicker(root) {
  const input = root.querySelector(".emoji-input");
  if (!input) return;
  root.querySelectorAll(".emoji-opt").forEach((btn) =>
    btn.addEventListener("click", () => {
      input.value = input.value.trim() === btn.dataset.emoji ? "" : btn.dataset.emoji;
    })
  );
}
