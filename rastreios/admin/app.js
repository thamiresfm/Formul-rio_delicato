const tokenInput = document.getElementById("admin-token");
const btnSalvar = document.getElementById("btn-salvar-token");
const tbody = document.getElementById("tbody-envios");
const adminMsg = document.getElementById("admin-msg");

const KEY = "delicatto_rastreio_admin_token";

function getToken() {
  return sessionStorage.getItem(KEY) || "";
}

function authHeaders() {
  const t = getToken();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Rastreio-Admin-Token": t,
  };
}

function showMsg(texto, isErr) {
  adminMsg.textContent = texto;
  adminMsg.classList.remove("state-hidden");
  adminMsg.classList.toggle("error", !!isErr);
  adminMsg.classList.toggle("info", !isErr);
}

btnSalvar.addEventListener("click", () => {
  sessionStorage.setItem(KEY, tokenInput.value.trim());
  showMsg("Token salvo neste navegador.", false);
});

tokenInput.value = getToken();

async function carregarLista() {
  const q = document.getElementById("filtro-q").value.trim();
  const status = document.getElementById("filtro-status").value.trim();
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);

  const res = await fetch(`/api/rastreio/admin/envios?${params}`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    showMsg(data.erro || "Falha ao listar (token inválido?)", true);
    return;
  }
  showMsg(`${data.envios?.length || 0} envio(s).`, false);
  tbody.innerHTML = "";
  for (const e of data.envios || []) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><code>${escapeHtml(e.codigoRastreio)}</code></td>
      <td>${escapeHtml(e.statusNormalizado)}</td>
      <td>${escapeHtml(e.transportadora || "—")}</td>
      <td>${escapeHtml(e.pedido?.codigo || "—")}</td>
      <td class="row-actions">
        <button type="button" class="btn-sm" data-sync="${e.id}">Sincronizar</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll("[data-sync]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-sync");
      const r = await fetch(`/api/rastreio/admin/envios/${id}/sincronizar`, {
        method: "POST",
        headers: authHeaders(),
      });
      const j = await r.json();
      showMsg(r.ok ? "Sincronizado." : j.erro || "Erro", !r.ok);
      if (r.ok) carregarLista();
    });
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.getElementById("btn-filtrar").addEventListener("click", carregarLista);

document.getElementById("btn-criar-pedido").addEventListener("click", async () => {
  const codigo = document.getElementById("ped-codigo").value.trim();
  const titulo = document.getElementById("ped-titulo").value.trim();
  const res = await fetch("/api/rastreio/admin/pedidos", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ codigo, titulo: titulo || undefined }),
  });
  const data = await res.json();
  showMsg(res.ok ? `Pedido criado: ${data.pedido?.id}` : data.erro || "Erro", !res.ok);
});

document.getElementById("btn-criar-envio").addEventListener("click", async () => {
  const codigoRastreio = document.getElementById("env-codigo").value.trim();
  const melhorEnvioShipmentId = document.getElementById("env-me-id").value.trim();
  const pedidoId = document.getElementById("env-pedido-id").value.trim();
  const res = await fetch("/api/rastreio/admin/envios", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      codigoRastreio,
      melhorEnvioShipmentId: melhorEnvioShipmentId || undefined,
      pedidoId: pedidoId || undefined,
    }),
  });
  const data = await res.json();
  showMsg(res.ok ? "Envio cadastrado." : data.erro || "Erro", !res.ok);
  if (res.ok) carregarLista();
});

document.getElementById("btn-sync-all").addEventListener("click", async () => {
  const res = await fetch("/api/rastreio/admin/sincronizar-todos", {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await res.json();
  showMsg(res.ok ? `Processados: ${data.total}` : data.erro || "Erro", !res.ok);
  carregarLista();
});

carregarLista();
