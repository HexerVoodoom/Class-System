/**
 * App do simulador. Importa o MOTOR REAL (mesmo código dos testes) — a UI
 * apenas coleta pontos e exibe os cálculos.
 *
 * Organização em abas (estilo tabuleiro de licenças do FFXII):
 *  1. Elementos — o Céu dos Elementos: tabuleiro celeste onde os 13 base
 *     formam o anel externo e as combinações orbitam o centro.
 *  2. Escolas — pontos + arquétipos emergentes.
 *  3. Recursos — proficiência nas fontes de energia + bancada de simulação.
 *  4. Talentos — árvore/cartas.
 *  5. Criar Skill — sliders limitados por talentos, fontes de energia
 *     combinadas em proporções, custo e impacto em tempo real.
 */

import {
  ELEMENTOS,
  elementosBase,
  elementosDerivados,
  type ElementoBaseId,
  type ElementoDef,
  type ElementoId,
} from '../registry/elementos';
import {
  TODAS_COMBINACOES,
  aridadeDe,
  buscarCombinacoes,
  combinacoesRelevantes,
  elementoDef,
} from '../registry/combinacoes';
import {
  CENTRO,
  R_ROTULO_BASE,
  TETO,
  VIEWBOX,
  W as W_CEU,
  guiasDeFaixa,
  posicaoBase,
  posicaoCombinacao,
  raioComNivel,
  type PosEstrela,
} from './ceu-layout';
import {
  MODIFICADORES,
  ROTULO_TAG,
  type ModificadorId,
} from '../registry/modificadores';
import { ESCOLAS, type EscolaId } from '../registry/escolas';
import { RECURSOS, type RecursoId } from '../registry/recursos';
import { TALENTOS, type TalentoDef, type TalentoId } from '../registry/talentos';
import { ARQUETIPOS } from '../registry/arquetipos';
import {
  criarPersonagem,
  investirElemento,
  desinvestirElemento,
  investirEscola,
  investirRecurso,
  investirTalento,
  investirProfissao,
  capturarCriatura,
  domarCriatura,
  afrouxarVinculo,
  soltarCriatura,
  type Personagem,
} from '../engine/personagem';
import {
  PROFISSOES,
  MATERIAIS_CRIATURA,
  itensDaProfissao,
  type ProfissaoId,
} from '../registry/profissoes';
import { craftar, elementosDominados, type ConfigCraft } from '../engine/profissoes';
import { calcularProgressao, type Progressao } from '../engine/progressao';
import { CUSTO_PONTO_ALOCACAO, DIVISOR_CASCATA, LIMIAR_DESTRAVAMENTO, ORCAMENTO_POR_TIER } from '../registry/geracoes';
import { custoDeAlocacao } from '../engine/cascata';
import type { Aridade } from '../registry/geracoes';
import { CRIATURAS, FAMILIAS, criaturas, type CriaturaDef } from '../registry/criaturas';
import { efetividade } from '../registry/afinidades';
import {
  avaliarCaptura,
  avaliarMontaria,
  capacidadeVinculo,
  elementosDeMaestria,
  evocar,
  MAESTRIA_LIMIAR,
  type ConfigEvocacao,
  type ModoEvocacao,
} from '../engine/evocacao';
import {
  calcularLimites,
  calcularSkill,
  normalizarFontes,
  type FonteEnergia,
  type ResultadoSkill,
  type SkillConfig,
  SLOTS_MODIFICADOR_BASE,
  TETO_MULT_MODIFICADORES,
  avaliarModificador,
  slotsModificador,
  tagsDaSkill,
} from '../engine/skills';
import {
  criarEstadoRecurso,
  FeEstado,
  FuriaEstado,
  RessonanciaEstado,
  SoullinkEstado,
  type EstadoRecurso,
} from '../engine/recursos';
import { calcularFusao, previewFusao } from '../engine/fusao';
import {
  PRESETS,
  ROTULO_PAPEL,
  type Complexidade,
  type PapelPreset,
  type PresetDef,
} from '../registry/presets';
import {
  custoDe,
  elementosNotaveis,
  materializarPreset,
} from '../engine/presets';
import { sigilo } from './sigilos';

/**
 * Nome de um elemento QUALQUER — inclusive as combinações procedurais, que não
 * moram em `ELEMENTOS` e só existem via `elementoDef`. Toda lista alimentada
 * por `prog.elementosDisponiveis` precisa passar por aqui: assim que uma ficha
 * libera uma tripla ou quádrupla gerada, `ELEMENTOS[id]` é `undefined` e a tela
 * inteira morre com "Cannot read properties of undefined".
 */
function nomeElemento(id: string): string {
  return elementoDef(id)?.nome ?? id;
}

/** <img> do sigilo, ou string vazia se não houver arte para o id. */
function sig(id: string, classe = 'sig'): string {
  const src = sigilo(id);
  return src ? `<img class="${classe}" src="${src}" alt="" loading="lazy">` : '';
}

// ---------------------------------------------------------------- estado

interface Snapshot {
  nome: string;
  criadoEm: string;
  personagem: Personagem;
  skill: SkillConfig;
}

type AbaId =
  | 'elementos'
  | 'escolas'
  | 'recursos'
  | 'talentos'
  | 'bestiario'
  | 'profissao'
  | 'skill'
  | 'fusao';

interface Estado {
  personagem: Personagem;
  orcamentoAtributos: number;
  orcamentoTalentos: number;
  skill: SkillConfig;
  skillsSalvas: SkillConfig[];
  filtroDerivados: string;
  filtroInvestir: string;
  filtroCriaturas: string;
  snapshots: Snapshot[];
  vistaTalentos: 'arvore' | 'cartas';
  abaAtiva: AbaId;
  evocacao: ConfigEvocacao;
  craft: ConfigCraft;
  /** Índices em `skillsSalvas` marcados como componentes da fusão. */
  fusao: number[];
}

const CHAVE_STORAGE = 'class-system-simulador-v1';

function skillPadrao(): SkillConfig {
  return {
    nome: 'Nova Skill',
    elemento: 'fogo',
    escola: 'conjuracao',
    fontes: [{ recurso: 'mana', proporcao: 100 }],
    energia: 20,
    tempoConjuracaoSegundos: 1.5,
    alcanceMetros: 10,
    area: { tipo: 'unico' },
    entrega: { tipo: 'instantaneo' },
  };
}

function estadoPadrao(): Estado {
  return {
    personagem: criarPersonagem('Meu Personagem'),
    // Tier 3 da curva do registro (ORCAMENTO_POR_TIER) — o suficiente para
    // 1–2 destraves de par; antes era um literal 100 desconectado da curva.
    orcamentoAtributos: ORCAMENTO_POR_TIER[3],
    orcamentoTalentos: 20,
    skill: skillPadrao(),
    skillsSalvas: [],
    filtroDerivados: '',
    filtroInvestir: '',
    filtroCriaturas: '',
    snapshots: [],
    vistaTalentos: 'arvore',
    abaAtiva: 'elementos',
    evocacao: { modo: 'elemental', elemento: 'fogo' },
    fusao: [],
    craft: { profissao: 'ferreiro', itemId: 'espada', elementosImbuidos: [] },
  };
}

/** Garante que uma ficha carregada/importada tenha o bestiário. */
function normalizarPersonagem(p: any): Personagem {
  const base = criarPersonagem(p?.nome ?? 'Meu Personagem');
  return {
    ...base,
    ...p,
    elementos: p?.elementos ?? {},
    escolas: p?.escolas ?? {},
    recursos: p?.recursos ?? {},
    talentos: p?.talentos ?? {},
    bestiario: Array.isArray(p?.bestiario) ? p.bestiario : [],
    profissoes: p?.profissoes ?? {},
  };
}

/** Migra skills salvas no formato antigo (recurso único) para fontes. */
function migrarSkill(s: any): SkillConfig {
  const base = skillPadrao();
  const skill: SkillConfig = { ...base, ...s };
  if (!Array.isArray(skill.fontes) || skill.fontes.length === 0) {
    const recursoAntigo = (s?.recurso as RecursoId) ?? 'mana';
    skill.fontes = [{ recurso: recursoAntigo, proporcao: 100 }];
  }
  if (typeof skill.alcanceMetros !== 'number') skill.alcanceMetros = base.alcanceMetros;
  delete (skill as any).recurso;
  return skill;
}

function carregar(): Estado {
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE);
    if (!bruto) return estadoPadrao();
    const salvo = JSON.parse(bruto);
    const base = estadoPadrao();
    const estado: Estado = {
      ...base,
      ...salvo,
      personagem: normalizarPersonagem({ ...base.personagem, ...salvo.personagem }),
      skill: migrarSkill(salvo.skill),
      skillsSalvas: Array.isArray(salvo.skillsSalvas) ? salvo.skillsSalvas.map(migrarSkill) : [],
      snapshots: Array.isArray(salvo.snapshots)
        ? salvo.snapshots.map((sn: any) => ({ ...sn, personagem: normalizarPersonagem(sn.personagem), skill: migrarSkill(sn.skill) }))
        : [],
      evocacao: salvo.evocacao ?? base.evocacao,
      filtroCriaturas: salvo.filtroCriaturas ?? '',
      filtroInvestir: salvo.filtroInvestir ?? '',
      craft: salvo.craft ?? base.craft,
      fusao: Array.isArray(salvo.fusao) ? salvo.fusao : [],
    };
    if ((estado.vistaTalentos as string) === 'constelacao') estado.vistaTalentos = 'arvore';
    // as abas válidas vêm da própria lista de abas — deixar um array literal
    // aqui foi o que fez Bestiário e Profissão perderem o contexto no reload
    if (!ABAS_VALIDAS.includes(estado.abaAtiva)) {
      estado.abaAtiva = 'elementos';
    }
    return estado;
  } catch {
    return estadoPadrao();
  }
}

let estado = carregar();

function salvar(): void {
  localStorage.setItem(CHAVE_STORAGE, JSON.stringify(estado));
}

// ---------------------------------------------------------------- helpers

const CORES: Record<ElementoBaseId, string> = {
  fogo: '#e2603f',
  agua: '#4f8fd0',
  terra: '#a07840',
  ar: '#8fc4c9',
  eletricidade: '#d9bd3e',
  arcano: '#8b7ad6',
  sombra: '#6b5a8a',
  luz: '#d9c878',
  vileza: '#b04a6e',
  morte: '#8a9184',
  vida: '#5fae82',
  marcial: '#9aa3b5',
  gravidade: '#7d6fa0',
};

const el = (id: string) => document.getElementById(id)!;
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('pt-BR');
const pct = (n: number) => `${Math.round(n * 100)}%`;

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string): void {
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('visivel');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visivel'), 3200);
}

function pontosAtributosGastos(): number {
  const soma = (obj: Partial<Record<string, number>>) =>
    Object.values(obj).reduce((a: number, b) => a + (b ?? 0), 0);
  // Elementos entram pelo CUSTO por geração (custoDeAlocacao), nunca pela
  // soma crua: contar 1 por ponto direto em derivado abria build degenerada
  // medida em 1,77× sobre a especialização pura (auditoria da cascata).
  return (
    custoDeAlocacao(estado.personagem.elementos).total +
    soma(estado.personagem.escolas) +
    soma(estado.personagem.recursos) +
    soma(estado.personagem.profissoes)
  );
}

function pontosTalentosGastos(): number {
  return Object.values(estado.personagem.talentos).reduce((a: number, b) => a + (b ?? 0), 0);
}

// ---------------------------------------------------------------- presets
//
// O CONTEÚDO das classes prontas mora em `registry/presets.ts` e a montagem
// da ficha em `engine/presets.ts`. Aqui só existe a galeria: filtrar, mostrar
// e aplicar. A UI não sabe mais quais elementos o Necromante investe.

const PAPEIS_ORDEM: PapelPreset[] = [
  'area', 'foco', 'linha_de_frente', 'suporte', 'controle', 'invocador', 'oficio',
];

/** Pergunta em linguagem de jogador; o rótulo do sistema aparece só no card. */
const PERGUNTA_PAPEL: Record<PapelPreset, string> = {
  area: 'Atingir vários',
  foco: 'Focar um alvo',
  linha_de_frente: 'Aguentar dano',
  suporte: 'Curar e reforçar',
  controle: 'Prender e atrasar',
  invocador: 'Invocar aliados',
  oficio: 'Fabricar coisas',
};

let galPapel: PapelPreset | 'todos' = 'todos';
let galComplexidade: Complexidade | 'todas' = 'todas';
let galBusca = '';
let galSelecionado: string | null = null;
/** Ficha de antes do último preset aplicado — o desfazer que sobrevive ao toast. */
let estadoAnterior: Estado | null = null;

function presetsFiltrados(): PresetDef[] {
  const q = norm(galBusca);
  return PRESETS.filter((pr) => {
    if (galPapel !== 'todos' && pr.papel !== galPapel) return false;
    if (galComplexidade !== 'todas' && pr.complexidade !== galComplexidade) return false;
    if (!q) return true;
    const recursos = Object.keys(pr.recursos).join(' ');
    const elementos = Object.keys(pr.elementos).join(' ');
    return norm(
      `${pr.nome} ${pr.personagem} ${pr.descricao} ${pr.referencia ?? ''} ${recursos} ${elementos}`,
    ).includes(q);
  });
}

function renderGaleria(): void {
  const grade = document.getElementById('gal-grade');
  const conta = document.getElementById('gal-conta');
  if (!grade) return;

  const chips = (
    alvo: string,
    itens: { id: string; rotulo: string }[],
    ativo: string,
    acao: string,
  ): void => {
    const box = document.getElementById(alvo);
    if (!box) return;
    box.innerHTML = itens
      .map(
        (i) =>
          `<button type="button" data-acao="${acao}" data-id="${i.id}" aria-pressed="${i.id === ativo}">${esc(i.rotulo)}</button>`,
      )
      .join('');
  };
  chips(
    'gal-papeis',
    [
      { id: 'todos', rotulo: 'Tanto faz' },
      ...PAPEIS_ORDEM.map((pp) => ({ id: pp, rotulo: PERGUNTA_PAPEL[pp] })),
    ],
    galPapel,
    'gal-papel',
  );
  chips(
    'gal-complexidades',
    [
      { id: 'todas', rotulo: 'Tanto faz' },
      { id: '1', rotulo: 'Simples · 2 elementos' },
      { id: '2', rotulo: 'Intermediário · 3 elementos' },
      { id: '3', rotulo: 'Avançado · 4 elementos, fusão, modificadores' },
    ],
    String(galComplexidade),
    'gal-cplx',
  );

  const lista = presetsFiltrados();
  if (conta) {
    conta.textContent =
      lista.length === PRESETS.length
        ? `${PRESETS.length} classes`
        : `${lista.length} de ${PRESETS.length} classes`;
  }

  if (!lista.length) {
    grade.innerHTML = `<p class="vazio">Nenhuma classe combina esses filtros.
      <button type="button" data-acao="gal-limpar">Limpar filtros</button></p>`;
    renderGaleriaDetalhe();
    return;
  }

  // agrupado por papel, e dentro do papel do simples para o avançado
  const porPapel = PAPEIS_ORDEM.filter((pp) => lista.some((x) => x.papel === pp));
  grade.innerHTML = porPapel
    .map((pp) => {
      const doPapel = [...lista.filter((x) => x.papel === pp)].sort(
        (a, b) => a.complexidade - b.complexidade || a.nome.localeCompare(b.nome),
      );
      const cards = doPapel.map((pr) => cardPreset(pr)).join('');
      return `<h4 class="gd-secao" style="grid-column:1/-1">${esc(ROTULO_PAPEL[pp])}</h4>${cards}`;
    })
    .join('');
  renderGaleriaDetalhe();
}

function cardPreset(pr: PresetDef): string {
  const recursos = Object.keys(pr.recursos)
    .map((r) => RECURSOS[r as RecursoId]?.nome ?? r)
    .join(' · ');
  const cplx =
    pr.complexidade === 1
      ? 'Simples'
      : pr.complexidade === 2
        ? 'Intermediário'
        : 'Avançado';
  return `<button type="button" class="preset-card" data-acao="gal-sel" data-id="${pr.id}"
      aria-current="${galSelecionado === pr.id}">
    <h3>${esc(pr.nome)}</h3>
    <p class="pc-promessa">${esc(pr.descricao)}</p>
    <p class="pc-skill">Já vem com: <em>“${esc(pr.skill.nome)}”</em></p>
    <p class="pc-etiquetas">
      <span class="etq">${esc(ROTULO_PAPEL[pr.papel])}</span>
      <span class="etq${pr.complexidade === 3 ? ' etq-c3' : ''}">${cplx}</span>
      <span class="etq">${esc(recursos)}</span>
    </p>
  </button>`;
}

function renderGaleriaDetalhe(): void {
  const alvo = document.getElementById('gal-detalhe');
  if (!alvo) return;
  const pr = galSelecionado ? PRESETS.find((x) => x.id === galSelecionado) : undefined;
  if (!pr) {
    alvo.innerHTML = `<p class="vazio">Escolha uma classe à esquerda para ver o que ela investe
      e o que ela ensina.</p>`;
    return;
  }
  const m = materializarPreset(pr);
  const linha = (titulo: string, obj: Partial<Record<string, number>>, nomes: (k: string) => string) => {
    const itens = Object.entries(obj).filter(([, n]) => (n ?? 0) > 0);
    if (!itens.length) return '';
    return `<p class="gd-secao">${titulo}</p><p class="gd-lista">${itens
      .map(([k, n]) => `${esc(nomes(k))} ${n}`)
      .join(' · ')}</p>`;
  };
  const gastos = pontosAtributosGastos();
  const consequencia =
    gastos > 0 || estado.skillsSalvas.length
      ? `<p class="gd-consequencia">Sua ficha atual — ${gastos} pontos investidos e
         ${estado.skillsSalvas.length} skill(s) salva(s) — será descartada. Dá pra desfazer.</p>`
      : '';
  const notaveis = elementosNotaveis(m, 6)
    .map((id) => elementoDef(id)?.nome ?? id)
    .join(' · ');

  alvo.innerHTML = `
    <h3 class="gd-nome">${esc(pr.nome)}</h3>
    <p class="gd-personagem">${esc(pr.personagem)}${pr.referencia ? ` — inspirado em ${esc(pr.referencia)}` : ''}</p>
    <p class="gd-secao">Este preset mostra</p>
    <p class="gd-ensina">${esc(pr.ensina)}</p>
    ${linha('Elementos', pr.elementos, (k) => ELEMENTOS[k as ElementoId]?.nome ?? k)}
    ${linha('Escolas', pr.escolas, (k) => ESCOLAS[k as EscolaId]?.nome ?? k)}
    ${linha('Recursos', pr.recursos, (k) => RECURSOS[k as RecursoId]?.nome ?? k)}
    ${linha('Talentos', pr.talentos ?? {}, (k) => TALENTOS[k as TalentoId]?.nome ?? k)}
    ${linha('Profissões', pr.profissoes ?? {}, (k) => PROFISSOES[k as ProfissaoId]?.nome ?? k)}
    ${notaveis ? `<p class="gd-secao">Elementos que isso abre</p><p class="gd-lista">${esc(notaveis)}</p>` : ''}
    <p class="gd-secao">Custo</p>
    <p class="gd-lista">${m.custo.atributos} pontos de atributo · ${m.custo.talentos} de talento${
      m.custo.profissoes ? ` · ${m.custo.profissoes} de profissão` : ''
    }</p>
    <button type="button" class="gd-aplicar" data-acao="gal-aplicar" data-id="${pr.id}">
      ${gastos > 0 ? 'Substituir minha ficha por esta' : 'Usar esta classe'}
    </button>
    ${consequencia}`;
}

/**
 * Aplica um preset. Parte de `estadoPadrao()` e sobrescreve — sobrou bug antes
 * por zerar `skillsSalvas` e deixar `estado.fusao` com índices pendurados.
 * Preserva o que é preferência da pessoa, não da build: vista de talentos.
 */
function aplicarPreset(id: string): void {
  const pr = PRESETS.find((x) => x.id === id);
  if (!pr) return;
  const m = materializarPreset(pr);
  const grave = m.problemas.filter((x) => x.severidade === 'erro');
  if (grave.length) {
    toast(`Preset "${pr.nome}" com problema: ${grave[0].mensagem}`);
    return;
  }
  estadoAnterior = estado;
  const vistaTalentos = estado.vistaTalentos;
  const snapshots = estado.snapshots;

  estado = estadoPadrao();
  estado.personagem = m.personagem;
  estado.skill = m.skill;
  estado.vistaTalentos = vistaTalentos;
  estado.snapshots = snapshots;
  // o orçamento passa a ser EXATAMENTE o que o preset gasta, nunca o máximo
  // acumulado — antes, clicar no Nulo (156 pts) deixava o teto em 160 para
  // sempre e todos os outros presets pareciam sobrar espaço.
  // profissões entram no MESMO orçamento de atributos que o cabeçalho conta
  // (`pontosAtributosGastos`). Sem somá-las aqui, todo preset de ofício abria
  // marcado como estourado — o Mestre Encantador gasta 70 + 26 e o teto ficava
  // em 70.
  const totalAtributos = m.custo.atributos + m.custo.profissoes;
  estado.orcamentoAtributos = Math.max(20, Math.ceil(totalAtributos / 10) * 10);
  estado.orcamentoTalentos = Math.max(5, m.custo.talentos);
  if (m.fusao) {
    estado.skillsSalvas = [...m.fusao.componentes];
    estado.fusao = m.fusao.componentes.map((_, i) => i);
    estado.abaAtiva = 'fusao';
  } else if (pr.complexidade === 3 && (m.skill.modificadores?.length ?? 0) > 0) {
    estado.abaAtiva = 'skill';
  }
  presetAtual = pr;
  licaoPendente = pr.ensina;

  (el('orc-atributos') as HTMLInputElement).value = String(estado.orcamentoAtributos);
  (el('orc-talentos') as HTMLInputElement).value = String(estado.orcamentoTalentos);
  fecharGaleria();
  render();
  toast(`${pr.nome} aplicado. Use "Voltar para a ficha anterior" se quiser desfazer.`);
}

let presetAtual: PresetDef | null = null;
let licaoPendente: string | null = null;

function desfazerPreset(): void {
  if (!estadoAnterior) return;
  estado = estadoAnterior;
  estadoAnterior = null;
  presetAtual = null;
  licaoPendente = null;
  (el('orc-atributos') as HTMLInputElement).value = String(estado.orcamentoAtributos);
  (el('orc-talentos') as HTMLInputElement).value = String(estado.orcamentoTalentos);
  render();
  toast('Ficha anterior restaurada.');
}

function abrirGaleria(): void {
  const d = document.getElementById('galeria') as HTMLDialogElement | null;
  if (!d) return;
  renderGaleria();
  d.showModal();
  if (window.innerWidth > 900) (document.getElementById('gal-busca') as HTMLInputElement)?.focus();
}

function fecharGaleria(): void {
  (document.getElementById('galeria') as HTMLDialogElement | null)?.close();
}

/** A tira: quantas classes existem, qual está carregada, e o desfazer. */
function renderBarraPresets(): void {
  const conta = document.getElementById('pa-conta');
  if (conta) conta.textContent = `${PRESETS.length} disponíveis`;
  const atual = document.getElementById('presets-atual');
  if (atual) {
    if (!presetAtual) {
      atual.textContent = pontosAtributosGastos() > 0 ? 'Ficha própria' : 'Ficha em branco';
    } else {
      const mexeu = pontosAtributosGastos() !== custoDe(presetAtual).atributos;
      atual.textContent = `Agora: ${presetAtual.nome}${mexeu ? ', com suas mudanças' : ''}`;
    }
  }
  const btn = document.getElementById('btn-desfazer-preset');
  if (btn) btn.toggleAttribute('hidden', !estadoAnterior);
}

function render(): void {
  const prog = calcularProgressao(estado.personagem);
  renderCabecalho();
  renderBarraPresets();
  renderAbas();
  renderCeuElementos(prog);
  renderPainelInvestir(prog);
  renderDetalheElemento(prog);
  renderMatrizAfinidades();
  renderEscolas();
  renderRecursos();
  renderTalentos();
  renderDerivados(prog);
  renderArquetipos(prog);
  renderFormSkill(prog);
  renderResultadoSkill(prog);
  renderSkillsSalvas();
  renderBancada();
  renderFormEvocar(prog);
  renderResultadoEvocar(prog);
  renderBestiario(prog);
  renderCriaturas(prog);
  renderProfissoes(prog);
  renderFormCraft(prog);
  renderResultadoCraft(prog);
  renderFusao(prog);
  renderComparacao();
  salvar();
}

function renderCabecalho(): void {
  const ga = pontosAtributosGastos();
  const gt = pontosTalentosGastos();
  const excedido = ga > estado.orcamentoAtributos || gt > estado.orcamentoTalentos;
  const g = el('gastos');
  g.textContent = `atributos ${ga}/${estado.orcamentoAtributos} · talentos ${gt}/${estado.orcamentoTalentos}`;
  g.classList.toggle('excedido', excedido);
}

function renderAbas(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-acao="aba"]').forEach((b) => {
    b.classList.toggle('ativo', b.dataset.id === estado.abaAtiva);
  });
  document.querySelectorAll<HTMLElement>('.aba').forEach((s) => {
    s.classList.toggle('ativa', s.id === `aba-${estado.abaAtiva}`);
  });
  renderLicao();
}

/**
 * A faixa-lição: depois de aplicar um preset, ela diz POR QUE aquele preset
 * existe, no topo da aba para onde o preset levou. É um bloco no fluxo, não um
 * popover nem um tour de vários passos — dá para reler, e some quando cumpriu
 * a função.
 */
function renderLicao(): void {
  document.getElementById('licao-faixa')?.remove();
  if (!licaoPendente || !presetAtual) return;
  const secao = document.getElementById(`aba-${estado.abaAtiva}`);
  if (!secao) return;
  const faixa = document.createElement('div');
  faixa.id = 'licao-faixa';
  faixa.className = 'licao';
  faixa.setAttribute('role', 'status');
  faixa.innerHTML = `<span class="licao-tag">Por que este preset existe</span>
    <p><strong>${esc(presetAtual.nome)}.</strong> ${esc(licaoPendente)}</p>
    <button type="button" data-acao="licao-ok">Entendi</button>`;
  secao.prepend(faixa);
}

// ------------------------------------------------- céu dos elementos

/**
 * As abas que o simulador conhece. Vive aqui, e não num array literal solto
 * dentro de `carregar()`, justamente porque esquecer de atualizar aquele
 * literal fazia a aba salva ser descartada em silêncio no reload.
 */
const ABAS_VALIDAS: string[] = [
  'elementos',
  'escolas',
  'recursos',
  'talentos',
  'bestiario',
  'profissao',
  'skill',
  'fusao',
];

let elementoSelecionado: ElementoId | null = null;

/** Controles do céu: profundidade, lente, busca e foco de linhagem. */
interface EstadoCeu {
  profundidade: 2 | 3 | 4;
  lente: 'tudo' | 'desbloqueados' | 'proximos' | 'curados' | 'procedurais';
  busca: string;
  foco: boolean;
  zoom: 1 | 2 | 3;
}

/**
 * O céu não tem default fixo — ele tem default DERIVADO da ficha.
 *
 * Com uma ficha zerada e `profundidade: 3, lente: 'tudo'`, praticamente todo
 * derivado cai em `e-distante` e nenhum ganha rótulo: a tela mais cara do
 * simulador abriria mostrando 17 pontos nomeados e centenas de manchas cinzas
 * anônimas. Ancorando o default no que a ficha já alcançou, o primeiro contato
 * é o anel de pares nomeados — um céu que se lê — e o espaço completo continua
 * a um clique.
 */
function ceuPadraoPara(prog: Progressao): EstadoCeu {
  const maiorAridade = prog.combinacoesLiberadas.reduce(
    (m, c) => Math.max(m, c.aridade),
    prog.elementosDisponiveis.some((id) => (elementoDef(id)?.receita?.length ?? 0) >= 2) ? 2 : 1,
  );
  const profundidade = Math.min(4, Math.max(2, maiorAridade + 1)) as 2 | 3 | 4;
  const temElemento = prog.elementosDisponiveis.length > 0;
  return {
    profundidade,
    lente: temElemento ? 'tudo' : 'curados',
    busca: '',
    foco: true,
    zoom: profundidade === 2 ? 1 : profundidade === 3 ? 2 : 3,
  };
}

/**
 * Configuração corrente. Enquanto `ceuAutomatico` for true, ela é recalculada
 * a cada render a partir da ficha; assim que o usuário mexe num controle, a
 * escolha dele passa a mandar e o automático desliga.
 */
let ceu: EstadoCeu = { profundidade: 2, lente: 'curados', busca: '', foco: true, zoom: 1 };
let ceuAutomatico = true;

/** Marca que o usuário assumiu o controle do céu. */
function ceuManual(): void {
  ceuAutomatico = false;
}

const INDICE_BASE = new Map<string, number>(
  elementosBase().map((e, i) => [e.id, i]),
);

/** Candidato ao céu: já resolvido, com posição e métricas de prioridade. */
interface Candidato {
  def: ElementoDef;
  aridade: number;
  nivel: number;
  progresso: number;
  curada: boolean;
  pos: PosEstrela;
  prioridade: number;
}

function indicesDe(def: ElementoDef): number[] {
  if (def.tipo === 'base') return [INDICE_BASE.get(def.id) ?? 0];
  return (def.receita ?? []).map((r) => INDICE_BASE.get(r.elemento) ?? 0);
}

function posicaoDe(def: ElementoDef): PosEstrela {
  const idx = indicesDe(def);
  if (def.tipo === 'base') return posicaoBase(idx[0]);
  if (idx.length >= 2 && idx.length <= 4) return posicaoCombinacao(idx);
  // receitas amplas (primordial, ciclo, nulo) moram no núcleo
  return { x: CENTRO, y: CENTRO, r: 5, arco: 0, pista: 0 };
}

const norm = (t: string) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Ancestrais e descendentes do selecionado, por continência de receita. */
function linhagemDe(id: ElementoId, candidatos: Candidato[]): Map<ElementoId, number> {
  const alvoDef = elementoDef(id);
  if (!alvoDef) return new Map();
  const alvo = new Set<string>(
    alvoDef.tipo === 'base' ? [alvoDef.id] : (alvoDef.receita ?? []).map((r) => r.elemento),
  );
  const m = new Map<ElementoId, number>([[id, 0]]);
  for (const c of candidatos) {
    if (c.def.id === id) continue;
    const seus = new Set<string>(
      c.def.tipo === 'base' ? [c.def.id] : (c.def.receita ?? []).map((r) => r.elemento),
    );
    const contidoNoAlvo = [...seus].every((x) => alvo.has(x));
    const contemAlvo = [...alvo].every((x) => seus.has(x));
    if (contidoNoAlvo && seus.size < alvo.size) m.set(c.def.id, alvo.size - seus.size);
    else if (contemAlvo && seus.size > alvo.size) m.set(c.def.id, -(seus.size - alvo.size));
  }
  return m;
}

function passaLente(c: Candidato): boolean {
  switch (ceu.lente) {
    case 'desbloqueados': return c.nivel > 0;
    case 'proximos': return c.nivel === 0 && c.progresso >= 0.55;
    case 'curados': return c.curada;
    case 'procedurais': return !c.curada;
    default: return true;
  }
}

/**
 * Reúne os candidatos do céu. O espaço completo tem 3.213 nós; esta função
 * materializa só o que pode importar e a prioridade corta o resto.
 */
function candidatosDoCeu(prog: Progressao): Candidato[] {
  const lista: Candidato[] = [];
  const vistos = new Set<ElementoId>();
  const push = (def: ElementoDef, curada: boolean) => {
    if (vistos.has(def.id)) return;
    vistos.add(def.id);
    const aridade = def.tipo === 'base' ? 1 : (def.receita?.length ?? 1);
    lista.push({
      def,
      aridade,
      nivel: prog.niveisEfetivos[def.id] ?? 0,
      progresso: def.tipo === 'base' ? 1 : progressoReceita(def, prog),
      curada,
      pos: posicaoDe(def),
      prioridade: 0,
    });
  };
  for (const b of elementosBase()) push(b, true);
  for (const d of elementosDerivados()) push(d, true);
  // combinações de 3/4: relevantes (desbloqueadas ou próximas) + as curadas
  for (const r of combinacoesRelevantes(prog.niveisEfetivos, {
    limite: 320,
    progressoMinimo: 0.35,
  })) {
    const def = elementoDef(r.info.id);
    if (def) push(def, r.info.curada);
  }
  for (const info of TODAS_COMBINACOES) {
    if (!info.curada || vistos.has(info.id)) continue;
    const def = elementoDef(info.id);
    if (def) push(def, true);
  }
  // resultados de busca entram mesmo que frios
  if (norm(ceu.busca).length >= 2) {
    for (const info of buscarCombinacoes(ceu.busca, 120)) {
      const def = elementoDef(info.id);
      if (def) push(def, info.curada);
    }
  }
  return lista;
}

function calcularPrioridades(
  cands: Candidato[],
  prog: Progressao,
  linhagem: Map<ElementoId, number>,
  achados: Set<ElementoId>,
): void {
  for (const c of cands) {
    const k = c.aridade;
    if (k === 1) { c.prioridade = 1000; continue; }
    if (c.def.tipo === 'especial') { c.prioridade = 950; continue; }
    if (elementoSelecionado === c.def.id) { c.prioridade = 900; continue; }
    if (ceu.foco && linhagem.has(c.def.id)) {
      c.prioridade = 800 + 40 * (4 - Math.abs(linhagem.get(c.def.id)!));
      continue;
    }
    if (achados.has(c.def.id)) { c.prioridade = 700; continue; }
    if (!passaLente(c) || k > ceu.profundidade) { c.prioridade = -1; continue; }
    if (c.nivel > 0) { c.prioridade = 600 + Math.min(99, c.nivel); continue; }
    if (c.progresso >= 0.85) { c.prioridade = 500 + Math.round(c.progresso * 99); continue; }
    if (c.progresso >= 0.55) { c.prioridade = 400 + Math.round(c.progresso * 99); continue; }
    if (k === 2) { c.prioridade = 300; continue; }
    if (c.curada) { c.prioridade = 200 + (5 - k) * 10; continue; }
    if (c.progresso >= 0.25) { c.prioridade = 100 + Math.round(c.progresso * 50); continue; }
    c.prioridade = -1;
  }
}

function classeEstrela(def: ElementoDef, prog: Progressao): string {
  if (def.tipo === 'base') return 'e-base';
  const nivel = prog.niveisEfetivos[def.id] ?? 0;
  if (nivel > 0) return 'e-desbloqueado';
  const progresso = progressoReceita(def, prog);
  if (progresso >= 0.85) return 'e-iminente';
  return progresso >= 0.55 ? 'e-proximo' : 'e-distante';
}

function renderControlesCeu(desenhados: number, total: number): void {
  const alvo = document.getElementById('ceu-controles');
  if (!alvo) return;
  const btn = (grupo: string, val: string, rot: string, ativo: boolean) =>
    `<button type="button" data-acao="ceu-${grupo}" data-id="${val}" class="${ativo ? 'ativo' : ''}">${rot}</button>`;
  alvo.innerHTML = `
    <div class="ceu-grupo"><span class="ceu-rot">Profundidade</span>
      ${[2, 3, 4].map((d) => btn('prof', String(d), `${d}`, ceu.profundidade === d)).join('')}</div>
    <div class="ceu-grupo"><span class="ceu-rot">Lente</span>
      ${btn('lente', 'tudo', 'Tudo', ceu.lente === 'tudo')}
      ${btn('lente', 'desbloqueados', 'Abertos', ceu.lente === 'desbloqueados')}
      ${btn('lente', 'proximos', 'Próximos', ceu.lente === 'proximos')}
      ${btn('lente', 'curados', 'Nomeados', ceu.lente === 'curados')}
      ${btn('lente', 'procedurais', 'Emergentes', ceu.lente === 'procedurais')}</div>
    <div class="ceu-grupo"><span class="ceu-rot">Zoom</span>
      ${[1, 2, 3].map((z) => btn('zoom', String(z), `${z}×`, ceu.zoom === z)).join('')}</div>
    <div class="ceu-grupo">
      ${btn('foco', 'toggle', ceu.foco ? '◉ Foco de linhagem' : '○ Foco de linhagem', ceu.foco)}</div>
    <div class="ceu-grupo ceu-busca">
      <input id="ceu-busca" type="search" placeholder="buscar combinação…"
        value="${esc(ceu.busca)}" aria-label="Buscar elemento ou combinação">
    </div>
    <div class="ceu-conta">${desenhados} de ${total} nós desenhados</div>`;
}

function renderCeuElementos(prog: Progressao): void {
  if (ceuAutomatico) ceu = { ...ceuPadraoPara(prog), busca: ceu.busca };
  const totalEspaco = elementosBase().length + elementosDerivados().length + TODAS_COMBINACOES.length;
  el('conta-elementos').textContent =
    `${prog.elementosDisponiveis.length} com nível efetivo · ${prog.combinacoesLiberadas.length} combinações amplas abertas`;

  const cands = candidatosDoCeu(prog);
  const achados = new Set<ElementoId>(
    norm(ceu.busca).length >= 2
      ? cands.filter((c) => norm(c.def.nome).includes(norm(ceu.busca))).map((c) => c.def.id)
      : [],
  );
  const linhagem =
    ceu.foco && elementoSelecionado ? linhagemDe(elementoSelecionado, cands) : new Map<ElementoId, number>();

  calcularPrioridades(cands, prog, linhagem, achados);
  const visiveis = cands
    .filter((c) => c.prioridade >= 0)
    .sort((a, b) => b.prioridade - a.prioridade || a.def.id.localeCompare(b.def.id))
    .slice(0, TETO.nos);

  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  let fundo = '';
  for (let i = 0; i < 90; i++) {
    fundo += `<circle class="fundo-estrela" cx="${(rnd() * W_CEU).toFixed(1)}" cy="${(rnd() * W_CEU).toFixed(1)}" r="${(0.4 + rnd() * 0.9).toFixed(2)}" opacity="${(0.1 + rnd() * 0.28).toFixed(2)}"/>`;
  }

  // guias de faixa: mostram onde vive cada aridade
  let guias = '';
  for (const g of guiasDeFaixa()) {
    const ativa = ceu.profundidade >= g.aridade ? ' ativa' : '';
    guias += `<circle class="faixa-aridade${ativa}" cx="${CENTRO}" cy="${CENTRO}" r="${g.raio}"/>`;
    guias += `<text class="rotulo-anel" x="${CENTRO}" y="${(CENTRO - g.raio + 11).toFixed(1)}">${g.rotulo}</text>`;
  }

  const bases = elementosBase();
  const anelPontos = bases
    .map((b) => {
      const p = posicaoDe(b);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');
  let ligas = `<polygon class="anel-zodiaco" points="${anelPontos}"/>`;

  // linhas de receita, com orçamento: quádrupla fraca cai antes de par forte
  const comLinha = visiveis
    .filter((c) => c.aridade >= 2 && (c.nivel > 0 || elementoSelecionado === c.def.id || linhagem.has(c.def.id)))
    .sort((a, b) => a.aridade - b.aridade || b.nivel - a.nivel)
    .slice(0, TETO.linhas / 3);
  for (const c of comLinha) {
    const selecionada = elementoSelecionado === c.def.id;
    const naLinhagem = linhagem.has(c.def.id);
    const cls = selecionada ? 'liga-selecao' : naLinhagem ? 'liga-ancestral' : 'liga-receita';
    for (const comp of c.def.receita ?? []) {
      const ate = posicaoDe(ELEMENTOS[comp.elemento]);
      ligas += `<line class="${cls}" x1="${c.pos.x.toFixed(1)}" y1="${c.pos.y.toFixed(1)}" x2="${ate.x.toFixed(1)}" y2="${ate.y.toFixed(1)}"/>`;
    }
  }

  let estrelas = '';
  let rotulos = '';
  let orcamentoRotulos = TETO.rotulos;
  for (const c of visiveis) {
    const def = c.def;
    const p = c.pos;
    const classes = [
      classeEstrela(def, prog),
      `a${Math.min(5, c.aridade)}`,
      c.curada ? 'curado' : 'procedural',
    ];
    if (elementoSelecionado === def.id) classes.push('selecionado', 'linhagem-selecionado');
    else if (linhagem.has(def.id)) {
      classes.push(linhagem.get(def.id)! > 0 ? 'linhagem-ancestral' : 'linhagem-descendente');
    }
    if (achados.has(def.id)) classes.push('achado');

    const raio = def.tipo === 'base' ? p.r + Math.min(5, c.nivel * 0.25) : raioComNivel(p.r, c.nivel);
    const corBase = def.tipo === 'base' ? ` style="fill:${CORES[def.id as ElementoBaseId]}"` : '';
    const arte = sigilo(def.id);
    const corpo =
      def.tipo === 'base' && arte
        ? (() => {
            const lado = raio * 4.2;
            return `<circle class="halo" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(lado / 2 + 4).toFixed(1)}"/>
      <image href="${arte}" x="${(p.x - lado / 2).toFixed(1)}" y="${(p.y - lado / 2).toFixed(1)}" width="${lado.toFixed(1)}" height="${lado.toFixed(1)}"/>`;
          })()
        : `<circle class="halo" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(raio + 8).toFixed(1)}"/>
      <circle class="nucleo" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${raio.toFixed(1)}"${corBase}/>`;
    const raioSel = def.tipo === 'base' && arte ? raio * 2.1 + 5 : raio + 4;
    const dist = linhagem.get(def.id);
    estrelas += `<g class="${classes.join(' ')}" data-acao="estrela-ceu" data-id="${def.id}" tabindex="0" role="button"${
      dist !== undefined ? ` data-dist="${Math.abs(dist)}"` : ''
    }${elementoSelecionado === def.id ? ' aria-current="true"' : ''}
      aria-label="${esc(def.nome)} (nível ${c.nivel})">
      <title>${esc(def.nome)} — ${esc(def.descricao)}</title>
      <circle class="alvo" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="8"/>
      ${corpo}
      <circle class="anel-sel" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${raioSel.toFixed(1)}" fill="none"/>
    </g>`;

    if (def.tipo === 'base') {
      const ang = Math.atan2(p.y - CENTRO, p.x - CENTRO);
      const lx = CENTRO + Math.cos(ang) * R_ROTULO_BASE;
      const ly = CENTRO + Math.sin(ang) * R_ROTULO_BASE;
      const anchor = Math.abs(Math.cos(ang)) < 0.3 ? 'middle' : Math.cos(ang) > 0 ? 'start' : 'end';
      rotulos += `<text class="rotulo-base" x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" text-anchor="${anchor}">${esc(def.nome)}${c.nivel > 0 ? ` ${c.nivel}` : ''}</text>`;
    } else if (
      orcamentoRotulos > 0 &&
      (elementoSelecionado === def.id || linhagem.has(def.id) || achados.has(def.id) || c.nivel > 0)
    ) {
      orcamentoRotulos--;
      rotulos += `<text class="rotulo-deriv${c.curada ? '' : ' procedural'}" x="${p.x.toFixed(1)}" y="${(p.y + raio + 10).toFixed(1)}">${esc(def.nome)}${c.nivel > 0 ? ` ${c.nivel}` : ''}</text>`;
    }
  }

  const modo = [
    ceu.foco && elementoSelecionado ? 'foco-ativo' : '',
    achados.size ? 'busca-ativa' : '',
    visiveis.length > 380 ? 'densidade-alta' : '',
  ]
    .filter(Boolean)
    .join(' ');

  el('ceu-elementos').innerHTML = `<svg class="${modo}" viewBox="${VIEWBOX[ceu.zoom]}" role="img" aria-label="Céu dos Elementos">
    ${fundo}${guias}${ligas}${estrelas}${rotulos}
  </svg>`;
  renderControlesCeu(visiveis.length, totalEspaco);
}

function renderMatrizAfinidades(): void {
  const bases = elementosBase().map((e) => e.id as ElementoBaseId);
  const abrev = (id: string) => ELEMENTOS[id].nome.slice(0, 3);
  const cabecalho =
    `<tr><th class="canto">atk\\def</th>${bases.map((d) => `<th title="${esc(ELEMENTOS[d].nome)}">${esc(abrev(d))}</th>`).join('')}</tr>`;
  const linhas = bases
    .map((atk) => {
      const cells = bases
        .map((def) => {
          if (atk === def) return `<td>·</td>`;
          const m = efetividade(atk, def);
          const cls = m > 1 ? 'forte' : m < 1 ? 'fraco' : '';
          const txt = m > 1 ? '▲' : m < 1 ? '▽' : '';
          return `<td class="${cls}" title="${esc(ELEMENTOS[atk].nome)} → ${esc(ELEMENTOS[def].nome)}: ×${m}">${txt}</td>`;
        })
        .join('');
      return `<tr><th title="${esc(ELEMENTOS[atk].nome)}">${esc(abrev(atk))}</th>${cells}</tr>`;
    })
    .join('');
  el('matriz-afinidades').innerHTML = `<table class="matriz">${cabecalho}${linhas}</table>`;
}


/**
 * A tabela de investimento — a única superfície onde pontos são gastos em
 * elementos.
 *
 * O céu deixou de ser um controle e voltou a ser um mapa: clicar numa estrela
 * seleciona, mostra a receita e ilumina a linhagem, mas não gasta ponto. Investir
 * pelo céu exigia caçar a estrela certa no anel externo antes de cada clique;
 * a lista lateral mostra exatamente o conjunto investível — sem procura.
 */
function renderPainelInvestir(prog: Progressao): void {
  const alvo = document.getElementById('painel-investir');
  if (!alvo) return;
  const p = estado.personagem;
  const filtro = norm(estado.filtroInvestir ?? '');
  // O conjunto investível é `prog.alocaveis` — as 17 bases MAIS os derivados
  // que a cascata destravou (10 passivos num par, 6 numa tripla, 4 numa
  // quádrupla). NÃO pode ser `elementosBase()` fixo: um par destravado ficaria
  // sem lugar para receber o ponto direto que a regra concede, e a UI estaria
  // reimplementando o teste de destrave por omissão. Quem decide é o motor.
  //
  // A tabela lista `alocaveis` ∪ {derivados que JÁ TÊM ponto direto}. A união
  // não é detalhe: com só `alocaveis`, quem investisse num par destravado e
  // depois baixasse um componente via "−" via o par RETRANCAR, sumir da lista
  // e continuar cobrando orçamento — sem nenhum "−" na tela para recuperar o
  // ponto (com o "+10", 20 pts irrecuperáveis a não ser pelo "Resetar", que
  // apaga a build inteira). Investir depende do destrave; devolver, nunca.
  const comPontoDireto = (Object.keys(p.elementos) as ElementoId[])
    .filter((id) => (p.elementos[id] ?? 0) > 0 && !prog.alocaveis.includes(id));
  // Derivados com passivos > 0 mas ainda travados (nunca tiveram ponto
  // direto): já ganharam pontos de cascata (investimento nos pais, ou
  // sinergia de alvo único transbordando) e merecem aparecer NA LISTA —
  // mesmo sem poder receber ponto ainda — para o jogador ver o progresso em
  // vez de descobrir o elemento só quando ele destrava do nada.
  const emProgresso = [...prog.cascata.progressoDestravamento.keys()]
    .filter((id) => !prog.alocaveis.includes(id) && !comPontoDireto.includes(id));
  const investiveis = [...prog.alocaveis, ...comPontoDireto, ...emProgresso]
    .map((id) => elementoDef(id))
    .filter((def): def is ElementoDef => Boolean(def))
    .filter((def) => !filtro || norm(def.nome).includes(filtro) || norm(def.id).includes(filtro));
  const travados = new Set(comPontoDireto);
  const progressoSet = new Set(emProgresso);

  const conta = document.getElementById('conta-investidos');
  if (conta) {
    // custo por geração, nunca soma crua (ponto direto em derivado custa mais)
    const gastos = custoDeAlocacao(p.elementos).total;
    conta.textContent = `${gastos} de ${estado.orcamentoAtributos} pts`;
  }

  if (!investiveis.length) {
    alvo.innerHTML = `<div class="pi-vazio">Nenhum elemento investível com "${esc(estado.filtroInvestir ?? '')}".</div>`;
    return;
  }

  alvo.innerHTML = investiveis
    .map((def) => {
      const id = def.id as ElementoId;
      const direto = p.elementos[id] ?? 0;
      const efetivo = prog.niveisEfetivos[id] ?? 0;
      const sinergia = efetivo - direto;
      const selecionada = elementoSelecionado === def.id ? ' selecionada' : '';
      const aridade = Math.min(4, Math.max(1, aridadeDe(def.id))) as Aridade;
      const travado = travados.has(id);
      const emProgressoLinha = progressoSet.has(id);

      // em progresso: nunca teve ponto direto, só passivos de cascata (pais
      // investidos, ou sinergia de alvo único) — sem "+" nem "−", só a barra.
      if (emProgressoLinha) {
        const prog2 = prog.cascata.progressoDestravamento.get(id)!;
        return `<div class="pi-linha pi-progresso" data-linha-elemento="${def.id}">
          ${sig(def.id, 'sig-mini')}
          <div>
            <div class="pi-nome">${esc(def.nome)} <span class="pi-selo" title="Ganha passivos com o investimento nos componentes (e sinergias ligadas a eles) — ainda não aceita ponto direto.">${prog2.passivos}/${prog2.limiar} passivos</span></div>
            <div class="pi-nivel">nível ${efetivo}${
              sinergia > 0 ? ` <span class="sinergia">(+${sinergia} sinergia)</span>` : ''
            }</div>
          </div>
        </div>`;
      }

      // derivado destravado: mostra a geração e o custo por ponto, para o
      // jogador entender por que aquele "+" gasta mais que o de uma base
      const selo = def.tipo === 'base'
        ? ''
        : travado
          ? ` <span class="pi-selo pi-selo-travado" title="A cascata retrancou este elemento: os pontos diretos que ficaram continuam custando ${CUSTO_PONTO_ALOCACAO[aridade]} cada. Remova-os aqui ou reponha os componentes para destravar de novo.">travado · ${CUSTO_PONTO_ALOCACAO[aridade]}pt</span>`
          : ` <span class="pi-selo" title="Destravado pela cascata: cada ponto custa ${CUSTO_PONTO_ALOCACAO[aridade]} de orçamento">gen ${aridade} · ${CUSTO_PONTO_ALOCACAO[aridade]}pt</span>`;
      // travado: só o "−". O "+" some porque o motor recusaria o ponto — mas a
      // devolução tem de continuar ao alcance de um clique.
      const mais = travado
        ? ''
        : `<button type="button" data-acao="inc-elemento" data-id="${def.id}"
            aria-label="Adicionar ponto em ${esc(def.nome)}">+</button>`;
      return `<div class="pi-linha${selecionada}${travado ? ' pi-travado' : ''}" data-linha-elemento="${def.id}">
        ${sig(def.id, 'sig-mini')}
        <div>
          <div class="pi-nome">${esc(def.nome)}${selo}</div>
          <div class="pi-nivel">nível ${efetivo}${
            sinergia > 0 ? ` <span class="sinergia">(+${sinergia} sinergia)</span>` : ''
          }</div>
        </div>
        <div class="pi-controles">
          <button type="button" data-acao="dec-elemento" data-id="${def.id}"
            aria-label="Remover ponto de ${esc(def.nome)}"${direto <= 0 ? ' disabled' : ''}>−</button>
          <span class="valor num">${direto}</span>
          ${mais}
        </div>
      </div>`;
    })
    .join('');
}

function renderDetalheElemento(prog: Progressao): void {
  const alvo = el('elemento-detalhe');
  if (!elementoSelecionado || !elementoDef(elementoSelecionado)) {
    alvo.innerHTML = `<div class="talento-detalhe vazio">Clique numa estrela do céu para ver a receita dela e iluminar a linhagem. Os pontos você investe na tabela ao lado.</div>`;
    return;
  }
  const def = elementoDef(elementoSelecionado)!;
  const nivel = prog.niveisEfetivos[def.id] ?? 0;

  if (def.tipo === 'base') {
    const direto = estado.personagem.elementos[def.id] ?? 0;
    const bonus = nivel - direto;
    alvo.innerHTML = `<div class="talento-detalhe detalhe-com-sig">
      ${sig(def.id, 'sig-detalhe')}
      <div class="detalhe-corpo">
      <div class="nome">${esc(def.nome)} <span class="conta">elemento base</span></div>
      <div class="desc">${esc(def.descricao)}</div>
      <div>Nível efetivo <strong class="num">${nivel}</strong>${bonus > 0 ? ` <span class="efetivo">(${direto} diretos + ${bonus} de sinergia)</span>` : ''}</div>
      <div class="desc">Investir pontos é na tabela ao lado — a linha deste elemento está destacada lá.</div>
    </div></div>`;
    return;
  }

  const receita = def
    .receita!.map((comp) => {
      const atual = prog.niveisEfetivos[comp.elemento] ?? 0;
      const okMin = atual >= comp.nivelMinimo;
      const fracao = Math.min(1, atual / comp.nivelMinimo);
      return `<div class="perfil-linha"><span>${esc(ELEMENTOS[comp.elemento].nome)}</span>
        <div class="barra ${okMin ? 'cheia' : ''}"><i style="width:${pct(fracao)}"></i></div>
        <span class="num">${atual}/${comp.nivelMinimo}</span></div>`;
    })
    .join('');
  const sigDeriv = def.receita!.map((c) => sig(c.elemento, 'sig-mini')).join('');

  // Ledger da ALOCAÇÃO GERACIONAL — a UI LÊ a cascata, nunca a recalcula
  // (reimplementar o destrave aqui é o footgun de regra copiada).
  const cascata = prog.cascata;
  const passivos = cascata.passivos.get(def.id) ?? 0;
  const diretos = estado.personagem.elementos[def.id] ?? 0;
  const destravado = cascata.destravados.has(def.id);
  const progresso = cascata.progressoDestravamento.get(def.id);
  const aridade = Math.min(4, def.receita!.length) as 1 | 2 | 3 | 4;
  const custoPonto = CUSTO_PONTO_ALOCACAO[aridade];
  const nuncaDestrava = def.cascata?.destravavel === false;

  // Pontos diretos que sobraram num elemento TRAVADO (o jogador investiu com
  // ele destravado e depois baixou um componente, retrancando-o) continuam
  // custando orçamento. Sem estes controles, o único caminho de volta era
  // "Resetar" — devolver ponto não pode depender do destrave.
  const controlesDevolucao = diretos > 0
    ? `<div>${diretos === 1
          ? 'Restou <strong class="num">1</strong> ponto direto'
          : `Restaram <strong class="num">${diretos}</strong> pontos diretos`} de quando estava destravado
        <span class="conta">· ainda custa${diretos === 1 ? ` ${custoPonto} de orçamento` : `m ${custoPonto} de orçamento cada`}</span></div>
      <div class="controles">
        <button type="button" data-acao="dec-elemento" data-id="${def.id}" aria-label="Remover ponto">−</button>
        <span class="valor num">${diretos}</span>
        <button type="button" data-acao="dec-elemento" data-id="${def.id}" data-passo="10" aria-label="Remover dez pontos">−10</button>
      </div>`
    : '';

  let ledger: string;
  if (nuncaDestrava) {
    ledger = `<div class="desc">Receita ampla: nunca aceita pontos diretos — evolui só pela cascata dos componentes.</div>${controlesDevolucao}`;
  } else if (destravado) {
    ledger = `<div>Cascata <strong class="num">${passivos}</strong> passivos + <strong class="num">${diretos}</strong> diretos
      <span class="conta">· ponto direto custa ${custoPonto} de orçamento</span></div>
      <div class="controles">
        <button type="button" data-acao="dec-elemento" data-id="${def.id}" aria-label="Remover ponto">−</button>
        <span class="valor num">${diretos}</span>
        <button type="button" data-acao="inc-elemento" data-id="${def.id}" aria-label="Adicionar ponto">+</button>
        <button type="button" data-acao="inc-elemento" data-id="${def.id}" data-passo="10" aria-label="Adicionar dez pontos">+10</button>
        <button type="button" data-acao="dec-elemento" data-id="${def.id}" data-passo="10" aria-label="Remover dez pontos"${diretos <= 0 ? ' disabled' : ''}>−10</button>
      </div>`;
  } else {
    const limiar = progresso?.limiar ?? LIMIAR_DESTRAVAMENTO[aridade];
    const fracao = Math.min(1, passivos / limiar);
    // marco em orçamento: limiar × divisor em cada um dos N componentes
    const marcoOrcamento = limiar * DIVISOR_CASCATA[aridade] * aridade;
    ledger = `<div class="perfil-linha"><span>Destrave da alocação direta</span>
      <div class="barra ${passivos >= limiar ? 'cheia' : ''}"><i style="width:${pct(fracao)}"></i></div>
      <span class="num">${passivos}/${limiar}</span></div>
      <div class="desc">A cada ${DIVISOR_CASCATA[aridade]} pontos DIRETOS em CADA componente, +1 ponto passivo aqui (transbordo de sinergia e nível de receita NÃO contam). Com ${limiar} passivos (≈${marcoOrcamento} de orçamento nas bases), este elemento passa a aceitar pontos diretos.</div>
      ${controlesDevolucao}`;
  }

  alvo.innerHTML = `<div class="talento-detalhe detalhe-com-sig">
    <div class="sig-combo">${sigDeriv}</div>
    <div class="detalhe-corpo">
    <div class="nome">${esc(def.nome)} <span class="conta">${def.tipo} · potência ×${def.fatorPotencia}</span></div>
    <div class="desc">${esc(def.descricao)}</div>
    <div>${nivel > 0 ? `Nível <strong class="num">${nivel}</strong> — menor componente${diretos > 0 ? ' + pontos diretos' : ''}.` : 'Ainda não liberado — todos os componentes precisam atingir o mínimo.'}</div>
    ${receita}
    ${ledger}
  </div></div>`;
}

// ------------------------------------------------- escolas / recursos

function renderEscolas(): void {
  el('escolas').innerHTML = Object.values(ESCOLAS)
    .map((def) => {
      const pontos = estado.personagem.escolas[def.id] ?? 0;
      return `<div class="carta carta-com-sig">
        ${sig(def.id, 'sig-carta')}
        <div class="carta-corpo">
        <div class="nome">${esc(def.nome)}</div>
        <div class="desc">${esc(def.descricao)}</div>
        <div class="controles">
          <button type="button" data-acao="dec-escola" data-id="${def.id}" aria-label="Remover ponto de ${esc(def.nome)}">−</button>
          <span class="valor num">${pontos}</span>
          <button type="button" data-acao="inc-escola" data-id="${def.id}" aria-label="Adicionar ponto em ${esc(def.nome)}">+</button>
        </div>
      </div></div>`;
    })
    .join('');
}

function renderRecursos(): void {
  el('recursos').innerHTML = Object.values(RECURSOS)
    .map((def) => {
      const pontos = estado.personagem.recursos[def.id] ?? 0;
      const escala = pontos > 0
        ? `<div class="efetivo num">custo −${Math.min(30, pontos)}% · impacto +${Math.round(pontos * 0.8)}% · conjuração −${(pontos * 0.01).toFixed(2)}s</div>`
        : `<div class="req">sem proficiência: não pode ser usado como fonte</div>`;
      return `<div class="carta carta-com-sig">
        ${sig(def.id, 'sig-carta')}
        <div class="carta-corpo">
        <div class="nome">${esc(def.nome)}</div>
        <div class="desc">${esc(def.descricao)}</div>
        ${escala}
        <div class="controles">
          <button type="button" data-acao="dec-recurso" data-id="${def.id}" aria-label="Remover proficiência de ${esc(def.nome)}">−</button>
          <span class="valor num">${pontos}</span>
          <button type="button" data-acao="inc-recurso" data-id="${def.id}" aria-label="Adicionar proficiência em ${esc(def.nome)}">+</button>
        </div>
      </div></div>`;
    })
    .join('');
}

// ------------------------------------------------- talentos (árvore/cartas)

const GRUPOS_TALENTOS: { titulo: string; ids: TalentoId[] }[] = [
  { titulo: 'Gerais', ids: ['area_ampliada', 'conjuracao_rapida', 'alcance_estendido', 'canalizacao_profunda', 'economia_de_recurso', 'persistencia'] },
  { titulo: 'Entrega (exclusivos)', ids: ['impacto_imediato', 'dano_ao_longo_do_tempo'] },
  { titulo: 'Conjuração', ids: ['perfuracao', 'estilhaco', 'eco_arcano'] },
  { titulo: 'Evocação', ids: ['enxame', 'colosso', 'vinculo_marcial', 'simbiose', 'autonomia', 'comando'] },
  { titulo: 'Doma', ids: ['instinto_de_caca', 'vinculo_primal', 'matilha_domada', 'fera_alfa', 'evolucao_da_fera'] },
  { titulo: 'Sinergia & Montaria', ids: ['sincronia_de_combate', 'assalto_coordenado', 'guarda_da_fera', 'montaria', 'carga_montada'] },
  { titulo: 'Maldição', ids: ['contagio', 'aflicao_profunda'] },
  { titulo: 'Bênção', ids: ['egide', 'exaltacao', 'vinculo_de_grupo'] },
  { titulo: 'Combate Físico', ids: ['sequencia_marcial', 'golpe_devastador', 'postura_inabalavel'] },
  { titulo: 'Longo Alcance', ids: ['olho_de_aguia', 'rajada'] },
  { titulo: 'Recursos', ids: ['devocao', 'fluxo_constante', 'sede_de_batalha', 'elo_profundo', 'afinacao'] },
  { titulo: 'Inspirações', ids: ['metamagia_gemea', 'auto_feitico', 'cancao_persistente', 'salto', 'endossar_elemento'] },
  { titulo: 'Fusão & Modificadores', ids: ['engenho_de_skill', 'arte_da_fusao', 'catalisador', 'estabilizador', 'prisma_interior'] },
  { titulo: 'Combinação', ids: ['sintonia_de_receita', 'convergencia_elemental', 'leitor_de_constelacao', 'transbordo_ampliado', 'maestria_paradoxal'] },
  { titulo: 'Ofício', ids: ['mao_de_mestre', 'olho_de_materiais', 'assinatura_do_artesao', 'linha_de_producao'] },
  { titulo: 'Híbridos', ids: ['duplo_chaveamento', 'ritmo_de_guerra', 'pacto_de_sangue', 'eco_de_batalha'] },
];

/**
 * Rede de segurança: qualquer talento do registro que não tenha sido
 * agrupado acima cai aqui, em vez de sumir da interface. Era o que acontecia
 * antes — 23 dos 65 talentos existiam no motor e não tinham controle nenhum
 * na tela, entre eles os que destravam a própria Camada 11.
 */
const TALENTOS_AGRUPADOS = new Set(GRUPOS_TALENTOS.flatMap((g) => g.ids));
const TALENTOS_ORFAOS = (Object.keys(TALENTOS) as TalentoId[]).filter(
  (id) => !TALENTOS_AGRUPADOS.has(id),
);
if (TALENTOS_ORFAOS.length) {
  GRUPOS_TALENTOS.push({ titulo: 'Outros', ids: TALENTOS_ORFAOS });
}

function requisitoTexto(def: TalentoDef): string {
  if (!def.requisito) return '';
  const { escola, recurso, nivelMinimo } = def.requisito;
  const alvo = escola ? ESCOLAS[escola].nome : RECURSOS[recurso!].nome;
  return `requer ${esc(alvo)} ${nivelMinimo}`;
}

let talentoSelecionado: TalentoId | null = null;

function estadoDoTalento(def: TalentoDef): { bloqueado: boolean; excluido: boolean; ranks: number } {
  const p = estado.personagem;
  const ranks = p.talentos[def.id] ?? 0;
  let bloqueado = false;
  if (def.requisito) {
    const { escola, recurso, nivelMinimo } = def.requisito;
    if (escola && (p.escolas[escola] ?? 0) < nivelMinimo) bloqueado = true;
    if (recurso && (p.recursos[recurso] ?? 0) < nivelMinimo) bloqueado = true;
  }
  const excluido = (def.exclusivoCom ?? []).some((rival) => (p.talentos[rival] ?? 0) > 0);
  return { bloqueado, excluido, ranks };
}

function renderDetalheTalento(): string {
  if (!talentoSelecionado) {
    return `<div class="talento-detalhe vazio">Clique num talento da árvore para ver detalhes e investir ranks.</div>`;
  }
  const def = TALENTOS[talentoSelecionado];
  const { bloqueado, excluido, ranks } = estadoDoTalento(def);
  const bolinhas = '●'.repeat(ranks) + '○'.repeat(def.ranksMaximos - ranks);
  const req = def.requisito
    ? `<div class="${bloqueado ? 'req-falta' : 'req-ok'}">${requisitoTexto(def)} ${bloqueado ? '(não atendido)' : '✓'}</div>`
    : '';
  const excl = def.exclusivoCom?.length
    ? `<div class="${excluido ? 'req-falta' : 'exclusivo'}">exclusivo com ${def.exclusivoCom.map((r) => esc(TALENTOS[r].nome)).join(', ')}${excluido ? ' — bloqueado pelo rival' : ''}</div>`
    : '';
  return `<div class="talento-detalhe">
    <div class="nome">${esc(def.nome)} <span class="ranks">${bolinhas}</span></div>
    <div class="desc">${esc(def.descricao)}</div>
    ${req}${excl}
    <div class="controles">
      <button type="button" data-acao="dec-talento" data-id="${def.id}" aria-label="Remover rank">−</button>
      <span class="valor num">${ranks}/${def.ranksMaximos}</span>
      <button type="button" data-acao="inc-talento" data-id="${def.id}" aria-label="Adicionar rank">+</button>
    </div>
  </div>`;
}

function renderArvoreTalentos(): void {
  const trilhas = GRUPOS_TALENTOS.map((grupo) => {
    const porNivel = new Map<number, TalentoId[]>();
    for (const id of grupo.ids) {
      const nivel = TALENTOS[id].requisito?.nivelMinimo ?? 0;
      porNivel.set(nivel, [...(porNivel.get(nivel) ?? []), id]);
    }
    const niveis = [...porNivel.keys()].sort((a, b) => a - b);

    const colunas = niveis
      .map((nivel, idx) => {
        const ids = porNivel.get(nivel)!;
        const nos: string[] = [];
        for (let i = 0; i < ids.length; i++) {
          const def = TALENTOS[ids[i]];
          const { bloqueado, excluido, ranks } = estadoDoTalento(def);
          const classes = [
            'no',
            ranks > 0 ? 'investido' : '',
            ranks === def.ranksMaximos ? 'max' : '',
            bloqueado ? 'bloqueado' : '',
            excluido ? 'excluido' : '',
            talentoSelecionado === def.id ? 'selecionado' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const pips = '●'.repeat(ranks) + '○'.repeat(def.ranksMaximos - ranks);
          nos.push(
            `<button type="button" class="${classes}" data-acao="no-talento" data-id="${def.id}" title="${esc(def.descricao)}">${esc(def.nome)}<span class="pips">${pips}</span></button>`,
          );
          const proximo = ids[i + 1];
          if (proximo && (def.exclusivoCom ?? []).includes(proximo)) {
            nos.push(`<div class="ou">— ou —</div>`);
          }
        }
        const conector =
          idx > 0 || nivel > 0
            ? `<div class="conector">${nivel > 0 ? `<span class="tier-req num">nv ${nivel}</span>` : ''}</div>`
            : '';
        return `${conector}<div class="tier">${nos.join('')}</div>`;
      })
      .join('');
    return `<div class="trilha"><div class="trilha-titulo">${esc(grupo.titulo)}</div>${colunas}</div>`;
  }).join('');

  el('talentos').innerHTML = `<div class="arvore">${trilhas}</div>${renderDetalheTalento()}`;
}

function renderTalentos(): void {
  el('conta-talentos').textContent = `${pontosTalentosGastos()} ranks distribuídos`;
  document.querySelectorAll<HTMLButtonElement>('[data-acao="vista-talentos"]').forEach((b) => {
    b.classList.toggle('ativo', b.dataset.id === estado.vistaTalentos);
  });
  if (estado.vistaTalentos === 'arvore') {
    renderArvoreTalentos();
    return;
  }
  el('talentos').innerHTML = GRUPOS_TALENTOS.map((grupo) => {
    const cartas = grupo.ids
      .map((id) => {
        const def = TALENTOS[id];
        const ranks = estado.personagem.talentos[id] ?? 0;
        const bolinhas = '●'.repeat(ranks) + '○'.repeat(def.ranksMaximos - ranks);
        const req = requisitoTexto(def);
        const excl = def.exclusivoCom?.length
          ? `exclusivo com ${def.exclusivoCom.map((r) => esc(TALENTOS[r].nome)).join(', ')}`
          : '';
        return `<div class="carta">
          <div class="nome">${esc(def.nome)} <span class="ranks" aria-label="${ranks} de ${def.ranksMaximos} ranks">${bolinhas}</span></div>
          <div class="desc">${esc(def.descricao)}</div>
          ${req ? `<div class="req">${req}</div>` : ''}
          ${excl ? `<div class="exclusivo">${excl}</div>` : ''}
          <div class="controles">
            <button type="button" data-acao="dec-talento" data-id="${id}" aria-label="Remover rank de ${esc(def.nome)}">−</button>
            <span class="valor num">${ranks}</span>
            <button type="button" data-acao="inc-talento" data-id="${id}" aria-label="Adicionar rank em ${esc(def.nome)}">+</button>
          </div>
        </div>`;
      })
      .join('');
    return `<div class="talento-grupo"><h3>${esc(grupo.titulo)}</h3><div class="lista-cartas">${cartas}</div></div>`;
  }).join('');
}

// ------------------------------------------------- derivados / arquétipos

function progressoReceita(def: ElementoDef, prog: Progressao): number {
  return Math.min(
    ...def.receita!.map((c) => Math.min(1, (prog.niveisEfetivos[c.elemento] ?? 0) / c.nivelMinimo)),
  );
}

function renderDerivados(prog: Progressao): void {
  const filtro = estado.filtroDerivados.trim().toLowerCase();
  const todos = elementosDerivados()
    .map((def) => ({ def, nivel: prog.niveisEfetivos[def.id] ?? 0, progresso: progressoReceita(def, prog) }))
    .filter(({ def }) => {
      if (!filtro) return true;
      const nomes = [def.nome, ...def.receita!.map((c) => ELEMENTOS[c.elemento].nome)].join(' ').toLowerCase();
      return nomes.includes(filtro);
    })
    .sort((a, b) => b.progresso - a.progresso || a.def.nome.localeCompare(b.def.nome));

  const liberados = todos.filter((x) => x.nivel > 0).length;
  el('conta-derivados').textContent = `${liberados}/${elementosDerivados().length} liberados`;

  el('derivados').innerHTML =
    todos
      .map(({ def, nivel, progresso }) => {
        const receita = def
          .receita!.map((c) => {
            const atual = prog.niveisEfetivos[c.elemento] ?? 0;
            const ok = atual >= c.nivelMinimo;
            return `<span style="${ok ? '' : 'opacity:.65'}">${esc(ELEMENTOS[c.elemento].nome)} <span class="num">${atual}/${c.nivelMinimo}</span></span>`;
          })
          .join(' + ');
        const rotulo = nivel > 0
          ? `<span class="rotulo-nivel liberado num">nv ${nivel}</span>`
          : `<span class="rotulo-nivel num">${pct(progresso)}</span>`;
        return `<div class="linha-derivado" title="${esc(def.descricao)}">
          <div class="info">
            <div><strong>${esc(def.nome)}</strong> <span class="receita">· ${receita}</span></div>
            <div class="barra ${nivel > 0 ? 'cheia' : ''}"><i style="width:${pct(Math.max(progresso, nivel > 0 ? 1 : 0))}"></i></div>
          </div>
          ${rotulo}
        </div>`;
      })
      .join('') || '<div class="vazio">Nenhum derivado corresponde ao filtro.</div>';
}

function renderArquetipos(prog: Progressao): void {
  const ids = new Set(prog.arquetipos.map((a) => a.id));
  const linhas = Object.values(ARQUETIPOS)
    .map((arq) => {
      const aberto = ids.has(arq.id);
      const partes: string[] = [];
      for (const [id, min] of Object.entries(arq.condicao.elementos ?? {})) {
        const atual = prog.niveisEfetivos[id] ?? 0;
        partes.push(`<span class="${atual >= min! ? '' : 'falta'}">${esc(ELEMENTOS[id]?.nome ?? id)} <span class="num">${atual}/${min}</span></span>`);
      }
      for (const [id, min] of Object.entries(arq.condicao.escolas ?? {})) {
        const atual = estado.personagem.escolas[id as EscolaId] ?? 0;
        partes.push(`<span class="${atual >= min! ? '' : 'falta'}">${esc(ESCOLAS[id as EscolaId].nome)} <span class="num">${atual}/${min}</span></span>`);
      }
      for (const [id, min] of Object.entries(arq.condicao.recursos ?? {})) {
        const atual = estado.personagem.recursos[id as RecursoId] ?? 0;
        partes.push(`<span class="${atual >= min! ? '' : 'falta'}">${esc(RECURSOS[id as RecursoId].nome)} <span class="num">${atual}/${min}</span></span>`);
      }
      return { arq, aberto, html: partes.join(' · ') };
    })
    .sort((a, b) => Number(b.aberto) - Number(a.aberto) || a.arq.nome.localeCompare(b.arq.nome));

  el('conta-arquetipos').textContent = `${prog.arquetipos.length}/${Object.keys(ARQUETIPOS).length} desbloqueados`;
  el('arquetipos').innerHTML = linhas
    .map(
      ({ arq, aberto, html }) => `<div class="arquetipo">
        <div class="titulo">${esc(arq.nome)} <span class="selo ${aberto ? '' : 'bloqueado'}">${aberto ? 'desbloqueado' : 'bloqueado'}</span></div>
        <div class="condicoes">${html}</div>
        ${aberto ? `<div class="capacidades-lista">libera: ${arq.capacidades.map(esc).join(', ')}</div>` : `<div class="condicoes">${esc(arq.descricao)}</div>`}
      </div>`,
    )
    .join('');
}

// ------------------------------------------------- construtor de skill



// ------------------------------------------------- aba fusão

/** O veredito de eficiência em duas palavras, não num parágrafo. */
function vereditoEficiencia(rel: number): string {
  if (rel < 0.97) return 'fundir custa mais por ponto de impacto';
  if (rel <= 1.04) return '≈ empate';
  return 'fundir rende mais por ponto de impacto';
}

function renderFusao(prog: Progressao): void {
  const salvas = estado.skillsSalvas;
  const marcados = estado.fusao.filter((i) => i >= 0 && i < salvas.length);

  const dica = `<p class="dica">Fundir skills funde os elementos delas. Uma skill de Fogo e uma de
    Terra viram uma skill de <strong>Lava</strong>. Duas viram 2ª geração; três ou quatro, 3ª.</p>`;

  if (salvas.length === 0) {
    el('fusao-componentes').innerHTML = `${dica}
      <div class="vazio"><strong>Nenhuma skill para fundir ainda.</strong><br>
      A fusão trabalha em cima de skills que você já salvou. Vá em <strong>⚔ Criar Skill</strong>,
      monte uma e clique em “Salvar skill na build”. Repita com um elemento diferente — Fogo e
      Terra, por exemplo — e volte aqui.</div>`;
    el('fusao-resultado').innerHTML = '';
    return;
  }

  const cartoes = salvas
    .map((sk, i) => {
      const def = elementoDef(sk.elemento);
      const marcado = marcados.includes(i);
      const cheio = !marcado && marcados.length >= 4;
      return `<label class="cartao-fusao${marcado ? ' marcado' : ''}${cheio ? ' bloqueado' : ''}">
        <input type="checkbox" data-acao="fusao-toggle" data-id="${i}" ${marcado ? 'checked' : ''}${cheio ? ' disabled' : ''}>
        ${sig(sk.elemento)}
        <span class="cf-nome">${esc(sk.nome)}</span>
        <span class="cf-meta">${esc(def?.nome ?? sk.elemento)} · ${esc(ESCOLAS[sk.escola].nome)} · ${sk.energia} en</span>
      </label>`;
    })
    .join('');

  el('fusao-componentes').innerHTML = `${dica}
    <div class="fusao-cabecalho"><h4>Componentes</h4><span class="num">${marcados.length} de 4</span></div>
    <div class="fusao-cartoes">${cartoes}</div>`;

  if (marcados.length === 0) {
    el('fusao-resultado').innerHTML = salvas.length === 1
      ? `<div class="vazio"><strong>Falta uma segunda skill.</strong><br>
         Você salvou <strong>${esc(salvas[0].nome)}</strong>. Toda fusão precisa de pelo menos duas.
         Salve outra com um elemento diferente e a prévia da combinação aparece aqui na hora.</div>`
      : `<div class="vazio">Marque de 2 a 4 skills acima. A combinação dos elementos aparece aqui
         antes de você confirmar.</div>`;
    return;
  }
  if (marcados.length === 1) {
    el('fusao-resultado').innerHTML =
      `<div class="vazio">Marque mais uma. Com dois elementos diferentes, esta linha mostra qual
       combinação nasce.</div>`;
    return;
  }

  const componentes = marcados.map((i) => salvas[i]);
  const pv = previewFusao(prog, componentes);

  // a linha de convergência: sigilos, seta, o elemento que nasce
  const bases = pv.bases
    .map((b) => `<span class="conv-item">${sig(b)}<span>${esc(ELEMENTOS[b].nome)}</span></span>`)
    .join('<span class="conv-mais">+</span>');
  const resultadoNome = pv.nome ?? '—';
  const convergencia = `<div class="convergencia${pv.liberado ? '' : ' travada'}">
    ${bases}
    <span class="conv-seta">→</span>
    <span class="conv-alvo">${pv.elemento ? sig(String(pv.elemento)) : ''}
      <strong${pv.liberado ? '' : ' class="riscado"'}>${esc(resultadoNome)}</strong>
      <em>${pv.geracao}ª geração · modo ${esc(pv.modo.nome)}</em></span>
  </div>`;

  const r = calcularFusao(estado.personagem, prog, { nome: 'Fusão', componentes });

  const avisos = r.avisos.length
    ? `<div class="req">${r.avisos.map((a) => esc(a)).join('<br>')}</div>`
    : '';
  const erros = r.erros.length
    ? `<ul class="erros">${r.erros.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`
    : '';

  const maxImp = Math.max(r.impactoSeparado, r.resultado.impactoTotal) || 1;
  const maxCus = Math.max(r.custoSeparado, r.resultado.custoTotal) || 1;
  const barra = (v: number, max: number, classe: string) =>
    `<span class="barra-comp ${classe}"><i style="width:${((v / max) * 100).toFixed(1)}%"></i></span>`;
  const rel = r.taxaDeCusto > 0 ? r.ganhoDeFusao / r.taxaDeCusto : 1;

  const comparacao = `<table class="comparacao-fusao">
    <tr><th></th><th>impacto</th><th>custo</th></tr>
    <tr><td>Separadas</td>
      <td>${barra(r.impactoSeparado, maxImp, 'imp')}<span class="num">${r.impactoSeparado.toFixed(0)}</span></td>
      <td>${barra(r.custoSeparado, maxCus, 'cus')}<span class="num">${r.custoSeparado.toFixed(0)}</span></td></tr>
    <tr><td>Fundida</td>
      <td>${barra(r.resultado.impactoTotal, maxImp, 'imp')}<span class="num">${r.resultado.impactoTotal.toFixed(0)}</span>${r.tetoGanhoAtingido ? '<i class="corte-teto" title="Teto de fusão: a eficiência foi limitada a 1,10× a de lançar as skills separadamente."></i>' : ''}</td>
      <td>${barra(r.resultado.custoTotal, maxCus, 'cus')}<span class="num">${r.resultado.custoTotal.toFixed(0)}</span></td></tr>
    <tr class="veredito"><td>eficiência da fusão</td>
      <td class="num">${rel.toFixed(2)}×</td><td>${esc(vereditoEficiencia(rel))}</td></tr>
  </table>`;

  const selos = [
    `1 ação em vez de ${componentes.length}`,
    `Elemento ${r.nomeElementoResultante} — perfil e estados próprios`,
    r.resultado.estados
      .slice(0, 4)
      .map((e) => e.nome)
      .join(' · '),
    ...r.propriedadesEmergentes.filter((x) => x.chave !== 'geracao').map((x) => x.rotulo),
  ]
    .filter(Boolean)
    .map((t) => `<li>${esc(t)}</li>`)
    .join('');

  el('fusao-resultado').innerHTML = `${convergencia}${avisos}${erros}
    ${r.valida ? comparacao : ''}
    <div class="so-fundindo"><h4>Só fundindo</h4><ul>${selos}</ul></div>`;
}

// ------------------------------------------------- modificadores de skill

/**
 * Famílias dos modificadores. 23 numa lista chapada é ruído; em 6 grupos de
 * 3–4 é um cardápio. Os grupos são os mesmos comentados em
 * `registry/modificadores.ts`.
 */
const FAMILIAS_MODIFICADOR: { titulo: string; ids: ModificadorId[] }[] = [
  { titulo: 'Amplificação', ids: ['sobrecarga_bruta', 'concentracao', 'ressonancia_ampliada'] },
  { titulo: 'Forma', ids: ['projeteis_multiplos', 'penetracao_encadeada', 'expansao_concentrica', 'implosao_dirigida'] },
  { titulo: 'Tempo', ids: ['gatilho_atrasado', 'repeticao_ecoada', 'aceleracao_forcada', 'prolongamento'] },
  { titulo: 'Risco e economia', ids: ['canalizacao_arriscada', 'sangria_arcana', 'contencao_disciplinada'] },
  { titulo: 'Escola', ids: ['legiao_menor', 'nucleo_reforcado', 'contagio_ampliado', 'graca_estendida', 'mira_absoluta', 'investida_encadeada'] },
  { titulo: 'Elemental', ids: ['imbuicao_dupla', 'fratura_elemental', 'convergencia_de_receita'] },
];

/** Resumo de uma linha: o que o modificador faz, em números, sem prosa. */
function efeitoResumido(id: ModificadorId): string {
  const partes: string[] = [];
  for (const ef of MODIFICADORES[id].efeitos) {
    switch (ef.tipo) {
      case 'poder_mais':
      case 'poder_aumentado':
        partes.push(`${ef.valor >= 0 ? '+' : ''}${Math.round(ef.valor * 100)}% poder`);
        break;
      case 'raio_bonus':
        partes.push(`raio ${ef.valor >= 0 ? '+' : ''}${ef.valor}m`);
        break;
      case 'alvos_mult':
        partes.push(`alvos ×${ef.valor}`);
        break;
      case 'tempo_fracao':
        partes.push(`conjuração ${ef.valor >= 0 ? '+' : ''}${Math.round(ef.valor * 100)}%`);
        break;
      case 'duracao_mult':
        partes.push(`duração ×${ef.valor}`);
        break;
      case 'invocacoes_mult':
        partes.push(`criaturas ×${ef.valor}`);
        break;
      case 'propriedade':
        partes.push(ef.rotulo.toLowerCase());
        break;
    }
  }
  return partes.join(' · ');
}

/** O produto de amplificação que um conjunto de modificadores produziria. */
function produtoAmplificacao(ids: ModificadorId[]): number {
  let mais = 1;
  let aumentado = 0;
  for (const id of ids) {
    for (const ef of MODIFICADORES[id]?.efeitos ?? []) {
      if (ef.tipo === 'poder_mais') mais *= 1 + ef.valor;
      else if (ef.tipo === 'poder_aumentado') aumentado += ef.valor;
    }
  }
  return mais * (1 + aumentado);
}

function renderModificadores(prog: Progressao): string {
  const p = estado.personagem;
  const cfg = estado.skill;
  const ativos = (cfg.modificadores ?? []) as ModificadorId[];
  const slots = slotsModificador(p);
  const tags = tagsDaSkill(cfg);
  const produtoAtual = produtoAmplificacao(ativos);

  const chips = tags
    .map((t) => `<span class="tag-skill">${esc(ROTULO_TAG[t])}</span>`)
    .join('');

  const cabem: string[] = [];
  const naoCabem: string[] = [];
  for (const familia of FAMILIAS_MODIFICADOR) {
    const linhas: string[] = [];
    for (const id of familia.ids) {
      const def = MODIFICADORES[id];
      const av = avaliarModificador(p, cfg, id, tags);
      const marcado = ativos.includes(id);
      if (!av.compativel) {
        naoCabem.push(
          `<li><span class="mod-nome">${esc(def.nome)}</span><span class="mod-motivo">${esc(av.motivo ?? '')}</span></li>`,
        );
        continue;
      }
      const semSlot = !marcado && ativos.length >= slots;
      const estouraria = !marcado && produtoAmplificacao([...ativos, id]) > 2.2;
      const selos = [
        estouraria ? '<span class="mod-selo alerta">passa do teto</span>' : '',
        semSlot ? '<span class="mod-selo">sem slot</span>' : '',
      ].join('');
      linhas.push(
        `<li class="${marcado ? 'marcado' : ''}${semSlot ? ' bloqueado' : ''}">
          <label><input type="checkbox" data-acao="mod-toggle" data-id="${id}"
            ${marcado ? 'checked' : ''}${semSlot ? ' disabled' : ''}>
            <span class="mod-nome">${esc(def.nome)}</span></label>
          <span class="mod-custo num">×${def.multiplicadorCusto.toFixed(2)} custo</span>
          <span class="mod-efeito">${esc(efeitoResumido(id))}</span>${selos}
        </li>`,
      );
    }
    if (linhas.length) {
      cabem.push(`<div class="mod-familia"><h5>${esc(familia.titulo)}</h5><ul>${linhas.join('')}</ul></div>`);
    }
  }

  const vazio = cabem.length
    ? ''
    : `<div class="req">Nenhum modificador cabe nesta configuração. Modificadores entram pela
       forma da skill: mude a <strong>área</strong>, a <strong>entrega</strong> ou a
       <strong>escola</strong> e a lista muda. Os ${naoCabem.length} incompatíveis estão
       listados abaixo, com o motivo de cada um.</div>`;

  const pct = Math.min(100, (produtoAtual / TETO_MULT_MODIFICADORES) * 100);
  const barra = ativos.length
    ? `<div class="mod-teto">
        <div class="barra-teto"><span style="width:${pct.toFixed(1)}%"></span><i class="marca-teto"></i></div>
        <span class="num">Amplificação ×${produtoAtual.toFixed(2)} de ×${TETO_MULT_MODIFICADORES}</span>
      </div>`
    : '';

  return `<div class="bloco-modificadores">
    <div class="mod-cabecalho">
      <h4>Modificadores</h4>
      <span class="num">${ativos.length} de ${slots} slots</span>
      ${slots === SLOTS_MODIFICADOR_BASE ? '<span class="mod-dica">cada rank de Engenho de Skill abre mais um slot</span>' : ''}
    </div>
    <div class="mod-tags" title="Os modificadores entram pela forma da skill, não pela sua vontade. Mude escola, área ou entrega e a lista muda junto.">
      Esta skill é: ${chips}
    </div>
    ${barra}
    ${vazio}
    <div class="mod-cabem">${cabem.join('')}</div>
    ${naoCabem.length
      ? `<details class="mod-nao-cabem"><summary>Não cabem nesta skill (${naoCabem.length})</summary><ul>${naoCabem.join('')}</ul></details>`
      : ''}
  </div>`;
}

/** A cascata de custo: mostra que 1.45 e 1.28 compõem para 1.86, não 1.73. */
function renderCascataCusto(r: ResultadoSkill): string {
  if (!r.modificadoresAplicados.length) return '';
  let corrente = r.custoTotal;
  for (const m of r.modificadoresAplicados) corrente /= m.multiplicadorCusto;
  const linhas: string[] = [
    `<tr><td>Custo base</td><td></td><td class="num">${corrente.toFixed(1)}</td></tr>`,
  ];
  for (const m of r.modificadoresAplicados) {
    corrente *= m.multiplicadorCusto;
    linhas.push(
      `<tr><td>× ${esc(m.nome)}</td><td class="num">${m.multiplicadorCusto.toFixed(2)}</td><td class="num">→ ${corrente.toFixed(1)}</td></tr>`,
    );
  }
  const produtoCusto = r.modificadoresAplicados.reduce((a, m) => a * m.multiplicadorCusto, 1);
  return `<div class="cascata">
    <table>${linhas.join('')}
      <tr class="total"><td>Custo com modificadores</td><td class="num">×${produtoCusto.toFixed(2)}</td><td class="num">${r.custoTotal.toFixed(1)}</td></tr>
    </table>
    ${r.tetoModificadoresAtingido
      ? `<p class="aviso-teto"><strong>Teto de amplificação atingido.</strong> O produto foi
         grampeado em ×${TETO_MULT_MODIFICADORES} — os bônus acima disso não contam. Troque um
         modificador caro por um mais barato, ou aceite o excedente perdido.</p>`
      : ''}
  </div>`;
}

function renderFormSkill(prog: Progressao): void {
  const s = estado.skill;
  const limites = calcularLimites(estado.personagem, s.escola, s.fontes);
  const disponiveis = prog.elementosDisponiveis;
  const opcoesElemento = (disponiveis.length ? disponiveis : ['fogo'])
    .map((id) => `<option value="${id}" ${id === s.elemento ? 'selected' : ''}>${esc(nomeElemento(id))} (nv ${prog.niveisEfetivos[id] ?? 0})</option>`)
    .join('');
  const opcoesEscola = Object.values(ESCOLAS)
    .map((d) => `<option value="${d.id}" ${d.id === s.escola ? 'selected' : ''}>${esc(d.nome)} (${estado.personagem.escolas[d.id] ?? 0} pts)</option>`)
    .join('');
  const capacidades = [...prog.capacidades].sort();
  const opcoesCapacidade =
    `<option value="">— nenhuma —</option>` +
    capacidades
      .map((c) => `<option value="${esc(c)}" ${c === s.capacidadeExigida ? 'selected' : ''}>${esc(c)}</option>`)
      .join('');

  // fontes: recursos com proficiência + qualquer um já usado na skill (para
  // poder zerá-lo mesmo sem proficiência)
  const recursosVisiveis = Object.values(RECURSOS).filter(
    (d) =>
      (estado.personagem.recursos[d.id] ?? 0) > 0 ||
      (s.fontes.find((f) => f.recurso === d.id)?.proporcao ?? 0) > 0,
  );
  const fontesHtml = recursosVisiveis.length
    ? recursosVisiveis
        .map((d) => {
          const atual = s.fontes.find((f) => f.recurso === d.id)?.proporcao ?? 0;
          const prof = estado.personagem.recursos[d.id] ?? 0;
          const semProf = prof <= 0;
          return `<div class="fonte-linha">
            <span>${esc(d.nome)} <span class="limite-hint num ${semProf ? 'req' : ''}">${semProf ? 'sem prof' : `prof ${prof}`}</span></span>
            <input id="sk-fonte-${d.id}" type="range" min="0" max="100" step="5" value="${atual}">
            <span class="num">${atual}</span>
          </div>`;
        })
        .join('')
    : `<div class="req">Nenhum recurso com proficiência — invista pontos na aba Recursos.</div>`;

  const energiaMax = Math.max(1, Math.floor(limites.energiaMaxima));
  const energia = Math.min(s.energia, energiaMax);
  const tempoMin = Math.round(limites.tempoConjuracaoMinimo * 10) / 10;
  const tempo = Math.max(s.tempoConjuracaoSegundos, tempoMin);
  const alcance = Math.min(s.alcanceMetros, limites.alcanceMaximo);

  // fonte da evocação (só quando a escola invoca criaturas)
  let evocacaoHtml = '';
  if (ESCOLAS[s.escola].entregaPadrao === 'invocacao') {
    const modo = s.evocacao?.modo ?? 'elemental';
    const botoes = ([
      ['elemental', 'Elemental'],
      ['aleatoria', 'Aleatória'],
      ['capturada', 'Capturada'],
    ] as const)
      .map(
        ([id, rot]) =>
          `<button type="button" class="btn-mini ${modo === id ? 'on' : ''}" data-acao="sk-evo-modo" data-id="${id}">${rot}</button>`,
      )
      .join(' ');
    let extra = '';
    if (modo === 'capturada') {
      const cap = estado.personagem.bestiario;
      if (!cap.length) {
        extra = `<div class="req">Nenhuma criatura capturada — vá à aba Bestiário.</div>`;
      } else {
        const opc = cap
          .map((b) => `<option value="${b.criaturaId}" ${b.criaturaId === s.evocacao?.criaturaId ? 'selected' : ''}>${esc(CRIATURAS[b.criaturaId].nome)}${b.nivelVinculo > 0 ? ` ♥${b.nivelVinculo}` : ''}</option>`)
          .join('');
        const imbui = (prog.niveisEfetivos[s.elemento] ?? 0) >= MAESTRIA_LIMIAR;
        extra = `<select id="sk-evo-criatura" style="margin-top:6px">${opc}</select>
          <div class="limite-hint">${imbui ? `imbuída de ${esc(nomeElemento(s.elemento))} (maestria ✓)` : `sem maestria em ${esc(nomeElemento(s.elemento))} — não imbui (suba para nível ${MAESTRIA_LIMIAR})`}</div>`;
      }
    } else if (modo === 'aleatoria') {
      extra = `<div class="limite-hint">criatura qualquer; mais forte quanto mais Evocação.</div>`;
    } else {
      extra = `<div class="limite-hint">um elemental de ${esc(nomeElemento(s.elemento))}.</div>`;
    }
    evocacaoHtml = `<div class="linha-campo"><label>Fonte da evocação</label><div><div class="radios">${botoes}</div>${extra}</div><span></span></div>`;
  }

  // montaria: só aparece quando há fera montável vinculada
  let montariaHtml = '';
  const montaveis = estado.personagem.bestiario.filter(
    (b) => avaliarMontaria(estado.personagem, b.criaturaId).montavel,
  );
  if (montaveis.length) {
    const opc =
      `<option value="">— a pé —</option>` +
      montaveis
        .map((b) => `<option value="${b.criaturaId}" ${b.criaturaId === s.montariaId ? 'selected' : ''}>${esc(CRIATURAS[b.criaturaId].nome)}</option>`)
        .join('');
    montariaHtml = `<div class="linha-campo"><label for="sk-montaria">Montaria</label><div><select id="sk-montaria">${opc}</select><div class="limite-hint">lançar cavalgando amplifica a skill (Carga Montada + porte da fera).</div></div><span></span></div>`;
  }

  el('form-skill').innerHTML = `
    <div class="linha-campo"><label for="sk-nome">Nome</label><input id="sk-nome" type="text" value="${esc(s.nome)}"><span></span></div>
    <div class="linha-campo"><label for="sk-elemento">Elemento</label><select id="sk-elemento">${opcoesElemento}</select><span></span></div>
    <div class="linha-campo"><label for="sk-escola">Escola</label><select id="sk-escola">${opcoesEscola}</select><span></span></div>
    ${evocacaoHtml}
    ${montariaHtml}
    <div class="linha-campo"><label for="sk-capacidade">Capacidade</label><select id="sk-capacidade">${opcoesCapacidade}</select><span></span></div>
    <div class="linha-campo"><label>Fontes de energia</label><div class="fontes-lista">${fontesHtml}</div><span></span></div>
    <div class="linha-campo"><label for="sk-energia">Energia</label>
      <input id="sk-energia" type="range" min="1" max="${energiaMax}" step="1" value="${energia}">
      <span><span class="num">${energia}</span><br><span class="limite-hint num">máx ${energiaMax}</span></span></div>
    <div class="linha-campo"><label for="sk-tempo">Conjuração (s)</label>
      <input id="sk-tempo" type="range" min="${tempoMin}" max="10" step="0.1" value="${tempo}">
      <span><span class="num">${f1(tempo)}s</span><br><span class="limite-hint num">mín ${f1(tempoMin)}s</span></span></div>
    <div class="linha-campo"><label for="sk-alcance">Alcance (m)</label>
      <input id="sk-alcance" type="range" min="0" max="${limites.alcanceMaximo}" step="1" value="${alcance}">
      <span><span class="num">${alcance}m</span><br><span class="limite-hint num">máx ${limites.alcanceMaximo}m</span></span></div>
    <div class="linha-campo"><label>Área</label>
      <div class="radios">
        <label><input type="radio" name="sk-area" value="unico" ${s.area.tipo === 'unico' ? 'checked' : ''}>Alvo único</label>
        <label><input type="radio" name="sk-area" value="circulo" ${s.area.tipo === 'circulo' ? 'checked' : ''}>Círculo</label>
      </div><span></span></div>
    ${s.area.tipo === 'circulo' ? `
    <div class="linha-campo"><label for="sk-raio">Raio (m)</label>
      <input id="sk-raio" type="range" min="1" max="${limites.raioMaximo}" step="1" value="${Math.min(s.area.raioMetros, limites.raioMaximo)}">
      <span><span class="num">${Math.min(s.area.raioMetros, limites.raioMaximo)}m</span><br><span class="limite-hint num">máx ${limites.raioMaximo}m</span></span></div>` : ''}
    <div class="linha-campo"><label>Entrega</label>
      <div class="radios">
        <label><input type="radio" name="sk-entrega" value="instantaneo" ${s.entrega.tipo === 'instantaneo' ? 'checked' : ''}>Instantânea</label>
        <label><input type="radio" name="sk-entrega" value="continuo" ${s.entrega.tipo === 'continuo' ? 'checked' : ''}>Contínua</label>
      </div><span></span></div>
    ${s.entrega.tipo === 'continuo' ? `
    <div class="linha-campo"><label for="sk-duracao">Duração (s)</label>
      <input id="sk-duracao" type="range" min="1" max="20" step="1" value="${s.entrega.duracaoSegundos}">
      <span class="num">${s.entrega.duracaoSegundos}s</span></div>` : ''}
    ${renderModificadores(prog)}
    <div class="linha-campo"><label for="sk-alvo">Alvo (afinidade)</label>
      <select id="sk-alvo">
        <option value="">— sem alvo —</option>
        ${elementosBase()
          .map((d) => `<option value="${d.id}" ${d.id === s.alvoElemento ? 'selected' : ''}>${esc(d.nome)}</option>`)
          .join('')}
      </select><span></span></div>
    <div><button type="button" class="botao-primario" id="btn-salvar-skill">Salvar skill na build</button></div>
  `;
}

const CHAVES_PERFIL = ['dano', 'controle', 'cura', 'defesa', 'suporte'] as const;

function radarSVG(r: ResultadoSkill): string {
  const fracoes = CHAVES_PERFIL.map((k) => (r.impactoTotal > 0 ? r.perfil[k] / r.impactoTotal : 0));
  const maxF = Math.max(...fracoes, 0.001);
  const cx = 105;
  const cy = 94;
  const R = 58;
  const ponto = (i: number, escala: number): string => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return `${(cx + Math.cos(ang) * R * escala).toFixed(1)},${(cy + Math.sin(ang) * R * escala).toFixed(1)}`;
  };
  const aneis = [0.33, 0.66, 1]
    .map((s) => `<polygon class="anel" points="${CHAVES_PERFIL.map((_, i) => ponto(i, s)).join(' ')}"/>`)
    .join('');
  const eixos = CHAVES_PERFIL.map((_, i) => {
    const [x, y] = ponto(i, 1).split(',');
    return `<line class="eixo" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
  }).join('');
  const forma = `<polygon class="forma" points="${CHAVES_PERFIL.map((_, i) => ponto(i, fracoes[i] / maxF)).join(' ')}"/>`;
  const rotulos = CHAVES_PERFIL.map((k, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const x = cx + Math.cos(ang) * (R + 12);
    const y = cy + Math.sin(ang) * (R + 12);
    const anchor = Math.abs(Math.cos(ang)) < 0.3 ? 'middle' : Math.cos(ang) > 0 ? 'start' : 'end';
    return `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="${anchor}">${k}</text>`;
  }).join('');
  return `<svg class="radar" width="220" height="186" viewBox="0 0 210 188" role="img" aria-label="Radar do perfil da skill">${aneis}${eixos}${forma}${rotulos}</svg>`;
}

function renderResultadoSkill(prog: Progressao): void {
  const r = calcularSkill(estado.personagem, prog, estado.skill);
  const alvo = el('resultado-skill');
  if (!r.valida) {
    alvo.innerHTML = `<div class="resultado-skill">
      <h3>${sig(estado.skill.elemento, 'sig-titulo')}${esc(estado.skill.nome)}</h3>
      <ul class="erros">${r.erros.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
    </div>`;
    return;
  }
  const perfilLinhas = CHAVES_PERFIL
    .filter((k) => r.perfil[k] > 0.01)
    .map((k) => {
      const fracao = r.impactoTotal > 0 ? r.perfil[k] / r.impactoTotal : 0;
      return `<div class="perfil-linha"><span>${k}</span>
        <div class="barra"><i style="width:${pct(fracao)}"></i></div>
        <span class="num">${f1(r.perfil[k])}</span></div>`;
    })
    .join('');
  const propriedades = r.propriedades.length
    ? `<ul class="propriedades">${r.propriedades
        .map((p) => `<li>${esc(p.rotulo)}: <strong class="num">${p.valor < 1 ? pct(p.valor) : f1(p.valor)}</strong></li>`)
        .join('')}</ul>`
    : '';
  const custoFontes = r.custoPorFonte
    .map((c) => `${esc(RECURSOS[c.recurso].nome)} ${f1(c.custo)}`)
    .join(' · ');
  const efetHtml = r.efetividade
    ? `<div class="metrica efet-${r.efetividade.rotulo}"><div class="rotulo">vs ${esc(ELEMENTOS[r.efetividade.alvo].nome)} (${r.efetividade.rotulo} ×${f1(r.efetividade.multiplicador)})</div><div class="valor num">${f1(r.efetividade.impacto)}</div></div>`
    : '';
  const estadosHtml = r.estados.length
    ? `<div class="estados-lista">pode causar: ${r.estados
        .map((e) => `<span class="estado-tag estado-${e.tipo}">${esc(e.nome)}</span>`)
        .join('')}</div>`
    : '';
  alvo.innerHTML = `<div class="resultado-skill">
    <h3>${sig(estado.skill.elemento, 'sig-titulo')}${esc(estado.skill.nome)}</h3>
    <div class="resultado-corpo">
      <div class="coluna-metricas">
        <div class="metricas">
          <div class="metrica"><div class="rotulo">Custo total</div><div class="valor num">${f1(r.custoTotal)}</div></div>
          <div class="metrica"><div class="rotulo">Impacto total</div><div class="valor num">${f1(r.impactoTotal)}</div></div>
          <div class="metrica"><div class="rotulo">Por alvo (${f1(r.alvosEsperados)} alvos)</div><div class="valor num">${f1(r.impactoPorAlvo)}</div></div>
          ${r.impactoPorSegundo ? `<div class="metrica"><div class="rotulo">Por segundo</div><div class="valor num">${f1(r.impactoPorSegundo)}</div></div>` : ''}
          ${r.invocacoes ? `<div class="metrica"><div class="rotulo">${esc(r.invocacoes.nome)}${r.invocacoes.imbuida ? ' ✦' : ''}</div><div class="valor num">${r.invocacoes.quantidade} × ${f1(r.invocacoes.poderPorCriatura)}</div></div>` : ''}
          ${r.montaria ? `<div class="metrica"><div class="rotulo">🐎 Montado em ${esc(r.montaria.nome)}</div><div class="valor num">+${pct(r.montaria.bonus)}</div></div>` : ''}
          ${efetHtml}
          <div class="metrica"><div class="rotulo">Eficiência</div><div class="valor num">${f1(r.eficiencia)}</div></div>
        </div>
        <div class="dica num">fontes: ${custoFontes}</div>
        ${estadosHtml}
        ${perfilLinhas}
        ${propriedades}
      </div>
      ${radarSVG(r)}
    </div>
  </div>`;
}

function renderSkillsSalvas(): void {
  el('conta-skills').textContent = String(estado.skillsSalvas.length);
  el('skills-salvas').innerHTML =
    estado.skillsSalvas
      .map((s, i) => {
        const fontesTxt = normalizarFontes(s.fontes)
          .map((f) => `${Math.round(f.proporcao * 100)}% ${RECURSOS[f.recurso].nome}`)
          .join(' + ');
        return `<div class="item-skill">
          <span><strong>${esc(s.nome)}</strong> · ${esc(nomeElemento(s.elemento))} + ${esc(ESCOLAS[s.escola].nome)} @ ${esc(fontesTxt)}</span>
          <span><button type="button" data-acao="carregar-skill" data-idx="${i}">editar</button>
          <button type="button" data-acao="remover-skill" data-idx="${i}">remover</button></span>
        </div>`;
      })
      .join('') || '<div class="vazio">Nenhuma skill salva ainda.</div>';
}

// ------------------------------------------------- bancada de recursos

let bancada: { chave: string; estados: Map<RecursoId, EstadoRecurso>; tempo: number } | null = null;

function fontesAtivasDaSkill(): FonteEnergia[] {
  return normalizarFontes(estado.skill.fontes);
}

function garantirBancada(): NonNullable<typeof bancada> {
  const fontes = fontesAtivasDaSkill();
  const chave = fontes
    .map((f) => `${f.recurso}:${estado.personagem.recursos[f.recurso] ?? 0}`)
    .join('|');
  if (!bancada || bancada.chave !== chave) {
    const estados = new Map<RecursoId, EstadoRecurso>();
    for (const f of fontes) {
      estados.set(f.recurso, criarEstadoRecurso(f.recurso, estado.personagem.recursos[f.recurso] ?? 0));
    }
    bancada = { chave, estados, tempo: 0 };
  }
  return bancada;
}

function custosDaSkillAtual(): { recurso: RecursoId; custo: number }[] {
  const prog = calcularProgressao(estado.personagem);
  return calcularSkill(estado.personagem, prog, estado.skill).custoPorFonte;
}

function renderBancada(): void {
  const b = garantirBancada();
  if (b.estados.size === 0) {
    el('bancada').innerHTML = `<div class="vazio">A skill atual não tem fontes de energia ativas — configure na aba Criar Skill.</div>`;
    return;
  }
  const custos = custosDaSkillAtual();
  const linhas: string[] = [];
  let temFuria = false;
  for (const [recurso, e] of b.estados) {
    const def = RECURSOS[recurso];
    const custo = custos.find((c) => c.recurso === recurso)?.custo ?? 0;
    const fracao = e.maximo > 0 ? e.atual / e.maximo : 0;
    let extras = '';
    if (e instanceof FeEstado) {
      extras = `<span class="badge">custo ×${f1(e.multiplicadorAtual)}</span>`;
    } else if (e instanceof FuriaEstado) {
      temFuria = true;
      extras = `<span class="badge ${e.emCombate ? 'on' : ''}">${e.emCombate ? 'em combate' : 'fora de combate'}</span>`;
    } else if (e instanceof SoullinkEstado) {
      extras = `<span class="badge on">vida</span> <span class="badge">limiar ${f1(e.limiarVital)}</span>`;
    } else if (e instanceof RessonanciaEstado) {
      extras = `<span class="badge">poder ×${f1(e.multiplicadorAtual)}</span> <span class="badge">reseta após 8s</span>`;
    }
    linhas.push(`<div class="pool">
      <strong style="min-width:92px">${esc(def.nome)}</strong>
      <div class="barra"><i style="width:${pct(fracao)}"></i></div>
      <span class="num">${f1(e.atual)}/${f1(e.maximo)}</span>
      <span class="num limite-hint">custo ${f1(e.custoEfetivo(custo))}</span>
      ${extras}
    </div>`);
  }
  const botoesCombate = temFuria
    ? `<button type="button" data-acao="banc-dano">Causar 30 de dano</button>
       <button type="button" data-acao="banc-recebe">Receber 20 de dano</button>`
    : '';
  el('bancada').innerHTML = `
    ${linhas.join('')}
    <div>tempo simulado: <span class="num">${f1(b.tempo)}s</span></div>
    <div class="acoes-inline">
      <button type="button" data-acao="banc-usar">Usar skill</button>
      <button type="button" data-acao="banc-tick" data-dt="1">+1s</button>
      <button type="button" data-acao="banc-tick" data-dt="5">+5s</button>
      ${botoesCombate}
      <button type="button" data-acao="banc-reiniciar">Reiniciar</button>
    </div>`;
}

// ------------------------------------------------- bestiário / evocação

function renderFormEvocar(prog: Progressao): void {
  const ev = estado.evocacao;
  const modos: { id: ModoEvocacao; rotulo: string }[] = [
    { id: 'elemental', rotulo: 'Elemental (básica)' },
    { id: 'aleatoria', rotulo: 'Aleatória' },
    { id: 'capturada', rotulo: 'Capturada' },
  ];
  const abasModo = modos
    .map(
      (m) =>
        `<button type="button" class="btn-mini ${ev.modo === m.id ? 'on' : ''}" data-acao="evo-modo" data-id="${m.id}">${m.rotulo}</button>`,
    )
    .join(' ');

  let campos = '';
  if (ev.modo === 'elemental') {
    const disp = prog.elementosDisponiveis;
    const opc = (disp.length ? disp : ['fogo'])
      .map((id) => `<option value="${id}" ${id === ev.elemento ? 'selected' : ''}>${esc(nomeElemento(id))} (nv ${prog.niveisEfetivos[id] ?? 0})</option>`)
      .join('');
    campos = `<div class="linha-campo"><label for="evo-elemento">Elemento</label><select id="evo-elemento">${opc}</select><span></span></div>`;
  } else if (ev.modo === 'capturada') {
    const capturadas = estado.personagem.bestiario;
    if (!capturadas.length) {
      campos = `<div class="req">Nenhuma criatura capturada. Vá à seção Captura abaixo.</div>`;
    } else {
      const opcCri = capturadas
        .map((b) => {
          const cr = CRIATURAS[b.criaturaId];
          return `<option value="${b.criaturaId}" ${b.criaturaId === ev.criaturaId ? 'selected' : ''}>${esc(cr.nome)}${b.nivelVinculo > 0 ? ` ♥${b.nivelVinculo}` : ''}</option>`;
        })
        .join('');
      const maestria = elementosDeMaestria(prog);
      const opcImb =
        `<option value="">— sem imbuir —</option>` +
        maestria
          .map((id) => `<option value="${id}" ${id === ev.elementoImbuido ? 'selected' : ''}>${esc(nomeElemento(id))} (nv ${prog.niveisEfetivos[id] ?? 0})</option>`)
          .join('');
      const semMaestria = maestria.length === 0
        ? `<div class="limite-hint">Nenhum elemento com maestria (nível ${MAESTRIA_LIMIAR}+) para imbuir ainda.</div>`
        : '';
      campos = `
        <div class="linha-campo"><label for="evo-criatura">Criatura</label><select id="evo-criatura">${opcCri}</select><span></span></div>
        <div class="linha-campo"><label for="evo-imbuir">Imbuir com</label><select id="evo-imbuir">${opcImb}</select><span></span></div>
        ${semMaestria ? `<div class="linha-campo"><span></span>${semMaestria}<span></span></div>` : ''}`;
    }
  }

  el('form-evocar').innerHTML = `
    <div class="linha-campo"><label>Modo</label><div class="radios">${abasModo}</div><span></span></div>
    ${campos}
  `;
}

function renderResultadoEvocar(prog: Progressao): void {
  const ev = estado.evocacao;
  // injeta o nível de vínculo da criatura selecionada
  const cfg: ConfigEvocacao = { ...ev };
  if (ev.modo === 'capturada' && ev.criaturaId) {
    const b = estado.personagem.bestiario.find((x) => x.criaturaId === ev.criaturaId);
    cfg.nivelVinculo = b?.nivelVinculo ?? 0;
  }
  const r = evocar(estado.personagem, prog, cfg);
  const alvo = el('resultado-evocar');
  if (!r.valida) {
    alvo.innerHTML = `<div class="resultado-skill"><ul class="erros">${r.erros.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
    return;
  }
  const famNome = r.familia && FAMILIAS[r.familia as keyof typeof FAMILIAS]?.nome;
  alvo.innerHTML = `<div class="resultado-skill">
    <h3>${r.imbuido ? sig(r.imbuido, 'sig-titulo') : ''}${esc(r.nome)}</h3>
    <div class="metricas">
      <div class="metrica"><div class="rotulo">Poder</div><div class="valor num">${f1(r.poder)}</div></div>
      ${famNome ? `<div class="metrica"><div class="rotulo">Família</div><div class="valor" style="font-size:14px">${esc(famNome)}</div></div>` : ''}
      ${r.vinculada ? `<div class="metrica"><div class="rotulo">Vínculo</div><div class="valor">domada ♥</div></div>` : ''}
      ${r.imbuido ? `<div class="metrica"><div class="rotulo">Imbuída</div><div class="valor" style="font-size:14px">${esc(nomeElemento(r.imbuido))}</div></div>` : ''}
    </div>
  </div>`;
}

function renderBestiario(prog: Progressao): void {
  const cap = capacidadeVinculo(estado.personagem);
  const vinculadas = estado.personagem.bestiario.filter((c) => c.nivelVinculo > 0).length;
  el('conta-bestiario').textContent = `${estado.personagem.bestiario.length} capturadas`;
  const capInfo = `<div class="cap-info">Vínculos de doma: <strong>${vinculadas}/${cap}</strong>${cap === 0 ? ' — desbloqueie o talento Vínculo Primal (Doma)' : ''}</div>`;
  const linhas = estado.personagem.bestiario
    .map((b) => {
      const cr = CRIATURAS[b.criaturaId];
      const pips = '♥'.repeat(b.nivelVinculo) + '·'.repeat(5 - b.nivelVinculo);
      const podeDomar = cap > 0 && (b.nivelVinculo > 0 || vinculadas < cap) && b.nivelVinculo < 5;
      const mont = avaliarMontaria(estado.personagem, b.criaturaId);
      const badgeMont = mont.montavel ? `<span class="familia-tag" style="border-color:var(--acento);color:var(--acento)">🐎 montável</span>` : '';
      return `<div class="criatura criatura-com-sig">
        ${sig(`fam_${cr.familia}`, 'sig-mini')}
        <div>
          <div><strong>${esc(cr.nome)}</strong> <span class="familia-tag">${esc(FAMILIAS[cr.familia].nome)}</span> ${badgeMont}<span class="vinculo-pips">${pips}</span></div>
          <div class="meta">poder base ${cr.poderBase} · ${esc(cr.descricao)}</div>
        </div>
        <div>
          <button type="button" class="btn-mini" data-acao="domar" data-id="${b.criaturaId}" ${podeDomar ? '' : 'disabled'}>domar +</button>
          ${b.nivelVinculo > 0 ? `<button type="button" class="btn-mini" data-acao="afrouxar" data-id="${b.criaturaId}">−</button>` : ''}
          <button type="button" class="btn-mini" data-acao="soltar" data-id="${b.criaturaId}">soltar</button>
        </div>
      </div>`;
    })
    .join('');
  el('bestiario').innerHTML = capInfo + (linhas || '<div class="vazio">Nenhuma criatura capturada ainda.</div>');
}

function renderCriaturas(prog: Progressao): void {
  const filtro = estado.filtroCriaturas.trim().toLowerCase();
  const jaTenho = new Set(estado.personagem.bestiario.map((c) => c.criaturaId));
  const lista = criaturas()
    .map((cr) => ({ cr, av: avaliarCaptura(estado.personagem, prog, cr.id) }))
    .filter(({ cr }) => {
      if (!filtro) return true;
      return `${cr.nome} ${FAMILIAS[cr.familia].nome}`.toLowerCase().includes(filtro);
    })
    .sort((a, b) => Number(b.av.capturavel) - Number(a.av.capturavel) || a.cr.poderBase - b.cr.poderBase);

  el('criaturas').innerHTML = lista
    .map(({ cr, av }) => {
      const afin = cr.afinidades.map((e) => esc(ELEMENTOS[e].nome)).join(' / ');
      const tenho = jaTenho.has(cr.id);
      const fracao = av.exigido > 0 ? Math.min(1, av.poder / av.exigido) : 0;
      const barra = `<div class="barra ${av.capturavel ? '' : 'baixa'}"><i style="width:${pct(fracao)}"></i></div>`;
      return `<div class="criatura criatura-com-sig">
        ${sig(`fam_${cr.familia}`, 'sig-mini')}
        <div>
          <div><strong>${esc(cr.nome)}</strong> <span class="familia-tag">${esc(FAMILIAS[cr.familia].nome)}</span>
            <span class="meta">afinidade <span class="afin">${afin}</span> · poder ${cr.poderBase}</span></div>
          <div class="meta">poder de captura ${f1(av.poder)}/${av.exigido}${av.motivo ? ` — ${esc(av.motivo)}` : ''}</div>
          ${barra}
        </div>
        <div>
          ${tenho
            ? `<span class="btn-mini on">no bestiário</span>`
            : `<button type="button" class="btn-mini" data-acao="capturar" data-id="${cr.id}" ${av.capturavel ? '' : 'disabled'}>capturar</button>`}
        </div>
      </div>`;
    })
    .join('');
}

// ------------------------------------------------- profissão / craft

function renderProfissoes(prog: Progressao): void {
  el('profissoes').innerHTML = Object.values(PROFISSOES)
    .map((def) => {
      const nivel = estado.personagem.profissoes[def.id] ?? 0;
      const fatores = Object.entries(def.fatoresElementos)
        .map(([e, w]) => `${esc(ELEMENTOS[e]?.nome ?? e)} ×${w}`)
        .join(' · ');
      return `<div class="carta carta-com-sig">
        ${sig(`prof_${def.id}`, 'sig-carta')}
        <div class="carta-corpo">
        <div class="nome">${esc(def.nome)}</div>
        <div class="desc">${esc(def.descricao)}</div>
        <div class="efetivo num">eleva com: ${fatores}</div>
        <div class="controles">
          <button type="button" data-acao="dec-profissao" data-id="${def.id}" aria-label="Remover ponto de ${esc(def.nome)}">−</button>
          <span class="valor num">${nivel}</span>
          <button type="button" data-acao="inc-profissao" data-id="${def.id}" aria-label="Adicionar ponto em ${esc(def.nome)}">+</button>
        </div>
      </div></div>`;
    })
    .join('');
}

function renderFormCraft(prog: Progressao): void {
  const c = estado.craft;
  const opcoesProf = Object.values(PROFISSOES)
    .map((d) => `<option value="${d.id}" ${d.id === c.profissao ? 'selected' : ''}>${esc(d.nome)} (nv ${estado.personagem.profissoes[d.id] ?? 0})</option>`)
    .join('');
  const itens = itensDaProfissao(c.profissao);
  if (!itens.some((i) => i.id === c.itemId)) c.itemId = itens[0]?.id ?? '';
  const opcoesItem = itens
    .map((i) => `<option value="${i.id}" ${i.id === c.itemId ? 'selected' : ''}>${esc(i.nome)} · ${i.categoria}</option>`)
    .join('');

  const dominados = elementosDominados(prog);
  const imbuirHtml = dominados.length
    ? `<div class="imbuir-lista">${dominados
        .map(
          (e) =>
            `<label><input type="checkbox" data-acao="craft-imbuir" data-id="${e}" ${c.elementosImbuidos.includes(e) ? 'checked' : ''}>${esc(nomeElemento(e))}</label>`,
        )
        .join('')}</div>`
    : `<div class="imbuir-vazio">Nenhum elemento com maestria (nível ${MAESTRIA_LIMIAR}+) ainda — suba elementos na aba Elementos.</div>`;

  // material de criatura: só o Curtidor, e só entre as capturadas
  let materialHtml = '';
  if (c.profissao === 'curtidor') {
    const capturadas = estado.personagem.bestiario;
    if (c.materialCriaturaId && !capturadas.some((b) => b.criaturaId === c.materialCriaturaId)) {
      c.materialCriaturaId = undefined;
    }
    if (capturadas.length) {
      const opc =
        `<option value="">— sem material —</option>` +
        capturadas
          .map((b) => {
            const cr = CRIATURAS[b.criaturaId];
            const mat = MATERIAIS_CRIATURA[cr.familia];
            return `<option value="${b.criaturaId}" ${b.criaturaId === c.materialCriaturaId ? 'selected' : ''}>${esc(cr.nome)} — ${esc(mat.material)}</option>`;
          })
          .join('');
      materialHtml = `<div class="linha-campo"><label for="craft-material">Pele / material</label><div><select id="craft-material">${opc}</select><div class="limite-hint">a pele da criatura confere qualidade e uma propriedade própria</div></div><span></span></div>`;
    } else {
      materialHtml = `<div class="linha-campo"><label>Pele / material</label><div class="imbuir-vazio">Capture criaturas no Bestiário para usar suas peles.</div><span></span></div>`;
    }
  }

  el('form-craft').innerHTML = `
    <div class="linha-campo"><label for="craft-prof">Profissão</label><select id="craft-prof">${opcoesProf}</select><span></span></div>
    <div class="linha-campo"><label for="craft-item">Item</label><select id="craft-item">${opcoesItem}</select><span></span></div>
    ${materialHtml}
    <div class="linha-campo"><label>Imbuir elementos</label><div>${imbuirHtml}<div class="limite-hint">as propriedades emergem do que você imbui + talentos + nível</div></div><span></span></div>
  `;
}

function renderResultadoCraft(prog: Progressao): void {
  const r = craftar(estado.personagem, prog, estado.craft);
  const alvo = el('resultado-craft');
  if (!r.valida) {
    alvo.innerHTML = `<div class="resultado-skill"><ul class="erros">${r.erros.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
    return;
  }
  const maxQual = 120;
  const fracao = Math.min(1, r.qualidade / maxQual);
  const props = r.propriedades.length
    ? r.propriedades
        .map((p) => `<div class="prop-item"><strong>${esc(p.nome)}</strong> <span class="prop-bonus">+${p.bonusQualidade}</span><br>${esc(p.descricao)}</div>`)
        .join('')
    : `<div class="prop-item imbuir-vazio">Nenhuma propriedade emergente — imbua elementos que você domina.</div>`;
  const atributos = r.atributos
    .filter((a) => a.valor > 0)
    .map((a) => `<li>${esc(a.rotulo)}: <strong class="num">+${f1(a.valor)}</strong></li>`)
    .join('');
  alvo.innerHTML = `<div class="resultado-skill">
    <h3>${esc(r.nomeItem)}</h3>
    <div class="metricas">
      <div class="metrica"><div class="rotulo">Qualidade</div><div class="valor num">${f1(r.qualidade)}</div></div>
      <div class="metrica"><div class="rotulo">Raridade</div><div class="valor"><span class="tier-badge" style="border-color:${r.tier.cor};color:${r.tier.cor}">${esc(r.tier.nome)}</span></div></div>
    </div>
    <div class="qual-barra"><i style="width:${pct(fracao)};background:${r.tier.cor}"></i></div>
    <div class="dica">Propriedades emergentes:</div>
    ${props}
    ${atributos ? `<div class="dica" style="margin-top:8px">Qualidade vem de:</div><ul class="propriedades">${atributos}</ul>` : ''}
  </div>`;
}

// ------------------------------------------------- comparação de builds

function resumoBuild(personagem: Personagem, skill: SkillConfig) {
  const prog = calcularProgressao(personagem);
  const r = calcularSkill(personagem, prog, skill);
  const soma = (obj: Partial<Record<string, number>>) =>
    Object.values(obj).reduce((a: number, b) => a + (b ?? 0), 0);
  const derivadosLiberados = elementosDerivados().filter((d) => (prog.niveisEfetivos[d.id] ?? 0) > 0).length;
  const perfilTop = r.valida
    ? [...CHAVES_PERFIL].sort((a, b) => r.perfil[b] - r.perfil[a])[0]
    : '—';
  return {
    pontos: `${soma(personagem.elementos) + soma(personagem.escolas) + soma(personagem.recursos)}+${soma(personagem.talentos)}t`,
    elementos: prog.elementosDisponiveis.length,
    derivados: derivadosLiberados,
    arquetipos: prog.arquetipos.length,
    skillNome: skill.nome,
    custo: r.valida ? f1(r.custoTotal) : '—',
    impacto: r.valida ? f1(r.impactoTotal) : 'inválida',
    eficiencia: r.valida ? f1(r.eficiencia) : '—',
    perfilTop,
  };
}

function renderComparacao(): void {
  el('conta-snapshots').textContent = `${estado.snapshots.length}/4 snapshots`;
  const colunas = [
    { titulo: 'Atual', resumo: resumoBuild(estado.personagem, estado.skill), idx: -1 },
    ...estado.snapshots.map((s, idx) => ({
      titulo: s.nome,
      resumo: resumoBuild(s.personagem, s.skill),
      idx,
    })),
  ];
  const linhas: { rotulo: string; campo: keyof ReturnType<typeof resumoBuild> }[] = [
    { rotulo: 'Pontos (atrib+talento)', campo: 'pontos' },
    { rotulo: 'Elementos com nível', campo: 'elementos' },
    { rotulo: 'Derivados liberados', campo: 'derivados' },
    { rotulo: 'Arquétipos', campo: 'arquetipos' },
    { rotulo: 'Skill', campo: 'skillNome' },
    { rotulo: 'Custo', campo: 'custo' },
    { rotulo: 'Impacto total', campo: 'impacto' },
    { rotulo: 'Eficiência', campo: 'eficiencia' },
    { rotulo: 'Perfil dominante', campo: 'perfilTop' },
  ];
  const cabecalho = colunas
    .map(
      (c) =>
        `<th>${esc(String(c.titulo))}${
          c.idx >= 0
            ? ` <button type="button" class="neutro" data-acao="snap-carregar" data-idx="${c.idx}">carregar</button><button type="button" data-acao="snap-remover" data-idx="${c.idx}">×</button>`
            : ''
        }</th>`,
    )
    .join('');
  const corpo = linhas
    .map(
      (l) =>
        `<tr><td>${esc(l.rotulo)}</td>${colunas
          .map((c) => `<td class="num">${esc(String(c.resumo[l.campo]))}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  el('comparacao').innerHTML = `<table><thead><tr><th></th>${cabecalho}</tr></thead><tbody>${corpo}</tbody></table>`;
}

// ---------------------------------------------------------------- ações

function decrementar(obj: Partial<Record<string, number>>, id: string): void {
  const atual = obj[id] ?? 0;
  if (atual <= 1) delete obj[id];
  else obj[id] = atual - 1;
}

document.addEventListener('click', (ev) => {
  const alvo = (ev.target as Element).closest<HTMLElement>('[data-acao]');
  if (!alvo) return;
  const acao = alvo.dataset.acao!;
  const id = alvo.dataset.id ?? '';
  const p = estado.personagem;
  try {
    switch (acao) {
      case 'mod-toggle': {
        const mods = new Set<ModificadorId>((estado.skill.modificadores ?? []) as ModificadorId[]);
        const mid = id as ModificadorId;
        if (mods.has(mid)) mods.delete(mid);
        else if (mods.size < slotsModificador(estado.personagem)) mods.add(mid);
        estado.skill.modificadores = [...mods];
        render();
        return;
      }
      case 'fusao-toggle': {
        const idx = Number(id);
        const atual = new Set(estado.fusao);
        if (atual.has(idx)) atual.delete(idx);
        else if (atual.size < 4) atual.add(idx);
        estado.fusao = [...atual].sort((a, b) => a - b);
        render();
        return;
      }
      case 'ceu-prof':
        ceuManual();
        ceu.profundidade = Number(id) as 2 | 3 | 4;
        render();
        return;
      case 'ceu-lente':
        ceuManual();
        ceu.lente = id as EstadoCeu['lente'];
        render();
        return;
      case 'ceu-zoom':
        ceuManual();
        ceu.zoom = Number(id) as 1 | 2 | 3;
        render();
        return;
      case 'ceu-foco':
        ceuManual();
        ceu.foco = !ceu.foco;
        render();
        return;
      case 'aba':
        estado.abaAtiva = id as AbaId;
        renderAbas();
        salvar();
        return;
      case 'estrela-ceu': {
        elementoSelecionado = elementoSelecionado === id ? null : id;
        const prog = calcularProgressao(p);
        renderCeuElementos(prog);
        renderDetalheElemento(prog);
        // a tabela também precisa redesenhar: é ela que carrega o destaque da
        // linha selecionada. Rolar até a linha depois do redesenho é o que
        // conecta as duas metades da tela sem o usuário ter de procurar.
        renderPainelInvestir(prog);
        if (elementoSelecionado) {
          document
            .querySelector(`[data-linha-elemento="${CSS.escape(elementoSelecionado)}"]`)
            ?.scrollIntoView({ block: 'nearest' });
        }
        return;
      }
      case 'inc-elemento': investirElemento(p, id, Number(alvo.dataset.passo ?? 1)); break;
      case 'dec-elemento': {
        // pelo MOTOR (`desinvestirElemento`), nunca escrevendo em `p.elementos`
        // por fora: é o único lugar que sabe que zerar remove a chave. O passo
        // é limitado ao que existe para o botão "−10" nunca virar erro.
        const atual = p.elementos[id as ElementoId] ?? 0;
        if (atual > 0) {
          desinvestirElemento(p, id as ElementoId, Math.min(Number(alvo.dataset.passo ?? 1), atual));
        }
        break;
      }
      case 'inc-escola': investirEscola(p, id as EscolaId, 1); break;
      case 'dec-escola': decrementar(p.escolas, id); break;
      case 'inc-recurso': investirRecurso(p, id as RecursoId, 1); break;
      case 'dec-recurso': decrementar(p.recursos, id); break;
      case 'inc-profissao': investirProfissao(p, id as ProfissaoId, 1); break;
      case 'dec-profissao': decrementar(p.profissoes, id); break;
      case 'craft-imbuir': {
        const arr = estado.craft.elementosImbuidos;
        const i = arr.indexOf(id);
        if (i >= 0) arr.splice(i, 1);
        else arr.push(id);
        renderResultadoCraft(calcularProgressao(p));
        salvar();
        return;
      }
      case 'inc-talento': investirTalento(p, id as TalentoId, 1); break;
      case 'dec-talento': decrementar(p.talentos, id); break;
      case 'carregar-skill':
        estado.skill = structuredClone(estado.skillsSalvas[Number(alvo.dataset.idx)]);
        break;
      case 'remover-skill':
        estado.skillsSalvas.splice(Number(alvo.dataset.idx), 1);
        break;
      case 'abrir-galeria':
        abrirGaleria();
        return;
      case 'fechar-galeria':
        fecharGaleria();
        return;
      case 'gal-papel':
        galPapel = id as PapelPreset | 'todos';
        renderGaleria();
        return;
      case 'gal-cplx':
        galComplexidade = id === 'todas' ? 'todas' : (Number(id) as Complexidade);
        renderGaleria();
        return;
      case 'gal-limpar':
        galPapel = 'todos';
        galComplexidade = 'todas';
        galBusca = '';
        (document.getElementById('gal-busca') as HTMLInputElement).value = '';
        renderGaleria();
        return;
      case 'gal-sel':
        galSelecionado = galSelecionado === id ? null : id;
        renderGaleria();
        return;
      case 'gal-aplicar':
        aplicarPreset(id);
        return; // aplicarPreset já renderiza
      case 'desfazer-preset':
        desfazerPreset();
        return;
      case 'licao-ok':
        licaoPendente = null;
        render();
        return;
      case 'banc-usar': {
        const b = garantirBancada();
        const custos = custosDaSkillAtual();
        const semSaldo = custos.filter((c) => {
          const e = b.estados.get(c.recurso);
          return e && !e.podePagar(c.custo);
        });
        if (semSaldo.length) {
          toast(`Insuficiente: ${semSaldo.map((c) => RECURSOS[c.recurso].nome).join(', ')}.`);
        } else {
          for (const c of custos) b.estados.get(c.recurso)?.usar(c.custo);
        }
        renderBancada();
        return;
      }
      case 'banc-tick': {
        const b = garantirBancada();
        const dt = Number(alvo.dataset.dt) || 1;
        for (const e of b.estados.values()) e.tick(dt);
        b.tempo += dt;
        renderBancada();
        return;
      }
      case 'banc-dano': {
        for (const e of garantirBancada().estados.values()) {
          if (e instanceof FuriaEstado) e.aoCausarDano(30);
        }
        renderBancada();
        return;
      }
      case 'banc-recebe': {
        for (const e of garantirBancada().estados.values()) {
          if (e instanceof FuriaEstado) e.aoReceberDano(20);
        }
        renderBancada();
        return;
      }
      case 'banc-reiniciar':
        bancada = null;
        renderBancada();
        return;
      case 'snap-carregar': {
        const s = estado.snapshots[Number(alvo.dataset.idx)];
        estado.personagem = structuredClone(s.personagem);
        estado.skill = structuredClone(s.skill);
        toast(`Snapshot "${s.nome}" carregado.`);
        break;
      }
      case 'snap-remover':
        estado.snapshots.splice(Number(alvo.dataset.idx), 1);
        break;
      case 'no-talento':
        talentoSelecionado = talentoSelecionado === id ? null : (id as TalentoId);
        renderTalentos();
        return;
      case 'evo-modo': {
        estado.evocacao = { modo: id as ModoEvocacao };
        if (id === 'elemental') {
          estado.evocacao.elemento = calcularProgressao(p).elementosDisponiveis[0] ?? 'fogo';
        } else if (id === 'capturada') {
          estado.evocacao.criaturaId = p.bestiario[0]?.criaturaId;
        }
        const prog = calcularProgressao(p);
        renderFormEvocar(prog);
        renderResultadoEvocar(prog);
        salvar();
        return;
      }
      case 'sk-evo-modo': {
        const modo = id as ModoEvocacao;
        estado.skill.evocacao =
          modo === 'capturada'
            ? { modo, criaturaId: estado.skill.evocacao?.criaturaId ?? p.bestiario[0]?.criaturaId }
            : { modo };
        const prog = calcularProgressao(p);
        renderFormSkill(prog);
        renderResultadoSkill(prog);
        renderComparacao();
        salvar();
        return;
      }
      case 'capturar':
        capturarCriatura(p, calcularProgressao(p), id);
        break;
      case 'domar':
        domarCriatura(p, id);
        break;
      case 'afrouxar':
        afrouxarVinculo(p, id);
        break;
      case 'soltar':
        soltarCriatura(p, id);
        if (estado.evocacao.criaturaId === id) estado.evocacao.criaturaId = p.bestiario[0]?.criaturaId;
        break;
      case 'vista-talentos':
        estado.vistaTalentos = id as Estado['vistaTalentos'];
        renderTalentos();
        salvar();
        return;
      default: return;
    }
    render();
  } catch (e) {
    // o toast mostra a mensagem; o console guarda a pilha. Sem isto, um erro
    // de render vira uma frase solta sem origem — e caçá-lo custa três
    // rodadas de instrumentação no navegador.
    console.error('Falha ao processar ação da interface:', e);
    toast((e as Error).message);
  }
});

document.addEventListener('input', (ev) => {
  const t = ev.target as HTMLInputElement;
  const s = estado.skill;

  if (t.id === 'gal-busca') {
    galBusca = t.value;
    // só a grade e o detalhe são redesenhados; o próprio campo não é tocado,
    // senão o cursor voltaria ao início a cada tecla
    renderGaleria();
    return;
  }

  if (t.id === 'filtro-investir') {
    estado.filtroInvestir = t.value;
    renderPainelInvestir(calcularProgressao(estado.personagem));
    salvar();
    return;
  }

  if (t.id === 'ceu-busca') {
    ceu.busca = t.value;
    const prog = calcularProgressao(estado.personagem);
    renderCeuElementos(prog);
    const campo = document.getElementById('ceu-busca') as HTMLInputElement | null;
    if (campo) {
      campo.focus();
      campo.setSelectionRange(campo.value.length, campo.value.length);
    }
    return;
  }

  if (t.id?.startsWith('sk-fonte-')) {
    const recurso = t.id.slice('sk-fonte-'.length) as RecursoId;
    const valor = Number(t.value);
    const existente = s.fontes.find((f) => f.recurso === recurso);
    if (existente) existente.proporcao = valor;
    else s.fontes.push({ recurso, proporcao: valor });
    const rotulo = t.parentElement?.querySelector('.num:last-of-type');
    if (rotulo) rotulo.textContent = String(valor);
    const prog = calcularProgressao(estado.personagem);
    renderResultadoSkill(prog);
    renderBancada();
    salvar();
    return;
  }

  switch (t.id) {
    case 'orc-atributos': estado.orcamentoAtributos = Number(t.value) || 0; renderCabecalho(); salvar(); return;
    case 'orc-talentos': estado.orcamentoTalentos = Number(t.value) || 0; renderCabecalho(); salvar(); return;
    case 'sk-nome': s.nome = t.value || 'Skill'; break;
    case 'sk-elemento': s.elemento = t.value; break;
    case 'sk-escola': s.escola = t.value as EscolaId; break;
    case 'sk-capacidade': s.capacidadeExigida = t.value || undefined; break;
    case 'sk-energia': s.energia = Number(t.value); break;
    case 'sk-tempo': s.tempoConjuracaoSegundos = Number(t.value); break;
    case 'sk-alcance': s.alcanceMetros = Number(t.value); break;
    case 'sk-raio': s.area = { tipo: 'circulo', raioMetros: Number(t.value) }; break;
    case 'sk-duracao': s.entrega = { tipo: 'continuo', duracaoSegundos: Number(t.value) }; break;
    case 'sk-alvo': s.alvoElemento = (t.value || undefined) as any; break;
    default:
      if (t.name === 'sk-area') {
        s.area = t.value === 'unico' ? { tipo: 'unico' } : { tipo: 'circulo', raioMetros: 4 };
      } else if (t.name === 'sk-entrega') {
        s.entrega = t.value === 'instantaneo' ? { tipo: 'instantaneo' } : { tipo: 'continuo', duracaoSegundos: 8 };
      } else if (t.id === 'filtro-derivados') {
        estado.filtroDerivados = t.value;
        renderDerivados(calcularProgressao(estado.personagem));
        salvar();
        return;
      } else if (t.id === 'filtro-criaturas') {
        estado.filtroCriaturas = t.value;
        renderCriaturas(calcularProgressao(estado.personagem));
        salvar();
        return;
      } else if (t.id === 'evo-elemento') {
        estado.evocacao.elemento = t.value;
        const prog = calcularProgressao(estado.personagem);
        renderResultadoEvocar(prog);
        salvar();
        return;
      } else if (t.id === 'evo-criatura') {
        estado.evocacao.criaturaId = t.value;
        renderResultadoEvocar(calcularProgressao(estado.personagem));
        salvar();
        return;
      } else if (t.id === 'evo-imbuir') {
        estado.evocacao.elementoImbuido = t.value || undefined;
        renderResultadoEvocar(calcularProgressao(estado.personagem));
        salvar();
        return;
      } else if (t.id === 'sk-evo-criatura') {
        estado.skill.evocacao = { modo: 'capturada', criaturaId: t.value };
        const prog = calcularProgressao(estado.personagem);
        renderResultadoSkill(prog);
        renderComparacao();
        salvar();
        return;
      } else if (t.id === 'craft-prof') {
        estado.craft.profissao = t.value as ProfissaoId;
        if (estado.craft.profissao !== 'curtidor') estado.craft.materialCriaturaId = undefined;
        const prog = calcularProgressao(estado.personagem);
        renderFormCraft(prog);
        renderResultadoCraft(prog);
        salvar();
        return;
      } else if (t.id === 'craft-item') {
        estado.craft.itemId = t.value;
        renderResultadoCraft(calcularProgressao(estado.personagem));
        salvar();
        return;
      } else if (t.id === 'craft-material') {
        estado.craft.materialCriaturaId = t.value || undefined;
        renderResultadoCraft(calcularProgressao(estado.personagem));
        salvar();
        return;
      } else if (t.id === 'sk-montaria') {
        estado.skill.montariaId = t.value || undefined;
        const prog = calcularProgressao(estado.personagem);
        renderFormSkill(prog);
        renderResultadoSkill(prog);
        renderComparacao();
        salvar();
        return;
      } else return;
  }
  const prog = calcularProgressao(estado.personagem);
  if (t.type === 'range') {
    // não re-renderizar durante o arraste: só atualiza o rótulo ao lado
    const rotulo = t.parentElement?.querySelector('.num');
    if (rotulo) {
      const sufixo =
        t.id === 'sk-tempo' ? 's' : t.id === 'sk-raio' || t.id === 'sk-alcance' ? 'm' : t.id === 'sk-duracao' ? 's' : '';
      rotulo.textContent = `${f1(Number(t.value))}${sufixo}`;
    }
  } else if (t.type === 'select-one' || t.type === 'radio') {
    renderFormSkill(prog);
  }
  renderResultadoSkill(prog);
  renderBancada();
  renderComparacao();
  salvar();
});

// ao soltar um slider, re-renderiza o formulário para atualizar limites
document.addEventListener('change', (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.type === 'range' && (t.id?.startsWith('sk-') || t.id?.startsWith('sk-fonte-'))) {
    renderFormSkill(calcularProgressao(estado.personagem));
  }
});

el('btn-exportar').addEventListener('click', () => {
  const exportado = {
    formato: 'class-system-build',
    versao: 2,
    exportadoEm: new Date().toISOString(),
    orcamentos: { atributos: estado.orcamentoAtributos, talentos: estado.orcamentoTalentos },
    personagem: estado.personagem,
    skills: estado.skillsSalvas,
    skillAtual: estado.skill,
    snapshots: estado.snapshots,
  };
  const json = JSON.stringify(exportado, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `build-${estado.personagem.nome.toLowerCase().replace(/\s+/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  navigator.clipboard?.writeText(json).then(
    () => toast('Build exportada: arquivo baixado e JSON copiado.'),
    () => toast('Build exportada: arquivo baixado.'),
  );
});

el('input-importar').addEventListener('change', async (ev) => {
  const arquivo = (ev.target as HTMLInputElement).files?.[0];
  if (!arquivo) return;
  try {
    const dados = JSON.parse(await arquivo.text());
    if (dados.formato !== 'class-system-build') throw new Error('Arquivo não é uma build exportada.');
    const base = estadoPadrao();
    estado = {
      ...base,
      personagem: normalizarPersonagem({ ...base.personagem, ...dados.personagem }),
      orcamentoAtributos: dados.orcamentos?.atributos ?? base.orcamentoAtributos,
      orcamentoTalentos: dados.orcamentos?.talentos ?? base.orcamentoTalentos,
      skillsSalvas: Array.isArray(dados.skills) ? dados.skills.map(migrarSkill) : [],
      skill: migrarSkill(dados.skillAtual),
      snapshots: Array.isArray(dados.snapshots)
        ? dados.snapshots.map((sn: any) => ({ ...sn, personagem: normalizarPersonagem(sn.personagem), skill: migrarSkill(sn.skill) }))
        : [],
    };
    (el('orc-atributos') as HTMLInputElement).value = String(estado.orcamentoAtributos);
    (el('orc-talentos') as HTMLInputElement).value = String(estado.orcamentoTalentos);
    bancada = null;
    render();
    toast('Build importada.');
  } catch (e) {
    toast(`Falha ao importar: ${(e as Error).message}`);
  } finally {
    (ev.target as HTMLInputElement).value = '';
  }
});

el('btn-resetar').addEventListener('click', () => {
  // confirmação em dois cliques (diálogos nativos são bloqueados em iframes)
  const btn = el('btn-resetar') as HTMLButtonElement;
  if (btn.dataset.armado !== '1') {
    btn.dataset.armado = '1';
    btn.textContent = 'Confirmar reset?';
    setTimeout(() => {
      btn.dataset.armado = '';
      btn.textContent = 'Resetar';
    }, 3000);
    return;
  }
  btn.dataset.armado = '';
  btn.textContent = 'Resetar';
  estado = estadoPadrao();
  bancada = null;
  elementoSelecionado = null;
  talentoSelecionado = null;
  localStorage.removeItem(CHAVE_STORAGE);
  (el('orc-atributos') as HTMLInputElement).value = String(estado.orcamentoAtributos);
  (el('orc-talentos') as HTMLInputElement).value = String(estado.orcamentoTalentos);
  render();
  toast('Build resetada.');
});

el('btn-snapshot').addEventListener('click', () => {
  if (estado.snapshots.length >= 4) {
    toast('Máximo de 4 snapshots — remova um para fotografar de novo.');
    return;
  }
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  estado.snapshots.push({
    nome: `#${estado.snapshots.length + 1} · ${hora}`,
    criadoEm: new Date().toISOString(),
    personagem: structuredClone(estado.personagem),
    skill: structuredClone(estado.skill),
  });
  renderComparacao();
  salvar();
  toast('Build fotografada.');
});

document.addEventListener('click', (ev) => {
  if ((ev.target as HTMLElement).id === 'btn-salvar-skill') {
    const prog = calcularProgressao(estado.personagem);
    const r = calcularSkill(estado.personagem, prog, estado.skill);
    if (!r.valida) {
      toast('Corrija os erros antes de salvar a skill.');
      return;
    }
    estado.skillsSalvas.push(structuredClone(estado.skill));
    estado.skill = { ...structuredClone(estado.skill), nome: 'Nova Skill' };
    render();
    toast('Skill salva na build.');
  }
});

render();
