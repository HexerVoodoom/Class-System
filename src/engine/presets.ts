/**
 * MATERIALIZAÇÃO E VERIFICAÇÃO DE CLASSES PRONTAS.
 *
 * `registry/presets.ts` guarda a INTENÇÃO ("esta classe tem Morte 18, um lobo
 * domado e promete abrir o arquétipo Necromante"). Aqui a intenção vira uma
 * `Personagem` de verdade, e — mais importante — se confere se a promessa se
 * cumpriu de fato.
 *
 * ORDEM CANÔNICA DE MONTAGEM. Não é detalhe de implementação; é o que torna a
 * montagem determinística, porque há dependências reais entre os passos:
 *
 *   1. elementos, escolas, recursos, profissões  (independentes entre si)
 *   2. talentos          — `investirTalento` valida requisito de escola/recurso
 *   3. calcularProgressao
 *   4. bestiário         — capturar exige progressão; domar exige talento
 *
 * NUNCA LANÇA. Um preset defeituoso vira lista de `problemas` mais a ficha
 * parcial que deu para montar. A alternativa — deixar o `throw` subir — foi o
 * que manteve os presets antigos escondidos atrás de um `try/catch` na UI, com
 * um toast genérico no lugar do defeito.
 */

import { PRESETS, PRESETS_POR_ID, type PresetDef } from '../registry/presets';
import { ARQUETIPOS } from '../registry/arquetipos';
import { elementoDef } from '../registry/combinacoes';
import type { ElementoBaseId, ElementoId } from '../registry/elementos';
import type { EscolaId } from '../registry/escolas';
import type { RecursoId } from '../registry/recursos';
import type { TalentoId } from '../registry/talentos';
import type { ProfissaoId } from '../registry/profissoes';
import type { FusaoConfig, SkillConfig } from '../registry/formatos';
import {
  capturarCriatura,
  criarPersonagem,
  domarCriatura,
  investirElemento,
  investirEscola,
  investirProfissao,
  investirRecurso,
  investirTalento,
  type Personagem,
} from './personagem';
import { calcularProgressao, type Progressao } from './progressao';
import { calcularSkill } from './skills';
import { calcularFusao } from './fusao';

export type SeveridadeProblema = 'erro' | 'aviso';

export type TipoProblemaPreset =
  | 'investimento_recusado'
  | 'bestiario_recusado'
  | 'skill_invalida'
  | 'fusao_invalida'
  | 'arquetipo_inexistente'
  | 'promessa_nao_cumprida'
  | 'capacidade_diluida'
  | 'investimento_morto';

export interface ProblemaPreset {
  severidade: SeveridadeProblema;
  presetId: string;
  tipo: TipoProblemaPreset;
  /** Diz o que fazer, não só o que falhou. */
  mensagem: string;
}

export interface CustoPreset {
  elementos: number;
  escolas: number;
  recursos: number;
  /** elementos + escolas + recursos — é o que o orçamento de atributos cobre. */
  atributos: number;
  talentos: number;
  profissoes: number;
}

export interface PresetMaterializado {
  def: PresetDef;
  /** Objeto novo a cada chamada — a UI muta a ficha que recebe. */
  personagem: Personagem;
  progressao: Progressao;
  skill: SkillConfig;
  fusao?: FusaoConfig;
  custo: CustoPreset;
  /** Vazio = preset íntegro. */
  problemas: ProblemaPreset[];
}

function soma(m: Partial<Record<string, number>>): number {
  return Object.values(m).reduce<number>((a, n) => a + (n ?? 0), 0);
}

/**
 * Roda `acao` e, se ela recusar o investimento, converte a recusa em problema.
 * Os `investir*` lançam com mensagem já escrita para humano; aproveitamos.
 */
function tentar(
  problemas: ProblemaPreset[],
  presetId: string,
  tipo: TipoProblemaPreset,
  contexto: string,
  acao: () => void,
): void {
  try {
    acao();
  } catch (e) {
    problemas.push({
      severidade: 'erro',
      presetId,
      tipo,
      mensagem: `${contexto}: ${(e as Error).message}`,
    });
  }
}

export function custoDe(def: PresetDef): CustoPreset {
  const elementos = soma(def.elementos);
  const escolas = soma(def.escolas);
  const recursos = soma(def.recursos);
  return {
    elementos,
    escolas,
    recursos,
    atributos: elementos + escolas + recursos,
    talentos: soma(def.talentos ?? {}),
    profissoes: soma(def.profissoes ?? {}),
  };
}

/** Constrói a ficha do preset. Nunca lança. */
export function materializarPreset(def: PresetDef): PresetMaterializado {
  const problemas: ProblemaPreset[] = [];
  const p = criarPersonagem(def.personagem);

  for (const [id, n] of Object.entries(def.elementos) as [ElementoBaseId, number][]) {
    if (n > 0) {
      tentar(problemas, def.id, 'investimento_recusado', `elemento ${id}`, () =>
        investirElemento(p, id, n),
      );
    }
  }
  for (const [id, n] of Object.entries(def.escolas) as [EscolaId, number][]) {
    if (n > 0) {
      tentar(problemas, def.id, 'investimento_recusado', `escola ${id}`, () =>
        investirEscola(p, id, n),
      );
    }
  }
  for (const [id, n] of Object.entries(def.recursos) as [RecursoId, number][]) {
    if (n > 0) {
      tentar(problemas, def.id, 'investimento_recusado', `recurso ${id}`, () =>
        investirRecurso(p, id, n),
      );
    }
  }
  for (const [id, n] of Object.entries(def.profissoes ?? {}) as [ProfissaoId, number][]) {
    if (n > 0) {
      tentar(problemas, def.id, 'investimento_recusado', `profissão ${id}`, () =>
        investirProfissao(p, id, n),
      );
    }
  }
  // depois de escolas e recursos: o requisito do talento olha para eles
  for (const [id, n] of Object.entries(def.talentos ?? {}) as [TalentoId, number][]) {
    if (n > 0) {
      tentar(problemas, def.id, 'investimento_recusado', `talento ${id}`, () =>
        investirTalento(p, id, n),
      );
    }
  }

  // o bestiário precisa da progressão pronta para avaliar captura
  for (const entrada of def.bestiario ?? []) {
    tentar(problemas, def.id, 'bestiario_recusado', `capturar ${entrada.criaturaId}`, () =>
      capturarCriatura(p, calcularProgressao(p), entrada.criaturaId),
    );
    for (let i = 0; i < entrada.vinculo; i++) {
      tentar(problemas, def.id, 'bestiario_recusado', `domar ${entrada.criaturaId}`, () =>
        domarCriatura(p, entrada.criaturaId),
      );
    }
  }

  const progressao = calcularProgressao(p);
  const fusao = def.fusao
    ? {
        nome: def.fusao.nome,
        componentes: def.fusao.componentes,
        escolaDominante: def.fusao.escolaDominante,
        modificadores: def.fusao.modificadores,
      }
    : undefined;

  return {
    def,
    personagem: p,
    progressao,
    skill: def.skill,
    fusao,
    custo: custoDe(def),
    problemas,
  };
}

/**
 * Materializa e confere o contrato. É esta função que dá o direito de a lista
 * de presets crescer: sem ela, "promete" seria só comentário.
 */
export function verificarPreset(def: PresetDef): ProblemaPreset[] {
  const m = materializarPreset(def);
  const problemas = [...m.problemas];
  const erro = (tipo: TipoProblemaPreset, mensagem: string): void => {
    problemas.push({ severidade: 'erro', presetId: def.id, tipo, mensagem });
  };
  const aviso = (tipo: TipoProblemaPreset, mensagem: string): void => {
    problemas.push({ severidade: 'aviso', presetId: def.id, tipo, mensagem });
  };

  // --- a skill de exemplo tem de ser lançável ---
  const r = calcularSkill(m.personagem, m.progressao, m.skill);
  if (!r.valida) {
    erro(
      'skill_invalida',
      `a skill "${m.skill.nome}" não é lançável por esta ficha — ${r.erros.join('; ')}`,
    );
  }
  if (m.skill.capacidadeExigida && !m.progressao.capacidades.has(m.skill.capacidadeExigida)) {
    if (m.progressao.capacidadesDiluidas.has(m.skill.capacidadeExigida)) {
      aviso(
        'capacidade_diluida',
        `a skill usa "${m.skill.capacidadeExigida}" apenas como meia-identidade (com penalidade). Se for de propósito, está certo; se não, suba o arquétipo inteiro.`,
      );
    } else {
      erro(
        'skill_invalida',
        `a skill exige a capacidade "${m.skill.capacidadeExigida}", que esta ficha não tem nem diluída.`,
      );
    }
  }

  // --- a fusão de exemplo, quando existe ---
  if (m.fusao) {
    const rf = calcularFusao(m.personagem, m.progressao, m.fusao);
    if (!rf.valida) {
      erro(
        'fusao_invalida',
        `a fusão "${m.fusao.nome}" não é executável — ${rf.erros.join('; ')}`,
      );
    }
  }

  // --- as promessas ---
  const abertos = new Set(m.progressao.arquetipos.map((a) => a.id));
  const diluidos = new Set(m.progressao.arquetiposDiluidos.map((a) => a.id));
  for (const id of def.promete.arquetipos) {
    if (!ARQUETIPOS[id]) {
      erro('arquetipo_inexistente', `promete o arquétipo "${id}", que não existe no registro.`);
      continue;
    }
    if (!abertos.has(id)) {
      const perto = diluidos.has(id) ? ' (está apenas como meia-identidade)' : '';
      erro(
        'promessa_nao_cumprida',
        `promete o arquétipo "${ARQUETIPOS[id].nome}", mas a ficha não o desbloqueia${perto}.`,
      );
    }
  }
  for (const id of def.promete.arquetiposDiluidos ?? []) {
    if (!diluidos.has(id) && !abertos.has(id)) {
      erro(
        'promessa_nao_cumprida',
        `promete a meia-identidade de "${id}", que a ficha não alcança.`,
      );
    }
  }
  for (const id of def.promete.elementos ?? []) {
    if (!elementoDef(id)) {
      erro('promessa_nao_cumprida', `promete o elemento "${id}", que não existe no registro.`);
      continue;
    }
    if ((m.progressao.niveisEfetivos[id] ?? 0) <= 0) {
      erro(
        'promessa_nao_cumprida',
        `promete o elemento "${elementoDef(id)!.nome}", mas ele não existe nesta ficha. Suba os componentes da receita.`,
      );
    }
  }

  // --- investimentos que não pagam nada ---
  for (const id of Object.keys(def.escolas) as EscolaId[]) {
    const usadaPelaSkill =
      m.skill.escola === id || (def.fusao?.componentes ?? []).some((c) => c.escola === id);
    const usadaPorArquetipo = m.progressao.arquetipos.some((a) => a.condicao.escolas?.[id]);
    const usadaPorTalento = Object.keys(def.talentos ?? {}).length > 0;
    if (!usadaPelaSkill && !usadaPorArquetipo && !usadaPorTalento) {
      aviso(
        'investimento_morto',
        `os pontos em ${id} não alimentam a skill nem nenhum arquétipo aberto.`,
      );
    }
  }
  for (const id of Object.keys(def.recursos) as RecursoId[]) {
    const usadoPelaSkill =
      m.skill.fontes.some((f) => f.recurso === id) ||
      (def.fusao?.componentes ?? []).some((c) => c.fontes.some((f) => f.recurso === id));
    const usadoPorArquetipo = m.progressao.arquetipos.some((a) => a.condicao.recursos?.[id]);
    const usadoPorTalento = Object.keys(def.talentos ?? {}).length > 0;
    if (!usadoPelaSkill && !usadoPorArquetipo && !usadoPorTalento) {
      aviso(
        'investimento_morto',
        `os pontos no recurso ${id} não pagam nenhuma skill deste preset.`,
      );
    }
  }

  return problemas;
}

/** Verifica a lista inteira. É o que a suíte e o comando de integridade usam. */
export function verificarPresets(): ProblemaPreset[] {
  return PRESETS.flatMap((def) => verificarPreset(def));
}

export function materializarPresetPorId(id: string): PresetMaterializado | undefined {
  const def = PRESETS_POR_ID.get(id);
  return def ? materializarPreset(def) : undefined;
}

/** Elementos derivados/combinados que o preset entrega, para exibição. */
export function elementosNotaveis(m: PresetMaterializado, limite = 8): ElementoId[] {
  return (Object.keys(m.progressao.niveisEfetivos) as ElementoId[])
    .filter((id) => {
      const def = elementoDef(id);
      return def && def.tipo !== 'base' && (m.progressao.niveisEfetivos[id] ?? 0) > 0;
    })
    .sort(
      (a, b) =>
        (m.progressao.niveisEfetivos[b] ?? 0) - (m.progressao.niveisEfetivos[a] ?? 0) ||
        a.localeCompare(b),
    )
    .slice(0, limite);
}
