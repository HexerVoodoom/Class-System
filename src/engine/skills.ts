/**
 * Construtor + calculadora de skills.
 *
 * O jogador monta a skill escolhendo: elemento, escola, FONTES DE ENERGIA
 * (uma ou mais, em proporções livres), energia investida, tempo de
 * conjuração, alcance, área e forma de entrega. O motor valida contra a
 * progressão e calcula custo e impacto em tempo real.
 *
 * FONTES DE ENERGIA — uma skill pode misturar recursos (ex.: 60% mana +
 * 40% fúria), desde que o personagem tenha proficiência (pontos) em cada
 * fonte usada. A proficiência ponderada pelas proporções escala tudo:
 *   - custo menor (−1%/ponto, até −30%);
 *   - impacto maior (+0.8%/ponto);
 *   - tempo mínimo de conjuração menor (−0.01s/ponto).
 *
 * BALANCEAMENTO — a regra central é um orçamento único de poder:
 *
 *   orcamento = energia × multTempo × multNivel × multFoco × multFontes
 *
 * Toda escolha de forma (área, entrega, invocações) apenas REDISTRIBUI esse
 * orçamento, nunca o multiplica de graça. Área maior = menos dano por alvo;
 * mais criaturas = criaturas mais fracas; DoT = mais total, porém diluído no
 * tempo. Assim, builds diferentes com o mesmo investimento têm impacto
 * mecânico similar.
 */

import { type ElementoBaseId, type ElementoId, type PerfilPesos } from '../registry/elementos';
import {
  ARIDADE_MAXIMA,
  aridadeDe,
  baseDominanteDe,
  efetividadeDe,
  elementoDef,
} from '../registry/combinacoes';
import { ESCOLAS, type EscolaId } from '../registry/escolas';
import type {
  AreaConfig,
  EntregaConfig,
  EvocacaoSkill,
  FonteEnergia,
  SkillConfig,
} from '../registry/formatos';
import { RECURSOS, type RecursoId } from '../registry/recursos';
import { TALENTOS, type EfeitoTalento, type TalentoId } from '../registry/talentos';
import { CRIATURAS } from '../registry/criaturas';
import { rotuloEfetividade } from '../registry/afinidades';
import {
  MODIFICADORES,
  ROTULO_TAG,
  type ModificadorId,
  type TagSkill,
} from '../registry/modificadores';
import {
  ESTADOS,
  ESTADOS_POR_ELEMENTO,
  ESTADOS_POR_ESCOLA,
  type EstadoId,
} from '../registry/estados';
import { avaliarMontaria, bonusMontaria, bonusVinculo, MAESTRIA_LIMIAR, type ModoEvocacao } from './evocacao';
import type { Personagem } from './personagem';
import { PENALIDADE_CAPACIDADE_DILUIDA, type Progressao } from './progressao';

/**
 * As formas de configuração moram em `registry/formatos.ts` — descrever uma
 * skill é vocabulário de conteúdo, não de cálculo. Reexportadas aqui para
 * quem já importava daqui não precisar mudar nada.
 */
export type {
  AreaConfig,
  EntregaConfig,
  EvocacaoSkill,
  FonteEnergia,
  SkillConfig,
} from '../registry/formatos';

export interface LimitesSkill {
  energiaMaxima: number;
  tempoConjuracaoMinimo: number;
  raioMaximo: number;
  alcanceMaximo: number;
}

export interface ResultadoSkill {
  valida: boolean;
  erros: string[];
  limites: LimitesSkill;
  /** Custo total (antes das dinâmicas de fé/ressonância em tempo real). */
  custoTotal: number;
  /** Quanto do custo cada fonte paga, na proporção escolhida. */
  custoPorFonte: { recurso: RecursoId; custo: number }[];
  /** Proficiência ponderada pelas proporções das fontes. */
  proficienciaPonderada: number;
  orcamentoDePoder: number;
  alvosEsperados: number;
  /** Impacto total esperado somando todos os alvos/duração. */
  impactoTotal: number;
  impactoPorAlvo: number;
  /** Presente quando entrega é contínua. */
  impactoPorSegundo?: number;
  /** Presente quando a escola é evocação. */
  invocacoes?: {
    quantidade: number;
    poderPorCriatura: number;
    poderTotal: number;
    nome: string;
    familia?: string;
    imbuida: boolean;
  };
  /** Presente quando a skill é lançada montado numa fera. */
  montaria?: { nome: string; bonus: number };
  /** Estados/condições que a skill pode infligir (elemento + escola). */
  estados: { id: EstadoId; nome: string; tipo: string }[];
  /** Efetividade contra o alvo, quando um alvo elemental foi informado. */
  efetividade?: { alvo: ElementoBaseId; multiplicador: number; rotulo: string; impacto: number };
  /**
   * Como o impacto se distribui mecanicamente — média dos perfis do
   * elemento e da escola aplicada ao impacto total.
   */
  perfil: PerfilPesos;
  /** Propriedades qualitativas vindas de talentos (penetração, contágio...). */
  propriedades: { chave: string; rotulo: string; valor: number }[];
  /** Métrica de balanceamento: impacto total ÷ energia investida. */
  eficiencia: number;
  /** Tags que esta skill exibe — o contrato de compatibilidade legível. */
  tags: TagSkill[];
  /** Modificadores efetivamente aplicados, com o custo que cada um cobrou. */
  modificadoresAplicados: { id: ModificadorId; nome: string; multiplicadorCusto: number }[];
  /** Produto dos multiplicadores de poder dos modificadores (após o teto). */
  multModificadores: number;
  /** true quando o teto anti-composição mordeu o produto de multiplicadores. */
  tetoModificadoresAtingido: boolean;
}

// ---- constantes de balanceamento (ajuste fino em um lugar só) ----
const ENERGIA_MAX_BASE = 40;
const ENERGIA_MAX_POR_NIVEL_ESCOLA = 2;
const TEMPO_MINIMO_BASE = 0.5;
const TEMPO_MINIMO_PISO = 0.1;
const RAIO_MAXIMO_BASE = 4;
const ALCANCE_MAXIMO_BASE = 20;
const CUSTO_EXTRA_POR_METRO_ALCANCE = 0.005;
const DENSIDADE_ALVOS_POR_M2 = 0.15;
const EFICIENCIA_AREA = 0.9; // leve taxa por espalhar o orçamento
const BONUS_POR_NIVEL_ELEMENTO = 0.04;
/**
 * COMPENSAÇÃO DE ARIDADE — um derivado de N componentes no nível L custou
 * N×L pontos, mas rende como se fosse um elemento no nível L. Sem correção,
 * especializar num único elemento domina qualquer combinação, e as triplas e
 * quádruplas viram conteúdo decorativo.
 *
 * Cada nível de um derivado vale por N níveis parciais:
 *
 *   bônus por nível = 0.04 × (1 + 0.30 × (N − 1))
 *
 * A compensação é deliberadamente PARCIAL (~0.30 e não 1.0): combinar já
 * paga em largura — mais elementos disponíveis, mais arquétipos, mais fusões.
 * Com 0.30, uma quádrupla entrega ~95% do poder bruto da especialização pura
 * pelo mesmo investimento, e compra a largura com os 5% restantes.
 *
 * A compensação SATURA em `ARIDADE_MAXIMA`. Ela foi calibrada contra pares,
 * triplas e quádruplas, que é onde o jogador constrói; extrapolá-la linearmente
 * quebra nas receitas amplas escritas à mão. Medido no Nulo (17 componentes,
 * nível 8): sem o teto, o bônus por nível ia a 0.232, o multiplicador de nível
 * a 4.0, e a skill entregava ~2× a eficiência de qualquer preset de mesmo tempo
 * de conjuração — com o MENOR nível efetivo da lista. Largura não pode comprar
 * altura, que é a regra que o sistema inteiro sustenta.
 */
const FRACAO_BONUS_ARIDADE = 0.3;
const BONUS_POR_NIVEL_ESCOLA = 0.03;
const BONUS_TOTAL_DOT_MAXIMO = 0.3;
const EXPOENTE_DIVISAO_ENXAME = 0.9;
// escala por proficiência na fonte de energia
const REDUCAO_CUSTO_POR_PROFICIENCIA = 0.01;
const REDUCAO_CUSTO_MAXIMA = 0.3;
const BONUS_IMPACTO_POR_PROFICIENCIA = 0.008;
const REDUCAO_TEMPO_POR_PROFICIENCIA = 0.01;
// tempo: skills de elemento temporal aceleram a conjuração (pressa)
const BONUS_PRESSA_POR_NIVEL = 0.012;
const BONUS_PRESSA_TETO = 0.35;
// evocação: fator da fonte sobre o poder da invocação
const FONTE_ALEATORIA_FATOR = 0.9;
const RAREZA_TETO = 0.4; // bônus máx. de raridade da criatura capturada
const RAREZA_DIVISOR = 250; // poderBase/divisor → bônus de raridade
/**
 * TETO ANTI-COMPOSIÇÃO. A fórmula do orçamento já é um produto de oito
 * multiplicadores; empilhar modificadores multiplicativos por cima, sem teto,
 * reproduz o modo de falha clássico dos sistemas de composição livre — existe
 * sempre um encadeamento que quebra a economia. O produto dos modificadores
 * é grampeado aqui, e o resultado avisa quando o teto mordeu.
 */
export const TETO_MULT_MODIFICADORES = 2.2;
/**
 * TETO DE EFICIÊNCIA DOS MODIFICADORES.
 *
 * O teto absoluto acima grampeia só o produto dos multiplicadores de PODER, e
 * isso deixava duas frestas por onde a composição escapava:
 *
 *  1. `tempo_fracao` alimenta √tempo no orçamento e fica FORA do produto
 *     grampeado — alongar a conjuração comprava poder de graça;
 *  2. um modificador de poder NEGATIVO (Contenção Disciplinada) abaixava o
 *     produto grampeado e liberava espaço sob o teto para os positivos.
 *
 * Medido, o encadeamento Repetição Ecoada + Canalização Arriscada + Sangria
 * Arcana + Contenção Disciplinada rendia 2.26× a eficiência da skill nua, e o
 * aviso de teto nem disparava.
 *
 * A correção é a mesma que já resolveu a fusão: amarrar o teto na EFICIÊNCIA
 * relativa (impacto ÷ custo, contra a mesma skill sem modificadores), o que
 * captura tempo e custo junto com o poder. O valor 1.4 preserva a troca
 * honesta de Contenção Disciplinada (1.29) e mata o encadeamento degenerado.
 */
export const TETO_EFICIENCIA_MODIFICADORES = 1.4;
/** Slots de modificador; cada rank de Engenho de Skill abre mais um. */
export const SLOTS_MODIFICADOR_BASE = 2;

function somaEfeitos(
  p: Personagem,
  filtro: (e: EfeitoTalento, ranks: number) => number,
): number {
  let total = 0;
  for (const [id, ranks] of Object.entries(p.talentos) as [TalentoId, number][]) {
    if (!ranks) continue;
    for (const efeito of TALENTOS[id].efeitos) total += filtro(efeito, ranks);
  }
  return total;
}

/** Filtra proporções > 0, funde duplicatas e normaliza para somar 1. */
export function normalizarFontes(fontes: FonteEnergia[]): FonteEnergia[] {
  const porRecurso = new Map<RecursoId, number>();
  for (const f of fontes) {
    if (f.proporcao > 0) porRecurso.set(f.recurso, (porRecurso.get(f.recurso) ?? 0) + f.proporcao);
  }
  const soma = [...porRecurso.values()].reduce((a, b) => a + b, 0);
  if (soma <= 0) return [];
  return [...porRecurso.entries()].map(([recurso, proporcao]) => ({
    recurso,
    proporcao: proporcao / soma,
  }));
}

/** Proficiência do personagem ponderada pelas proporções das fontes. */
export function proficienciaPonderada(p: Personagem, fontes: FonteEnergia[]): number {
  const norm = normalizarFontes(fontes);
  return norm.reduce((s, f) => s + f.proporcao * (p.recursos[f.recurso] ?? 0), 0);
}

export function calcularLimites(
  p: Personagem,
  escola: EscolaId,
  fontes: FonteEnergia[] = [],
): LimitesSkill {
  const nivelEscola = p.escolas[escola] ?? 0;
  const bonusEnergia = somaEfeitos(p, (e, r) =>
    e.tipo === 'energia_maxima_bonus_fracao' ? e.valorPorRank * r : 0,
  );
  const reducaoTempo = somaEfeitos(p, (e, r) =>
    e.tipo === 'tempo_conjuracao_minimo_reducao' ? e.valorPorRank * r : 0,
  );
  const bonusRaio = somaEfeitos(p, (e, r) =>
    e.tipo === 'raio_maximo_bonus' ? e.valorPorRank * r : 0,
  );
  const bonusAlcance = somaEfeitos(p, (e, r) =>
    e.tipo === 'alcance_bonus_metros' ? e.valorPorRank * r : 0,
  );
  const prof = proficienciaPonderada(p, fontes);
  return {
    energiaMaxima:
      (ENERGIA_MAX_BASE + ENERGIA_MAX_POR_NIVEL_ESCOLA * nivelEscola) * (1 + bonusEnergia),
    tempoConjuracaoMinimo: Math.max(
      TEMPO_MINIMO_PISO,
      TEMPO_MINIMO_BASE - reducaoTempo - REDUCAO_TEMPO_POR_PROFICIENCIA * prof,
    ),
    raioMaximo: RAIO_MAXIMO_BASE + bonusRaio,
    alcanceMaximo: ALCANCE_MAXIMO_BASE + bonusAlcance,
  };
}


/**
 * Tags que uma skill exibe, derivadas da configuração. É o contrato legível
 * de compatibilidade com os modificadores — a regra dura é `exigeTags`.
 */
export function tagsDaSkill(cfg: SkillConfig): TagSkill[] {
  const escola = ESCOLAS[cfg.escola];
  const tags = new Set<TagSkill>();
  tags.add(escola.tipo === 'marcial' ? 'marcial' : 'magica');
  tags.add(cfg.entrega.tipo === 'continuo' ? 'continuo' : 'instantaneo');
  tags.add(cfg.area.tipo === 'circulo' ? 'area' : 'unico');
  if (escola.entregaPadrao === 'invocacao') tags.add('invocacao');
  else if (escola.entregaPadrao === 'efeito') tags.add('efeito');
  else tags.add('dano');
  // projétil: dano lançado à distância, seja flecha ou bola de fogo
  if (escola.entregaPadrao === 'dano' && cfg.alcanceMetros > 0) tags.add('projetil');
  if (baseDominanteDe(cfg.elemento) === 'tempo') tags.add('temporal');
  if ((elementoDef(cfg.elemento)?.receita?.length ?? 0) > 0) tags.add('derivado');
  return [...tags];
}

/** Slots de modificador disponíveis, considerando talentos. */
export function slotsModificador(p: Personagem): number {
  const extra = somaEfeitos(p, (e, r) =>
    e.tipo === 'propriedade' && e.chave === 'slots_modificador' ? e.valorPorRank * r : 0,
  );
  return SLOTS_MODIFICADOR_BASE + Math.floor(extra);
}

export interface AvaliacaoModificador {
  id: ModificadorId;
  compativel: boolean;
  motivo?: string;
}

/** Por que um modificador entra (ou não) numa skill — alimenta a UI. */
export function avaliarModificador(
  p: Personagem,
  cfg: SkillConfig,
  id: ModificadorId,
  tags = tagsDaSkill(cfg),
): AvaliacaoModificador {
  const def = MODIFICADORES[id];
  if (!def) return { id, compativel: false, motivo: 'Modificador desconhecido.' };
  const faltando = def.exigeTags.filter((t) => !tags.includes(t));
  if (faltando.length) {
    return {
      id,
      compativel: false,
      motivo: `Exige skill com ${faltando.map((t) => ROTULO_TAG[t]).join(' + ')}.`,
    };
  }
  const proibida = (def.proibeTags ?? []).find((t) => tags.includes(t));
  if (proibida) {
    return { id, compativel: false, motivo: `Incompatível com skills de ${ROTULO_TAG[proibida]}.` };
  }
  const req = def.requisito;
  if (req?.escola && (p.escolas[req.escola] ?? 0) < (req.nivelMinimo ?? 0)) {
    return {
      id,
      compativel: false,
      motivo: `Exige ${req.nivelMinimo} em ${ESCOLAS[req.escola].nome}.`,
    };
  }
  if (req?.talento && !(p.talentos[req.talento] ?? 0)) {
    return { id, compativel: false, motivo: `Exige o talento ${TALENTOS[req.talento].nome}.` };
  }
  return { id, compativel: true };
}

interface EfeitoAgregado {
  multMais: number;
  aumentado: number;
  raioBonus: number;
  alvosMult: number;
  tempoFracao: number;
  duracaoMult: number;
  invocacoesMult: number;
  multCusto: number;
  tetoAtingido: boolean;
  aplicados: { id: ModificadorId; nome: string; multiplicadorCusto: number }[];
  propriedades: { chave: string; rotulo: string; valor: number }[];
}

function agregarModificadores(
  p: Personagem,
  cfg: SkillConfig,
  tags: TagSkill[],
): EfeitoAgregado {
  const ag: EfeitoAgregado = {
    multMais: 1, aumentado: 0, raioBonus: 0, alvosMult: 1, tempoFracao: 0,
    duracaoMult: 1, invocacoesMult: 1, multCusto: 1, tetoAtingido: false,
    aplicados: [], propriedades: [],
  };
  const vistos = new Set<ModificadorId>();
  for (const id of cfg.modificadores ?? []) {
    if (vistos.has(id)) continue; // o mesmo modificador não empilha consigo
    if (!avaliarModificador(p, cfg, id, tags).compativel) continue;
    vistos.add(id);
    const def = MODIFICADORES[id];
    ag.multCusto *= def.multiplicadorCusto;
    ag.aplicados.push({ id, nome: def.nome, multiplicadorCusto: def.multiplicadorCusto });
    for (const ef of def.efeitos) {
      switch (ef.tipo) {
        case 'poder_mais': ag.multMais *= 1 + ef.valor; break;
        case 'poder_aumentado': ag.aumentado += ef.valor; break;
        case 'raio_bonus': ag.raioBonus += ef.valor; break;
        case 'alvos_mult': ag.alvosMult *= ef.valor; break;
        case 'tempo_fracao': ag.tempoFracao += ef.valor; break;
        case 'duracao_mult': ag.duracaoMult *= ef.valor; break;
        case 'invocacoes_mult': ag.invocacoesMult *= ef.valor; break;
        case 'propriedade':
          ag.propriedades.push({ chave: ef.chave, rotulo: ef.rotulo, valor: ef.valor });
          break;
      }
    }
  }
  const bruto = ag.multMais * (1 + ag.aumentado);
  if (bruto > TETO_MULT_MODIFICADORES) {
    ag.tetoAtingido = true;
    ag.multMais = TETO_MULT_MODIFICADORES;
    ag.aumentado = 0;
  }
  return ag;
}

export function validarSkill(
  p: Personagem,
  prog: Progressao,
  cfg: SkillConfig,
): { erros: string[]; limites: LimitesSkill } {
  const erros: string[] = [];
  const limites = calcularLimites(p, cfg.escola, cfg.fontes);

  if ((prog.niveisEfetivos[cfg.elemento] ?? 0) <= 0) {
    erros.push(
      `Elemento "${elementoDef(cfg.elemento)?.nome ?? cfg.elemento}" ainda não foi liberado.`,
    );
  }
  if ((p.escolas[cfg.escola] ?? 0) <= 0) {
    erros.push(`Sem pontos na escola "${ESCOLAS[cfg.escola].nome}".`);
  }

  const fontesAtivas = normalizarFontes(cfg.fontes);
  if (fontesAtivas.length === 0) {
    erros.push('A skill precisa de pelo menos uma fonte de energia com proporção maior que zero.');
  }
  for (const f of fontesAtivas) {
    if ((p.recursos[f.recurso] ?? 0) <= 0) {
      erros.push(
        `Sem proficiência em ${RECURSOS[f.recurso].nome} — invista pontos nesse recurso para usá-lo como fonte.`,
      );
    }
  }

  if (cfg.energia <= 0) erros.push('Energia deve ser positiva.');
  if (cfg.energia > limites.energiaMaxima) {
    erros.push(
      `Energia ${cfg.energia} acima do máximo ${limites.energiaMaxima.toFixed(1)} ` +
        `(suba a escola ou o talento Canalização Profunda).`,
    );
  }
  if (cfg.tempoConjuracaoSegundos < limites.tempoConjuracaoMinimo) {
    erros.push(
      `Tempo de conjuração mínimo é ${limites.tempoConjuracaoMinimo.toFixed(2)}s ` +
        `(talento Conjuração Rápida e proficiência nas fontes reduzem).`,
    );
  }
  if (cfg.alcanceMetros < 0) erros.push('Alcance não pode ser negativo.');
  if (cfg.alcanceMetros > limites.alcanceMaximo) {
    erros.push(
      `Alcance ${cfg.alcanceMetros}m acima do máximo ${limites.alcanceMaximo}m ` +
        `(talento Alcance Estendido aumenta).`,
    );
  }
  if (cfg.area.tipo === 'circulo') {
    if (cfg.area.raioMetros <= 0) erros.push('Raio deve ser positivo.');
    if (cfg.area.raioMetros > limites.raioMaximo) {
      erros.push(
        `Raio ${cfg.area.raioMetros}m acima do máximo ${limites.raioMaximo}m ` +
          `(talento Área Ampliada aumenta).`,
      );
    }
  }
  if (cfg.entrega.tipo === 'continuo' && cfg.entrega.duracaoSegundos <= 0) {
    erros.push('Duração do efeito contínuo deve ser positiva.');
  }
  if (
    cfg.capacidadeExigida &&
    !prog.capacidades.has(cfg.capacidadeExigida) &&
    !prog.capacidadesDiluidas.has(cfg.capacidadeExigida)
  ) {
    erros.push(
      `Exige a capacidade "${cfg.capacidadeExigida}" — desbloqueie o arquétipo correspondente ` +
        `ou uma combinação ampla que o contenha.`,
    );
  }
  // fonte da evocação (só em escola de invocação)
  if (ESCOLAS[cfg.escola].entregaPadrao === 'invocacao' && cfg.evocacao?.modo === 'capturada') {
    const cri = cfg.evocacao.criaturaId ? CRIATURAS[cfg.evocacao.criaturaId] : undefined;
    if (!cri) {
      erros.push('Selecione uma criatura capturada para a evocação.');
    } else if (!p.bestiario.some((b) => b.criaturaId === cri.id)) {
      erros.push(`"${cri.nome}" não está no seu bestiário — capture-a antes de evocá-la.`);
    }
  }
  // modificadores de 2ª geração: slots e compatibilidade
  const modsPedidos = [...new Set(cfg.modificadores ?? [])];
  const slots = slotsModificador(p);
  if (modsPedidos.length > slots) {
    erros.push(
      `${modsPedidos.length} modificadores para ${slots} slots ` +
        `(o talento Engenho de Skill abre mais).`,
    );
  }
  const tagsCfg = tagsDaSkill(cfg);
  for (const id of modsPedidos) {
    const av = avaliarModificador(p, cfg, id, tagsCfg);
    if (!av.compativel) {
      erros.push(`Modificador "${MODIFICADORES[id]?.nome ?? id}": ${av.motivo}`);
    }
  }
  // montaria: a fera-veículo precisa ser montável
  if (cfg.montariaId) {
    const av = avaliarMontaria(p, cfg.montariaId);
    if (!av.montavel) {
      const nome = CRIATURAS[cfg.montariaId]?.nome ?? cfg.montariaId;
      erros.push(`Não é possível lançar montado em "${nome}": ${av.motivo}`);
    }
  }
  return { erros, limites };
}

export function calcularSkill(
  p: Personagem,
  prog: Progressao,
  cfg: SkillConfig,
): ResultadoSkill {
  const { erros, limites } = validarSkill(p, prog, cfg);

  const nivelElemento = prog.niveisEfetivos[cfg.elemento] ?? 0;
  const defElemento = elementoDef(cfg.elemento);
  const aridadeElemento = aridadeDe(cfg.elemento);
  const nivelEscola = p.escolas[cfg.escola] ?? 0;
  const fatorPotencia = defElemento?.fatorPotencia ?? 1;

  const fontes = normalizarFontes(cfg.fontes);
  const prof = proficienciaPonderada(p, cfg.fontes);

  // custo: energia − reduções de talento − proficiência + taxa de alcance
  const reducaoTalento = somaEfeitos(p, (e, r) =>
    e.tipo === 'custo_reducao_fracao' ? e.valorPorRank * r : 0,
  );
  const reducaoProf = Math.min(REDUCAO_CUSTO_MAXIMA, REDUCAO_CUSTO_POR_PROFICIENCIA * prof);
  const tags = tagsDaSkill(cfg);
  const mods = agregarModificadores(p, cfg, tags);
  // o custo dos modificadores é MULTIPLICATIVO — é ele que impede empilhar tudo
  const custoTotal =
    cfg.energia *
    Math.max(0.5, 1 - reducaoTalento) *
    (1 - reducaoProf) *
    (1 + CUSTO_EXTRA_POR_METRO_ALCANCE * cfg.alcanceMetros) *
    mods.multCusto;
  const custoPorFonte = fontes.map((f) => ({
    recurso: f.recurso,
    custo: custoTotal * f.proporcao,
  }));

  // orçamento único de poder
  const tempoSemMods = Math.max(cfg.tempoConjuracaoSegundos, limites.tempoConjuracaoMinimo);
  const tempo = Math.max(
    cfg.tempoConjuracaoSegundos * (1 + mods.tempoFracao),
    limites.tempoConjuracaoMinimo,
  );
  // o ganho de eficiência que os modificadores produzem, contando TUDO:
  // poder, o √tempo que a conjuração alongada compra, e o custo composto
  const fatorTempoMods = tempoSemMods > 0 ? Math.sqrt(tempo / tempoSemMods) : 1;
  const ganhoEficienciaMods =
    (mods.multMais * (1 + mods.aumentado) * fatorTempoMods) / (mods.multCusto || 1);
  if (mods.aplicados.length && ganhoEficienciaMods > TETO_EFICIENCIA_MODIFICADORES) {
    mods.multMais *= TETO_EFICIENCIA_MODIFICADORES / ganhoEficienciaMods;
    mods.tetoAtingido = true;
  }
  const multTempo = Math.sqrt(tempo); // 1s = 1.0; 4s = 2.0
  // cada nível de um derivado de N componentes representa N elementos no
  // mesmo patamar — o bônus por nível escala com a aridade para compensar,
  // saturando na aridade máxima construível (ver a nota em FRACAO_BONUS_ARIDADE)
  const aridadeCompensada = Math.min(aridadeElemento, ARIDADE_MAXIMA);
  const bonusPorNivelElemento =
    BONUS_POR_NIVEL_ELEMENTO * (1 + FRACAO_BONUS_ARIDADE * (aridadeCompensada - 1));
  const multNivel =
    fatorPotencia *
    (1 + bonusPorNivelElemento * nivelElemento) *
    (1 + BONUS_POR_NIVEL_ESCOLA * nivelEscola);
  const bonusFoco = somaEfeitos(p, (e, r) =>
    e.tipo === 'foco_entrega' && e.entrega === cfg.entrega.tipo
      ? e.bonusFracaoPorRank * r
      : 0,
  );
  // fontes "caras" (soullink paga em vida) amplificam o poder, na proporção
  const multFontes = fontes.length
    ? fontes.reduce(
        (s, f) => s + f.proporcao * (RECURSOS[f.recurso].parametros.multiplicadorPoder ?? 1),
        0,
      )
    : 1;
  const multProficiencia = 1 + BONUS_IMPACTO_POR_PROFICIENCIA * prof;
  // pressa do Cronomante: elementos temporais aceleram a conjuração,
  // rendendo mais poder por segundo de cast (escala com o nível do elemento)
  const ehTemporal = baseDominanteDe(cfg.elemento) === 'tempo';
  const multPressa = ehTemporal
    ? 1 + Math.min(BONUS_PRESSA_TETO, BONUS_PRESSA_POR_NIVEL * nivelElemento)
    : 1;
  const orcamento =
    cfg.energia *
    multTempo *
    multNivel *
    (1 + bonusFoco) *
    multFontes *
    multProficiencia *
    multPressa *
    mods.multMais *
    (1 + mods.aumentado);

  // área: espalhar o orçamento entre alvos esperados
  const raioEfetivo =
    cfg.area.tipo === 'circulo' ? Math.max(0.5, cfg.area.raioMetros + mods.raioBonus) : 0;
  const alvosEsperados =
    (cfg.area.tipo === 'unico'
      ? 1
      : Math.max(1, 1 + DENSIDADE_ALVOS_POR_M2 * Math.PI * raioEfetivo ** 2)) * mods.alvosMult;
  const eficienciaArea = cfg.area.tipo === 'unico' ? 1 : EFICIENCIA_AREA;

  // entrega: DoT rende um pouco mais no total, mas diluído na duração
  let impactoTotal = orcamento * eficienciaArea;
  let impactoPorSegundo: number | undefined;
  if (cfg.entrega.tipo === 'continuo') {
    const duracao = cfg.entrega.duracaoSegundos * mods.duracaoMult;
    const bonusDot = Math.min(BONUS_TOTAL_DOT_MAXIMO, 0.02 * duracao);
    impactoTotal *= 1 + bonusDot;
    impactoPorSegundo = impactoTotal / duracao;
  }

  // meia-identidade: a capacidade veio de uma combinação ampla, não do
  // arquétipo pleno — funciona, mas rende menos
  const capacidadeDiluida = Boolean(
    cfg.capacidadeExigida &&
      !prog.capacidades.has(cfg.capacidadeExigida) &&
      prog.capacidadesDiluidas.has(cfg.capacidadeExigida),
  );
  if (capacidadeDiluida) {
    impactoTotal *= 1 - PENALIDADE_CAPACIDADE_DILUIDA;
    if (impactoPorSegundo) impactoPorSegundo *= 1 - PENALIDADE_CAPACIDADE_DILUIDA;
  }

  // montaria: lançar a skill cavalgando uma fera amplifica o resultado
  let montaria: ResultadoSkill['montaria'];
  if (cfg.montariaId && avaliarMontaria(p, cfg.montariaId).montavel) {
    const bonus = bonusMontaria(p, cfg.montariaId);
    impactoTotal *= 1 + bonus;
    if (impactoPorSegundo) impactoPorSegundo *= 1 + bonus;
    montaria = { nome: CRIATURAS[cfg.montariaId].nome, bonus };
  }

  const impactoPorAlvo = impactoTotal / alvosEsperados;

  // evocação: orçamento vira criaturas
  let invocacoes: ResultadoSkill['invocacoes'];
  if (ESCOLAS[cfg.escola].entregaPadrao === 'invocacao') {
    const quantidadeBonus = somaEfeitos(p, (e, r) =>
      e.tipo === 'invocacao_quantidade_bonus' ? e.valorPorRank * r : 0,
    );
    const potenciaBonus = somaEfeitos(p, (e, r) =>
      e.tipo === 'invocacao_potencia_bonus_fracao' ? e.valorPorRank * r : 0,
    );
    const quantidade = Math.max(
      1,
      Math.round((1 + Math.floor(quantidadeBonus)) * mods.invocacoesMult),
    );

    // fonte da evocação: define quem é invocado e um fator sobre o poder
    const modo = cfg.evocacao?.modo ?? 'elemental';
    const nomeElemento = defElemento?.nome ?? cfg.elemento;
    let fatorFonte = 1;
    let nomeCriatura = `Elemental de ${nomeElemento}`;
    let familia: string | undefined = 'elemental';
    let imbuida = false;
    if (modo === 'aleatoria') {
      fatorFonte = FONTE_ALEATORIA_FATOR;
      nomeCriatura = 'Criatura Aleatória';
      familia = 'aleatoria';
    } else if (modo === 'capturada' && cfg.evocacao?.criaturaId) {
      const cri = CRIATURAS[cfg.evocacao.criaturaId];
      const bond = p.bestiario.find((b) => b.criaturaId === cri?.id)?.nivelVinculo ?? 0;
      if (cri) {
        const rareza = Math.min(RAREZA_TETO, cri.poderBase / RAREZA_DIVISOR);
        fatorFonte = 1 + rareza + bonusVinculo(p, bond);
        // imbuída pelo elemento da skill quando há maestria naquele elemento
        imbuida = nivelElemento >= MAESTRIA_LIMIAR;
        nomeCriatura = imbuida ? `${cri.nome} de ${nomeElemento}` : cri.nome;
        familia = cri.familia;
      }
    }

    const poderTotal = impactoTotal * (1 + potenciaBonus) * fatorFonte;
    const poderPorCriatura = poderTotal / quantidade ** EXPOENTE_DIVISAO_ENXAME;
    invocacoes = {
      quantidade,
      poderPorCriatura,
      poderTotal: poderPorCriatura * quantidade ** EXPOENTE_DIVISAO_ENXAME,
      nome: nomeCriatura,
      familia,
      imbuida,
    };
  }

  // perfil mecânico: média dos pesos do elemento e da escola × impacto
  const pesosElemento = defElemento?.pesos ?? {
    dano: 1,
    controle: 0,
    cura: 0,
    defesa: 0,
    suporte: 0,
  };
  const pesosEscola = ESCOLAS[cfg.escola].pesos;
  const perfil = {} as PerfilPesos;
  for (const k of ['dano', 'controle', 'cura', 'defesa', 'suporte'] as const) {
    perfil[k] = ((pesosElemento[k] + pesosEscola[k]) / 2) * impactoTotal;
  }

  // propriedades qualitativas de talentos (gerais ou da escola da skill)
  const propriedades: ResultadoSkill['propriedades'] = [];
  for (const [id, ranks] of Object.entries(p.talentos) as [TalentoId, number][]) {
    if (!ranks) continue;
    for (const efeito of TALENTOS[id].efeitos) {
      if (efeito.tipo !== 'propriedade') continue;
      if (efeito.escola && efeito.escola !== cfg.escola) continue;
      propriedades.push({
        chave: efeito.chave,
        rotulo: efeito.rotulo,
        valor: efeito.valorPorRank * ranks,
      });
    }
  }

  // notas da dinâmica das fontes escolhidas
  for (const f of fontes) {
    const par = RECURSOS[f.recurso].parametros;
    if (f.recurso === 'soullink') {
      propriedades.push({
        chave: 'custo_em_vida',
        rotulo: `${Math.round(f.proporcao * 100)}% do custo pago com a própria vida (poder amplificado)`,
        valor: (par.multiplicadorPoder ?? 1) - 1,
      });
    }
    if (f.recurso === 'ressonancia') {
      propriedades.push({
        chave: 'ressonancia_maxima',
        rotulo: 'Poder extra com ressonância no máximo',
        valor: (par.multiplicadorPoderMaximo ?? 1) - 1,
      });
    }
  }
  if (prof > 0) {
    propriedades.push({
      chave: 'proficiencia_fontes',
      rotulo: `Proficiência ponderada ${prof.toFixed(1)}: custo −${Math.round(reducaoProf * 100)}%, impacto +${Math.round((multProficiencia - 1) * 100)}%`,
      valor: prof,
    });
  }
  if (capacidadeDiluida) {
    propriedades.push({
      chave: 'capacidade_diluida',
      rotulo:
        `Meia-identidade: "${cfg.capacidadeExigida}" vem de uma combinação ampla, ` +
        `não do arquétipo pleno — impacto −${Math.round(PENALIDADE_CAPACIDADE_DILUIDA * 100)}%`,
      valor: -PENALIDADE_CAPACIDADE_DILUIDA,
    });
  }
  for (const pr of mods.propriedades) propriedades.push(pr);
  if (mods.aplicados.length) {
    propriedades.push({
      chave: 'custo_modificadores',
      rotulo:
        `${mods.aplicados.length} modificador(es): custo ×${mods.multCusto.toFixed(2)}` +
        (mods.tetoAtingido ? ' — TETO de composição atingido' : ''),
      valor: mods.multCusto,
    });
  }
  if (ehTemporal && multPressa > 1) {
    propriedades.push({
      chave: 'pressa',
      rotulo: 'Pressa (Cronomante): conjuração acelerada',
      valor: multPressa - 1,
    });
  }

  // estados/condições que a skill pode infligir (elemento + escola), sem repetir
  const baseElem = baseDominanteDe(cfg.elemento);
  const estadoIds = new Set<EstadoId>([
    ...(ESTADOS_POR_ELEMENTO[baseElem] ?? []),
    ...(ESTADOS_POR_ESCOLA[cfg.escola] ?? []),
  ]);
  const estados = [...estadoIds].map((id) => ({
    id,
    nome: ESTADOS[id].nome,
    tipo: ESTADOS[id].tipo,
  }));

  // efetividade contra a afinidade do alvo (não altera o impacto base;
  // preserva o invariante de balanceamento e apenas informa o "vs alvo")
  let efet: ResultadoSkill['efetividade'];
  if (cfg.alvoElemento) {
    const mult = efetividadeDe(cfg.elemento, cfg.alvoElemento);
    efet = {
      alvo: cfg.alvoElemento,
      multiplicador: mult,
      rotulo: rotuloEfetividade(mult),
      impacto: impactoTotal * mult,
    };
  }

  return {
    valida: erros.length === 0,
    erros,
    limites,
    custoTotal,
    custoPorFonte,
    proficienciaPonderada: prof,
    orcamentoDePoder: orcamento,
    alvosEsperados,
    impactoTotal,
    impactoPorAlvo,
    impactoPorSegundo,
    invocacoes,
    montaria,
    estados,
    efetividade: efet,
    perfil,
    propriedades,
    eficiencia: impactoTotal / cfg.energia,
    tags,
    modificadoresAplicados: mods.aplicados,
    multModificadores: mods.multMais * (1 + mods.aumentado),
    tetoModificadoresAtingido: mods.tetoAtingido,
  };
}
