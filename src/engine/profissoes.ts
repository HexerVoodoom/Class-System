/**
 * Motor de profissões: calcula a qualidade e as propriedades emergentes de
 * um item criado, a partir do nível de profissão e do RESTO DA FICHA
 * (elementos com maestria, escolas, talentos).
 */

import { ELEMENTOS, type ElementoId } from '../registry/elementos';
import { CRIATURAS, FAMILIAS } from '../registry/criaturas';
import {
  ITENS_BASE,
  MATERIAIS_CRIATURA,
  PROFISSOES,
  PROPRIEDADES_ITEM,
  type ItemBaseDef,
  type ProfissaoId,
  type PropriedadeItemDef,
} from '../registry/profissoes';
import { MAESTRIA_LIMIAR } from './evocacao';
import type { Personagem } from './personagem';
import type { Progressao } from './progressao';

// ---- constantes de balanceamento ----
const QUAL_BASE = 8;
const QUAL_POR_NIVEL_PROFISSAO = 2.5;
const QUAL_POR_PROPRIEDADE = 0; // as propriedades já somam seu próprio bônus

export interface TierQualidade {
  nome: string;
  cor: string;
  minimo: number;
}

/** Faixas de qualidade, da mais baixa para a mais alta. */
export const TIERS: TierQualidade[] = [
  { nome: 'Comum', cor: '#9a92a8', minimo: 0 },
  { nome: 'Incomum', cor: '#5fae82', minimo: 24 },
  { nome: 'Raro', cor: '#4f8fd0', minimo: 42 },
  { nome: 'Épico', cor: '#9d6fd0', minimo: 62 },
  { nome: 'Lendário', cor: '#d9a24b', minimo: 84 },
  { nome: 'Mítico', cor: '#d06a5a', minimo: 108 },
];

export function tierDe(qualidade: number): TierQualidade {
  let tier = TIERS[0];
  for (const t of TIERS) if (qualidade >= t.minimo) tier = t;
  return tier;
}

export interface ConfigCraft {
  profissao: ProfissaoId;
  itemId: string;
  /** Elementos que o artesão escolhe imbuir (dentre os que domina). */
  elementosImbuidos: ElementoId[];
  /** Criatura do bestiário usada como material (só Curtidor). */
  materialCriaturaId?: string;
}

export interface ResultadoCraft {
  valida: boolean;
  erros: string[];
  item?: ItemBaseDef;
  qualidade: number;
  tier: TierQualidade;
  nomeItem: string;
  propriedades: PropriedadeItemDef[];
  /** Contribuições de atributo para a qualidade (rótulo → valor). */
  atributos: { rotulo: string; valor: number }[];
}

const talento = (p: Personagem, id: string) => p.talentos[id as keyof typeof p.talentos] ?? 0;

/** Elementos (base ou derivados) que o personagem domina para imbuir. */
export function elementosDominados(prog: Progressao, limiar = MAESTRIA_LIMIAR): ElementoId[] {
  return (Object.keys(prog.niveisEfetivos) as ElementoId[]).filter(
    (id) => (prog.niveisEfetivos[id] ?? 0) >= limiar,
  );
}

function propriedadeAtende(
  def: PropriedadeItemDef,
  p: Personagem,
  prog: Progressao,
  nivelProfissao: number,
  imbuidosDominados: Set<ElementoId>,
): boolean {
  if (def.requerProfissaoNivel && nivelProfissao < def.requerProfissaoNivel) return false;
  if (def.requerTalento && talento(p, def.requerTalento) <= 0) return false;
  if (def.requerTodos && !def.requerTodos.every((e) => imbuidosDominados.has(e))) return false;
  if (def.requerAlgum && !def.requerAlgum.some((e) => imbuidosDominados.has(e))) return false;
  // se não exige elemento algum (ex.: obra-prima), aplica direto
  return true;
}

export function craftar(p: Personagem, prog: Progressao, cfg: ConfigCraft): ResultadoCraft {
  const erros: string[] = [];
  const profissao = PROFISSOES[cfg.profissao];
  const item = ITENS_BASE[cfg.itemId];
  const nivelProfissao = p.profissoes?.[cfg.profissao] ?? 0;

  if (!profissao) erros.push('Profissão inválida.');
  if (!item) erros.push('Item inválido.');
  if (item && item.profissao !== cfg.profissao) {
    erros.push(`"${item.nome}" não pertence à profissão ${profissao?.nome}.`);
  }
  if (nivelProfissao <= 0) erros.push(`Invista pontos na profissão ${profissao?.nome ?? ''}.`);

  // só valem os elementos imbuídos que o personagem REALMENTE domina
  const dominados = new Set(elementosDominados(prog));
  const imbuidosDominados = new Set(
    cfg.elementosImbuidos.filter((e) => dominados.has(e)),
  );
  for (const e of cfg.elementosImbuidos) {
    if (!dominados.has(e)) {
      erros.push(`Sem maestria (nível ${MAESTRIA_LIMIAR}+) em ${ELEMENTOS[e]?.nome ?? e} para imbuir.`);
    }
  }

  // qualidade base + nível de profissão + atributos da ficha
  const atributos: ResultadoCraft['atributos'] = [];
  let qualidade = QUAL_BASE + nivelProfissao * QUAL_POR_NIVEL_PROFISSAO;
  atributos.push({ rotulo: `Profissão ${profissao?.nome ?? ''} (nv ${nivelProfissao})`, valor: nivelProfissao * QUAL_POR_NIVEL_PROFISSAO });

  if (profissao) {
    for (const [elem, peso] of Object.entries(profissao.fatoresElementos) as [ElementoId, number][]) {
      const nivel = prog.niveisEfetivos[elem] ?? 0;
      if (nivel > 0) {
        const contrib = nivel * peso;
        qualidade += contrib;
        atributos.push({ rotulo: `${ELEMENTOS[elem]?.nome ?? elem} ×${peso}`, valor: contrib });
      }
    }
    for (const [escola, peso] of Object.entries(profissao.fatoresEscolas ?? {}) as [string, number][]) {
      const nivel = p.escolas[escola as keyof typeof p.escolas] ?? 0;
      if (nivel > 0) {
        const contrib = nivel * peso;
        qualidade += contrib;
        atributos.push({ rotulo: `${escola} ×${peso}`, valor: contrib });
      }
    }
  }

  // propriedades emergentes aplicáveis a este item
  const propriedadesAplicaveis: PropriedadeItemDef[] = [];
  if (item) {
    for (const def of Object.values(PROPRIEDADES_ITEM)) {
      if (!def.categorias.includes(item.categoria)) continue;
      if (propriedadeAtende(def, p, prog, nivelProfissao, imbuidosDominados)) {
        propriedadesAplicaveis.push(def);
        qualidade += def.bonusQualidade + QUAL_POR_PROPRIEDADE;
      }
    }
  }

  // material de criatura (a ponte com o bestiário): só o Curtidor trabalha peles
  if (cfg.materialCriaturaId) {
    const cri = CRIATURAS[cfg.materialCriaturaId];
    if (cfg.profissao !== 'curtidor') {
      erros.push('Só o Curtidor trabalha peles e carcaças de criatura.');
    } else if (!cri) {
      erros.push('Material de criatura desconhecido.');
    } else if (!p.bestiario?.some((b) => b.criaturaId === cri.id)) {
      erros.push(`Capture ${cri.nome} no bestiário antes de usá-la como material.`);
    } else {
      const mat = MATERIAIS_CRIATURA[cri.familia];
      qualidade += cri.poderBase * mat.qualidadePorPoder;
      atributos.push({
        rotulo: `${mat.material} (${FAMILIAS[cri.familia].nome}, poder ${cri.poderBase})`,
        valor: cri.poderBase * mat.qualidadePorPoder,
      });
      if (item && mat.propriedade.categorias.includes(item.categoria)) {
        const propMat: PropriedadeItemDef = {
          id: `mat_${cri.familia}`,
          nome: mat.propriedade.nome,
          descricao: `${mat.propriedade.descricao} (de ${cri.nome})`,
          categorias: mat.propriedade.categorias,
          bonusQualidade: mat.propriedade.bonusQualidade,
        };
        propriedadesAplicaveis.push(propMat);
        qualidade += propMat.bonusQualidade;
      }
    }
  }

  // nome descritivo: item + propriedades marcantes
  const adjetivos = propriedadesAplicaveis
    .filter((d) => d.id !== 'obra_prima')
    .slice(0, 2)
    .map((d) => d.nome);
  const nomeItem = item
    ? adjetivos.length
      ? `${item.nome} ${adjetivos.join(' e ')}`
      : item.nome
    : 'Item';

  return {
    valida: erros.length === 0,
    erros,
    item,
    qualidade,
    tier: tierDe(qualidade),
    nomeItem,
    propriedades: propriedadesAplicaveis,
    atributos,
  };
}
