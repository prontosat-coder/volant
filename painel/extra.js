"use strict";
// Painel VolAnt: Uso por conta (1.0.1), Apoios à colônia, Financeiro, Excluir do app (0.30.14) Falhas do app (0.30.17), Assinaturas e Pontos (0.30.18), Liberar Pro e aviso de versão (1.0.0).
// Usa as peças do painel (window.volantPainel) e só chama funções de administrador.
(() => {
  const P = window.volantPainel;
  if (!P) return;
  const { rpc, criar: h, um: q, erro, tabela, num, data, dataHora } = P;
  const sv = (tag, attrs, ...filhos) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.append(...filhos);
    return el;
  };
  const dinheiro = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const frases = {
    site_sem_https: "O site precisa começar com https://",
    logo_sem_https: "O endereço do logo precisa começar com https://",
    ponto_pela_metade: "Confira o ponto no mapa: são dois números, separados por vírgula.",
    nao_achei: "Não achei esse item. Atualize a tela.",
    ainda_rascunho: "Este anúncio ainda é rascunho: use Ativar.",
    evento_sem_titulo: "Escreva o nome do evento (pelo menos 3 letras).",
    evento_sem_data: "Confira o dia e os horários do evento.",
    evento_passou: "Esse evento já terminou: confira o dia e os horários.",
    evento_nao_renova: "Evento não se renova: crie um novo para outra data.",
    tipo_desconhecido: "Escolha Apoio ou Evento.",
  };
  const dizer = (e) => frases[e.message] || e.message;
  const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  // ---------- modal ----------
  const fechar = () => q("#modal").classList.remove("on");
  function abrir(titulo, corpo, botao, aoConfirmar) {
    const falha = h("p", { class: "erro" });
    const ok = h("button", { class: "bt azul", type: "button" }, botao);
    ok.addEventListener("click", async () => {
      falha.textContent = "";
      ok.disabled = true;
      try {
        await aoConfirmar();
        fechar();
      } catch (e) {
        falha.textContent = dizer(e);
      }
      ok.disabled = false;
    });
    q("#modalCaixa").replaceChildren(
      h("h3", {}, titulo), ...[corpo].flat(), falha,
      h("div", { class: "linha", style: "justify-content:flex-end" },
        h("button", { class: "bt fino", type: "button", onclick: fechar }, "Cancelar"), ok));
    q("#modal").classList.add("on");
  }
  const campo = (rotulo, el, dica) =>
    h("label", { style: "display:grid;gap:4px;font-size:12.5px;color:var(--texto3);font-weight:600" }, rotulo, el,
      dica ? h("span", { style: "font-weight:400" }, dica) : "");
  const texto = (valor, extra = {}) => h("input", { type: "text", value: valor ?? "", style: "width:100%", ...extra });
  const escolha = (opcoes, valor) => {
    const s = h("select", { style: "width:100%" }, ...opcoes.map(([v, n]) => h("option", { value: v }, n)));
    s.value = String(valor ?? opcoes[0][0]);
    return s;
  };

  // Contador ao lado do campo: "28/32". Passou do que cabe na linha do app: fica amarelo.
  function contador(el, cabe, dica) {
    const c = h("span", { style: "font-weight:600" });
    const contar = () => {
      const n = el.value.trim().length;
      c.textContent = `${n}/${cabe}`;
      c.style.color = n > cabe ? "var(--amarelo, #FFC83D)" : "var(--texto3)";
      c.title = n > cabe ? dica : "";
    };
    el.addEventListener("input", contar);
    contar();
    return c;
  }
  const campoContado = (rotulo, el, cabe, dica, ajuda) =>
    h("label", { style: "display:grid;gap:4px;font-size:12.5px;color:var(--texto3);font-weight:600" },
      h("span", { style: "display:flex;justify-content:space-between;gap:8px" }, rotulo, contador(el, cabe, dica)), el,
      ajuda ? h("span", { style: "font-weight:400" }, ajuda) : "");

  // Quando é o evento, como no app: "Hoje, 14h às 18h", "Sábado, 28/11, 14h às 18h".
  function quandoDoEvento(inicio, fim) {
    const fuso = { timeZone: "America/Sao_Paulo" };
    const dia = (d) => d.toLocaleDateString("sv-SE", fuso);
    const hora = (d) => {
      const [hh, mm] = d.toLocaleTimeString("pt-BR", { ...fuso, hour: "2-digit", minute: "2-digit", hour12: false }).split(":");
      return mm === "00" ? `${+hh}h` : `${+hh}h${mm}`;
    };
    const hoje = new Date(dia(new Date()) + "T12:00:00"), d = new Date(dia(inicio) + "T12:00:00");
    const diferenca = Math.round((d - hoje) / 864e5);
    const nomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const qual = diferenca <= 0 ? "Hoje" : diferenca === 1 ? "Amanhã"
      : `${nomes[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    return dia(inicio) === dia(fim) ? `${qual}, ${hora(inicio)} às ${hora(fim)}` : `${qual}, ${hora(inicio)}`;
  }

  // Prévia de como aparece no app: a linha de cima do mapa e o cartão (cores do app).
  function previaNoApp() {
    const caixa = h("div", { style: "background:#0E1B2E;border-radius:14px;padding:12px;display:grid;gap:10px" });
    const desenhar = ({ evento, nome, titulo, sub, quando, beneficio, horario, logo, destaque, telefone, whatsapp, site }) => {
      const cor = evento ? "#FF7EB6" : "#FFD24A";
      const quadrado = (lado, fonte) => {
        const q2 = h("div", { style: `width:${lado}px;height:${lado}px;border-radius:${lado / 4}px;background:#0E1B2E;display:flex;align-items:center;justify-content:center;overflow:hidden;color:${cor};font-weight:800;font-size:${fonte}px;flex:none` });
        if (evento) q2.append(sv("svg", { viewBox: "0 0 24 24", width: fonte, height: fonte, fill: cor },
          sv("path", { d: "M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V9h14v11ZM7 11h5v5H7z" })));
        else if (logo) q2.append(h("img", { src: logo, alt: "", style: "width:100%;height:100%;object-fit:cover" }));
        else q2.append((nome || "?").trim().charAt(0).toUpperCase() || "?");
        return q2;
      };
      const etiqueta = (t) => h("span", { style: `background:${cor}2e;color:${cor};border-radius:999px;padding:1px 7px;font-size:11px;font-weight:700;white-space:nowrap` }, t);
      const umaLinha = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
      const grande = evento ? (titulo || "Nome do evento") : (nome || "Nome do parceiro");
      const embaixo = evento ? quando : (beneficio || sub);
      // A largura do celular mais comum (360 de largura): o que passar some com "...".
      const linha = h("div", { style: `width:336px;max-width:100%;height:52px;box-sizing:border-box;background:#16263D;border:1.5px solid ${cor}73;border-radius:12px;display:flex;align-items:center;gap:10px;padding:0 10px 0 9px` },
        quadrado(34, 16),
        h("div", { style: "flex:1;min-width:0" },
          h("div", { style: `${umaLinha};color:#F2F6FB;font-weight:700;font-size:13.5px` }, grande, h("span", { style: "color:#9FB0C6;font-weight:400;font-size:12px" }, " · 1,2 km")),
          embaixo ? h("div", { style: `${umaLinha};color:${evento ? "#FF7EB6" : "#2FD27A"};font-weight:600;font-size:12.5px` }, embaixo) : ""),
        etiqueta(evento ? "Evento" : "Apoio"));
      const cartao = h("div", { style: `width:336px;max-width:100%;box-sizing:border-box;background:#16263D;border:2px solid ${cor};border-radius:18px;padding:12px 14px;display:grid;gap:8px` },
        h("div", { style: "display:flex;align-items:center;gap:10px" }, quadrado(44, 22),
          h("div", { style: "flex:1;min-width:0" },
            h("div", { style: "color:#F2F6FB;font-weight:700;font-size:16px" }, grande),
            h("div", { style: "color:#9FB0C6;font-size:12.5px" }, [evento ? `por ${nome || "parceiro"}` : sub, "1,2 km"].filter(Boolean).join(" · "))),
          etiqueta(evento ? "Evento" : destaque ? "Apoiador destaque" : "Apoiador")),
        evento ? h("div", { style: "color:#F2F6FB;font-weight:700;font-size:13.5px" }, "🕑 " + (quando || "Dia e hora"))
          : horario ? h("div", { style: "color:#C5D2E3;font-size:13px" }, horario) : "",
        beneficio ? h("div", { style: "background:#173B33;color:#F2F6FB;border-radius:10px;padding:8px 10px;font-size:13px" }, "🎁 Para a colônia: " + beneficio) : "",
        // Os botões: só aparece o que tem para onde ir. Com WhatsApp, ele entra no lugar do Ligar.
        h("div", { style: "display:flex;gap:6px" }, ...["Ir", String(telefone || "").replace(/\D/g, "").length >= 8 ? (whatsapp ? "WhatsApp" : "Ligar") : "",
          /^https:\/\/./i.test(String(site || "").trim()) ? "Site" : ""].filter(Boolean).map((b) =>
          h("div", { style: "flex:1;height:34px;border:2px solid #2A3D57;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#5AB0FF;font-weight:700;font-size:12.5px" }, b))));
      caixa.replaceChildren(
        h("div", { style: "color:#9FB0C6;font-size:11.5px;font-weight:600" }, "Como aparece no app: a linha em cima do mapa"), linha,
        h("div", { style: "color:#9FB0C6;font-size:11.5px;font-weight:600" }, "e o cartão, ao tocar"), cartao);
    };
    return { caixa, desenhar };
  }

  // Envia a imagem do parceiro para o servidor (pasta "apoios") e devolve o endereço público.
  async function enviarImagem(arquivo) {
    const tipos = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
    if (!tipos[arquivo.type]) throw new Error("A imagem precisa ser PNG, JPG ou WebP.");
    if (arquivo.size > 500 * 1024) throw new Error("A imagem passa de 500 KB. Diminua e tente de novo.");
    const caminho = `parceiros/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${tipos[arquivo.type]}`;
    const r = await fetch(`${P.base}/storage/v1/object/apoios/${caminho}`, {
      method: "POST",
      headers: { apikey: P.chave, Authorization: "Bearer " + await P.token(), "Content-Type": arquivo.type, "x-upsert": "false" },
      body: arquivo,
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.statusCode === "403" || r.status === 403
        ? "O servidor recusou a imagem: entre de novo com o código e tente outra vez."
        : `Não deu para enviar a imagem (${e.message || r.status}).`);
    }
    return `${P.base}/storage/v1/object/public/apoios/${caminho}`;
  }

  // Lê o tamanho da imagem escolhida (para avisar se não é quadrada ou é pequena).
  const medidas = (arquivo) => new Promise((ok) => {
    const img = new Image();
    img.onload = () => { ok([img.naturalWidth, img.naturalHeight]); URL.revokeObjectURL(img.src); };
    img.onerror = () => ok([0, 0]);
    img.src = URL.createObjectURL(arquivo);
  });

  // ===================================================================================
  // APOIOS
  // ===================================================================================
  let parceiros = [], anuncios = [], cidades = [];
  const situacoes = {
    ativo: ["bom", "Ativo"], vence_logo: ["atencao", "Vence logo"], vencido: ["critico", "Vencido"],
    pausado: ["neutro", "Pausado"], rascunho: ["neutro", "Rascunho"],
  };
  const niveis = { apoiador: "Apoiador", destaque: "Destaque" };

  async function apoios() {
    const onde = q("#listaAnuncios");
    try {
      [parceiros, anuncios, cidades] = await Promise.all([
        rpc("admin_parceiros"), rpc("admin_anuncios"),
        cidades.length ? cidades : rpc("admin_colonias").then((l) => l.filter((c) => c.ativa)),
      ]);
    } catch (e) {
      return erro(onde, e);
    }
    const logo = anuncios.filter((a) => a.situacao === "vence_logo").length;
    const vencidos = anuncios.filter((a) => a.situacao === "vencido").length;
    q("#avisoApoios").replaceChildren(...[
      logo ? h("div", { class: "geral atencao" }, `${logo} anúncio(s) vencem nos próximos 15 dias.`) : "",
      vencidos ? h("div", { class: "geral critico" }, `${vencidos} anúncio(s) vencido(s): já saíram do mapa. Use "Renovar" para voltar.`) : "",
    ]);
    onde.replaceChildren(...(anuncios.length ? anuncios.map(linhaDoAnuncio)
      : [h("p", { class: "vazio" }, parceiros.length
        ? 'Nenhum anúncio ainda. Toque em "Novo anúncio".'
        : 'Comece por "Novo parceiro" (a empresa) e depois crie o anúncio dela.')]));
    q("#listaParceiros").replaceChildren(parceiros.length
      ? tabela(["Parceiro", "Categoria", "Telefone", "Site", "Anúncios", ""], parceiros.map((p) => [
        p.nome, p.categoria || "—", p.telefone ? p.telefone + (p.whatsapp ? " · WhatsApp" : "") : "—", p.site || "—", num(p.anuncios),
        h("button", { class: "bt fino", type: "button", onclick: () => formParceiro(p) }, "Editar")]), [4])
      : h("p", { class: "vazio" }, "Nenhum parceiro cadastrado."));
  }

  function linhaDoAnuncio(a) {
    const [cor, nome] = situacoes[a.situacao] || ["neutro", a.situacao];
    const acao = (rotulo, oQue, classe = "fino") =>
      h("button", { class: "bt " + classe, type: "button", onclick: () => acaoNoAnuncio(a, oQue, rotulo) }, rotulo);
    const evento = a.tipo === "evento";
    const comWhats = !!(parceiros.find((x) => x.id === a.parceiro) || {}).whatsapp;
    const periodo = evento
      ? `Evento: ${quandoDoEvento(new Date(a.evento_inicio), new Date(a.evento_fim))}${a.inicio ? " · sai do mapa quando terminar" : " · entra no mapa quando você ativar"}`
      : a.inicio ? `De ${data(a.inicio + "T12:00:00")} até ${data(a.fim + "T12:00:00")}` : "Começa quando você ativar";
    const pessoas = (p, t) => h("span", { title: `${num(t)} toques no total` }, h("b", {}, num(p)), h("span", { style: "opacity:.7" }, ` (${num(t)})`));
    return h("div", { class: "it" },
      h("div", {},
        h("span", { class: "estado " + cor }, nome), " ",
        evento ? h("span", { class: "estado neutro", style: "color:#FF7EB6" }, "Evento") : "", evento ? " " : "",
        h("b", {}, evento ? `${a.titulo} · ${a.parceiro_nome}` : a.parceiro_nome),
        h("p", {}, [a.categoria, a.cidade, evento ? `${niveis[a.nivel]} · ${dinheiro(a.valor_mes)}` : `${niveis[a.nivel]} · ${a.meses} meses · ${dinheiro(a.valor_mes)}/mês`].filter(Boolean).join(" · ")),
        h("div", { class: "meta" }, `${periodo} · ${a.lat == null ? "sem ponto no mapa (não aparece no app)" : "com ponto no mapa"}`),
        h("div", { class: "meta" }, "Pessoas diferentes (toques): abriram o cartão ", pessoas(a.pessoas_vistas, a.vistas),
          " · Ir ", pessoas(a.pessoas_ir, a.toques_ir), comWhats ? " · WhatsApp " : " · Ligar ", pessoas(a.pessoas_ligar, a.toques_ligar),
          " · Site ", pessoas(a.pessoas_site, a.toques_site), ` · Recebido: ${dinheiro(a.recebido)}`)),
      h("div", { class: "acoes" },
        h("button", { class: "bt fino", type: "button", onclick: () => formAnuncio(a) }, "Editar"),
        a.status === "rascunho" ? acao("Ativar", "ativar", "azul") : "",
        a.status === "ativo" ? acao("Pausar", "pausar") : "",
        a.status === "pausado" ? acao("Retomar", "retomar", "azul") : "",
        a.status !== "rascunho" && !evento ? acao("Renovar", "renovar", a.situacao === "ativo" ? "fino" : "azul") : "",
        h("button", { class: "bt fino", type: "button", onclick: () => formRecebimento(a) }, "Recebimento")));
  }

  function acaoNoAnuncio(a, oQue, rotulo) {
    const explica = {
      ativar: a.tipo === "evento"
        ? "O evento entra no mapa agora e sai sozinho quando terminar."
        : `O anúncio entra no mapa agora e vale por ${a.meses} meses a partir de hoje.`,
      pausar: "O anúncio sai do mapa. Nada se perde, e o prazo continua correndo.",
      retomar: "O anúncio volta para o mapa.",
      renovar: `Soma mais ${a.meses} meses ao fim do anúncio (ou a partir de hoje, se já venceu).`,
    }[oQue];
    abrir(`${rotulo}: ${a.tipo === "evento" ? a.titulo : a.parceiro_nome}`, h("p", { class: "sub" }, explica), rotulo, async () => {
      await rpc("admin_acao_no_anuncio", { p_id: a.id, p_acao: oQue });
      await apoios();
    });
  }

  function formParceiro(p = {}) {
    const nome = texto(p.nome, { maxlength: "40" }), categoria = texto(p.categoria, { maxlength: "60", placeholder: "Ex.: Rastreamento veicular" }),
      telefone = texto(p.telefone, { maxlength: "30", placeholder: "(55) 0000-0000" }), site = texto(p.site, { maxlength: "200", placeholder: "https://" }),
      contato = texto(p.contato, { maxlength: "200" });
    const whats = h("input", { type: "checkbox" });
    whats.checked = !!p.whatsapp;
    // A imagem: escolhe no computador; o painel envia ao salvar.
    let logo = p.logo || "", arquivo = null;
    const arquivoEl = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", style: "display:none" });
    const avisoImg = h("span", { style: "font-weight:400" }, "Quadrada, 512 × 512 px, PNG ou JPG, até 500 KB. Logo centralizado, com margem, que apareça em fundo escuro.");
    const tirar = h("button", { class: "bt fino", type: "button" }, "Tirar imagem");
    const previa = previaNoApp();
    const redesenhar = () => {
      tirar.style.display = logo || arquivo ? "" : "none";
      previa.desenhar({ nome: nome.value.trim(), sub: categoria.value.trim(), logo: arquivo ? URL.createObjectURL(arquivo) : logo,
        beneficio: "10% para motorista de app", horario: "Seg a sex, 8h às 18h",
        telefone: telefone.value, whatsapp: whats.checked, site: site.value });
    };
    arquivoEl.addEventListener("change", async () => {
      const f = arquivoEl.files[0];
      if (!f) return;
      if (f.size > 500 * 1024) {
        avisoImg.textContent = `Essa imagem tem ${Math.round(f.size / 1024)} KB: o limite é 500 KB.`;
        avisoImg.style.color = "#FF5A5A";
        return;
      }
      const [l, a] = await medidas(f);
      arquivo = f;
      avisoImg.style.color = l !== a || l < 256 ? "#FFC83D" : "";
      avisoImg.textContent = l !== a ? `Essa imagem tem ${l} × ${a} px: não é quadrada, então as bordas vão ser cortadas. Confira na prévia.`
        : l < 256 ? `Essa imagem tem ${l} × ${a} px: pode ficar borrada. O ideal é 512 × 512.` : `${l} × ${a} px · ${Math.round(f.size / 1024)} KB. Vai ser enviada ao salvar.`;
      redesenhar();
    });
    tirar.addEventListener("click", () => { logo = ""; arquivo = null; arquivoEl.value = ""; redesenhar(); });
    for (const el of [nome, categoria, telefone, site]) el.addEventListener("input", redesenhar);
    whats.addEventListener("change", redesenhar);
    redesenhar();
    abrir(p.id ? "Editar parceiro" : "Novo parceiro", [
      campoContado("Nome (aparece no app)", nome, 20, "Passa do que cabe na linha de cima do mapa (aparece com ...); no cartão aparece inteiro."),
      campoContado("Categoria (aparece no app)", categoria, 25, "Passa do que cabe no cartão."),
      campo("Telefone (botão Ligar ou WhatsApp)", telefone),
      h("label", { style: "display:flex;gap:8px;align-items:center;font-size:13px;color:var(--texto2);cursor:pointer;margin-top:-4px" }, whats,
        "Este número tem WhatsApp (no app aparece o botão WhatsApp no lugar do Ligar)"),
      campo("Site (botão Site)", site),
      h("label", { style: "display:grid;gap:4px;font-size:12.5px;color:var(--texto3);font-weight:600" }, "Imagem do logo",
        h("div", { class: "linha" }, h("button", { class: "bt fino", type: "button", onclick: () => arquivoEl.click() }, "Escolher imagem"), tirar, arquivoEl),
        avisoImg),
      previa.caixa,
      campo("Contato, só para você", contato, "Não aparece no app."),
    ], "Salvar", async () => {
      if (nome.value.trim().length < 2) throw new Error("Escreva o nome do parceiro.");
      if (arquivo) logo = await enviarImagem(arquivo);
      await rpc("admin_guardar_parceiro", {
        p_id: p.id ?? null, p_nome: nome.value, p_categoria: categoria.value, p_telefone: telefone.value,
        p_site: site.value.trim(), p_logo: logo, p_contato: contato.value, p_whatsapp: whats.checked,
      });
      await apoios();
    });
  }

  // "-29.6842, -53.8069" (como o Google Maps copia) vira os dois números.
  function lerPonto(t) {
    const s = String(t || "").trim();
    if (!s) return [null, null];
    const m = s.match(/^\s*(-?\d{1,2}[.,]\d+)\s*[,;\s]\s*(-?\d{1,3}[.,]\d+)\s*$/);
    if (!m) throw new Error(frases.ponto_pela_metade);
    const lat = Number(m[1].replace(",", ".")), lon = Number(m[2].replace(",", "."));
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error(frases.ponto_pela_metade);
    return [lat, lon];
  }

  // "2026-11-28" e "14:00" (horário de Brasília) viram a data e hora certa.
  const quandoBrasil = (dia, hora) => (dia && hora ? new Date(`${dia}T${hora}:00-03:00`) : null);
  const diaBrasil = (iso) => (iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : "");
  const horaBrasil = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }) : "");

  function formAnuncio(a = {}) {
    if (!parceiros.length) return formParceiro();
    const tipo = escolha([["apoio", "Apoio (fica no mapa pelo plano)"], ["evento", "Evento (sai do mapa quando terminar)"]], a.tipo || "apoio"),
      parceiro = escolha(parceiros.map((p) => [p.id, p.nome]), a.parceiro),
      cidade = escolha(cidades.map((c) => [c.id, `${c.nome}/${c.uf}`]), a.cidade_id),
      nivel = escolha([["apoiador", "Apoiador"], ["destaque", "Destaque (aparece primeiro)"]], a.nivel),
      meses = escolha([[3, "3 meses"], [6, "6 meses"], [12, "12 meses"]], a.meses),
      valor = texto(a.valor_mes != null ? String(a.valor_mes).replace(".", ",") : "50,00", { inputmode: "decimal" }),
      ponto = texto(a.lat != null ? `${a.lat}, ${a.lon}` : "", { placeholder: "-29.6842, -53.8069" }),
      horario = texto(a.horario, { maxlength: "60", placeholder: "Seg a sex, 8h às 18h" }),
      beneficio = texto(a.beneficio, { maxlength: "80", placeholder: "Ex.: 10% para motorista de app" }),
      titulo = texto(a.titulo, { maxlength: "40", placeholder: "Ex.: Mutirão de revisão" }),
      dia = h("input", { type: "date", value: diaBrasil(a.evento_inicio) || hoje(), style: "width:100%" }),
      comeca = h("input", { type: "time", value: horaBrasil(a.evento_inicio) || "14:00", style: "width:100%" }),
      termina = h("input", { type: "time", value: horaBrasil(a.evento_fim) || "18:00", style: "width:100%" });
    const rotuloValor = h("span", {});
    const soApoio = [campo("Plano", meses), campoContado("Horário de atendimento", horario, 30, "Passa do que cabe no cartão.")];
    const soEvento = [campoContado("Nome do evento (aparece no app)", titulo, 20, "Passa do que cabe na linha de cima do mapa; no cartão aparece inteiro."),
      h("div", { class: "linha" }, campo("Dia", dia), campo("Começa", comeca), campo("Termina", termina))];
    const blocoApoio = h("div", { style: "display:grid;gap:10px" }, ...soApoio);
    const blocoEvento = h("div", { style: "display:grid;gap:10px" }, ...soEvento);
    const previa = previaNoApp();
    // Termina antes de começar: é no dia seguinte (ex.: 22h às 2h).
    const datas = () => {
      const i = quandoBrasil(dia.value, comeca.value);
      let f = quandoBrasil(dia.value, termina.value);
      if (i && f && f <= i) f = new Date(f.getTime() + 864e5);
      return [i, f];
    };
    const redesenhar = () => {
      const evento = tipo.value === "evento";
      blocoApoio.style.display = evento ? "none" : "grid";
      blocoEvento.style.display = evento ? "grid" : "none";
      rotuloValor.textContent = evento ? "Valor do evento (R$)" : "Valor por mês (R$)";
      const p = parceiros.find((x) => String(x.id) === parceiro.value) || {};
      const [i, f] = datas();
      previa.desenhar({ evento, nome: p.nome, titulo: titulo.value.trim(), sub: p.categoria, logo: p.logo,
        telefone: p.telefone, whatsapp: p.whatsapp, site: p.site,
        quando: i && f ? quandoDoEvento(i, f) : "", beneficio: beneficio.value.trim(), horario: horario.value.trim(),
        destaque: nivel.value === "destaque" });
    };
    for (const el of [tipo, parceiro, nivel, dia, comeca, termina]) el.addEventListener("change", redesenhar);
    for (const el of [titulo, beneficio, horario]) el.addEventListener("input", redesenhar);
    redesenhar();
    abrir(a.id ? "Editar anúncio" : "Novo anúncio", [
      campo("Tipo", tipo),
      campo("Parceiro", parceiro), campo("Colônia", cidade),
      h("div", { class: "linha" }, campo("Nível", nivel), campo(rotuloValor, valor)),
      blocoApoio, blocoEvento,
      campo("Ponto no mapa", ponto, "No Google Maps, clique com o botão direito no lugar e depois nos números: eles são copiados. Cole aqui."),
      campoContado("Benefício para a colônia", beneficio, 32, "Passa do que cabe na linha de cima do mapa (aparece com ...); no cartão aparece inteiro.",
        'Aparece no app como "Para a colônia: ...". Opcional.'),
      previa.caixa,
    ], a.id ? "Salvar" : "Criar rascunho", async () => {
      const [lat, lon] = lerPonto(ponto.value);
      const v = Number(valor.value.trim().replace(/\./g, "").replace(",", "."));
      if (!(v >= 0)) throw new Error("Confira o valor.");
      const evento = tipo.value === "evento";
      const [i, f] = evento ? datas() : [null, null];
      if (evento && (!i || !f)) throw new Error(frases.evento_sem_data);
      if (evento && f <= new Date()) throw new Error(frases.evento_passou);
      await rpc("admin_guardar_anuncio", {
        p_id: a.id ?? null, p_parceiro: +parceiro.value, p_cidade: +cidade.value, p_nivel: nivel.value,
        p_meses: +meses.value, p_valor_mes: v, p_lat: lat, p_lon: lon, p_horario: horario.value, p_beneficio: beneficio.value,
        p_tipo: tipo.value, p_titulo: evento ? titulo.value : "",
        p_evento_inicio: i ? i.toISOString() : null, p_evento_fim: f ? f.toISOString() : null,
      });
      await apoios();
    });
  }

  // ===================================================================================
  // FINANCEIRO
  // ===================================================================================
  let lancamentos = [];

  function formRecebimento(a) {
    const origem = escolha([["apoiador", "Apoiador"], ["assinatura", "Assinatura de motorista"]], "apoiador"),
      anuncio = escolha([["", "Sem anúncio"], ...anuncios.map((x) => [x.id, `${x.parceiro_nome} · ${niveis[x.nivel]} ${x.meses} meses`])], a ? a.id : ""),
      quem = texto("", { maxlength: "80", placeholder: "Só se não for de um anúncio" }),
      valor = texto(a ? String(a.valor_mes).replace(".", ",") : "", { inputmode: "decimal" }),
      quando = h("input", { type: "date", value: hoje(), style: "width:100%" }),
      nota = texto("", { maxlength: "200", placeholder: "Ex.: Pix, mês 1 de 3" });
    abrir("Registrar recebimento", [
      campo("De onde veio", origem), campo("Anúncio", anuncio), campo("De quem", quem),
      h("div", { class: "linha" }, campo("Valor recebido (R$)", valor), campo("Dia", quando)),
      campo("Anotação", nota),
      h("p", { class: "sub" }, "É só uma anotação sua: o painel não cobra ninguém."),
    ], "Registrar", async () => {
      const v = Number(valor.value.trim().replace(/\./g, "").replace(",", "."));
      if (!(v > 0)) throw new Error("Confira o valor recebido.");
      await rpc("admin_registrar_recebimento", {
        p_origem: origem.value, p_anuncio: anuncio.value ? +anuncio.value : null, p_quem: quem.value,
        p_valor: v, p_recebido_em: quando.value || null, p_nota: nota.value,
      });
      await Promise.all([financeiro(), anuncios.length ? apoios() : null]);
    });
  }

  async function financeiro() {
    const onde = q("#listaRecebimentos");
    try {
      if (!anuncios.length) anuncios = await rpc("admin_anuncios");
      const f = await rpc("admin_financeiro", { p_de: q("#finDe").value || null, p_ate: q("#finAte").value || null });
      lancamentos = f.lancamentos || [];
      const tile = (r, v, cor) => h("div", { class: "tile" }, h("div", { class: "r" }, r),
        h("div", { class: "v", style: cor ? `color:var(--${cor})` : "" }, dinheiro(v)));
      q("#tilesFinanceiro").replaceChildren(
        tile("Entrou (total)", f.total, "bom"), tile("De apoiadores", f.apoiadores), tile("De assinaturas", f.assinaturas),
        tile("A receber", f.a_receber), tile("Em atraso", f.em_atraso, Number(f.em_atraso) > 0 ? "critico" : ""));
      const soma = lancamentos.reduce((s, l) => s + Number(l.valor), 0);
      q("#somaPeriodo").textContent = lancamentos.length ? `${lancamentos.length} lançamento(s) no período · ${dinheiro(soma)}` : "";
      onde.replaceChildren(lancamentos.length
        ? tabela(["Dia", "De quem", "Origem", "Anotação", "Valor", ""], lancamentos.map((l) => [
          data(l.recebido_em + "T12:00:00"), l.quem || "—", l.origem === "apoiador" ? "Apoiador" : "Assinatura", l.nota || "—", dinheiro(l.valor),
          h("button", { class: "bt fino", type: "button", onclick: () => apagarRecebimento(l) }, "Apagar")]), [4])
        : h("p", { class: "vazio" }, "Nenhum recebimento neste período."));
    } catch (e) {
      erro(onde, e);
    }
  }

  function apagarRecebimento(l) {
    abrir(`Apagar o recebimento de ${dinheiro(l.valor)}?`, h("p", { class: "sub" },
      `${l.quem || "Sem nome"} · ${data(l.recebido_em + "T12:00:00")}. Use para corrigir um lançamento errado. Uma cópia fica no histórico do painel.`),
    "Apagar", async () => {
      await rpc("admin_apagar_recebimento", { p_id: l.id });
      await Promise.all([financeiro(), anuncios.length ? apoios() : null]);
    });
  }

  function exportar() {
    const celula = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [["Dia", "De quem", "Origem", "Anotação", "Valor"],
      ...lancamentos.map((l) => [l.recebido_em, l.quem, l.origem, l.nota, String(l.valor).replace(".", ",")])];
    const csv = "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
    const link = h("a", { href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), download: `volant-recebimentos-${hoje()}.csv` });
    document.body.append(link);
    link.click();
    link.remove();
  }

  // ===================================================================================
  // EXCLUIR DO APP
  // ===================================================================================
  let oQue = "trilhas";
  const tipos = { acidente: "Acidente", roubo: "Suspeita de roubo", zona: "Zona segura", alagamento: "Alagamento", bloqueio: "Bloqueio", outro: "Outro", posto: "Posto barato", chamada: "Muita chamada" };
  const vazios = { trilhas: "Nenhuma trilha valendo agora.", postos: "Nenhum posto adicionado por motoristas.", precos: "Nenhum preço informado nos últimos 7 dias.", lixeira: "A lixeira está vazia." };

  // Pontos de recarga: os que estão no app (Excluir, Tirar o preço) e os excluídos (Restaurar).
  async function recarga() {
    const onde = q("#listaExcluir");
    try {
      const busca = q("#buscaExcluir").value;
      const [ativos, fora] = await Promise.all([
        rpc("admin_recarga", { p_busca: busca, p_excluidos: false }), rpc("admin_recarga", { p_busca: busca, p_excluidos: true })]);
      const acao = (x, oQueFazer, titulo, explica, botao) => () => abrir(titulo, h("p", { class: "sub" }, explica), botao, async () => {
        await rpc("admin_acao_na_recarga", { p_id: x.id, p_acao: oQueFazer });
        await recarga();
      });
      const linha = (x, excluido) => h("div", { class: "it" },
        h("div", {}, h("b", {}, x.nome || "Ponto de recarga"),
          h("p", {}, x.preco == null ? "sem preço" : `${dinheiro(x.preco)} por kWh`),
          h("div", { class: "meta" }, [x.cidade, x.origem === "motorista" ? "adicionado por motorista" : "do mapa aberto",
            (excluido ? "Excluído em " : "") + dataHora(x.quando), x.autor ? "@" + x.autor : ""].filter(Boolean).join(" · "))),
        h("div", { class: "acoes" }, excluido
          ? h("button", { class: "bt azul", type: "button", onclick: acao(x, "restaurar", `Restaurar: ${x.nome}?`, "Volta para o app como estava.", "Restaurar") }, "Restaurar")
          : [x.preco == null ? "" : h("button", { class: "bt fino", type: "button", onclick: acao(x, "tirar_preco", `Tirar o preço de ${x.nome}?`, "O ponto continua no app, sem preço, até alguém informar de novo.", "Tirar o preço") }, "Tirar o preço"),
            h("button", { class: "bt vermelho", type: "button", onclick: acao(x, "excluir", `Excluir: ${x.nome}?`, "Some do app de todos na hora. Dá para restaurar aqui mesmo, mais abaixo.", "Excluir") }, "Excluir")]));
      onde.replaceChildren(
        ...(ativos.length ? ativos.map((x) => linha(x, false)) : [h("p", { class: "vazio" }, busca.trim() ? "Nada encontrado com essa busca." : "Nenhum ponto de recarga ainda.")]),
        ...(fora.length ? [h("h2", { class: "mt", style: "font:700 14px Inter" }, "Excluídos"), ...fora.map((x) => linha(x, true))] : []));
    } catch (e) {
      erro(onde, e);
    }
  }

  async function excluir() {
    if (oQue === "recarga") return recarga();
    const onde = q("#listaExcluir");
    try {
      const l = await rpc("admin_moderacao", { p_o_que: oQue, p_busca: q("#buscaExcluir").value });
      onde.replaceChildren(...(l.length ? l.map((x) => {
        const naLixeira = oQue === "lixeira";
        const titulo = x.tipo === "trilha" && !naLixeira ? (tipos[x.titulo] || x.titulo) : x.titulo;
        return h("div", { class: "it" },
          h("div", {}, h("b", {}, titulo),
            naLixeira ? "" : h("p", {}, x.detalhe || "—"),
            h("div", { class: "meta" }, [x.cidade, (naLixeira ? "Excluído em " : "") + dataHora(x.quando), x.autor ? (naLixeira ? "por " : "@") + x.autor : ""].filter(Boolean).join(" · "))),
          h("div", { class: "acoes" }, naLixeira
            ? h("button", { class: "bt azul", type: "button", onclick: () => restaurar(x) }, "Restaurar")
            : h("button", { class: "bt vermelho", type: "button", onclick: () => tirar(x, titulo) }, "Excluir")));
      }) : [h("p", { class: "vazio" }, q("#buscaExcluir").value.trim() ? "Nada encontrado com essa busca." : vazios[oQue])]));
    } catch (e) {
      erro(onde, e);
    }
  }

  function tirar(x, titulo) {
    abrir(`Excluir: ${titulo}?`, h("p", { class: "sub" },
      "Some do app de todos na hora. Fica 30 dias na Lixeira, de onde dá para restaurar."), "Excluir", async () => {
      await rpc("admin_excluir", { p_tipo: x.tipo, p_alvo: x.alvo });
      await excluir();
    });
  }

  function restaurar(x) {
    abrir(`Restaurar: ${x.titulo}?`, h("p", { class: "sub" }, "Volta para o app como estava."), "Restaurar", async () => {
      await rpc("admin_restaurar", { p_id: +x.alvo });
      await excluir();
    });
  }

  // ---------- ligações ----------
  q("#btNovoParceiro").addEventListener("click", () => formParceiro());
  q("#btNovoAnuncio").addEventListener("click", () => formAnuncio());
  q("#btRecebimento").addEventListener("click", () => formRecebimento());
  q("#btExportar").addEventListener("click", exportar);
  q("#btFiltrarFin").addEventListener("click", financeiro);
  q("#btBuscarExcluir").addEventListener("click", excluir);
  q("#buscaExcluir").addEventListener("keydown", (e) => { if (e.key === "Enter") excluir(); });
  document.querySelectorAll("#filtroExcluir button").forEach((b) => b.addEventListener("click", () => {
    oQue = b.dataset.o;
    document.querySelectorAll("#filtroExcluir button").forEach((x) => x.classList.toggle("on", x === b));
    excluir();
  }));

  // ---------- falhas do app (0.30.17) ----------
  async function falhas() {
    const onde = q("#listaFalhas");
    try {
      const l = await rpc("admin_falhas", {});
      onde.replaceChildren(...(l.length ? l.map((x) => {
        const pilha = h("pre", { style: "display:none;white-space:pre-wrap;font-size:12px;margin:8px 0 0" }, x.pilha || "(sem pilha)");
        const ver = h("button", { class: "bt fino", type: "button" }, "Ver onde quebrou");
        ver.addEventListener("click", () => {
          const aberto = pilha.style.display !== "none";
          pilha.style.display = aberto ? "none" : "block";
          ver.textContent = aberto ? "Ver onde quebrou" : "Esconder";
        });
        return h("div", { class: "it" },
          h("div", {}, h("b", {}, `${x.tipo} · ${x.vezes} ${x.vezes === 1 ? "vez" : "vezes"}`),
            h("p", {}, x.mensagem || "—"),
            h("div", { class: "meta" }, [`versão ${x.versao}`, x.plataforma, x.onde ? `em: ${x.onde}` : "",
              `primeira ${dataHora(x.primeira_em)}`, `última ${dataHora(x.ultima_em)}`].filter(Boolean).join(" · ")),
            pilha),
          h("div", { class: "acoes" }, ver,
            h("button", { class: "bt vermelho", type: "button", onclick: () => tirarFalha(x) }, "Tirar da lista")));
      }) : [h("p", { class: "vazio" }, "Nenhuma falha registrada. Bom sinal.")]));
    } catch (e) {
      erro(onde, e);
    }
  }

  function tirarFalha(x) {
    abrir(`Tirar da lista: ${x.tipo}?`, h("p", { class: "sub" },
      "Use quando a falha já foi corrigida. Se acontecer de novo, ela volta para a lista."), "Tirar", async () => {
      await rpc("admin_apagar_falha", { p_id: x.id });
      await falhas();
    });
  }

  // ---------- assinaturas e pontos (0.30.18) ----------
  const tile = (rotulo, valor) => h("div", { class: "tile" }, h("div", { class: "r" }, rotulo), h("div", { class: "v" }, valor));
  const nomesDosPlanos = { anual: "Anual", trimestral: "Trimestral", mensal: "Mensal", sem_plano: "Sem plano anotado" };

  async function assinaturas() {
    const onde = q("#assTiles");
    try {
      const a = await rpc("admin_assinaturas", {});
      q("#assAviso").replaceChildren(h("p", { class: "sub" }, a.ligado
        ? `Cobrança LIGADA. Tempo grátis no app: ${a.dias_gratis} dias.`
        : `Cobrança DESLIGADA: todo mundo usa o Pro de graça. Tempo grátis configurado: ${a.dias_gratis} dias.`));
      onde.replaceChildren(
        tile("Assinantes ativos", num(a.ativas)),
        tile("Pela loja", num(a.pela_loja)),
        tile("Pelo site", num(a.pelo_site)),
        tile("Liberados no painel", num(a.pelo_painel)),
        tile("No tempo grátis", num(a.no_tempo_gratis)),
        tile("Com preço de fundador", num(a.fundadores)),
        tile("Novas nos últimos 30 dias", num(a.novas_no_mes)),
        tile("Não vão renovar", num(a.nao_renovam)),
        tile("Acabaram nos últimos 30 dias", num(a.acabaram_no_mes)),
        tile("Contas no VolAnt", num(a.contas)),
        tile("Contas novas em 30 dias", num(a.contas_novas_no_mes)));
      await liberados();
      await versao();
      const planos = Object.entries(a.por_plano || {});
      q("#assPlanos").replaceChildren(planos.length
        ? tabela(["Plano", "Assinantes"], planos.map(([p, n]) => [nomesDosPlanos[p] || p, num(n)]))
        : h("p", { class: "vazio" }, "Ainda sem assinantes."));
    } catch (e) {
      erro(onde, e);
    }
  }

  const nomesDoPeriodo = { mensal: "1 mês", trimestral: "3 meses", anual: "12 meses" };
  async function liberados() {
    const onde = q("#assLiberados");
    try {
      const l = await rpc("admin_liberados", {});
      onde.replaceChildren(l.length
        ? tabela(["Motorista", "Período", "Até", "Anotação", ""], l.map((x) => [
            "@" + x.nome, nomesDoPeriodo[x.plano] || x.plano, data(x.ate), x.nota || "—",
            x.valendo ? h("button", { class: "bt fino", type: "button", onclick: () => tirarPro(x) }, "Tirar") : "Acabou"]))
        : h("p", { class: "vazio" }, "Nenhum Pro liberado no painel."));
    } catch (e) {
      erro(onde, e);
    }
  }

  function liberarPro() {
    const quem = h("input", { type: "text", placeholder: "@nome_de_usuario ou e-mail" });
    let meses = 3;
    const botoes = [1, 3, 12].map((m) => {
      const b = h("button", { class: m === meses ? "bt azul" : "bt fino", type: "button" }, m === 1 ? "1 mês" : `${m} meses`);
      b.addEventListener("click", () => {
        meses = m;
        botoes.forEach((x, i) => (x.className = [1, 3, 12][i] === m ? "bt azul" : "bt fino"));
      });
      return b;
    });
    const nota = h("input", { type: "text", placeholder: "Ex.: Pix 22/11 · R$ 29,70" });
    abrir("Liberar Pro", [
      h("p", { class: "sub" }, "Se a pessoa já tem Pro liberado valendo, o período novo começa no fim do atual."),
      campo("Motorista", quem), campo("Período", h("div", { class: "linha" }, ...botoes)), campo("Anotação", nota),
    ], "Liberar Pro", async () => {
      await rpc("admin_liberar_pro", { p_quem: quem.value, p_meses: meses, p_nota: nota.value });
      await assinaturas();
    });
  }

  function tirarPro(x) {
    abrir(`Tirar o Pro de @${x.nome}?`, h("p", { class: "sub" },
      "O Pro liberado no painel acaba agora. Se a pessoa ainda estiver no tempo grátis, continua com ele."), "Tirar", async () => {
      await rpc("admin_tirar_pro", { p_token: x.token });
      await assinaturas();
    });
  }

  async function versao() {
    const onde = q("#assVersao");
    try {
      const atual = await rpc("aviso_de_versao", {});
      const ent = h("input", { type: "text", placeholder: "Ex.: 1.0.0", value: atual || "" });
      const salvar = h("button", { class: "bt azul", type: "button" }, "Salvar");
      const ok = h("p", { class: "sub" }, atual ? `Hoje: avisa quem tiver abaixo de ${atual}.` : "Hoje: ninguém vê o aviso.");
      salvar.addEventListener("click", async () => {
        salvar.disabled = true;
        try {
          await rpc("admin_versao_minima", { p_versao: ent.value });
          await versao();
        } catch (e) {
          ok.textContent = dizer(e);
          salvar.disabled = false;
        }
      });
      onde.replaceChildren(h("div", { class: "linha" }, ent, salvar), ok);
    } catch (e) {
      erro(onde, e);
    }
  }
  q("#btLiberarPro").addEventListener("click", liberarPro);

  async function pontos() {
    const onde = q("#listaPontos");
    try {
      const l = await rpc("admin_pontos", {});
      onde.replaceChildren(l.length
        ? tabela(["Motorista", "Cidade", "Pontos", "Último ponto"], l.map((x) => ["@" + x.nome, x.cidade || "—", num(x.total), dataHora(x.ultimo)]))
        : h("p", { class: "vazio" }, "Ninguém ganhou pontos ainda."));
    } catch (e) {
      erro(onde, e);
    }
  }

  function ajustarPontos() {
    const nome = h("input", { type: "text", placeholder: "@nome_de_usuario" });
    const quantos = h("input", { type: "number", placeholder: "Ex.: 10 para dar, -10 para tirar" });
    const nota = h("input", { type: "text", placeholder: "Por quê (fica no histórico do painel)" });
    abrir("Dar ou tirar pontos", [
      h("p", { class: "sub" }, "Número positivo dá pontos; negativo tira. O motorista vê como \"Ajuste da VolAnt\"."),
      campo("Motorista", nome), campo("Pontos", quantos), campo("Anotação", nota),
    ], "Confirmar", async () => {
      await rpc("admin_ajustar_pontos", { p_nome: nome.value, p_pontos: parseInt(quantos.value, 10) || 0, p_nota: nota.value });
      await pontos();
    });
  }
  q("#btAjustarPontos").addEventListener("click", ajustarPontos);
  Object.assign(frases, { periodo_invalido: "Escolha 1, 3 ou 12 meses.", versao_invalida: "Use o formato 1.0.0 (três números com ponto)." });
  Object.assign(frases, { pontos_invalidos: "Informe um número de pontos diferente de zero (até 10.000).", nao_achei: "Não achei esse motorista ou item. Confira o nome." });

  // ===================================================================================
  // USO POR CONTA (1.0.1): travas contra contas falsas
  // ===================================================================================
  let usoDias = 1;
  const situacoesUso = {
    trava: ["critico", "Na trava"], celular: ["serio", "Celular com várias contas"],
    perto: ["atencao", "Perto da trava"], ok: ["bom", "Tranquilo"],
  };
  const planosUso = { free: "Free", pro: "Pro", colaborador: "Colaborador" };
  const corUso = (u, l) => (u >= l ? "var(--critico)" : u >= Math.ceil(l * 0.8) ? "var(--atencao)" : "var(--bom)");
  const barraUso = (x) => h("div", { style: "min-width:64px" },
    h("div", { style: "font-variant-numeric:tabular-nums" }, `${num(x.usado)} / ${num(x.limite)}`),
    h("div", { style: "height:4px;border-radius:9px;background:var(--linha);margin-top:4px" },
      h("div", { style: `height:4px;border-radius:9px;width:${Math.min(100, (100 * x.usado) / Math.max(1, x.limite)).toFixed(0)}%;background:${corUso(x.usado, x.limite)}` })));

  async function uso() {
    const onde = q("#tabUso");
    try {
      const l = await rpc("admin_uso_por_conta", { p_dias: usoDias, p_so_perto: q("#usoSoPerto").checked });
      q("#contaUso").textContent = l.filter((x) => x.situacao === "trava" || x.situacao === "celular").length || "";
      if (!l.length) {
        onde.replaceChildren(h("p", { class: "vazio" }, q("#usoSoPerto").checked ? "Ninguém perto da trava." : "Ninguém publicou no período."));
        return;
      }
      const cab = ["Conta", "Plano", "Trilhas por hora", "Perguntas por dia", "Postos por dia", "Respostas por hora",
        usoDias === 1 ? "Hoje" : `${usoDias} dias`, "Situação", ""];
      onde.replaceChildren(h("div", { style: "overflow-x:auto" }, tabela(cab, l.map((x) => {
        const [cor, nome] = situacoesUso[x.situacao] || situacoesUso.ok;
        const detalhe = x.situacao === "celular" ? `${x.contas_no_celular} contas no mesmo celular`
          : x.dias_perto >= 2 ? `perto da trava em ${x.dias_perto} dos últimos 7 dias`
          : x.colaborador_em ? `Colaborador desde ${data(x.colaborador_em)}` : "";
        const p = x.periodo;
        const acoes = h("div", { style: "display:flex;flex-direction:column;gap:6px;align-items:stretch;min-width:170px" });
        if (x.plano === "colaborador") acoes.append(h("button", { class: "bt fino", type: "button", onclick: () => colaborador(x, false) }, "Tirar Colaborador"));
        else if (!x.conta_nova && (x.situacao === "perto" || x.dias_perto >= 2)) acoes.append(h("button", { class: "bt azul", type: "button", onclick: () => colaborador(x, true) }, "Liberar mais"));
        else if (x.limitada_aparelho) acoes.append(h("button", { class: "bt fino", type: "button", onclick: () => colaborador(x, true) }, "Liberar"));
        acoes.append(h("button", { class: "bt fino", type: "button", onclick: () => verPublicado(x) }, "Ver o que publicou"));
        if (x.contas_no_celular >= 2) acoes.append(h("button", { class: "bt fino", type: "button", onclick: () => verCelular(x) }, "Ver as contas do celular"));
        if (x.lote_apagado) acoes.append(h("button", { class: "bt fino", type: "button", onclick: () => desfazerApagar(x) }, "Desfazer o apagar"));
        else acoes.append(h("button", { class: "bt fino", type: "button", style: "color:var(--critico)", onclick: () => apagarTudo(x) }, "Apagar tudo desta conta"));
        return [
          h("div", {}, h("b", {}, "@" + x.nome),
            h("div", { class: "meta" }, [x.cidade, x.conta_nova ? (x.limitada_aparelho ? "limitada pelo celular" : "conta nova") : `desde ${data(x.criado_em)}`].filter(Boolean).join(" · "))),
          h("span", { class: "tag" }, planosUso[x.plano] || x.plano),
          barraUso(x.agora.trilhas), barraUso(x.agora.perguntas), barraUso(x.agora.postos), barraUso(x.agora.respostas),
          h("b", { title: `${num(p.trilhas)} trilhas · ${num(p.perguntas)} perguntas · ${num(p.respostas)} respostas · ${num(p.postos)} postos` }, num(p.trilhas + p.perguntas + p.respostas + p.postos)),
          h("div", {}, h("span", { class: "estado " + cor }, nome), detalhe ? h("div", { class: "meta" }, detalhe) : ""),
          acoes,
        ];
      }))));
    } catch (e) {
      erro(onde, e);
    }
  }

  function colaborador(x, ligar) {
    abrir(ligar ? `Liberar mais para @${x.nome}?` : `Tirar o Colaborador de @${x.nome}?`,
      h("p", { class: "sub" }, ligar
        ? "A conta vira Colaborador: fica com as travas do Pro (10 trilhas por hora, 10 perguntas e 6 postos por dia), sem cobrar nada, até você tirar. Também deixa de ser tratada como conta nova."
        : "A conta volta às travas normais do plano dela."),
      ligar ? "Liberar mais" : "Tirar", async () => {
        await rpc("admin_colaborador", { p_conta: x.id, p_ligar: ligar });
        await uso();
      });
  }

  async function verPublicado(x) {
    const corpo = h("div", { class: "lista", style: "max-height:55vh;overflow:auto" }, h("p", { class: "vazio" }, "Carregando…"));
    abrir(`O que @${x.nome} publicou (7 dias)`, corpo, "Fechar", async () => {});
    try {
      const l = await rpc("admin_publicado_por", { p_conta: x.id });
      corpo.replaceChildren(...(l.length ? l.map((i) => h("div", { class: "it" },
        h("div", {}, h("span", { class: "tag" }, i.tipo), i.texto,
          h("div", { class: "meta" }, dataHora(i.quando) + (i.valendo ? "" : " · já saiu do app"))))) : [h("p", { class: "vazio" }, "Nada nos últimos 7 dias.")]));
    } catch (e) {
      erro(corpo, e);
    }
  }

  async function verCelular(x) {
    const corpo = h("div", { class: "lista" }, h("p", { class: "vazio" }, "Carregando…"));
    abrir(`Contas no mesmo celular de @${x.nome}`, [h("p", { class: "sub" }, "Contas que abriram o app no mesmo celular. A partir da 3ª conta nova em 30 dias, a conta fica com as travas de conta nova até você liberar."), corpo], "Fechar", async () => {});
    try {
      const l = await rpc("admin_contas_do_celular", { p_conta: x.id });
      corpo.replaceChildren(...l.map((c) => h("div", { class: "it" },
        h("div", {}, h("b", {}, "@" + c.nome), h("div", { class: "meta" }, `criada em ${data(c.criado_em)}`)),
        c.colaborador ? h("span", { class: "estado bom" }, "Colaborador") : c.limitada ? h("span", { class: "estado serio" }, "Limitada") : "")));
    } catch (e) {
      erro(corpo, e);
    }
  }

  function apagarTudo(x) {
    abrir(`Apagar tudo de @${x.nome}?`,
      h("p", { class: "sub" }, "Vai para a lixeira: trilhas valendo, perguntas e respostas dos últimos 30 dias, postos adicionados e preços dos últimos 7 dias. A conta continua existindo. Dá para desfazer por 30 dias, aqui mesmo."),
      "Apagar tudo", async () => {
        const r = await rpc("admin_apagar_tudo", { p_conta: x.id });
        await uso();
        alert(`${r.itens} ${r.itens === 1 ? "item foi" : "itens foram"} para a lixeira.`);
      });
  }

  function desfazerApagar(x) {
    abrir(`Desfazer o apagar de @${x.nome}?`, h("p", { class: "sub" }, "Tudo o que foi apagado de uma vez volta para o app."),
      "Desfazer", async () => {
        await rpc("admin_desfazer_apagar", { p_lote: x.lote_apagado });
        await uso();
      });
  }

  for (const b of document.querySelectorAll("#usoPeriodo button")) {
    b.addEventListener("click", () => {
      usoDias = +b.dataset.d;
      for (const o of document.querySelectorAll("#usoPeriodo button")) o.classList.toggle("on", o === b);
      uso();
    });
  }
  q("#usoSoPerto")?.addEventListener("change", uso);
  q("#btUso")?.addEventListener("click", uso);

  window.volantExtra = (tela) => ({ apoios, financeiro, excluir, falhas, assinaturas, pontos, uso })[tela]?.();
})();
