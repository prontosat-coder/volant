"use strict";
// Painel VolAnt: Apoios à colônia, Financeiro e Excluir do app (0.30.14).
// Usa as peças do painel (window.volantPainel) e só chama funções de administrador.
(() => {
  const P = window.volantPainel;
  if (!P) return;
  const { rpc, criar: h, um: q, erro, tabela, num, data, dataHora } = P;
  const dinheiro = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const frases = {
    site_sem_https: "O site precisa começar com https://",
    logo_sem_https: "O endereço do logo precisa começar com https://",
    ponto_pela_metade: "Confira o ponto no mapa: são dois números, separados por vírgula.",
    nao_achei: "Não achei esse item. Atualize a tela.",
    ainda_rascunho: "Este anúncio ainda é rascunho: use Ativar.",
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
        p.nome, p.categoria || "—", p.telefone || "—", p.site || "—", num(p.anuncios),
        h("button", { class: "bt fino", type: "button", onclick: () => formParceiro(p) }, "Editar")]), [4])
      : h("p", { class: "vazio" }, "Nenhum parceiro cadastrado."));
  }

  function linhaDoAnuncio(a) {
    const [cor, nome] = situacoes[a.situacao] || ["neutro", a.situacao];
    const acao = (rotulo, oQue, classe = "fino") =>
      h("button", { class: "bt " + classe, type: "button", onclick: () => acaoNoAnuncio(a, oQue, rotulo) }, rotulo);
    const periodo = a.inicio ? `De ${data(a.inicio + "T12:00:00")} até ${data(a.fim + "T12:00:00")}` : "Começa quando você ativar";
    return h("div", { class: "it" },
      h("div", {},
        h("span", { class: "estado " + cor }, nome), " ",
        h("b", {}, a.parceiro_nome),
        h("p", {}, [a.categoria, a.cidade, `${niveis[a.nivel]} · ${a.meses} meses · ${dinheiro(a.valor_mes)}/mês`].filter(Boolean).join(" · ")),
        h("div", { class: "meta" }, `${periodo} · ${a.lat == null ? "sem ponto no mapa (não aparece no app)" : "com ponto no mapa"}`),
        h("div", { class: "meta" },
          `Abriram o cartão: ${num(a.vistas)} · Ir: ${num(a.toques_ir)} · Ligar: ${num(a.toques_ligar)} · Site: ${num(a.toques_site)} · Recebido: ${dinheiro(a.recebido)}`)),
      h("div", { class: "acoes" },
        h("button", { class: "bt fino", type: "button", onclick: () => formAnuncio(a) }, "Editar"),
        a.status === "rascunho" ? acao("Ativar", "ativar", "azul") : "",
        a.status === "ativo" ? acao("Pausar", "pausar") : "",
        a.status === "pausado" ? acao("Retomar", "retomar", "azul") : "",
        a.status !== "rascunho" ? acao("Renovar", "renovar", a.situacao === "ativo" ? "fino" : "azul") : "",
        h("button", { class: "bt fino", type: "button", onclick: () => formRecebimento(a) }, "Recebimento")));
  }

  function acaoNoAnuncio(a, oQue, rotulo) {
    const explica = {
      ativar: `O anúncio entra no mapa agora e vale por ${a.meses} meses a partir de hoje.`,
      pausar: "O anúncio sai do mapa. Nada se perde, e o prazo continua correndo.",
      retomar: "O anúncio volta para o mapa.",
      renovar: `Soma mais ${a.meses} meses ao fim do anúncio (ou a partir de hoje, se já venceu).`,
    }[oQue];
    abrir(`${rotulo}: ${a.parceiro_nome}`, h("p", { class: "sub" }, explica), rotulo, async () => {
      await rpc("admin_acao_no_anuncio", { p_id: a.id, p_acao: oQue });
      await apoios();
    });
  }

  function formParceiro(p = {}) {
    const nome = texto(p.nome, { maxlength: "80" }), categoria = texto(p.categoria, { maxlength: "60", placeholder: "Ex.: Rastreamento e segurança" }),
      telefone = texto(p.telefone, { maxlength: "30", placeholder: "(55) 0000-0000" }), site = texto(p.site, { maxlength: "200", placeholder: "https://" }),
      logo = texto(p.logo, { maxlength: "300", placeholder: "https://" }), contato = texto(p.contato, { maxlength: "200" });
    abrir(p.id ? "Editar parceiro" : "Novo parceiro", [
      campo("Nome (aparece no app)", nome), campo("Categoria (aparece no app)", categoria),
      campo("Telefone (botão Ligar)", telefone), campo("Site (botão Site)", site),
      campo("Endereço da imagem do logo", logo, "Opcional. Sem logo, o app mostra a primeira letra do nome."),
      campo("Contato, só para você", contato, "Não aparece no app."),
    ], "Salvar", async () => {
      if (nome.value.trim().length < 2) throw new Error("Escreva o nome do parceiro.");
      await rpc("admin_guardar_parceiro", {
        p_id: p.id ?? null, p_nome: nome.value, p_categoria: categoria.value, p_telefone: telefone.value,
        p_site: site.value.trim(), p_logo: logo.value.trim(), p_contato: contato.value,
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

  function formAnuncio(a = {}) {
    if (!parceiros.length) return formParceiro();
    const parceiro = escolha(parceiros.map((p) => [p.id, p.nome]), a.parceiro),
      cidade = escolha(cidades.map((c) => [c.id, `${c.nome}/${c.uf}`]), a.cidade_id),
      nivel = escolha([["apoiador", "Apoiador"], ["destaque", "Destaque (aparece primeiro)"]], a.nivel),
      meses = escolha([[3, "3 meses"], [6, "6 meses"], [12, "12 meses"]], a.meses),
      valor = texto(a.valor_mes != null ? String(a.valor_mes).replace(".", ",") : "50,00", { inputmode: "decimal" }),
      ponto = texto(a.lat != null ? `${a.lat}, ${a.lon}` : "", { placeholder: "-29.6842, -53.8069" }),
      horario = texto(a.horario, { maxlength: "120", placeholder: "Seg a sex, 8h às 18h" }),
      beneficio = texto(a.beneficio, { maxlength: "140", placeholder: "Ex.: 10% para motorista de app" });
    abrir(a.id ? "Editar anúncio" : "Novo anúncio", [
      campo("Parceiro", parceiro), campo("Colônia", cidade),
      h("div", { class: "linha" }, campo("Nível", nivel), campo("Plano", meses), campo("Valor por mês (R$)", valor)),
      campo("Ponto no mapa", ponto, "No Google Maps, clique com o botão direito no lugar e depois nos números: eles são copiados. Cole aqui."),
      campo("Horário de atendimento", horario),
      campo("Benefício para a colônia", beneficio, 'Aparece no app como "Para a colônia: ...". Opcional.'),
    ], a.id ? "Salvar" : "Criar rascunho", async () => {
      const [lat, lon] = lerPonto(ponto.value);
      const v = Number(valor.value.trim().replace(/\./g, "").replace(",", "."));
      if (!(v >= 0)) throw new Error("Confira o valor por mês.");
      await rpc("admin_guardar_anuncio", {
        p_id: a.id ?? null, p_parceiro: +parceiro.value, p_cidade: +cidade.value, p_nivel: nivel.value,
        p_meses: +meses.value, p_valor_mes: v, p_lat: lat, p_lon: lon, p_horario: horario.value, p_beneficio: beneficio.value,
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

  window.volantExtra = (tela) => ({ apoios, financeiro, excluir })[tela]?.();
})();
