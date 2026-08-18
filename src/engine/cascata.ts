/**
 * Motor da CASCATA GERACIONAL — a segunda contabilidade dos elementos.
 *
 * `niveisEfetivos` (progressão) mede o que a ficha já consegue EXPRESSAR;
 * a cascata mede o quanto cada combinação VIROU PARTE da ficha — pontos
 * passivos acumulados pelo investimento nos pais — e é ela que decide:
 *
 *   1. quais elementos aceitam ponto DIRETO agora (17 bases + derivados
 *      DESTRAVADOS, i.e. com passivos >= limiar da aridade);
 *   2. quanto cada nó alimenta a geração seguinte (`paraCascata`).
 *
 * Fórmula (uma passada, aridade crescente — DAG estrito, sem realimentação):
 *
 *   paraCascata(X) = passivos(X) + pesoDiretoNaCascata(aridade X) × diretos(X)
 *   passivos(Y)    = min sobre pais P de floor(paraCascata(P) / divisor(Y))
 *   destravado(Y)  = passivos(Y) >= LIMIAR_DESTRAVAMENTO[aridade Y]
 *
 * O peso do direto na cascata é CUSTO_PONTO/CUSTO_CASCATA_EQUIVALENTE — a
 * paridade vale para o `paraCascata` do PRÓPRIO nó por ponto de orçamento;
 * o destrave da geração seguinte pelas bases continua a rota mais barata
 * (o `min` sobre N pais cobra N vezes) e há teste de marco MEDIDO travando.
 * NÃO "simplifique" o peso para 1: abriria arbitragem composta por geração.
 *
 * Mapas ESPARSOS: só nós tocados entram — uma ficha típica (3–5 bases) toca
 * dezenas de nós, nunca os 3.213 do espaço completo.
 */

import {
  ELEMENTOS,
  SINERGIAS,
  elementosBase,
  type ElementoBaseId,
  type ElementoId,
} from '../registry/elementos';
import {
  aridadeDe,
  combinacaoInfoPorComponentes,
  elementoDef,
  ordenarComponentes,
  paisDeCascata,
} from '../registry/combinacoes';
import {
  CUSTO_PONTO_ALOCACAO,
  DIVISOR_CASCATA,
  LIMIAR_DESTRAVAMENTO,
  pesoDiretoNaCascata,
  type Aridade,
} from '../registry/geracoes';

export interface Cascata {
  /** Pontos ganhos pela cascata (nunca alocados à mão). */
  passivos: ReadonlyMap<ElementoId, number>;
  /** Pontos diretos da ficha, ecoados para leitura uniforme. */
  diretos: ReadonlyMap<ElementoId, number>;
  /** passivos + diretos — o número que a UI mostra por elemento. */
  efetivos: ReadonlyMap<ElementoId, number>;
  /** O que alimenta a geração seguinte: passivos + peso × diretos. */
  paraCascata: ReadonlyMap<ElementoId, number>;
  /** Aceita ponto direto AGORA: as 17 bases + derivados destravados. */
  destravados: ReadonlySet<ElementoId>;
  /** Só dos derivados tocados ainda travados: quanto falta para destravar. */
  progressoDestravamento: ReadonlyMap<ElementoId, { passivos: number; limiar: number }>;
}

export interface OpcoesCascata {
  /** Redução do divisor (gancho do efeito de talento `cascata_divisor_reducao`). */
  reducaoDivisor?: number;
  /** Intensidade do transbordo (gancho do talento `transbordo_bonus`), mesmo
   *  fator que `progressao.ts` já aplica aos níveis efetivos. */
  bonusTransbordo?: number;
}

/**
 * Sinergias de ALVO ÚNICO (fogo↔vileza, sombra↔morte…) alimentam a cascata:
 * é investimento de verdade que transbordou, então conta para destravar o par
 * feito daquela base — pequeno demais para desequilibrar (o "grátis" nunca
 * passa de `razao` do que já foi pago, e o par ainda exige o OUTRO componente
 * também no divisor).
 *
 * Sinergias de LEQUE (`vida`→5 primais, `arcano`→7 elementos) ficam DE FORA
 * de propósito. Medido: se `vida` alimentasse a cascata como alimenta
 * `niveisEfetivos`, 250 pontos em `vida` (250 de orçamento) dariam +50 em
 * CADA um dos 5 primais — passivos suficientes para destravar as 10 pares
 * entre eles simultaneamente, contra 1000 de orçamento pela rota honesta.
 * O leque já concede nível efetivo de graça (por desenho); destravar em
 * cascata TAMBÉM de graça é o exploit que a rodada anterior fechou — não
 * reabra sem refazer essa conta.
 */
const SINERGIAS_ALVO_UNICO = SINERGIAS.filter((s) => s.para.length === 1);

/** Os 17 ids base na ordem canônica do registro. */
const BASE_IDS: ElementoBaseId[] = elementosBase().map((d) => d.id as ElementoBaseId);

function aridadeClamp(id: ElementoId): Aridade {
  return Math.min(4, Math.max(1, aridadeDe(id))) as Aridade;
}

function divisorDe(id: ElementoId, reducao: number): number {
  const declarado = elementoDef(id)?.cascata?.divisor;
  const aridade = aridadeClamp(id);
  const base = declarado ?? DIVISOR_CASCATA[aridade];
  // A redução de divisor (gancho de talento) só age na GERAÇÃO 2 e nunca em
  // divisor declarado (especiais): aplicada em todas as gerações ela compõe
  // pela cadeia — 1 rank derrubava o marco da quádrupla em 60% (960→384) e
  // com 2 ranks a quádrupla ficava mais barata que o par (auditoria medida).
  if (declarado !== undefined || aridade !== 2) return base;
  return Math.max(1, base - reducao);
}

function destravavel(id: ElementoId): boolean {
  const def = elementoDef(id);
  if (!def || def.tipo === 'base') return false;
  return def.cascata?.destravavel !== false;
}

/** Combinações de tamanho `k` de uma lista (ordem estável). */
function combinacoesDe<T>(itens: T[], k: number): T[][] {
  const saida: T[][] = [];
  const atual: T[] = [];
  const rec = (inicio: number) => {
    if (atual.length === k) {
      saida.push([...atual]);
      return;
    }
    for (let i = inicio; i <= itens.length - (k - atual.length); i++) {
      atual.push(itens[i]);
      rec(i + 1);
      atual.pop();
    }
  };
  rec(0);
  return saida;
}

/** id do filho de aridade N formado por estas bases (par curado ou combinação). */
function filhoDe(comps: ElementoBaseId[]): ElementoId | undefined {
  if (comps.length === 2) {
    // os 136 pares são curados em ELEMENTOS — a receita identifica o id
    const chave = ordenarComponentes(comps).join('+');
    return PAR_POR_CHAVE.get(chave);
  }
  return combinacaoInfoPorComponentes(comps)?.id;
}

const PAR_POR_CHAVE = new Map<string, ElementoId>(
  Object.values(ELEMENTOS)
    .filter((d) => d.receita?.length === 2)
    .map((d) => [ordenarComponentes(d.receita!.map((c) => c.elemento)).join('+'), d.id]),
);

/**
 * Calcula a cascata inteira a partir dos pontos DIRETOS da ficha.
 * Pura e determinística; propagação PODADA — só descendentes das bases
 * tocadas (e dos derivados com ponto direto) são visitados.
 */
export function calcularCascata(
  diretosRecord: Partial<Record<ElementoId, number>>,
  opcoes: OpcoesCascata = {},
): Cascata {
  const reducao = opcoes.reducaoDivisor ?? 0;
  const bonusTransbordo = opcoes.bonusTransbordo ?? 0;

  const diretos = new Map<ElementoId, number>();
  for (const [id, pts] of Object.entries(diretosRecord)) {
    if ((pts ?? 0) > 0 && elementoDef(id)) diretos.set(id, pts!);
  }

  // Transbordo de sinergias de alvo único — mesma fórmula de progressao.ts,
  // mas só a fatia segura de alimentar a cascata (ver docstring acima).
  const transbordoSimples = new Map<ElementoBaseId, number>();
  {
    // mesma regra de `progressao.ts`: acumula a fração de todas as setas que
    // apontam para o alvo e arredonda uma vez só
    const acumulado = new Map<ElementoBaseId, number>();
    for (const s of SINERGIAS_ALVO_UNICO) {
      const origem = diretos.get(s.de) ?? 0;
      if (origem <= 0) continue;
      const alvo = s.para[0];
      acumulado.set(alvo, (acumulado.get(alvo) ?? 0) + origem * s.razao * (1 + bonusTransbordo));
    }
    for (const [alvo, valor] of acumulado) {
      const bonus = Math.floor(valor);
      if (bonus > 0) transbordoSimples.set(alvo, bonus);
    }
  }

  // Bases semente: as investidas diretamente + as das receitas de qualquer
  // derivado com ponto direto (um par com diretos alimenta triplas mesmo que
  // as bases dele não tenham sido tocadas nesta ficha) + as que só receberam
  // transbordo de alvo único (a sinergia sozinha já justifica olhar o par).
  const basesSemente = new Set<ElementoBaseId>();
  for (const id of diretos.keys()) {
    const def = elementoDef(id);
    if (!def) continue;
    if (def.tipo === 'base') basesSemente.add(id as ElementoBaseId);
    else for (const c of def.receita ?? []) basesSemente.add(c.elemento);
  }
  for (const alvo of transbordoSimples.keys()) basesSemente.add(alvo);
  const bases = BASE_IDS.filter((b) => basesSemente.has(b));

  const passivos = new Map<ElementoId, number>();
  const paraCascata = new Map<ElementoId, number>();
  const tocados: ElementoId[] = [];

  const registrar = (id: ElementoId, passivo: number) => {
    const direto = diretos.get(id) ?? 0;
    if (passivo <= 0 && direto <= 0) return;
    passivos.set(id, passivo);
    paraCascata.set(id, passivo + pesoDiretoNaCascata(aridadeClamp(id)) * direto);
    tocados.push(id);
  };

  // aridade 1 — as bases alimentam a cascata com o ponto direto integral
  // (pesoDiretoNaCascata(1) = 1) MAIS o transbordo de alvo único que
  // receberam — é investimento pago em outro lugar que refletiu aqui.
  for (const b of bases) {
    const direto = diretos.get(b) ?? 0;
    const bonus = transbordoSimples.get(b) ?? 0;
    const total = direto + bonus;
    if (total <= 0) continue;
    passivos.set(b, 0);
    paraCascata.set(b, total);
    tocados.push(b);
  }

  // aridades 2..4 — filhos das bases semente, em ordem crescente
  for (const aridade of [2, 3, 4] as const) {
    for (const comps of combinacoesDe(bases, aridade)) {
      const id = filhoDe(comps);
      if (!id) continue;
      const pais = paisDeCascata(id);
      const divisor = divisorDe(id, reducao);
      let menor = Infinity;
      for (const pai of pais) {
        const alimento = paraCascata.get(pai) ?? 0;
        const rendimento = Math.floor(alimento / divisor);
        if (rendimento < menor) menor = rendimento;
      }
      const passivo = pais.length > 0 && Number.isFinite(menor) ? menor : 0;
      registrar(id, passivo);
    }
  }

  // especiais (pais declarados — receita ampla, divisor próprio)
  for (const def of Object.values(ELEMENTOS)) {
    if (!def.cascata?.pais || passivos.has(def.id)) continue;
    const divisor = divisorDe(def.id, reducao);
    let menor = Infinity;
    for (const pai of def.cascata.pais) {
      const alimento = paraCascata.get(pai) ?? 0;
      const rendimento = Math.floor(alimento / divisor);
      if (rendimento < menor) menor = rendimento;
    }
    if (Number.isFinite(menor) && menor > 0) registrar(def.id, menor);
  }

  // derivados com ponto direto que a poda não alcançou (ficha montada à mão)
  for (const id of diretos.keys()) {
    if (!passivos.has(id)) registrar(id, 0);
  }

  const efetivos = new Map<ElementoId, number>();
  for (const id of tocados) {
    efetivos.set(id, (passivos.get(id) ?? 0) + (diretos.get(id) ?? 0));
  }

  const destravados = new Set<ElementoId>(BASE_IDS);
  const progressoDestravamento = new Map<ElementoId, { passivos: number; limiar: number }>();
  for (const id of tocados) {
    if (!destravavel(id)) continue;
    const limiar = LIMIAR_DESTRAVAMENTO[aridadeClamp(id)];
    const p = passivos.get(id) ?? 0;
    if (p >= limiar) destravados.add(id);
    else progressoDestravamento.set(id, { passivos: p, limiar });
  }

  return { passivos, diretos, efetivos, paraCascata, destravados, progressoDestravamento };
}

/** O elemento aceita ponto direto AGORA? */
export function podeReceberDireto(c: Cascata, id: ElementoId): boolean {
  return c.destravados.has(id);
}

/**
 * A lista que o alocador da UI renderiza — bases primeiro (ordem canônica),
 * derivados destravados depois, por aridade e id. A UI NÃO recalcula isso.
 */
export function elementosAlocaveis(c: Cascata): ElementoId[] {
  const basesCanonicas = BASE_IDS;
  const derivados = [...c.destravados]
    .filter((id) => elementoDef(id)?.tipo !== 'base')
    .sort((a, b) => aridadeDe(a) - aridadeDe(b) || a.localeCompare(b));
  return [...basesCanonicas, ...derivados];
}

/**
 * Custo da ficha em pontos de ORÇAMENTO (ponto direto em geração alta custa
 * mais). RELATÓRIO para UI/consumidores — o motor nunca recusa por orçamento.
 */
export function custoDeAlocacao(
  diretos: Partial<Record<ElementoId, number>>,
): { porAridade: Record<Aridade, number>; total: number } {
  const porAridade: Record<Aridade, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const [id, pts] of Object.entries(diretos)) {
    if ((pts ?? 0) <= 0) continue;
    const aridade = aridadeClamp(id);
    porAridade[aridade] += pts! * CUSTO_PONTO_ALOCACAO[aridade];
  }
  return {
    porAridade,
    total: porAridade[1] + porAridade[2] + porAridade[3] + porAridade[4],
  };
}
