/**
 * Camada isolada de integração HTTP com a API Melhor Envio.
 *
 * Documentação oficial: https://docs.melhorenvio.com.br/
 *
 * IMPORTANTE — manutenção:
 * - Endpoints podem ser ajustados pela Melhor Envio. Em caso de mudança, altere apenas este arquivo.
 * - Autenticação: apenas JWT do painel ME em ME_PANEL_ACCESS_TOKEN (Permissões de acesso).
 *   Cache em memória conforme expiração do JWT.
 * - Nenhum segredo deve ir para o frontend.
 */

const ME_BASE_DEFAULT = "https://www.melhorenvio.com.br";

/** Cache em memória do JWT do painel (evita reler exp em cada request). */
let accessCache = { token: null, expiresAtMs: 0 };

function getBaseUrl() {
  let base = (process.env.ME_API_BASE || ME_BASE_DEFAULT).replace(/\/$/, "");
  // O apex (sem www) costuma responder com a SPA do site (HTML 200), não com a API JSON.
  if (/^https?:\/\/melhorenvio\.com\.br$/i.test(base)) {
    base = "https://www.melhorenvio.com.br";
  }
  return base;
}

function normalizarTextoRespostaMe(text) {
  return String(text ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
}

function corpoEhPaginaHtml(text) {
  const s = normalizarTextoRespostaMe(text);
  if (!s) return false;
  if (s[0] === "<") return true;
  return /^<!DOCTYPE\s+html/i.test(s) || /^<html[\s>/]/i.test(s);
}

function erroRespostaHtmlEmVezDeJson() {
  return new Error(
    "Melhor Envio: a resposta foi HTML (página do site) em vez de JSON. Defina ME_API_BASE como https://www.melhorenvio.com.br (com www, sem barra no fim). Evite melhorenvio.com.br sem www e confira o path /api/v2/me/…"
  );
}

function jsonOuErroMe(text, contexto) {
  const trimmed = normalizarTextoRespostaMe(text);
  if (!trimmed) {
    throw new Error(`Melhor Envio: resposta vazia (${contexto})`);
  }
  if (corpoEhPaginaHtml(trimmed)) {
    throw erroRespostaHtmlEmVezDeJson();
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    if (trimmed[0] === "<") {
      throw erroRespostaHtmlEmVezDeJson();
    }
    throw new Error(
      `Melhor Envio: corpo não é JSON (${contexto}): ${trimmed.slice(0, 200)}`
    );
  }
}

/**
 * ME /orders/search pode devolver:
 * - array direto [...]
 * - paginação estilo Laravel: { current_page, data: [...], total, per_page, last_page, ... }
 */
function listaOrdersSearch(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];
  if (Array.isArray(parsed.data)) return parsed.data;
  if (Array.isArray(parsed.orders)) return parsed.orders;
  if (Array.isArray(parsed.results)) return parsed.results;
  if (Array.isArray(parsed.items)) return parsed.items;
  return [];
}

/**
 * Doc ME: User-Agent obrigatório com nome da aplicação + e-mail de suporte.
 * @see https://docs.melhorenvio.com.br/reference/introducao-api-melhor-envio
 */
function userAgentMelhorEnvio() {
  const custom = String(process.env.ME_USER_AGENT || "").trim();
  if (custom) return custom;
  const email = String(process.env.ME_CONTACT_EMAIL || "").trim();
  if (email) {
    return `Delicatto Personalizados (${email})`;
  }
  return "DelicattoRastreio/1.0 (Node)";
}

/** Lê `exp` do JWT (segundos → ms) para cache; retorna null se inválido. */
function jwtExpParaMs(token) {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const payload = JSON.parse(Buffer.from(b64 + pad, "base64").toString("utf8"));
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Bearer JWT do painel ME (ME_PANEL_ACCESS_TOKEN). Único modo de autenticação suportado.
 */
async function obterAccessToken() {
  const now = Date.now();
  const panel = String(process.env.ME_PANEL_ACCESS_TOKEN || "").trim();
  if (panel.length === 0) {
    throw new Error(
      "Melhor Envio: defina ME_PANEL_ACCESS_TOKEN (JWT em Permissões de acesso no painel ME)."
    );
  }
  if (accessCache.token === panel && now < accessCache.expiresAtMs - 90_000) {
    return accessCache.token;
  }
  const expMs = jwtExpParaMs(panel);
  if (expMs != null && expMs <= now) {
    throw new Error(
      "Melhor Envio: ME_PANEL_ACCESS_TOKEN expirou. Gere um novo em Permissões de acesso no painel ME."
    );
  }
  const ate = expMs != null ? expMs : now + 86400 * 1000;
  accessCache = { token: panel, expiresAtMs: ate };
  return panel;
}

/**
 * Busca dados da etiqueta no Melhor Envio pelo ID retornado em orders/search.
 *
 * Doc ME: GET /api/v2/me/orders/{id} — id da order correspondente à etiqueta.
 * @see https://docs.melhorenvio.com.br/reference/listar-informacoes-de-uma-etiqueta
 */
async function buscarEnvioPorId(shipmentId) {
  const token = await obterAccessToken();
  const base = getBaseUrl();
  const id = encodeURIComponent(String(shipmentId).trim());

  const candidatos = [
    `${base}/api/v2/me/orders/${id}`,
    `${base}/api/v2/me/shipment/${id}`,
    `${base}/api/v2/me/shipments/${id}`,
  ];

  let ultimoErro = null;
  for (const url of candidatos) {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": userAgentMelhorEnvio(),
      },
    });
    const bodyText = await res.text();
    if (res.ok) {
      const trimmed = normalizarTextoRespostaMe(bodyText);
      if (!trimmed) {
        ultimoErro = `${res.status} corpo vazio`;
        continue;
      }
      return jsonOuErroMe(bodyText, `orders/${id}`);
    }
    if (corpoEhPaginaHtml(bodyText)) {
      throw erroRespostaHtmlEmVezDeJson();
    }
    ultimoErro = `${res.status} ${bodyText.slice(0, 200)}`;
  }
  throw new Error(`Melhor Envio: não foi possível buscar envio ${id}. Último: ${ultimoErro}`);
}

/**
 * Pesquisa pedidos/envios pelo termo `q` (documentação: código de rastreio, protocolo, id, etc.).
 * @see https://docs.melhorenvio.com.br/reference/pesquisar-etiqueta
 */
async function pesquisarPedidosPorTermo(q) {
  const termo = String(q || "").trim();
  if (termo.length < 3) {
    return [];
  }
  const token = await obterAccessToken();
  const base = getBaseUrl();
  const url = `${base}/api/v2/me/orders/search?q=${encodeURIComponent(termo)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": userAgentMelhorEnvio(),
    },
  });
  // GET /orders/search: a ME costuma devolver **204 No Content** quando não há etiqueta
  // que corresponda ao `q` (id, protocolo, tracking, autorização, documento). É sucesso
  // sem corpo — não é falha de autenticação. Ver discussão:
  // https://docs.melhorenvio.com.br/discuss/67f00f0fd399010012fe3e5c
  // Doc: https://docs.melhorenvio.com.br/reference/pesquisar-etiqueta
  if (res.status === 204) {
    return [];
  }
  const text = await res.text();
  if (corpoEhPaginaHtml(text)) {
    throw erroRespostaHtmlEmVezDeJson();
  }
  if (!res.ok) {
    throw new Error(`Melhor Envio: pesquisa falhou (${res.status}): ${text.slice(0, 400)}`);
  }
  const trimmed = normalizarTextoRespostaMe(text);
  // GET search: 2xx sem corpo costuma significar “nenhum resultado” (equivale a []).
  if (!trimmed && res.ok) {
    return [];
  }
  const parsed = jsonOuErroMe(text, "orders/search");
  return listaOrdersSearch(parsed);
}

/**
 * Data para o marco sintético "Em transporte" quando a ME não envia events[].
 * Usa campos explícitos da API; senão infere entre postado e entregue ou updated_at.
 */
function dataMarcoEmTransporte(payload) {
  if (!payload || typeof payload !== "object") return null;
  const direto =
    payload.in_transit_at ||
    payload.inTransitAt ||
    payload.shipped_at ||
    payload.shippedAt ||
    payload.on_carriage_at ||
    payload.onCarriageAt;
  if (direto) return direto;

  const posted = payload.posted_at;
  const delivered = payload.delivered_at;
  const updated = payload.updated_at;
  const tPosted = posted ? new Date(posted).getTime() : NaN;
  const tDelivered = delivered ? new Date(delivered).getTime() : NaN;
  const tUpdated = updated ? new Date(updated).getTime() : NaN;
  const st = String(payload.status || "").toLowerCase();

  const statusEmRota = /in_transit|on_carriage|carried|shipped|delivered/.test(st);

  if (Number.isFinite(tPosted) && Number.isFinite(tDelivered) && tDelivered > tPosted) {
    return new Date(Math.floor((tPosted + tDelivered) / 2)).toISOString();
  }
  if (statusEmRota && Number.isFinite(tPosted)) {
    if (Number.isFinite(tUpdated) && tUpdated > tPosted) {
      if (!Number.isFinite(tDelivered) || tUpdated <= tDelivered) return updated;
    }
    return updated || posted;
  }
  return null;
}

/**
 * Tenta extrair "Cidade/UF" ou trecho após traço em textos de rastreio (ex.: descrição da transportadora).
 */
function extrairLocalidadeDeTexto(s) {
  const t = String(s || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  const m2 = t.match(/\b([A-Za-zÀ-ú][A-Za-zÀ-ú\s'.-]{1,40})\s*\/\s*([A-Z]{2})\b/);
  if (m2) return `${m2[1].trim()}/${m2[2]}`;
  const m1 = t.match(/[—\-–]\s*([A-Za-zÀ-ú0-9][A-Za-zÀ-ú0-9\s'.-]{1,60}\/[A-Z]{2})\s*$/i);
  if (m1) return m1[1].trim();
  return "";
}

/** Cidade/UF a partir de blocos `from` / `to` / `address` da API ME. */
function cidadeUfMe(part) {
  if (!part || typeof part !== "object") return "";
  const city = String(part.city || "").trim();
  const uf = String(part.state_abbr || part.state || "")
    .trim()
    .replace(/^([a-z]{2})$/i, (m) => m.toUpperCase());
  if (city && uf && uf.length <= 2) return `${city}/${uf}`;
  if (city) return city;
  return "";
}

/** Agência / ponto de postagem: só cidade/UF do endereço (sem nome comercial da unidade). */
function localUnidadeAgencia(agency) {
  if (!agency || typeof agency !== "object") return "";
  const addr = agency.address;
  if (addr && typeof addr === "object") {
    const loc = cidadeUfMe(addr);
    if (loc) return loc;
  }
  return "";
}

/**
 * Quando a ME não envia `events[]` (só o pedido), preenche `local` com origem, agência, roteamento e destino.
 * Não substitui local já vindo de evento de rastreio da transportadora.
 */
function enriquecerLocaisComPedidoMe(eventos, payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(eventos)) return eventos;
  const fromLoc = cidadeUfMe(payload.from);
  const toLoc = cidadeUfMe(payload.to);
  const agencyLoc = localUnidadeAgencia(payload.agency);
  const sort = String(payload.additional_info?.sortingCode || "").trim();

  return eventos.map((e) => {
    if (e.local && String(e.local).trim()) return e;
    const st = String(e.statusRaw || "").toLowerCase();
    const tit = String(e.descricao || "").toLowerCase();

    if (st === "generated" || /etiqueta\s+gerada/.test(tit)) {
      return { ...e, local: fromLoc || agencyLoc || null };
    }
    if (st === "posted" || /^postado/.test(tit)) {
      return { ...e, local: agencyLoc || fromLoc || null };
    }
    if (st === "in_transit" || /em\s+transporte/.test(tit)) {
      const parts = [];
      if (sort) parts.push(sort.trim());
      if (toLoc) parts.push(`→ ${toLoc}`);
      const loc = parts.length ? parts.join(" ") : toLoc || fromLoc || null;
      return { ...e, local: loc };
    }
    if (st === "delivered" || /^entregue/.test(tit)) {
      return { ...e, local: toLoc || null };
    }
    return e;
  });
}

/**
 * Local/unidade a partir de campos comuns da ME e transportadoras (sem persistência).
 */
function textoLocalDeEvento(ev) {
  if (!ev || typeof ev !== "object") return "";
  const parts = [
    ev.location,
    ev.locality,
    ev.local,
    ev.place,
    ev.place_name,
    ev.unit,
    ev.branch_name,
    ev.branch,
    ev.facility,
    ev.hub,
    ev.hub_name,
    ev.office_name,
    ev.service_point,
    ev.city && (ev.state || ev.uf) ? `${ev.city}/${ev.state || ev.uf}` : null,
    ev.city && !ev.state ? ev.city : null,
    ev.city_name && (ev.state_name || ev.state_abbr || ev.state)
      ? `${ev.city_name}/${ev.state_name || ev.state_abbr || ev.state}`
      : null,
    ev.city_name && !ev.state_name ? ev.city_name : null,
  ].filter(Boolean);
  if (parts.length) return parts.map(String).join(" — ");
  const L = ev.localization;
  if (L && typeof L === "object") {
    const citySt = [L.city, L.state || L.uf].filter(Boolean).join("/");
    return [L.name || L.unit, citySt].filter(Boolean).join(" — ");
  }
  const addr = ev.address;
  if (addr && typeof addr === "object") {
    const citySt = [addr.city, addr.state || addr.uf].filter(Boolean).join("/");
    return [addr.name, citySt].filter(Boolean).join(" — ");
  }
  const to = ev.to;
  if (to && typeof to === "object") {
    const citySt = [to.city, to.state || to.uf].filter(Boolean).join("/");
    return [to.name, citySt].filter(Boolean).join(" — ");
  }
  const from = ev.from;
  if (from && typeof from === "object") {
    const citySt = [from.city, from.state || from.uf].filter(Boolean).join("/");
    return [from.name, citySt].filter(Boolean).join(" — ");
  }
  const data = ev.data;
  if (data && typeof data === "object" && data.location) {
    const loc = data.location;
    if (typeof loc === "string") return loc;
    if (typeof loc === "object") {
      const citySt = [loc.city, loc.state || loc.uf].filter(Boolean).join("/");
      return [loc.name, citySt].filter(Boolean).join(" — ");
    }
  }
  return "";
}

function tituloEDetalheEvento(ev) {
  const title = ev.title || ev.name;
  const desc = ev.description || ev.message || ev.details;
  if (title && desc && String(title).trim() !== String(desc).trim()) {
    return { titulo: String(title).trim(), detalhe: String(desc).trim() };
  }
  const titulo = String(desc || title || ev.status || "Atualização").trim() || "Atualização";
  const extras = [ev.details, ev.subtitle, ev.sub_description, ev.note, ev.observation]
    .map((x) => String(x || "").trim())
    .filter((x) => x && x !== titulo);
  return { titulo, detalhe: extras[0] || "" };
}

function normalizarEventoParaDominio(ev, toDate) {
  const when = ev.created_at || ev.date || ev.occurred_at || ev.datetime || null;
  const { titulo, detalhe } = tituloEDetalheEvento(ev);
  let local = textoLocalDeEvento(ev).trim();
  if (!local) {
    local = extrairLocalidadeDeTexto(`${titulo} ${detalhe || ""}`).trim();
  }
  const st = ev.status || ev.state || null;
  return {
    ocorridoEm: toDate(when),
    descricao: titulo,
    detalhe: detalhe || null,
    local: local || null,
    statusRaw: st ? String(st) : null,
  };
}

/**
 * Normaliza payload diverso da API para um formato estável usado pelo domínio.
 */
function extrairCamposDoPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return {
      statusRaw: null,
      tracking: null,
      transportadora: null,
      dataCriacao: null,
      dataAtualizacao: null,
      eventos: [],
    };
  }

  const statusRaw =
    payload.status ||
    payload.state ||
    payload.situation ||
    (payload.data && payload.data.status) ||
    null;

  const tracking =
    payload.tracking ||
    payload.tracking_code ||
    payload.code ||
    payload.trackingCode ||
    null;

  const transportadora =
    payload.service?.company?.name ||
    payload.company?.name ||
    payload.carrier?.name ||
    payload.service?.name ||
    null;

  let dataCriacao = payload.created_at || payload.createdAt || payload.created || null;
  let dataAtualizacao = payload.updated_at || payload.updatedAt || payload.updated || null;

  const toDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  let eventosBrutos = Array.isArray(payload.events)
    ? payload.events
    : Array.isArray(payload.tracking_events)
      ? payload.tracking_events
      : Array.isArray(payload.history)
        ? payload.history
        : [];

  if (eventosBrutos.length === 0) {
    const emTransporte = dataMarcoEmTransporte(payload);
    const marcos = [
      {
        created_at: payload.generated_at,
        description: "Etiqueta gerada",
        details: "Registro da etiqueta no Melhor Envio.",
        status: "generated",
      },
      {
        created_at: payload.posted_at,
        description: "Postado",
        details: "Enviado à transportadora para seguir ao destino.",
        status: "posted",
      },
      {
        created_at: emTransporte,
        description: "Em transporte",
        details: "Pacote em rota até o destino.",
        status: "in_transit",
      },
      {
        created_at: payload.delivered_at,
        description: "Entregue",
        details: "Situação finalizada junto à transportadora.",
        status: "delivered",
      },
    ].filter((m) => m.created_at);
    marcos.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    eventosBrutos = marcos;
  }

  let eventos = eventosBrutos.map((ev) => normalizarEventoParaDominio(ev, toDate));

  const textoEvento = (e) => `${e.descricao || ""} ${e.detalhe || ""}`;
  const descSugereTransporte = (txt) =>
    /trânsito|transito|em transporte|transporte|encaminhado|roteiriza|carried|in_transit|em trânsito/i.test(
      String(txt || "")
    );
  const jaTemTransporte = eventos.some((e) => descSugereTransporte(textoEvento(e)));
  if (!jaTemTransporte) {
    const whenTransit = dataMarcoEmTransporte(payload);
    const o = toDate(whenTransit);
    if (o) {
      eventos.push({
        ocorridoEm: o,
        descricao: "Em transporte",
        detalhe: "Pacote em rota até o destino.",
        local: null,
        statusRaw: "in_transit",
      });
      eventos.sort((a, b) => {
        const ta = a.ocorridoEm instanceof Date ? a.ocorridoEm.getTime() : 0;
        const tb = b.ocorridoEm instanceof Date ? b.ocorridoEm.getTime() : 0;
        return ta - tb;
      });
    }
  }

  eventos = enriquecerLocaisComPedidoMe(eventos, payload);

  return {
    statusRaw: statusRaw ? String(statusRaw) : null,
    tracking: tracking ? String(tracking) : null,
    transportadora: transportadora ? String(transportadora) : null,
    dataCriacao: toDate(dataCriacao),
    dataAtualizacao: toDate(dataAtualizacao),
    eventos,
  };
}

module.exports = {
  obterAccessToken,
  buscarEnvioPorId,
  pesquisarPedidosPorTermo,
  extrairCamposDoPayload,
  getBaseUrl,
};
