/**
 * App do simulador. Importa o MOTOR REAL (mesmo código dos testes) — a UI
 * apenas coleta pontos e exibe os cálculos.
 */

import {
  ELEMENTOS,
  elementosBase,
  elementosDerivados,
  type ElementoBaseId,
  type ElementoDef,
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
  type Personagem,
} from '../engine/personagem';
import { calcularProgressao, type Progressao } from '../engine/progressao';
import { calcularSkill, type ResultadoSkill, type SkillConfig } from '../engine/skills';
import { criarEstadoRecurso, FeEstado, FuriaEstado, type EstadoRecurso } from '../engine/recursos';

// ---------------------------------------------------------------- estado

interface Snapshot {
  nome: string;
  criadoEm: string;
  personagem: Personagem;
  skill: SkillConfig;
}

interface Estado {
  personagem: Personagem;
  orcamentoAtributos: number;
  orcamentoTalentos: number;
  skill: SkillConfig;
  skillsSalvas: SkillConfig[];
  filtroDerivados: string;
  snapshots: Snapshot[];
}

const CHAVE_STORAGE = 'class-system-simulador-v1';

function skillPadrao(): SkillConfig {
  return {
    nome: 'Nova Skill',
    elemento: 'fogo',
    escola: 'conjuracao',
    recurso: 'mana',
    energia: 20,
    tempoConjuracaoSegundos: 1.5,
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
    snapshots: [],
  };
}

function carregar(): Estado {
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE);
    if (!bruto) return estadoPadrao();
    const salvo = JSON.parse(bruto);
    const base = estadoPadrao();
    return {
      ...base,
      ...salvo,
      personagem: { ...base.personagem, ...salvo.personagem },
      skill: { ...base.skill, ...salvo.skill },
    };
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

function sk(extra: Partial<SkillConfig> & Pick<SkillConfig, 'nome' | 'elemento' | 'escola' | 'recurso'>): SkillConfig {
  return {
    energia: 20,
    tempoConjuracaoSegundos: 1.5,
    area: { tipo: 'unico' },
    entrega: { tipo: 'instantaneo' },
    ...extra,
  };
}

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
      return { p, skill: sk({ nome: 'Legião de Ossos', elemento: 'morte', escola: 'evocacao', recurso: 'mana', energia: 30, tempoConjuracaoSegundos: 3, capacidadeExigida: 'evocar_mortos_vivos' }) };
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
      return { p, skill: sk({ nome: 'Erupção', elemento: 'lava', escola: 'conjuracao', recurso: 'mana', energia: 28, tempoConjuracaoSegundos: 2.5, area: { tipo: 'circulo', raioMetros: 6 } }) };
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
      return { p, skill: sk({ nome: 'Aura da Bravura', elemento: 'bravura', escola: 'benca', recurso: 'fe', tempoConjuracaoSegundos: 2, area: { tipo: 'circulo', raioMetros: 4 }, entrega: { tipo: 'continuo', duracaoSegundos: 10 } }) };
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
      return { p, skill: sk({ nome: 'Golpe Fervente', elemento: 'fervor', escola: 'combate_fisico', recurso: 'furia', energia: 25, tempoConjuracaoSegundos: 1 }) };
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
      return { p, skill: sk({ nome: 'Céu Partido', elemento: 'tempestade', escola: 'conjuracao', recurso: 'mana', energia: 26, tempoConjuracaoSegundos: 2.5, area: { tipo: 'circulo', raioMetros: 8 } }) };
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
      return { p, skill: sk({ nome: 'Graça Plena', elemento: 'santidade', escola: 'benca', recurso: 'fe', energia: 24, tempoConjuracaoSegundos: 2, area: { tipo: 'circulo', raioMetros: 4 }, entrega: { tipo: 'continuo', duracaoSegundos: 10 } }) };
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
      return { p, skill: sk({ nome: 'Armas Dançantes', elemento: 'vigor', escola: 'evocacao', recurso: 'furia', energia: 35, tempoConjuracaoSegundos: 2, capacidadeExigida: 'evocar_armas_autonomas' }) };
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
      return { p, skill: sk({ nome: 'Anulação', elemento: 'nulo', escola: 'conjuracao', recurso: 'mana', energia: 30, tempoConjuracaoSegundos: 2 }) };
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
  renderPresets();
  renderElementos(prog);
  renderEscolas();
  renderRecursos();
  renderTalentos();
  renderDerivados(prog);
  renderArquetipos(prog);
  renderFormSkill(prog);
  renderResultadoSkill(prog);
  renderSkillsSalvas();
  renderBancada();
  renderComparacao();
  salvar();
}

function renderPresets(): void {
  el('presets').innerHTML = PRESETS.map(
    (pr) => `<button type="button" data-acao="preset" data-id="${pr.id}" title="${esc(pr.descricao)}">${esc(pr.nome)}</button>`,
  ).join('');
}

function renderCabecalho(): void {
  const ga = pontosAtributosGastos();
  const gt = pontosTalentosGastos();
  const excedido = ga > estado.orcamentoAtributos || gt > estado.orcamentoTalentos;
  const g = el('gastos');
  g.textContent = `atributos ${ga}/${estado.orcamentoAtributos} · talentos ${gt}/${estado.orcamentoTalentos}`;
  g.classList.toggle('excedido', excedido);
}

function renderElementos(prog: Progressao): void {
  el('conta-elementos').textContent = `${prog.elementosDisponiveis.length} com nível efetivo`;
  el('elementos').innerHTML = elementosBase()
    .map((def) => {
      const id = def.id as ElementoBaseId;
      const direto = estado.personagem.elementos[id] ?? 0;
      const efetivo = prog.niveisEfetivos[id] ?? 0;
      const bonus = efetivo - direto;
      return `<div class="carta">
        <div class="nome"><span class="ponto-cor" style="background:${CORES[id]}"></span>${esc(def.nome)}</div>
        <div class="desc">${esc(def.descricao)}</div>
        <div class="controles">
          <button type="button" data-acao="dec-elemento" data-id="${id}" aria-label="Remover ponto de ${esc(def.nome)}">−</button>
          <span class="valor num">${direto}</span>
          <button type="button" data-acao="inc-elemento" data-id="${id}" aria-label="Adicionar ponto em ${esc(def.nome)}">+</button>
          ${bonus > 0 ? `<span class="efetivo num">efetivo ${efetivo} (+${bonus} sinergia)</span>` : ''}
        </div>
      </div>`;
    })
    .join('');
}

function renderEscolas(): void {
  el('escolas').innerHTML = Object.values(ESCOLAS)
    .map((def) => {
      const pontos = estado.personagem.escolas[def.id] ?? 0;
      return `<div class="carta">
        <div class="nome">${esc(def.nome)}</div>
        <div class="desc">${esc(def.descricao)}</div>
        <div class="controles">
          <button type="button" data-acao="dec-escola" data-id="${def.id}" aria-label="Remover ponto de ${esc(def.nome)}">−</button>
          <span class="valor num">${pontos}</span>
          <button type="button" data-acao="inc-escola" data-id="${def.id}" aria-label="Adicionar ponto em ${esc(def.nome)}">+</button>
        </div>
      </div>`;
    })
    .join('');
}

function renderRecursos(): void {
  el('recursos').innerHTML = Object.values(RECURSOS)
    .map((def) => {
      const pontos = estado.personagem.recursos[def.id] ?? 0;
      return `<div class="carta">
        <div class="nome">${esc(def.nome)}</div>
        <div class="desc">${esc(def.descricao)}</div>
        <div class="controles">
          <button type="button" data-acao="dec-recurso" data-id="${def.id}" aria-label="Remover proficiência de ${esc(def.nome)}">−</button>
          <span class="valor num">${pontos}</span>
          <button type="button" data-acao="inc-recurso" data-id="${def.id}" aria-label="Adicionar proficiência em ${esc(def.nome)}">+</button>
        </div>
      </div>`;
    })
    .join('');
}

const GRUPOS_TALENTOS: { titulo: string; ids: TalentoId[] }[] = [
  { titulo: 'Gerais', ids: ['area_ampliada', 'conjuracao_rapida', 'alcance_estendido', 'canalizacao_profunda', 'economia_de_recurso', 'persistencia'] },
  { titulo: 'Entrega (exclusivos)', ids: ['impacto_imediato', 'dano_ao_longo_do_tempo'] },
  { titulo: 'Conjuração', ids: ['perfuracao', 'estilhaco', 'eco_arcano'] },
  { titulo: 'Evocação', ids: ['enxame', 'colosso', 'vinculo_marcial', 'simbiose', 'autonomia', 'comando'] },
  { titulo: 'Maldição', ids: ['contagio', 'aflicao_profunda'] },
  { titulo: 'Bênção', ids: ['egide', 'exaltacao', 'vinculo_de_grupo'] },
  { titulo: 'Combate Físico', ids: ['sequencia_marcial', 'golpe_devastador', 'postura_inabalavel'] },
  { titulo: 'Longo Alcance', ids: ['olho_de_aguia', 'rajada'] },
  { titulo: 'Recursos', ids: ['devocao', 'fluxo_constante', 'sede_de_batalha'] },
];

function requisitoTexto(def: TalentoDef): string {
  if (!def.requisito) return '';
  const { escola, recurso, nivelMinimo } = def.requisito;
  const alvo = escola ? ESCOLAS[escola].nome : RECURSOS[recurso!].nome;
  return `requer ${esc(alvo)} ${nivelMinimo}`;
}

function renderTalentos(): void {
  el('conta-talentos').textContent = `${pontosTalentosGastos()} ranks distribuídos`;
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

function renderFormSkill(prog: Progressao): void {
  const s = estado.skill;
  const disponiveis = prog.elementosDisponiveis;
  const opcoesElemento = (disponiveis.length ? disponiveis : ['fogo'])
    .map((id) => `<option value="${id}" ${id === s.elemento ? 'selected' : ''}>${esc(ELEMENTOS[id].nome)} (nv ${prog.niveisEfetivos[id] ?? 0})</option>`)
    .join('');
  const opcoesEscola = Object.values(ESCOLAS)
    .map((d) => `<option value="${d.id}" ${d.id === s.escola ? 'selected' : ''}>${esc(d.nome)} (${estado.personagem.escolas[d.id] ?? 0} pts)</option>`)
    .join('');
  const opcoesRecurso = Object.values(RECURSOS)
    .map((d) => `<option value="${d.id}" ${d.id === s.recurso ? 'selected' : ''}>${esc(d.nome)}</option>`)
    .join('');
  const capacidades = [...prog.capacidades].sort();
  const opcoesCapacidade =
    `<option value="">— nenhuma —</option>` +
    capacidades
      .map((c) => `<option value="${esc(c)}" ${c === s.capacidadeExigida ? 'selected' : ''}>${esc(c)}</option>`)
      .join('');

  el('form-skill').innerHTML = `
    <div class="linha-campo"><label for="sk-nome">Nome</label><input id="sk-nome" type="text" value="${esc(s.nome)}"><span></span></div>
    <div class="linha-campo"><label for="sk-elemento">Elemento</label><select id="sk-elemento">${opcoesElemento}</select><span></span></div>
    <div class="linha-campo"><label for="sk-escola">Escola</label><select id="sk-escola">${opcoesEscola}</select><span></span></div>
    <div class="linha-campo"><label for="sk-recurso">Recurso</label><select id="sk-recurso">${opcoesRecurso}</select><span></span></div>
    <div class="linha-campo"><label for="sk-capacidade">Capacidade</label><select id="sk-capacidade">${opcoesCapacidade}</select><span></span></div>
    <div class="linha-campo"><label for="sk-energia">Energia</label>
      <input id="sk-energia" type="range" min="1" max="120" step="1" value="${s.energia}">
      <span class="num">${s.energia}</span></div>
    <div class="linha-campo"><label for="sk-tempo">Conjuração (s)</label>
      <input id="sk-tempo" type="range" min="0.1" max="10" step="0.1" value="${s.tempoConjuracaoSegundos}">
      <span class="num">${f1(s.tempoConjuracaoSegundos)}s</span></div>
    <div class="linha-campo"><label>Área</label>
      <div class="radios">
        <label><input type="radio" name="sk-area" value="unico" ${s.area.tipo === 'unico' ? 'checked' : ''}>Alvo único</label>
        <label><input type="radio" name="sk-area" value="circulo" ${s.area.tipo === 'circulo' ? 'checked' : ''}>Círculo</label>
      </div><span></span></div>
    ${s.area.tipo === 'circulo' ? `
    <div class="linha-campo"><label for="sk-raio">Raio (m)</label>
      <input id="sk-raio" type="range" min="1" max="16" step="1" value="${s.area.raioMetros}">
      <span class="num">${s.area.raioMetros}m</span></div>` : ''}
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
      <h3>${esc(estado.skill.nome)}</h3>
      <ul class="erros">${r.erros.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
    </div>`;
    return;
  }
  const perfilLinhas = (['dano', 'controle', 'cura', 'defesa', 'suporte'] as const)
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
  alvo.innerHTML = `<div class="resultado-skill">
    <h3>${esc(estado.skill.nome)}</h3>
    <div class="resultado-corpo">
      <div class="coluna-metricas">
        <div class="metricas">
          <div class="metrica"><div class="rotulo">Custo (${esc(RECURSOS[estado.skill.recurso].nome)})</div><div class="valor num">${f1(r.custoBase)}</div></div>
          <div class="metrica"><div class="rotulo">Impacto total</div><div class="valor num">${f1(r.impactoTotal)}</div></div>
          <div class="metrica"><div class="rotulo">Por alvo (${f1(r.alvosEsperados)} alvos)</div><div class="valor num">${f1(r.impactoPorAlvo)}</div></div>
          ${r.impactoPorSegundo ? `<div class="metrica"><div class="rotulo">Por segundo</div><div class="valor num">${f1(r.impactoPorSegundo)}</div></div>` : ''}
          ${r.invocacoes ? `<div class="metrica"><div class="rotulo">Criaturas</div><div class="valor num">${r.invocacoes.quantidade} × ${f1(r.invocacoes.poderPorCriatura)}</div></div>` : ''}
          <div class="metrica"><div class="rotulo">Eficiência</div><div class="valor num">${f1(r.eficiencia)}</div></div>
        </div>
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
      .map(
        (s, i) => `<div class="item-skill">
          <span><strong>${esc(s.nome)}</strong> · ${esc(ELEMENTOS[s.elemento]?.nome ?? s.elemento)} + ${esc(ESCOLAS[s.escola].nome)} @ ${esc(RECURSOS[s.recurso].nome)}</span>
          <span><button type="button" data-acao="carregar-skill" data-idx="${i}">editar</button>
          <button type="button" data-acao="remover-skill" data-idx="${i}">remover</button></span>
        </div>`,
      )
      .join('') || '<div class="vazio">Nenhuma skill salva ainda.</div>';
}

// ------------------------------------------------------- bancada de recursos

let bancada: { chave: string; estado: EstadoRecurso; tempo: number } | null = null;

function garantirBancada(): { estado: EstadoRecurso; tempo: number } {
  const recurso = estado.skill.recurso;
  const prof = estado.personagem.recursos[recurso] ?? 0;
  const chave = `${recurso}:${prof}`;
  if (!bancada || bancada.chave !== chave) {
    bancada = { chave, estado: criarEstadoRecurso(recurso, prof), tempo: 0 };
  }
  return bancada;
}

function custoDaSkillAtual(): number {
  const prog = calcularProgressao(estado.personagem);
  return calcularSkill(estado.personagem, prog, estado.skill).custoBase;
}

function renderBancada(): void {
  const b = garantirBancada();
  const e = b.estado;
  const recurso = RECURSOS[estado.skill.recurso];
  const fracao = e.maximo > 0 ? e.atual / e.maximo : 0;
  const custo = custoDaSkillAtual();

  let extras = '';
  if (e instanceof FeEstado) {
    extras = `<div>Multiplicador de custo: <strong class="num">×${f1(e.multiplicadorAtual)}</strong>
      <span class="badge">penalidade ${f1(e.penalidade)}</span></div>`;
  } else if (e instanceof FuriaEstado) {
    extras = `<div><span class="badge ${e.emCombate ? 'on' : ''}">${e.emCombate ? 'em combate' : 'fora de combate'}</span></div>`;
  }
  const botoesCombate =
    e instanceof FuriaEstado
      ? `<button type="button" data-acao="banc-dano">Causar 30 de dano</button>
         <button type="button" data-acao="banc-recebe">Receber 20 de dano</button>`
      : '';

  el('bancada').innerHTML = `
    <div class="pool">
      <strong>${esc(recurso.nome)}</strong>
      <div class="barra"><i style="width:${pct(fracao)}"></i></div>
      <span class="num">${f1(e.atual)}/${f1(e.maximo)}</span>
    </div>
    <div>Custo efetivo da skill agora: <strong class="num">${f1(e.custoEfetivo(custo))}</strong>
      · tempo simulado: <span class="num">${f1(b.tempo)}s</span></div>
    ${extras}
    <div class="acoes-inline">
      <button type="button" data-acao="banc-usar">Usar skill</button>
      <button type="button" data-acao="banc-tick" data-dt="1">+1s</button>
      <button type="button" data-acao="banc-tick" data-dt="5">+5s</button>
      ${botoesCombate}
      <button type="button" data-acao="banc-reiniciar">Reiniciar</button>
    </div>`;
}

// ------------------------------------------------------- comparação de builds

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
    custo: r.valida ? f1(r.custoBase) : '—',
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
  const alvo = (ev.target as HTMLElement).closest<HTMLElement>('[data-acao]');
  if (!alvo) return;
  const acao = alvo.dataset.acao!;
  const id = alvo.dataset.id ?? '';
  const p = estado.personagem;
  try {
    switch (acao) {
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
        if (!b.estado.usar(custoDaSkillAtual())) toast('Recurso insuficiente para usar a skill.');
        renderBancada();
        return;
      }
      case 'banc-tick': {
        const b = garantirBancada();
        const dt = Number(alvo.dataset.dt) || 1;
        b.estado.tick(dt);
        b.tempo += dt;
        renderBancada();
        return;
      }
      case 'banc-dano': {
        const b = garantirBancada();
        if (b.estado instanceof FuriaEstado) b.estado.aoCausarDano(30);
        renderBancada();
        return;
      }
      case 'banc-recebe': {
        const b = garantirBancada();
        if (b.estado instanceof FuriaEstado) b.estado.aoReceberDano(20);
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
      default: return;
    }
    render();
  } catch (e) {
    toast((e as Error).message);
  }
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

document.addEventListener('input', (ev) => {
  const t = ev.target as HTMLInputElement;
  const s = estado.skill;
  switch (t.id) {
    case 'orc-atributos': estado.orcamentoAtributos = Number(t.value) || 0; renderCabecalho(); salvar(); return;
    case 'orc-talentos': estado.orcamentoTalentos = Number(t.value) || 0; renderCabecalho(); salvar(); return;
    case 'sk-nome': s.nome = t.value || 'Skill'; break;
    case 'sk-elemento': s.elemento = t.value; break;
    case 'sk-escola': s.escola = t.value as EscolaId; break;
    case 'sk-recurso': s.recurso = t.value as RecursoId; break;
    case 'sk-capacidade': s.capacidadeExigida = t.value || undefined; break;
    case 'sk-energia': s.energia = Number(t.value); break;
    case 'sk-tempo': s.tempoConjuracaoSegundos = Number(t.value); break;
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
      } else return;
  }
  const prog = calcularProgressao(estado.personagem);
  if (t.type === 'range') {
    // não re-renderizar durante o arraste: só atualiza o rótulo ao lado
    const rotulo = t.parentElement?.querySelector('.num');
    if (rotulo) {
      const sufixo = t.id === 'sk-tempo' ? 's' : t.id === 'sk-raio' ? 'm' : t.id === 'sk-duracao' ? 's' : '';
      rotulo.textContent = `${f1(Number(t.value))}${sufixo}`;
    }
  } else if (t.type === 'select-one' || t.type === 'radio') {
    renderFormSkill(prog);
  }
  renderResultadoSkill(prog);
  salvar();
});

el('btn-exportar').addEventListener('click', () => {
  const exportado = {
    formato: 'class-system-build',
    versao: 1,
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
      personagem: { ...base.personagem, ...dados.personagem },
      orcamentoAtributos: dados.orcamentos?.atributos ?? base.orcamentoAtributos,
      orcamentoTalentos: dados.orcamentos?.talentos ?? base.orcamentoTalentos,
      skillsSalvas: Array.isArray(dados.skills) ? dados.skills : [],
      skill: dados.skillAtual ?? base.skill,
      snapshots: Array.isArray(dados.snapshots) ? dados.snapshots : [],
    };
    (el('orc-atributos') as HTMLInputElement).value = String(estado.orcamentoAtributos);
    (el('orc-talentos') as HTMLInputElement).value = String(estado.orcamentoTalentos);
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
  localStorage.removeItem(CHAVE_STORAGE);
  (el('orc-atributos') as HTMLInputElement).value = String(estado.orcamentoAtributos);
  (el('orc-talentos') as HTMLInputElement).value = String(estado.orcamentoTalentos);
  render();
  toast('Build resetada.');
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
