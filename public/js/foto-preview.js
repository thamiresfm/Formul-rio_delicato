/**
 * Pré-visualização de miniaturas para inputs file (foto1…fotoN).
 * Espera no DOM: #fotoK-preview com .foto-preview-img e .foto-preview-fallback
 */

const previewObjectUrls = {};

export function limparPreviewFotoPorId(inputId) {
  if (previewObjectUrls[inputId]) {
    URL.revokeObjectURL(previewObjectUrls[inputId]);
    delete previewObjectUrls[inputId];
  }
  const wrap = document.getElementById(`${inputId}-preview`);
  if (!wrap) return;
  wrap.classList.add("hidden");
  const img = wrap.querySelector(".foto-preview-img");
  const fb = wrap.querySelector(".foto-preview-fallback");
  if (img) {
    img.onload = null;
    img.onerror = null;
    img.removeAttribute("src");
  }
  fb?.classList.add("hidden");
}

export function limparTodasPreviewsFotos(numFotos) {
  for (let i = 1; i <= numFotos; i++) {
    limparPreviewFotoPorId(`foto${i}`);
  }
}

export function atualizarPreviewFoto(inputEl) {
  const inputId = inputEl.id;
  limparPreviewFotoPorId(inputId);
  const wrap = document.getElementById(`${inputId}-preview`);
  const file = inputEl.files?.[0];
  if (!file || !wrap) return;
  const img = wrap.querySelector(".foto-preview-img");
  const fb = wrap.querySelector(".foto-preview-fallback");
  if (!img) return;
  if (!file.type.startsWith("image/")) {
    wrap.classList.add("hidden");
    return;
  }
  const url = URL.createObjectURL(file);
  previewObjectUrls[inputId] = url;
  img.onload = () => {
    img.onload = null;
    img.onerror = null;
    fb?.classList.add("hidden");
    wrap.classList.remove("hidden");
  };
  img.onerror = () => {
    img.onload = null;
    img.onerror = null;
    img.removeAttribute("src");
    fb?.classList.remove("hidden");
    wrap.classList.remove("hidden");
  };
  img.src = url;
}

export function wireFotoPreviewListeners(numFotos) {
  for (let i = 1; i <= numFotos; i++) {
    const el = document.getElementById(`foto${i}`);
    if (el) el.addEventListener("change", (e) => atualizarPreviewFoto(e.target));
  }
}
