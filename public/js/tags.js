=== FILE: public/js/tags.js (SAVE AS tags.js inside public/js/) ===
/**
 * Tag Input (Skills Entry)
 * Allows entering multiple skills separated by comma / period / space
 */

function setupTagInput(containerId, hiddenInputName) {
  const container = document.getElementById(containerId);
  const hiddenInput = document.createElement("input");

  hiddenInput.type = "hidden";
  hiddenInput.name = hiddenInputName;
  container.appendChild(hiddenInput);

  container.classList.add("tag-input");

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type skill and press comma";
  input.style.border = "none";
  input.style.flex = "1";
  input.style.minWidth = "120px";

  container.appendChild(input);

  let tags = [];

  function updateHiddenField() {
    hiddenInput.value = tags.join(",");
  }

  function addTag(text) {
    text = text.trim();
    if (!text || tags.includes(text)) return;

    tags.push(text);

    const tag = document.createElement("div");
    tag.className = "tag";
    tag.innerHTML = `
      ${text}
      <span data-tag="${text}">×</span>
    `;

    container.insertBefore(tag, input);
    updateHiddenField();
  }

  container.addEventListener("click", () => input.focus());

  input.addEventListener("keyup", (e) => {
    if (["Enter", ",", "."].includes(e.key)) {
      addTag(input.value.replace(/[,.]/g, ""));
      input.value = "";
    }
  });

  container.addEventListener("click", (e) => {
    if (e.target.tagName === "SPAN") {
      const text = e.target.getAttribute("data-tag");
      tags = tags.filter((t) => t !== text);
      e.target.parentElement.remove();
      updateHiddenField();
    }
  });

}
