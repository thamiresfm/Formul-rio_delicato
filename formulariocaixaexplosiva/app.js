/** WhatsApp da loja (E.164): +55 21 99672-8473 */
const WHATSAPP_LOJA_E164 = "5521996728473";
const WA_TEXTO_MAX = 3500;
const NUM_FOTOS = 4;

const form = document.getElementById("pedido-form");
const bannerChocolateCom = document.getElementById("banner-chocolate-com");
const bannerChocolateSem = document.getElementById("banner-chocolate-sem");
const btnResumo = document.getElementById("btn-resumo");
const panelResumo = document.getElementById("panel-resumo");
const resumoConteudo = document.getElementById("resumo-conteudo");
const btnVoltar = document.getElementById("btn-voltar");
const btnEnviar = document.getElementById("btn-enviar");
const toast = document.getElementById("toast");
const cepInput = document.getElementById("cep");
const ufInput = document.getElementById("uf");
const cpfInput = document.getElementById("cpf");
const secFrases = document.getElementById("sec-frases");
const secFotos = document.getElementById("sec-fotos");
const secEndereco = document.getElementById("sec-endereco");
const secCliente = document.getElementById("sec-cliente");
const actionsPrimary = document.getElementById("actions-primary");

let resumoAberto = false;
let ultimoTextoWhatsapp = "";
/** Quatro arquivos de foto — compartilhamento nativo no mobile. */
let ultimoFotosShare = null;

function showToast(message, isError) {
  toast.textContent = message;
  toast.classList.toggle("error", !!isError);
  toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 5200);
}

function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

function formatCep(v) {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function formatCpf(v) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function cpfValido(digits) {
  const s = onlyDigits(digits);
  if (s.length !== 11 || /^(\d)\1{10}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(s[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(s[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(s[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(s[10], 10);
}

let ultimoCepPreenchidoViaApi = "";
let cepDebounceTimer = null;

async function buscarEnderecoPorCep(digits) {
  const ruaEl = document.getElementById("rua");
  const bairroEl = document.getElementById("bairro");
  const cidadeEl = document.getElementById("cidade");
  const ufEl = document.getElementById("uf");
  cepInput.setAttribute("aria-busy", "true");
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) throw new Error("http");
    const data = await res.json();
    if (data.erro) {
      ultimoCepPreenchidoViaApi = "";
      showToast("CEP não encontrado. Confira os números ou preencha o endereço manualmente.", true);
      return;
    }
    ultimoCepPreenchidoViaApi = digits;
    if (data.logradouro) ruaEl.value = data.logradouro;
    if (data.bairro) bairroEl.value = data.bairro;
    if (data.localidade) cidadeEl.value = data.localidade;
    if (data.uf) ufEl.value = String(data.uf).toUpperCase().slice(0, 2);
    clearFieldErrors();
  } catch (_e) {
    ultimoCepPreenchidoViaApi = "";
    showToast("Não foi possível consultar o CEP. Preencha o endereço manualmente.", true);
  } finally {
    cepInput.removeAttribute("aria-busy");
  }
}

cepInput.addEventListener("input", () => {
  cepInput.value = formatCep(cepInput.value);
  const d = onlyDigits(cepInput.value);
  clearTimeout(cepDebounceTimer);
  if (d.length !== 8) {
    ultimoCepPreenchidoViaApi = "";
    return;
  }
  cepDebounceTimer = setTimeout(() => {
    if (d === ultimoCepPreenchidoViaApi) return;
    buscarEnderecoPorCep(d);
  }, 450);
});

ufInput.addEventListener("input", () => {
  ufInput.value = ufInput.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
});

cpfInput.addEventListener("input", () => {
  cpfInput.value = formatCpf(cpfInput.value);
});

function getTipoChocolate() {
  const el = form.querySelector('input[name="tipoChocolate"]:checked');
  return el ? el.value : null;
}

function textoVariacaoChocolateLegivel() {
  const t = getTipoChocolate();
  if (t === "com-chocolate") return "Com chocolate";
  if (t === "sem-chocolate") return "Sem chocolate";
  return "—";
}

function atualizarVisibilidadeRestanteFormulario() {
  const mostrar = Boolean(getTipoChocolate());
  [secFrases, secFotos, secEndereco, secCliente, actionsPrimary].forEach((el) => {
    if (el) el.classList.toggle("hidden", !mostrar);
  });
}

function atualizarBannersChocolate() {
  const tipo = getTipoChocolate();
  if (bannerChocolateCom) bannerChocolateCom.classList.toggle("hidden", tipo !== "com-chocolate");
  if (bannerChocolateSem) bannerChocolateSem.classList.toggle("hidden", tipo !== "sem-chocolate");
  const estavaOculto = secFrases && secFrases.classList.contains("hidden");
  atualizarVisibilidadeRestanteFormulario();
  if (tipo && estavaOculto && secFrases) {
    requestAnimationFrame(() => secFrases.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

form.querySelectorAll('input[name="tipoChocolate"]').forEach((input) => {
  input.addEventListener("change", atualizarBannersChocolate);
});

function clearFieldErrors() {
  form.querySelectorAll(".field-error").forEach((el) => el.classList.remove("field-error"));
}

function markError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("field-error");
}

const MIN_FOTO_BYTES = 15 * 1024;
const MAX_FRASE_SEGUNDA_TAMPA = 40;
const MAX_FRASE_TERCEIRA_TAMPA = 10;
const MAX_FRASE_MEIO_CAIXA = 50;

function validar() {
  clearFieldErrors();
  const erros = [];

  const tipoChoc = getTipoChocolate();
  if (!tipoChoc) {
    erros.push("Escolha a variação da caixa: com chocolate ou sem chocolate (obrigatório).");
    markError("tipoChocolate-com");
    markError("tipoChocolate-sem");
  }

  const fraseSegunda = document.getElementById("fraseSegundaTampa").value.trim();
  if (!fraseSegunda) {
    erros.push("Informe a frase para a segunda tampa.");
    markError("fraseSegundaTampa");
  } else if (fraseSegunda.length > MAX_FRASE_SEGUNDA_TAMPA) {
    erros.push(`A frase da segunda tampa pode ter no máximo ${MAX_FRASE_SEGUNDA_TAMPA} caracteres.`);
    markError("fraseSegundaTampa");
  }

  const fraseTerceira = document.getElementById("fraseTerceiraTampa").value.trim();
  if (!fraseTerceira) {
    erros.push("Informe a frase para a terceira tampa.");
    markError("fraseTerceiraTampa");
  } else if (fraseTerceira.length > MAX_FRASE_TERCEIRA_TAMPA) {
    erros.push(`A frase da terceira tampa pode ter no máximo ${MAX_FRASE_TERCEIRA_TAMPA} caracteres.`);
    markError("fraseTerceiraTampa");
  }

  const fraseMeio = document.getElementById("fraseMeioCaixa").value.trim();
  if (!fraseMeio) {
    erros.push("Informe a frase para o meio da caixa.");
    markError("fraseMeioCaixa");
  } else if (fraseMeio.length > MAX_FRASE_MEIO_CAIXA) {
    erros.push(`A frase do meio da caixa pode ter no máximo ${MAX_FRASE_MEIO_CAIXA} caracteres.`);
    markError("fraseMeioCaixa");
  }

  const fotos = [];
  for (let i = 1; i <= NUM_FOTOS; i++) {
    fotos.push(document.getElementById(`foto${i}`).files[0]);
  }
  if (fotos.some((f) => !f)) {
    erros.push(`Envie as ${NUM_FOTOS} fotos.`);
    for (let i = 1; i <= NUM_FOTOS; i++) markError(`foto${i}`);
  } else {
    fotos.forEach((f, i) => {
      if (f.size < MIN_FOTO_BYTES) {
        erros.push(`A foto ${i + 1} parece muito pequena; prefira arquivo HD ou original.`);
        markError(`foto${i + 1}`);
      }
    });
  }

  const rua = document.getElementById("rua").value.trim();
  if (rua.length < 2) {
    erros.push("Informe a rua.");
    markError("rua");
  }

  const numero = document.getElementById("numero").value.trim();
  if (!numero) {
    erros.push("Informe o número.");
    markError("numero");
  }

  const bairro = document.getElementById("bairro").value.trim();
  if (bairro.length < 2) {
    erros.push("Informe o bairro.");
    markError("bairro");
  }

  const cidade = document.getElementById("cidade").value.trim();
  if (cidade.length < 2) {
    erros.push("Informe a cidade.");
    markError("cidade");
  }

  const uf = document.getElementById("uf").value.trim();
  if (uf.length !== 2) {
    erros.push("Informe a UF com 2 letras.");
    markError("uf");
  }

  const cep = onlyDigits(document.getElementById("cep").value);
  if (cep.length !== 8) {
    erros.push("CEP inválido.");
    markError("cep");
  }

  const nome = document.getElementById("nomeCompleto").value.trim();
  if (nome.split(/\s+/).filter(Boolean).length < 2) {
    erros.push("Informe o nome completo.");
    markError("nomeCompleto");
  }

  const cpf = document.getElementById("cpf").value;
  if (!cpfValido(cpf)) {
    erros.push("CPF inválido.");
    markError("cpf");
  }

  return erros;
}

function montarLinhaEnderecoCompleto() {
  const rua = document.getElementById("rua").value.trim();
  const numero = document.getElementById("numero").value.trim();
  const cidade = document.getElementById("cidade").value.trim();
  const uf = document.getElementById("uf").value.trim().toUpperCase();
  const ref = document.getElementById("referencia").value.trim();
  let linha = `${rua}, ${numero} — ${cidade}/${uf}`;
  if (ref) linha += ` — Ref.: ${ref}`;
  return linha;
}

/**
 * Formato solicitado para WhatsApp (Caixa Explosiva).
 */
function montarTextoWhatsappPedido() {
  const cepFmt = formatCep(document.getElementById("cep").value);
  const linhas = [];
  linhas.push("Caixa Explosiva");
  linhas.push(`Variação: ${textoVariacaoChocolateLegivel().toLowerCase()}`);
  linhas.push("Pagamento confirmado ✅");
  linhas.push("");
  linhas.push(`Frase para segunda tampa: ${document.getElementById("fraseSegundaTampa").value.trim()}`);
  linhas.push(`Frase para terceira tampa: ${document.getElementById("fraseTerceiraTampa").value.trim()}`);
  linhas.push(`Frase para o meio da caixa: ${document.getElementById("fraseMeioCaixa").value.trim()}`);
  linhas.push("");
  linhas.push("Fotos: 4 anexos");
  linhas.push("");
  linhas.push(`Endereço: ${montarLinhaEnderecoCompleto()}`);
  linhas.push(`CEP: ${cepFmt}`);
  linhas.push(`Bairro: ${document.getElementById("bairro").value.trim()}`);
  linhas.push(`Nome completo: ${document.getElementById("nomeCompleto").value.trim()}`);
  linhas.push(`CPF: ${formatCpf(document.getElementById("cpf").value)}`);
  return linhas.join("\n");
}

function isMobileDispositivo() {
  if (
    typeof navigator !== "undefined" &&
    navigator.userAgentData &&
    typeof navigator.userAgentData.mobile === "boolean"
  ) {
    return navigator.userAgentData.mobile;
  }
  const ua = navigator.userAgent || "";
  if (/iPhone|iPod|iPad/i.test(ua)) return true;
  if (/Android/i.test(ua)) return true;
  if (/webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

function abrirUrlWhatsappComTexto(texto) {
  let corpo = texto;
  if (corpo.length > WA_TEXTO_MAX) {
    corpo = `${corpo.slice(0, WA_TEXTO_MAX)}\n…(texto truncado)`;
  }
  const encoded = encodeURIComponent(corpo);
  const phone = WHATSAPP_LOJA_E164;
  const base = isMobileDispositivo() ? "https://api.whatsapp.com/send" : "https://web.whatsapp.com/send";
  let url = `${base}?phone=${phone}&text=${encoded}`;
  if (url.length > 8000) {
    url = `${base}?phone=${phone}`;
  }
  return url;
}

function abrirWhatsappUrl(url) {
  if (isMobileDispositivo()) {
    window.location.assign(url);
    return;
  }
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (win) return;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function finalizarPedidoAposEnvio() {
  resumoAberto = false;
  panelResumo.classList.add("hidden");
  form.reset();
  ultimoCepPreenchidoViaApi = "";
  ultimoTextoWhatsapp = "";
  ultimoFotosShare = null;
  atualizarBannersChocolate();
}

async function enviarPedidoWhatsappAgora() {
  const texto = ultimoTextoWhatsapp;
  const files = ultimoFotosShare;
  if (!texto) {
    showToast("Erro ao montar o pedido.", true);
    return "cancelado";
  }

  const mobile = isMobileDispositivo();
  const temQuatroFotos = files && files.length === NUM_FOTOS && files.every(Boolean);
  const temShare = typeof navigator !== "undefined" && navigator.share;
  let podeCompartilharComFotos = mobile && temQuatroFotos && temShare;
  if (podeCompartilharComFotos && navigator.canShare) {
    podeCompartilharComFotos = navigator.canShare({ files });
  }

  if (podeCompartilharComFotos) {
    try {
      await navigator.share({
        title: "Delicatto — Caixa Explosiva — texto + 4 imagens",
        text: texto,
        files,
      });
      return "ok-fotos";
    } catch (err) {
      if (err && err.name === "AbortError") return "cancelado";
      showToast("Abrindo só o texto no WhatsApp; anexe as 4 fotos na conversa.", true);
    }
  }

  const url = abrirUrlWhatsappComTexto(texto);
  if (isMobileDispositivo()) {
    finalizarPedidoAposEnvio();
    window.location.assign(url);
    return "navegando";
  }
  abrirWhatsappUrl(url);
  return "ok";
}

function montarResumo() {
  const fd = new FormData(form);
  const cepFmt = formatCep(fd.get("cep"));
  const nomeArquivos = [1, 2, 3, 4].map((i) => {
    const f = document.getElementById(`foto${i}`).files[0];
    return f ? f.name : "—";
  });

  const rows = [
    ["Produto", `Caixa Explosiva — ${textoVariacaoChocolateLegivel().toLowerCase()}`],
    ["Pagamento", "Confirmado ✅"],
    ["Frase — segunda tampa", fd.get("fraseSegundaTampa")],
    ["Frase — terceira tampa", fd.get("fraseTerceiraTampa")],
    ["Frase — meio da caixa", fd.get("fraseMeioCaixa")],
    ["Fotos (nomes dos arquivos)", nomeArquivos.join(" · ")],
    ["Rua", fd.get("rua")],
    ["Número", fd.get("numero")],
    ["Bairro", fd.get("bairro")],
    ["Cidade / UF", `${fd.get("cidade")} — ${String(fd.get("uf") || "").toUpperCase()}`],
    ["CEP", cepFmt],
    ["Referência", fd.get("referencia")?.trim() || "—"],
    ["Nome", fd.get("nomeCompleto")],
    ["CPF", formatCpf(fd.get("cpf"))],
  ];

  resumoConteudo.innerHTML = "";
  rows.forEach(([dt, dd]) => {
    const dterm = document.createElement("dt");
    dterm.textContent = dt;
    const ddef = document.createElement("dd");
    ddef.textContent = dd;
    resumoConteudo.appendChild(dterm);
    resumoConteudo.appendChild(ddef);
  });
}

btnResumo.addEventListener("click", () => {
  const erros = validar();
  if (erros.length) {
    showToast(erros[0], true);
    return;
  }
  ultimoTextoWhatsapp = "";
  ultimoFotosShare = null;
  montarResumo();
  resumoAberto = true;
  panelResumo.classList.remove("hidden");
  panelResumo.scrollIntoView({ behavior: "smooth", block: "start" });
});

btnVoltar.addEventListener("click", () => {
  resumoAberto = false;
  panelResumo.classList.add("hidden");
  form.scrollIntoView({ behavior: "smooth" });
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const erros = validar();
  if (erros.length) {
    showToast(erros[0], true);
    panelResumo.classList.add("hidden");
    resumoAberto = false;
    return;
  }

  if (!resumoAberto) {
    showToast('Use "Ver resumo antes de enviar" para revisar o pedido.', true);
    return;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    showToast("Sem conexão com a internet. Tente novamente.", true);
    return;
  }

  btnEnviar.disabled = true;
  try {
    const f1 = document.getElementById("foto1").files[0];
    const f2 = document.getElementById("foto2").files[0];
    const f3 = document.getElementById("foto3").files[0];
    const f4 = document.getElementById("foto4").files[0];
    ultimoFotosShare = f1 && f2 && f3 && f4 ? [f1, f2, f3, f4] : null;

    ultimoTextoWhatsapp = montarTextoWhatsappPedido();

    const resultado = await enviarPedidoWhatsappAgora();
    if (resultado === "cancelado") {
      return;
    }
    if (resultado === "navegando") {
      return;
    }
    finalizarPedidoAposEnvio();
    if (resultado === "ok-fotos") {
      showToast(
        "No próximo passo, escolha o WhatsApp e o contato da loja (+55 21 99672-8473). O texto e as 4 imagens vão juntos no envio."
      );
    } else if (isMobileDispositivo()) {
      showToast("WhatsApp aberto com o texto — anexe as 4 fotos se ainda não enviou.");
    } else {
      showToast(
        "Abrimos o WhatsApp Web com o texto do pedido. Anexe as 4 fotos na conversa (arrastar ou botão de clipe)."
      );
    }
  } catch (err) {
    console.error(err);
    const detalhe = err && err.message ? err.message : "falha ao processar o pedido";
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const dicaInApp = /Instagram|FBAN|FBAV|Line\/|MicroMessenger|WebView/i.test(ua)
      ? " Se estiver dentro do Instagram/WhatsApp, abra o link no Safari ou Chrome."
      : "";
    showToast(`Não foi possível concluir: ${detalhe}.${dicaInApp}`, true);
  } finally {
    btnEnviar.disabled = false;
  }
});

atualizarBannersChocolate();
