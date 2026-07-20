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
import { ESCOLAS, type EscolaId } from '../registry/escolas';
import { RECURSOS, type RecursoId } from '../registry/recursos';
import { TALENTOS, type TalentoDef, type TalentoId } from '../registry/talentos';
import { ARQUETIPOS } from '../registry/arquetipos';
import {
  criarPersonagem,
  investirElemento,
  investirEscola,
  investirRecurso,
  investirTalento,
  capturarCriatura,
  domarCriatura,
  afrouxarVinculo,
  soltarCriatura,
  type Personagem,
} from '../engine/personagem';
import { calcularProgressao, type Progressao } from '../engine/progressao';
import { CRIATURAS, FAMILIAS, criaturas, type CriaturaDef } from '../registry/criaturas';
import {
  avaliarCaptura,
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
} from '../engine/skills';
import {
  criarEstadoRecurso,
  FeEstado,
  FuriaEstado,
  RessonanciaEstado,
  SoullinkEstado,
  type EstadoRecurso,
} from '../engine/recursos';
import { sigilo } from './sigilos';

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

type AbaId = 'elementos' | 'escolas' | 'recursos' | 'talentos' | 'bestiario' | 'skill';

interface Estado {
  personagem: Personagem;
  orcamentoAtributos: number;
  orcamentoTalentos: number;
  skill: SkillConfig;
  skillsSalvas: SkillConfig[];
  filtroDerivados: string;
  filtroCriaturas: string;
  snapshots: Snapshot[];
  vistaTalentos: 'arvore' | 'cartas';
  abaAtiva: AbaId;
  evocacao: ConfigEvocacao;
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
    orcamentoAtributos: 100,
    orcamentoTalentos: 20,
    skill: skillPadrao(),
    skillsSalvas: [],
    filtroDerivados: '',
    filtroCriaturas: '',
    snapshots: [],
    vistaTalentos: 'arvore',
    abaAtiva: 'elementos',
    evocacao: { modo: 'elemental', elemento: 'fogo' },
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
    };
    if ((estado.vistaTalentos as string) === 'constelacao') estado.vistaTalentos = 'arvore';
    if (!['elementos', 'escolas', 'recursos', 'talentos', 'skill'].includes(estado.abaAtiva)) {
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
  vigor: '#c07a50',
  marcial: '#9aa3b5',
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
  return soma(estado.personagem.elementos) + soma(estado.personagem.escolas) + soma(estado.personagem.recursos);
}

function pontosTalentosGastos(): number {
  return Object.values(estado.personagem.talentos).reduce((a: number, b) => a + (b ?? 0), 0);
}

// ---------------------------------------------------------------- presets

interface Preset {
  id: string;
  nome: string;
  descricao: string;
  montar(): { p: Personagem; skill: SkillConfig };
}

function sk(
  extra: Partial<SkillConfig> & Pick<SkillConfig, 'nome' | 'elemento' | 'escola' | 'fontes'>,
): SkillConfig {
  return {
    energia: 20,
    tempoConjuracaoSegundos: 1.5,
    alcanceMetros: 10,
    area: { tipo: 'unico' },
    entrega: { tipo: 'instantaneo' },
    ...extra,
  };
}

const fonte = (recurso: RecursoId, proporcao = 100): FonteEnergia => ({ recurso, proporcao });

const PRESETS: Preset[] = [
  {
    id: 'necromante',
    nome: 'Necromante',
    descricao: 'Morte + Evocação, enxame de mortos-vivos.',
    montar() {
      const p = criarPersonagem('Vesper, a Necromante');
      investirElemento(p, 'morte', 18);
      investirElemento(p, 'sombra', 6);
      investirEscola(p, 'evocacao', 14);
      investirEscola(p, 'maldicao', 6);
      investirRecurso(p, 'mana', 10);
      investirTalento(p, 'enxame', 3);
      return { p, skill: sk({ nome: 'Legião de Ossos', elemento: 'morte', escola: 'evocacao', fontes: [fonte('mana')], energia: 30, tempoConjuracaoSegundos: 3, capacidadeExigida: 'evocar_mortos_vivos' }) };
    },
  },
  {
    id: 'lavamante',
    nome: 'Lavamante',
    descricao: 'Fogo + Terra em erupções de área.',
    montar() {
      const p = criarPersonagem('Brasa, o Lavamante');
      investirElemento(p, 'fogo', 14);
      investirElemento(p, 'terra', 14);
      investirEscola(p, 'conjuracao', 14);
      investirRecurso(p, 'mana', 10);
      investirTalento(p, 'area_ampliada', 3);
      investirTalento(p, 'impacto_imediato', 2);
      return { p, skill: sk({ nome: 'Erupção', elemento: 'lava', escola: 'conjuracao', fontes: [fonte('mana')], energia: 28, tempoConjuracaoSegundos: 2.5, area: { tipo: 'circulo', raioMetros: 6 } }) };
    },
  },
  {
    id: 'paladino',
    nome: 'Paladino',
    descricao: 'Bravura + Fé: o muro sagrado.',
    montar() {
      const p = criarPersonagem('Aurelia, a Paladina');
      investirElemento(p, 'luz', 12);
      investirElemento(p, 'vigor', 12);
      investirEscola(p, 'combate_fisico', 12);
      investirEscola(p, 'benca', 8);
      investirRecurso(p, 'fe', 10);
      investirTalento(p, 'egide', 2);
      investirTalento(p, 'postura_inabalavel', 2);
      return { p, skill: sk({ nome: 'Aura da Bravura', elemento: 'bravura', escola: 'benca', fontes: [fonte('fe')], tempoConjuracaoSegundos: 2, area: { tipo: 'circulo', raioMetros: 4 }, entrega: { tipo: 'continuo', duracaoSegundos: 10 } }) };
    },
  },
  {
    id: 'berserker',
    nome: 'Berserker',
    descricao: 'Fervor + Fúria: sangue fervente.',
    montar() {
      const p = criarPersonagem('Korg, o Berserker');
      investirElemento(p, 'vigor', 14);
      investirElemento(p, 'fogo', 10);
      investirEscola(p, 'combate_fisico', 14);
      investirRecurso(p, 'furia', 10);
      investirTalento(p, 'golpe_devastador', 2);
      investirTalento(p, 'sede_de_batalha', 2);
      return { p, skill: sk({ nome: 'Golpe Fervente', elemento: 'fervor', escola: 'combate_fisico', fontes: [fonte('furia')], energia: 25, tempoConjuracaoSegundos: 1, alcanceMetros: 0 }) };
    },
  },
  {
    id: 'tempestario',
    nome: 'Tempestário',
    descricao: 'Ar + Eletricidade: o céu em fúria.',
    montar() {
      const p = criarPersonagem('Zael, o Tempestário');
      investirElemento(p, 'ar', 13);
      investirElemento(p, 'eletricidade', 13);
      investirEscola(p, 'conjuracao', 12);
      investirRecurso(p, 'mana', 8);
      investirTalento(p, 'area_ampliada', 2);
      return { p, skill: sk({ nome: 'Céu Partido', elemento: 'tempestade', escola: 'conjuracao', fontes: [fonte('mana')], energia: 26, tempoConjuracaoSegundos: 2.5, area: { tipo: 'circulo', raioMetros: 8 } }) };
    },
  },
  {
    id: 'santo',
    nome: 'Santo Guardião',
    descricao: 'Santidade: a cura mais pura.',
    montar() {
      const p = criarPersonagem('Ilya, a Santa Guardiã');
      investirElemento(p, 'luz', 14);
      investirElemento(p, 'vida', 14);
      investirEscola(p, 'benca', 14);
      investirRecurso(p, 'fe', 10);
      investirTalento(p, 'vinculo_de_grupo', 2);
      investirTalento(p, 'egide', 2);
      return { p, skill: sk({ nome: 'Graça Plena', elemento: 'santidade', escola: 'benca', fontes: [fonte('fe')], energia: 24, tempoConjuracaoSegundos: 2, area: { tipo: 'circulo', raioMetros: 4 }, entrega: { tipo: 'continuo', duracaoSegundos: 10 } }) };
    },
  },
  {
    id: 'arsenal',
    nome: 'Arsenal Espectral',
    descricao: 'Armas evocadas que lutam sozinhas.',
    montar() {
      const p = criarPersonagem('Kael, Arsenal Espectral');
      investirElemento(p, 'vigor', 12);
      investirElemento(p, 'arcano', 8);
      investirEscola(p, 'evocacao', 13);
      investirEscola(p, 'combate_fisico', 13);
      investirRecurso(p, 'furia', 9);
      investirTalento(p, 'colosso', 2);
      investirTalento(p, 'vinculo_marcial', 2);
      return { p, skill: sk({ nome: 'Armas Dançantes', elemento: 'vigor', escola: 'evocacao', fontes: [fonte('furia')], energia: 35, tempoConjuracaoSegundos: 2, alcanceMetros: 0, capacidadeExigida: 'evocar_armas_autonomas' }) };
    },
  },
  {
    id: 'mestre_de_armas',
    nome: 'Mestre de Armas',
    descricao: 'Marcial + Soullink/Fúria: paga com a vida por golpes perfeitos.',
    montar() {
      const p = criarPersonagem('Cem-Lâminas');
      investirElemento(p, 'marcial', 14);
      investirElemento(p, 'vigor', 10);
      investirEscola(p, 'combate_fisico', 12);
      investirRecurso(p, 'soullink', 8);
      investirRecurso(p, 'furia', 6);
      investirTalento(p, 'sequencia_marcial', 2);
      investirTalento(p, 'elo_profundo', 2);
      return { p, skill: sk({ nome: 'Dança de Mil Cortes', elemento: 'maestria', escola: 'combate_fisico', fontes: [fonte('soullink', 60), fonte('furia', 40)], energia: 25, tempoConjuracaoSegundos: 1.5, alcanceMetros: 0 }) };
    },
  },
  {
    id: 'nulo',
    nome: 'Portador do Nulo',
    descricao: 'Nível 8 em tudo: o elemento que nega.',
    montar() {
      const p = criarPersonagem('O Sem-Nome');
      for (const def of elementosBase()) investirElemento(p, def.id, 8);
      investirEscola(p, 'conjuracao', 10);
      investirRecurso(p, 'mana', 10);
      return { p, skill: sk({ nome: 'Anulação', elemento: 'nulo', escola: 'conjuracao', fontes: [fonte('mana')], energia: 30, tempoConjuracaoSegundos: 2 }) };
    },
  },
];

function aplicarPreset(id: string): void {
  const preset = PRESETS.find((x) => x.id === id);
  if (!preset) return;
  try {
    const { p, skill } = preset.montar();
    estado.personagem = p;
    estado.skill = skill;
    estado.skillsSalvas = [];
    const gastoA = pontosAtributosGastos();
    const gastoT = pontosTalentosGastos();
    estado.orcamentoAtributos = Math.max(estado.orcamentoAtributos, Math.ceil(gastoA / 10) * 10);
    estado.orcamentoTalentos = Math.max(estado.orcamentoTalentos, gastoT);
    (el('orc-atributos') as HTMLInputElement).value = String(estado.orcamentoAtributos);
    (el('orc-talentos') as HTMLInputElement).value = String(estado.orcamentoTalentos);
    render();
    toast(`Preset "${preset.nome}" aplicado.`);
  } catch (e) {
    toast(`Preset falhou: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------- render

function render(): void {
  const prog = calcularProgressao(estado.personagem);
  renderCabecalho();
  renderAbas();
  renderCeuElementos(prog);
  renderDetalheElemento(prog);
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
}

// ------------------------------------------------- céu dos elementos

let elementoSelecionado: ElementoId | null = null;

interface PosEstrela {
  x: number;
  y: number;
  r: number;
}

function posicoesDoCeu(): Map<ElementoId, PosEstrela> {
  const W = 760;
  const c = W / 2;
  const bases = elementosBase().map((e) => e.id as ElementoBaseId);
  const n = bases.length; // 13
  const passo = (2 * Math.PI) / n;
  const angulo = (i: number) => -Math.PI / 2 + i * passo;
  const R_BASE = 300;
  const pos = new Map<ElementoId, PosEstrela>();

  bases.forEach((id, i) => {
    pos.set(id, {
      x: c + Math.cos(angulo(i)) * R_BASE,
      y: c + Math.sin(angulo(i)) * R_BASE,
      r: 6,
    });
  });

  const idx = new Map(bases.map((id, i) => [id, i]));
  const triplas: ElementoDef[] = [];
  for (const def of elementosDerivados()) {
    const comps = def.receita!.map((r) => r.elemento);
    if (comps.length === 2) {
      let i = idx.get(comps[0])!;
      let j = idx.get(comps[1])!;
      let s = (j - i + n) % n;
      if (s > n / 2) {
        [i, j] = [j, i];
        s = n - s;
      }
      // anéis concêntricos: pares de componentes vizinhos ficam na borda,
      // pares de opostos mergulham em direção ao centro — uma mandala 13×6
      const raio = 300 - 36 * s;
      const ang = angulo(i) + (s * passo) / 2;
      pos.set(def.id, { x: c + Math.cos(ang) * raio, y: c + Math.sin(ang) * raio, r: 3 });
    } else if (comps.length === 3) {
      triplas.push(def);
    }
  }

  // triplas: ordenadas pelo ângulo médio dos componentes, espaçadas num anel interno
  const anguloMedio = (def: ElementoDef): number => {
    let sx = 0;
    let sy = 0;
    for (const r of def.receita!) {
      const a = angulo(idx.get(r.elemento)!);
      sx += Math.cos(a);
      sy += Math.sin(a);
    }
    return Math.atan2(sy, sx);
  };
  triplas
    .map((def) => ({ def, ang: anguloMedio(def) }))
    .sort((a, b) => a.ang - b.ang)
    .forEach(({ def }, k, arr) => {
      const ang = -Math.PI / 2 + (k * 2 * Math.PI) / arr.length;
      pos.set(def.id, { x: c + Math.cos(ang) * 52, y: c + Math.sin(ang) * 52, r: 3.5 });
    });

  // amplas: primordial no zênite interno, ciclo no nadir; nulo no coração
  pos.set('primordial', { x: c, y: c - 26, r: 4 });
  pos.set('ciclo', { x: c, y: c + 26, r: 4 });
  pos.set('nulo', { x: c, y: c, r: 5 });
  return pos;
}

function classeEstrela(def: ElementoDef, prog: Progressao): string {
  if (def.tipo === 'base') return 'base';
  const nivel = prog.niveisEfetivos[def.id] ?? 0;
  if (nivel > 0) return 'liberado';
  const progresso = progressoReceita(def, prog);
  return progresso >= 0.5 ? 'proximo' : 'distante';
}

function renderCeuElementos(prog: Progressao): void {
  el('conta-elementos').textContent =
    `${prog.elementosDisponiveis.length} elementos com nível efetivo`;

  const W = 760;
  const c = W / 2;
  const pos = posicoesDoCeu();

  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  let fundo = '';
  for (let i = 0; i < 90; i++) {
    fundo += `<circle class="fundo-estrela" cx="${(rnd() * W).toFixed(1)}" cy="${(rnd() * W).toFixed(1)}" r="${(0.4 + rnd() * 0.9).toFixed(2)}" opacity="${(0.1 + rnd() * 0.28).toFixed(2)}"/>`;
  }

  // anel do zodíaco ligando os 13 elementos base
  const bases = elementosBase();
  const anelPontos = bases
    .map((b) => {
      const p = pos.get(b.id)!;
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');
  let ligas = `<polygon class="anel-zodiaco" points="${anelPontos}"/>`;

  // linhas de receita: derivados liberados sempre; selecionado em destaque
  for (const def of elementosDerivados()) {
    const nivel = prog.niveisEfetivos[def.id] ?? 0;
    const selecionada = elementoSelecionado === def.id;
    if (nivel <= 0 && !selecionada) continue;
    const de = pos.get(def.id);
    if (!de) continue;
    for (const comp of def.receita!) {
      const ate = pos.get(comp.elemento)!;
      ligas += `<line class="${selecionada ? 'liga-selecao' : 'liga-receita'}" x1="${de.x.toFixed(1)}" y1="${de.y.toFixed(1)}" x2="${ate.x.toFixed(1)}" y2="${ate.y.toFixed(1)}"/>`;
    }
  }

  let estrelas = '';
  let rotulos = '';
  for (const def of [...bases, ...elementosDerivados()]) {
    const p = pos.get(def.id);
    if (!p) continue;
    const nivel = prog.niveisEfetivos[def.id] ?? 0;
    const classe = classeEstrela(def, prog);
    const selecionado = elementoSelecionado === def.id ? ' selecionado' : '';
    const raio = def.tipo === 'base' ? p.r + Math.min(5, nivel * 0.25) : p.r + Math.min(3, nivel * 0.12);
    const corBase = def.tipo === 'base' ? ` style="fill:${CORES[def.id as ElementoBaseId]}"` : '';
    // elementos base ganham a arte PNG como disco; derivados seguem pontos de luz
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
    estrelas += `<g class="${classe}${selecionado}" data-acao="estrela-ceu" data-id="${def.id}" tabindex="0" role="button"
      aria-label="${esc(def.nome)} (nível ${nivel})">
      <title>${esc(def.nome)} — ${esc(def.descricao)}</title>
      ${corpo}
      <circle class="anel-sel" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${raioSel.toFixed(1)}" fill="none"/>
    </g>`;
    if (def.tipo === 'base') {
      const ang = Math.atan2(p.y - c, p.x - c);
      const lx = c + Math.cos(ang) * 336;
      const ly = c + Math.sin(ang) * 336;
      const anchor = Math.abs(Math.cos(ang)) < 0.3 ? 'middle' : Math.cos(ang) > 0 ? 'start' : 'end';
      rotulos += `<text class="rotulo-base" x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" text-anchor="${anchor}">${esc(def.nome)}${nivel > 0 ? ` ${nivel}` : ''}</text>`;
    } else if (nivel > 0 || elementoSelecionado === def.id) {
      rotulos += `<text class="rotulo-deriv" x="${p.x.toFixed(1)}" y="${(p.y + raio + 10).toFixed(1)}">${esc(def.nome)}${nivel > 0 ? ` ${nivel}` : ''}</text>`;
    }
  }

  el('ceu-elementos').innerHTML = `<svg viewBox="0 0 ${W} ${W}" role="img" aria-label="Céu dos Elementos">
    ${fundo}${ligas}${estrelas}${rotulos}
  </svg>`;
}

function renderDetalheElemento(prog: Progressao): void {
  const alvo = el('elemento-detalhe');
  if (!elementoSelecionado || !ELEMENTOS[elementoSelecionado]) {
    alvo.innerHTML = `<div class="talento-detalhe vazio">Clique numa estrela do céu para ver detalhes e investir pontos.</div>`;
    return;
  }
  const def = ELEMENTOS[elementoSelecionado];
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
      <div class="controles">
        <button type="button" data-acao="dec-elemento" data-id="${def.id}" aria-label="Remover ponto">−</button>
        <span class="valor num">${direto}</span>
        <button type="button" data-acao="inc-elemento" data-id="${def.id}" aria-label="Adicionar ponto">+</button>
      </div>
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
  alvo.innerHTML = `<div class="talento-detalhe detalhe-com-sig">
    <div class="sig-combo">${sigDeriv}</div>
    <div class="detalhe-corpo">
    <div class="nome">${esc(def.nome)} <span class="conta">${def.tipo} · potência ×${def.fatorPotencia}</span></div>
    <div class="desc">${esc(def.descricao)}</div>
    <div>${nivel > 0 ? `Nível <strong class="num">${nivel}</strong> — igual ao menor componente.` : 'Ainda não liberado — todos os componentes precisam atingir o mínimo.'}</div>
    ${receita}
    <div class="desc">Elementos combinados não aceitam pontos diretos: evoluem quando os componentes sobem juntos.</div>
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
  { titulo: 'Maldição', ids: ['contagio', 'aflicao_profunda'] },
  { titulo: 'Bênção', ids: ['egide', 'exaltacao', 'vinculo_de_grupo'] },
  { titulo: 'Combate Físico', ids: ['sequencia_marcial', 'golpe_devastador', 'postura_inabalavel'] },
  { titulo: 'Longo Alcance', ids: ['olho_de_aguia', 'rajada'] },
  { titulo: 'Recursos', ids: ['devocao', 'fluxo_constante', 'sede_de_batalha', 'elo_profundo', 'afinacao'] },
];

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

function renderFormSkill(prog: Progressao): void {
  const s = estado.skill;
  const limites = calcularLimites(estado.personagem, s.escola, s.fontes);
  const disponiveis = prog.elementosDisponiveis;
  const opcoesElemento = (disponiveis.length ? disponiveis : ['fogo'])
    .map((id) => `<option value="${id}" ${id === s.elemento ? 'selected' : ''}>${esc(ELEMENTOS[id].nome)} (nv ${prog.niveisEfetivos[id] ?? 0})</option>`)
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

  // fontes de energia: só recursos com proficiência aparecem
  const recursosComProf = Object.values(RECURSOS).filter(
    (d) => (estado.personagem.recursos[d.id] ?? 0) > 0,
  );
  const fontesHtml = recursosComProf.length
    ? recursosComProf
        .map((d) => {
          const atual = s.fontes.find((f) => f.recurso === d.id)?.proporcao ?? 0;
          const prof = estado.personagem.recursos[d.id] ?? 0;
          return `<div class="fonte-linha">
            <span>${esc(d.nome)} <span class="limite-hint num">prof ${prof}</span></span>
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
          <div class="limite-hint">${imbui ? `imbuída de ${esc(ELEMENTOS[s.elemento].nome)} (maestria ✓)` : `sem maestria em ${esc(ELEMENTOS[s.elemento].nome)} — não imbui (suba para nível ${MAESTRIA_LIMIAR})`}</div>`;
      }
    } else if (modo === 'aleatoria') {
      extra = `<div class="limite-hint">criatura qualquer; mais forte quanto mais Evocação.</div>`;
    } else {
      extra = `<div class="limite-hint">um elemental de ${esc(ELEMENTOS[s.elemento]?.nome ?? s.elemento)}.</div>`;
    }
    evocacaoHtml = `<div class="linha-campo"><label>Fonte da evocação</label><div><div class="radios">${botoes}</div>${extra}</div><span></span></div>`;
  }

  el('form-skill').innerHTML = `
    <div class="linha-campo"><label for="sk-nome">Nome</label><input id="sk-nome" type="text" value="${esc(s.nome)}"><span></span></div>
    <div class="linha-campo"><label for="sk-elemento">Elemento</label><select id="sk-elemento">${opcoesElemento}</select><span></span></div>
    <div class="linha-campo"><label for="sk-escola">Escola</label><select id="sk-escola">${opcoesEscola}</select><span></span></div>
    ${evocacaoHtml}
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
          <div class="metrica"><div class="rotulo">Eficiência</div><div class="valor num">${f1(r.eficiencia)}</div></div>
        </div>
        <div class="dica num">fontes: ${custoFontes}</div>
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
          <span><strong>${esc(s.nome)}</strong> · ${esc(ELEMENTOS[s.elemento]?.nome ?? s.elemento)} + ${esc(ESCOLAS[s.escola].nome)} @ ${esc(fontesTxt)}</span>
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
      .map((id) => `<option value="${id}" ${id === ev.elemento ? 'selected' : ''}>${esc(ELEMENTOS[id].nome)} (nv ${prog.niveisEfetivos[id] ?? 0})</option>`)
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
          .map((id) => `<option value="${id}" ${id === ev.elementoImbuido ? 'selected' : ''}>${esc(ELEMENTOS[id].nome)} (nv ${prog.niveisEfetivos[id] ?? 0})</option>`)
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
      ${r.imbuido ? `<div class="metrica"><div class="rotulo">Imbuída</div><div class="valor" style="font-size:14px">${esc(ELEMENTOS[r.imbuido].nome)}</div></div>` : ''}
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
      return `<div class="criatura">
        <div>
          <div><strong>${esc(cr.nome)}</strong> <span class="familia-tag">${esc(FAMILIAS[cr.familia].nome)}</span> <span class="vinculo-pips">${pips}</span></div>
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
      return `<div class="criatura">
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
        return;
      }
      case 'inc-elemento': investirElemento(p, id, 1); break;
      case 'dec-elemento': decrementar(p.elementos, id); break;
      case 'inc-escola': investirEscola(p, id as EscolaId, 1); break;
      case 'dec-escola': decrementar(p.escolas, id); break;
      case 'inc-recurso': investirRecurso(p, id as RecursoId, 1); break;
      case 'dec-recurso': decrementar(p.recursos, id); break;
      case 'inc-talento': investirTalento(p, id as TalentoId, 1); break;
      case 'dec-talento': decrementar(p.talentos, id); break;
      case 'carregar-skill':
        estado.skill = structuredClone(estado.skillsSalvas[Number(alvo.dataset.idx)]);
        break;
      case 'remover-skill':
        estado.skillsSalvas.splice(Number(alvo.dataset.idx), 1);
        break;
      case 'preset':
        aplicarPreset(id);
        return; // aplicarPreset já renderiza
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
    toast((e as Error).message);
  }
});

document.addEventListener('input', (ev) => {
  const t = ev.target as HTMLInputElement;
  const s = estado.skill;

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
