/**
 * GERADOR AUTOMÁTICO — monta fichas completas a partir de um orçamento.
 *
 * O sistema é grande demais para a folha em branco: 17 bases, 3.215 elementos
 * alcançáveis, 6 escolas, 5 recursos, dezenas de talentos e profissões. Quem
 * chega sem uma build em mente não tem por onde começar, e quem precisa de
 * cinco NPCs para uma sessão não vai distribuir 2.500 pontos à mão.
 *
 * O que o gerador faz: escolhe uma FAMÍLIA elemental coerente para o papel
 * pedido, gasta o orçamento do tier nela, deixa a cascata destravar o que
 * tiver de destravar, e desenha skills que o motor já considera válidas.
 *
 * O que ele NÃO faz: nada que um jogador não pudesse fazer à mão. Toda a
 * construção passa pelos mutadores de `personagem.ts` — `investirElemento`,
 * `investirTalento`… — então uma ficha gerada obedece exatamente às mesmas
 * regras (ponto direto só em base ou derivado destravado, requisito de
 * talento, exclusividade de ramo). Se o gerador conseguisse produzir uma
 * ficha impossível, o bug estaria aqui, não no motor.
 *
 * DETERMINISMO. O motor é puro e o gerador não abre exceção: toda escolha sai
 * de um PRNG SEMEADO. Mesma semente + mesmos filtros → mesma ficha, byte a
 * byte, em qualquer máquina. Sem semente explícita, ela é derivada dos
 * próprios filtros — ou seja, ainda determinística; para variar, troque a
 * semente, é o único dial de aleatoriedade que existe.
 *
 * Os únicos filtros que o usuário informa são NÍVEL (tier de orçamento) e,
 * para grupos, QUANTIDADE e PAPÉIS. Todo o resto é sorteado: é essa a graça.
 */

import {
  ELEMENTOS,
  elementosBase,
  type ElementoBaseId,
  type ElementoId,
  type PerfilPesos,
} from '../registry/elementos';
import { elementoDef } from '../registry/combinacoes';
import { ESCOLAS, type EscolaId } from '../registry/escolas';
import { RECURSOS, type RecursoId } from '../registry/recursos';
import { TALENTOS, type TalentoId } from '../registry/talentos';
import { PROFISSOES, type ProfissaoId } from '../registry/profissoes';
import { MODIFICADORES, type ModificadorId } from '../registry/modificadores';
import { CUSTO_PONTO_ALOCACAO, ORCAMENTO_POR_TIER } from '../registry/geracoes';
import { custoDeAlocacao } from './cascata';
import {
  criarPersonagem,
  investirElemento,
  investirEscola,
  investirProfissao,
  investirRecurso,
  investirTalento,
  podeInvestir,
  type Personagem,
} from './personagem';
import { calcularProgressao, type Progressao } from './progressao';
import {
  avaliarModificador,
  calcularLimites,
  calcularSkill,
  slotsModificador,
  tagsDaSkill,
  validarSkill,
  type SkillConfig,
  type ResultadoSkill,
} from './skills';

// ---------------------------------------------------------------------------
// 1. Aleatoriedade semeada
// ---------------------------------------------------------------------------

/**
 * PRNG mulberry32: 32 bits de estado, distribuição boa o bastante para
 * sorteio de conteúdo e — o que importa aqui — reprodutível em qualquer
 * runtime, sem depender da implementação de `Math.random` do host.
 */
export function criarPrng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash estável de string → semente. Usado quando ninguém informou uma. */
export function sementeDeTexto(texto: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

type Prng = () => number;

const inteiro = (rnd: Prng, min: number, max: number): number =>
  min + Math.floor(rnd() * (max - min + 1));

const umDe = <T>(rnd: Prng, itens: readonly T[]): T => itens[Math.floor(rnd() * itens.length)];

/**
 * Sorteio ponderado sem reposição. Pesos <= 0 são elegíveis por último (peso
 * mínimo epsilon) em vez de ficarem de fora: um papel nunca deve tornar um
 * elemento IMPOSSÍVEL, só improvável — variedade é metade do produto.
 */
function sortearPonderado<T>(
  rnd: Prng,
  itens: readonly T[],
  peso: (x: T) => number,
  quantidade: number,
): T[] {
  const restantes = [...itens];
  const escolhidos: T[] = [];
  while (escolhidos.length < quantidade && restantes.length) {
    const pesos = restantes.map((x) => Math.max(0.02, peso(x)));
    const total = pesos.reduce((a, b) => a + b, 0);
    let alvo = rnd() * total;
    let idx = restantes.length - 1;
    for (let i = 0; i < restantes.length; i++) {
      alvo -= pesos[i];
      if (alvo <= 0) {
        idx = i;
        break;
      }
    }
    escolhidos.push(restantes[idx]);
    restantes.splice(idx, 1);
  }
  return escolhidos;
}

// ---------------------------------------------------------------------------
// 2. Papéis
// ---------------------------------------------------------------------------

export type PapelId = 'dps' | 'tank' | 'suporte' | 'curandeiro' | 'controle' | 'invocador';

export interface PapelDef {
  id: PapelId;
  nome: string;
  descricao: string;
  /** Perfil desejado — casa com o `pesos` de elementos e escolas. */
  alvo: PerfilPesos;
  escolasPreferidas: EscolaId[];
  recursosPreferidos: RecursoId[];
  /** Forma padrão das skills deste papel. */
  forma: {
    area: 'unico' | 'circulo';
    entrega: 'instantaneo' | 'continuo';
    /** Fração do alcance máximo que o papel costuma usar. */
    fracaoAlcance: number;
  };
  talentosPreferidos: TalentoId[];
}

const perfil = (
  dano: number,
  controle: number,
  cura: number,
  defesa: number,
  suporte: number,
): PerfilPesos => ({ dano, controle, cura, defesa, suporte });

export const PAPEIS: Record<PapelId, PapelDef> = {
  dps: {
    id: 'dps',
    nome: 'DPS',
    descricao: 'Concentra o orçamento em dano bruto e alcance efetivo.',
    alvo: perfil(0.8, 0.1, 0, 0.05, 0.05),
    escolasPreferidas: ['conjuracao', 'longo_alcance', 'combate_fisico'],
    recursosPreferidos: ['mana', 'furia', 'ressonancia'],
    forma: { area: 'circulo', entrega: 'instantaneo', fracaoAlcance: 0.6 },
    talentosPreferidos: ['canalizacao_profunda', 'impacto_imediato', 'perfuracao', 'estilhaco'],
  },
  tank: {
    id: 'tank',
    nome: 'Tank',
    descricao: 'Segura a linha de frente: defesa, presença e ameaça de perto.',
    alvo: perfil(0.25, 0.15, 0, 0.5, 0.1),
    escolasPreferidas: ['combate_fisico', 'benca'],
    recursosPreferidos: ['furia', 'mana'],
    forma: { area: 'unico', entrega: 'instantaneo', fracaoAlcance: 0.05 },
    talentosPreferidos: ['postura_inabalavel', 'golpe_devastador', 'egide', 'sequencia_marcial'],
  },
  suporte: {
    id: 'suporte',
    nome: 'Suporte',
    descricao: 'Amplifica o grupo com auras, escudos e bênçãos sustentadas.',
    alvo: perfil(0.05, 0.15, 0.2, 0.2, 0.4),
    escolasPreferidas: ['benca', 'conjuracao'],
    recursosPreferidos: ['fe', 'mana'],
    forma: { area: 'circulo', entrega: 'continuo', fracaoAlcance: 0.35 },
    talentosPreferidos: ['exaltacao', 'vinculo_de_grupo', 'persistencia', 'area_ampliada'],
  },
  curandeiro: {
    id: 'curandeiro',
    nome: 'Curandeiro',
    descricao: 'Sustenta a vida do grupo; cura reativa e regeneração.',
    alvo: perfil(0.05, 0.05, 0.6, 0.2, 0.1),
    escolasPreferidas: ['benca'],
    recursosPreferidos: ['fe', 'mana'],
    forma: { area: 'circulo', entrega: 'continuo', fracaoAlcance: 0.3 },
    talentosPreferidos: ['exaltacao', 'persistencia', 'economia_de_recurso', 'egide'],
  },
  controle: {
    id: 'controle',
    nome: 'Controle',
    descricao: 'Nega espaço e ação: lentidão, prisão, maldição e área negada.',
    alvo: perfil(0.2, 0.65, 0, 0.05, 0.1),
    escolasPreferidas: ['maldicao', 'conjuracao'],
    recursosPreferidos: ['mana', 'ressonancia', 'soullink'],
    forma: { area: 'circulo', entrega: 'continuo', fracaoAlcance: 0.5 },
    talentosPreferidos: ['contagio', 'aflicao_profunda', 'area_ampliada', 'dano_ao_longo_do_tempo'],
  },
  invocador: {
    id: 'invocador',
    nome: 'Invocador',
    descricao: 'Luta por procuração: evocações que agem sozinhas.',
    alvo: perfil(0.45, 0.1, 0.05, 0.2, 0.2),
    escolasPreferidas: ['evocacao'],
    recursosPreferidos: ['mana', 'soullink', 'fe'],
    forma: { area: 'unico', entrega: 'instantaneo', fracaoAlcance: 0.25 },
    talentosPreferidos: ['enxame', 'autonomia', 'comando', 'colosso'],
  },
};

export const PAPEIS_VALIDOS = Object.keys(PAPEIS) as PapelId[];

/**
 * Composição padrão de grupo por tamanho. Segue a trindade clássica e vai
 * abrindo em largura — é o que a maioria espera ao pedir "gera um grupo de 4"
 * sem dizer mais nada. Acima de 6, repete o ciclo.
 */
const COMPOSICAO_PADRAO: PapelId[] = [
  'dps',
  'tank',
  'curandeiro',
  'controle',
  'suporte',
  'invocador',
];

export function composicaoPadrao(quantidade: number): PapelId[] {
  const papeis: PapelId[] = [];
  for (let i = 0; i < quantidade; i++) papeis.push(COMPOSICAO_PADRAO[i % COMPOSICAO_PADRAO.length]);
  return papeis;
}

/** Quanto um perfil de pesos serve a um papel: produto escalar normalizado. */
function afinidadeComPapel(pesos: PerfilPesos, alvo: PerfilPesos): number {
  return (
    pesos.dano * alvo.dano +
    pesos.controle * alvo.controle +
    pesos.cura * alvo.cura +
    pesos.defesa * alvo.defesa +
    pesos.suporte * alvo.suporte
  );
}

// ---------------------------------------------------------------------------
// 3. Nomes
// ---------------------------------------------------------------------------

const PRENOMES = [
  'Ashen', 'Bruma', 'Corvo', 'Dálmine', 'Ember', 'Fúlvio', 'Garça', 'Húmus',
  'Ídris', 'Jônia', 'Kaleb', 'Lárix', 'Múrmur', 'Nyx', 'Órion', 'Práxis',
  'Quéren', 'Rúbrica', 'Sílex', 'Tíbio', 'Ulmo', 'Vórtice', 'Xisto', 'Zéfiro',
];

const EPITETOS_POR_PAPEL: Record<PapelId, string[]> = {
  dps: ['o Estilhaço', 'a Lâmina Curta', 'o Rombo', 'a Pontaria Seca'],
  tank: ['o Batente', 'a Muralha Baixa', 'o Que Não Cede', 'a Âncora'],
  suporte: ['o Fôlego', 'a Corrente Boa', 'o Segundo Vento', 'a Mão Aberta'],
  curandeiro: ['a Costura', 'o Que Remenda', 'a Vigília', 'o Fio Quente'],
  controle: ['o Nó', 'a Coleira', 'o Que Atrasa', 'a Névoa Cheia'],
  invocador: ['o Coro', 'a Matilha', 'o Que Chama', 'a Boca do Bando'],
};

function nomearPersonagem(rnd: Prng, papel: PapelId, elementoPrincipal: ElementoId): string {
  const prenome = umDe(rnd, PRENOMES);
  const elemento = elementoDef(elementoPrincipal)?.nome ?? elementoPrincipal;
  // Metade das vezes o epíteto é o elemento, metade é o papel — variedade sem
  // precisar de um léxico gigante. "de X" e não "do/da X": os nomes de
  // elemento têm gêneros misturados (a Luz, o Som, a Lava) e não há campo de
  // gênero no registro; "de" está sempre certo.
  const epiteto = rnd() < 0.5 ? `de ${elemento}` : umDe(rnd, EPITETOS_POR_PAPEL[papel]);
  return `${prenome} ${epiteto}`;
}

const FORMAS_NOME_SKILL = ['Rito de', 'Sopro de', 'Selo de', 'Colapso de', 'Véu de', 'Marca de', 'Coroa de', 'Maré de'];

function nomearSkill(rnd: Prng, elemento: ElementoId): string {
  return `${umDe(rnd, FORMAS_NOME_SKILL)} ${elementoDef(elemento)?.nome ?? elemento}`;
}

// ---------------------------------------------------------------------------
// 4. Filtros de entrada
// ---------------------------------------------------------------------------

export const NIVEL_MINIMO = 1;
export const NIVEL_MAXIMO = 7;

export interface FiltrosGeracao {
  /** Tier 1..7 — define o orçamento (ver `ORCAMENTO_POR_TIER`). Default: 3. */
  nivel?: number;
  /** Orçamento explícito, se você não quiser usar a curva por tier. */
  orcamento?: number;
  /** Papel desejado. Omitido = sorteado. */
  papel?: PapelId;
  /** Semente do PRNG. Omitida = derivada dos demais filtros (determinística). */
  semente?: number;
  /** Nome fixo, se você não quiser o nome procedural. */
  nome?: string;
  /** Quantas skills desenhar. Default: 2. */
  skills?: number;
  /**
   * Bases a evitar (o gerador de grupo usa para dar identidade a cada membro).
   * É uma PREFERÊNCIA: se o orçamento não permitir mais nada, elas voltam.
   */
  evitarElementos?: ElementoBaseId[];
}

export interface FiltrosGrupo extends Omit<FiltrosGeracao, 'papel' | 'nome'> {
  /** Quantos personagens. Default: 4. */
  quantidade?: number;
  /**
   * Papéis, na ordem. Menos papéis que `quantidade` completa com a composição
   * padrão; mais papéis que `quantidade` define a quantidade.
   */
  papeis?: PapelId[];
  /** Nome do grupo, para o nome procedural dos membros. */
  nome?: string;
}

export function orcamentoDoNivel(nivel: number): number {
  const n = Math.min(NIVEL_MAXIMO, Math.max(NIVEL_MINIMO, Math.round(nivel)));
  return ORCAMENTO_POR_TIER[n];
}

function normalizarNivel(nivel: number | undefined): number {
  if (nivel === undefined) return 3;
  if (!Number.isFinite(nivel)) throw new Error('Nível precisa ser um número entre 1 e 7.');
  const n = Math.round(nivel);
  if (n < NIVEL_MINIMO || n > NIVEL_MAXIMO) {
    throw new Error(
      `Nível ${nivel} fora da faixa: use ${NIVEL_MINIMO}..${NIVEL_MAXIMO} ` +
        `(orçamentos ${ORCAMENTO_POR_TIER[NIVEL_MINIMO]}..${ORCAMENTO_POR_TIER[NIVEL_MAXIMO]}), ` +
        'ou informe `orcamento` direto.',
    );
  }
  return n;
}

// ---------------------------------------------------------------------------
// 5. Resultado
// ---------------------------------------------------------------------------

export interface SkillGerada {
  config: SkillConfig;
  resultado: ResultadoSkill;
}

export interface GastoOrcamento {
  elementos: number;
  escolas: number;
  recursos: number;
  talentos: number;
  profissoes: number;
  total: number;
}

export interface PersonagemGerado {
  personagem: Personagem;
  papel: PapelId;
  nivel: number;
  semente: number;
  orcamento: { disponivel: number; gasto: GastoOrcamento; sobra: number };
  progressao: Progressao;
  skills: SkillGerada[];
  /** Bases que formaram o núcleo da build, na ordem de investimento. */
  nucleo: ElementoBaseId[];
  /** O elemento de maior expressão da ficha (o "tema" que saiu). */
  elementoPrincipal: ElementoId;
}

export interface GrupoGerado {
  nome: string;
  nivel: number;
  semente: number;
  membros: PersonagemGerado[];
}

// ---------------------------------------------------------------------------
// 6. Geração de um personagem
// ---------------------------------------------------------------------------

/** Repartição do orçamento. Soma 1; sobras vão para elementos no final. */
const FATIAS = { elementos: 0.58, escolas: 0.18, recursos: 0.14, talentos: 0.05, profissoes: 0.05 };

/**
 * Quantas bases formam o núcleo. Orçamento pequeno espalhado em 4 bases não
 * destrava nada (o divisor da cascata cobra 5 pontos efetivos em CADA pai);
 * orçamento grande concentrado em 2 desperdiça a largura que ele compraria.
 */
function tamanhoDoNucleo(orcamento: number, rnd: Prng): number {
  if (orcamento < 100) return 2;
  if (orcamento < 220) return inteiro(rnd, 2, 3);
  if (orcamento < 520) return 3;
  return inteiro(rnd, 3, 4);
}

export function gerarPersonagem(filtros: FiltrosGeracao = {}): PersonagemGerado {
  const nivel = normalizarNivel(filtros.nivel);
  const disponivel = filtros.orcamento ?? orcamentoDoNivel(nivel);
  if (disponivel <= 0) throw new Error('Orçamento precisa ser positivo.');

  const semente =
    filtros.semente ??
    sementeDeTexto(`${nivel}|${disponivel}|${filtros.papel ?? '?'}|${filtros.nome ?? ''}`);
  const rnd = criarPrng(semente);

  const papel = filtros.papel ?? umDe(rnd, PAPEIS_VALIDOS);
  const def = PAPEIS[papel];
  const evitar = new Set<ElementoBaseId>(filtros.evitarElementos ?? []);

  // --- 6.1 núcleo elemental -------------------------------------------------
  const bases = elementosBase().map((e) => e.id as ElementoBaseId);
  const quantidadeNucleo = Math.min(bases.length, tamanhoDoNucleo(disponivel, rnd));
  const nucleo = sortearPonderado(
    rnd,
    bases,
    (id) => {
      const afinidade = afinidadeComPapel(ELEMENTOS[id].pesos, def.alvo);
      // `evitar` derruba o peso mas não zera: com muitos membros no grupo as
      // bases boas para o papel acabam, e é melhor repetir uma base que
      // devolver uma build sem identidade nenhuma.
      return (0.15 + afinidade) * (evitar.has(id) ? 0.12 : 1);
    },
    quantidadeNucleo,
  );

  const p = criarPersonagem(filtros.nome ?? 'sem nome');

  // Distribuição: o primeiro do núcleo é o foco e leva a maior fatia; os
  // demais ficam PRÓXIMOS o bastante para a cascata enxergar par/tripla —
  // é o `min` sobre os pais que decide o destrave, então deixar um componente
  // para trás desperdiça tudo que foi gasto nos outros.
  const orcamentoElementos = Math.floor(disponivel * FATIAS.elementos);
  const pesosNucleo = nucleo.map((_, i) => (i === 0 ? 1.35 : 1));
  const somaPesos = pesosNucleo.reduce((a, b) => a + b, 0);
  nucleo.forEach((id, i) => {
    const pontos = Math.floor((orcamentoElementos * pesosNucleo[i]) / somaPesos);
    if (pontos > 0) investirElemento(p, id, pontos);
  });

  // --- 6.2 escolas ----------------------------------------------------------
  const orcamentoEscolas = Math.floor(disponivel * FATIAS.escolas);
  // A escola PRINCIPAL sai sempre das preferidas do papel: ela é o que torna
  // o papel legível na ficha (e o teto de energia das skills). A variedade
  // entra na segunda escola, sorteada entre todas as outras.
  const escolaPrincipal = sortearPonderado(
    rnd,
    def.escolasPreferidas,
    (id) => 1 + afinidadeComPapel(ESCOLAS[id].pesos, def.alvo),
    1,
  )[0];
  const escolas: EscolaId[] = [escolaPrincipal];
  if (orcamentoEscolas >= 40) {
    escolas.push(
      sortearPonderado(
        rnd,
        (Object.keys(ESCOLAS) as EscolaId[]).filter((id) => id !== escolaPrincipal),
        (id) =>
          (def.escolasPreferidas.includes(id) ? 1.2 : 0.25) +
          afinidadeComPapel(ESCOLAS[id].pesos, def.alvo),
        1,
      )[0],
    );
  }
  // A escola principal fica com 70%: nível de escola é o teto de energia da
  // skill, e duas escolas medianas entregam menos que uma escola alta.
  escolas.forEach((id, i) => {
    const pontos = Math.floor(orcamentoEscolas * (escolas.length === 1 ? 1 : i === 0 ? 0.7 : 0.3));
    if (pontos > 0) investirEscola(p, id, pontos);
  });

  // --- 6.3 recursos ---------------------------------------------------------
  const orcamentoRecursos = Math.floor(disponivel * FATIAS.recursos);
  // Mesmo princípio das escolas: a fonte principal vem do papel (é ela que
  // paga as skills), a segunda é livre.
  const recursoPrincipal = umDe(rnd, def.recursosPreferidos);
  const recursos: RecursoId[] = [recursoPrincipal];
  if (orcamentoRecursos >= 30) {
    recursos.push(
      sortearPonderado(
        rnd,
        (Object.keys(RECURSOS) as RecursoId[]).filter((id) => id !== recursoPrincipal),
        (id) => (def.recursosPreferidos.includes(id) ? 1 : 0.3),
        1,
      )[0],
    );
  }
  recursos.forEach((id, i) => {
    const pontos = Math.floor(orcamentoRecursos * (recursos.length === 1 ? 1 : i === 0 ? 0.75 : 0.25));
    if (pontos > 0) investirRecurso(p, id, pontos);
  });

  // --- 6.4 talentos ---------------------------------------------------------
  // Requisito de escola/recurso e exclusividade de ramo são do motor, não
  // daqui: tentamos investir e aceitamos o "não". Reimplementar a checagem
  // duplicaria a regra e ela divergiria no primeiro talento novo.
  let orcamentoTalentos = Math.floor(disponivel * FATIAS.talentos);
  const candidatosTalento = [
    ...def.talentosPreferidos,
    ...sortearPonderado(rnd, Object.keys(TALENTOS) as TalentoId[], () => 1, 6),
  ];
  for (const id of candidatosTalento) {
    if (orcamentoTalentos <= 0) break;
    const talento = TALENTOS[id];
    if (!talento) continue;
    const ranks = Math.min(talento.ranksMaximos, orcamentoTalentos, inteiro(rnd, 1, 2));
    if (ranks <= 0) continue;
    try {
      investirTalento(p, id, ranks);
      orcamentoTalentos -= ranks;
    } catch {
      // requisito não atendido ou ramo rival: segue para o próximo candidato.
    }
  }

  // --- 6.5 profissão --------------------------------------------------------
  const orcamentoProfissoes = Math.floor(disponivel * FATIAS.profissoes);
  if (orcamentoProfissoes > 0) {
    const profissao = sortearPonderado(
      rnd,
      Object.keys(PROFISSOES) as ProfissaoId[],
      (id) => {
        // profissão que gosta de alguma base do núcleo pontua mais
        const fatores = PROFISSOES[id].fatoresElementos;
        return 0.2 + nucleo.reduce((soma, base) => soma + (fatores[base] ?? 0), 0);
      },
      1,
    )[0];
    investirProfissao(p, profissao, orcamentoProfissoes);
  }

  // --- 6.6 sobra: ponto direto num derivado destravado ----------------------
  // O prêmio da cascata. Só existe se a build de fato destravou algo — e é
  // exatamente isso que torna o resultado interessante de ler.
  let prog = calcularProgressao(p);
  let sobra =
    disponivel -
    custoDeAlocacao(p.elementos).total -
    somaValores(p.escolas) -
    somaValores(p.recursos) -
    somaValores(p.talentos) -
    somaValores(p.profissoes);
  const destravados = [...prog.cascata.destravados]
    .filter((id) => ELEMENTOS[id]?.tipo !== 'base')
    .filter((id) => podeInvestir(p, id, prog).ok)
    .sort((a, b) => (prog.niveisEfetivos[b] ?? 0) - (prog.niveisEfetivos[a] ?? 0) || a.localeCompare(b));
  if (destravados.length && sobra > 0) {
    const alvo = destravados[0];
    const aridade = Math.min(4, Math.max(1, elementoDef(alvo)?.receita?.length ?? 2)) as 1 | 2 | 3 | 4;
    const pontos = Math.floor(sobra / CUSTO_PONTO_ALOCACAO[aridade]);
    if (pontos > 0) {
      investirElemento(p, alvo, pontos, prog);
      sobra -= pontos * CUSTO_PONTO_ALOCACAO[aridade];
      prog = calcularProgressao(p);
    }
  }

  // --- 6.7 nome e skills ----------------------------------------------------
  const elementoPrincipal = escolherElementoPrincipal(prog, nucleo);
  if (!filtros.nome) p.nome = nomearPersonagem(rnd, papel, elementoPrincipal);

  const skills: SkillGerada[] = [];
  const quantasSkills = Math.max(0, filtros.skills ?? 2);
  const paletaElementos = paletaDeElementos(prog, elementoPrincipal);
  for (let i = 0; i < quantasSkills; i++) {
    const elemento = paletaElementos[i % paletaElementos.length];
    const skill = desenharSkill(rnd, p, prog, def, elemento);
    if (skill) skills.push(skill);
  }

  const gasto: GastoOrcamento = {
    elementos: custoDeAlocacao(p.elementos).total,
    escolas: somaValores(p.escolas),
    recursos: somaValores(p.recursos),
    talentos: somaValores(p.talentos),
    profissoes: somaValores(p.profissoes),
    total: 0,
  };
  gasto.total = gasto.elementos + gasto.escolas + gasto.recursos + gasto.talentos + gasto.profissoes;

  return {
    personagem: p,
    papel,
    nivel,
    semente,
    orcamento: { disponivel, gasto, sobra: disponivel - gasto.total },
    progressao: prog,
    skills,
    nucleo,
    elementoPrincipal,
  };
}

function somaValores(m: Partial<Record<string, number>>): number {
  return Object.values(m).reduce<number>((a, b) => a + (b ?? 0), 0);
}

/**
 * O elemento que melhor define a ficha: nível efetivo ponderado pelo fator de
 * potência da geração — uma tripla nível 12 diz mais sobre a build que uma
 * base nível 40 que só existe para alimentá-la.
 */
function escolherElementoPrincipal(prog: Progressao, nucleo: ElementoBaseId[]): ElementoId {
  let melhor: ElementoId = nucleo[0];
  let melhorNota = -1;
  for (const id of prog.elementosDisponiveis) {
    const nivel = prog.niveisEfetivos[id] ?? 0;
    if (nivel <= 0) continue;
    const nota = nivel * (elementoDef(id)?.fatorPotencia ?? 1);
    if (nota > melhorNota || (nota === melhorNota && id.localeCompare(melhor) < 0)) {
      melhorNota = nota;
      melhor = id;
    }
  }
  return melhor;
}

/** Os elementos que valem virar skill, do mais expressivo para o menos. */
function paletaDeElementos(prog: Progressao, principal: ElementoId): ElementoId[] {
  const ordenados = prog.elementosDisponiveis
    .filter((id) => (prog.niveisEfetivos[id] ?? 0) > 0)
    .sort(
      (a, b) =>
        (prog.niveisEfetivos[b] ?? 0) * (elementoDef(b)?.fatorPotencia ?? 1) -
          (prog.niveisEfetivos[a] ?? 0) * (elementoDef(a)?.fatorPotencia ?? 1) ||
        a.localeCompare(b),
    );
  const paleta = [principal, ...ordenados.filter((id) => id !== principal)];
  return paleta.length ? paleta : [principal];
}

// ---------------------------------------------------------------------------
// 7. Desenho de skill
// ---------------------------------------------------------------------------

/**
 * Monta uma skill dentro dos limites da ficha e devolve o cálculo do motor.
 * Se a configuração sair inválida (acontece em orçamento baixo, quando não
 * sobrou proficiência para nenhuma fonte), devolve `undefined` em vez de uma
 * skill quebrada — o consumidor mostra a ficha sem skill, que é honesto.
 */
function desenharSkill(
  rnd: Prng,
  p: Personagem,
  prog: Progressao,
  papel: PapelDef,
  elemento: ElementoId,
): SkillGerada | undefined {
  const escolasComPontos = (Object.keys(p.escolas) as EscolaId[]).filter(
    (id) => (p.escolas[id] ?? 0) > 0,
  );
  const recursosComProficiencia = (Object.keys(p.recursos) as RecursoId[]).filter(
    (id) => (p.recursos[id] ?? 0) > 0,
  );
  if (!escolasComPontos.length || !recursosComProficiencia.length) return undefined;

  const escola =
    escolasComPontos.find((id) => papel.escolasPreferidas.includes(id)) ?? escolasComPontos[0];
  const limites = calcularLimites(p, escola, []);

  const fontes =
    recursosComProficiencia.length > 1 && rnd() < 0.35
      ? [
          { recurso: recursosComProficiencia[0], proporcao: 70 },
          { recurso: recursosComProficiencia[1], proporcao: 30 },
        ]
      : [{ recurso: recursosComProficiencia[0], proporcao: 100 }];

  // 55%..90% do teto de energia: perto do limite sem encostar nele, para a
  // ficha continuar válida se o consumidor mexer num modificador depois.
  const energia = Math.max(1, Math.floor(limites.energiaMaxima * (0.55 + rnd() * 0.35)));
  const alcance = Math.round(limites.alcanceMaximo * papel.forma.fracaoAlcance);

  const cfg: SkillConfig = {
    nome: nomearSkill(rnd, elemento),
    elemento,
    escola,
    fontes,
    energia,
    tempoConjuracaoSegundos: Number(
      (limites.tempoConjuracaoMinimo + rnd() * 2).toFixed(2),
    ),
    alcanceMetros: alcance,
    area:
      papel.forma.area === 'circulo'
        ? { tipo: 'circulo', raioMetros: Math.max(1, Math.round(limites.raioMaximo * (0.4 + rnd() * 0.4))) }
        : { tipo: 'unico' },
    entrega:
      papel.forma.entrega === 'continuo'
        ? { tipo: 'continuo', duracaoSegundos: inteiro(rnd, 3, 8) }
        : { tipo: 'instantaneo' },
  };

  // Modificadores: só os que o motor considera compatíveis, até o número de
  // slots. `avaliarModificador` é a autoridade — não há lista paralela aqui.
  const slots = slotsModificador(p);
  if (slots > 0) {
    const tags = tagsDaSkill(cfg);
    const compativeis = (Object.keys(MODIFICADORES) as ModificadorId[])
      .filter((id) => avaliarModificador(p, cfg, id, tags).compativel)
      .sort();
    const escolhidos = sortearPonderado(rnd, compativeis, () => 1, Math.min(slots, compativeis.length > 1 ? inteiro(rnd, 1, 2) : compativeis.length));
    if (escolhidos.length) cfg.modificadores = escolhidos.sort();
  }

  const { erros } = validarSkill(p, prog, cfg);
  if (erros.length) {
    // Uma tentativa de recuo: energia no mínimo viável e sem modificadores
    // resolve a esmagadora maioria dos casos (teto de energia estourado).
    const recuo: SkillConfig = { ...cfg, energia: Math.max(1, Math.floor(limites.energiaMaxima * 0.4)) };
    delete recuo.modificadores;
    if (validarSkill(p, prog, recuo).erros.length) return undefined;
    return { config: recuo, resultado: calcularSkill(p, prog, recuo) };
  }
  return { config: cfg, resultado: calcularSkill(p, prog, cfg) };
}

// ---------------------------------------------------------------------------
// 8. Geração de grupo
// ---------------------------------------------------------------------------

/**
 * Um grupo é mais que N fichas: cada membro é gerado com uma semente derivada
 * (determinismo preservado) e recebe as bases já usadas pelos anteriores como
 * `evitarElementos`, para o grupo cobrir o mapa elemental em vez de sair com
 * cinco piromantes.
 */
export function gerarGrupo(filtros: FiltrosGrupo = {}): GrupoGerado {
  const nivel = normalizarNivel(filtros.nivel);
  const papeisPedidos = filtros.papeis ?? [];
  for (const papel of papeisPedidos) {
    if (!PAPEIS[papel]) {
      throw new Error(`Papel desconhecido: "${papel}". Use: ${PAPEIS_VALIDOS.join(', ')}.`);
    }
  }
  const quantidade = Math.max(
    1,
    Math.round(filtros.quantidade ?? Math.max(papeisPedidos.length, 4)),
  );
  if (quantidade > 24) {
    throw new Error('Grupo de no máximo 24 membros — acima disso gere em lotes.');
  }

  const papeis = [...papeisPedidos];
  const preenchimento = composicaoPadrao(quantidade);
  for (let i = papeis.length; i < quantidade; i++) {
    // completa evitando repetir papel enquanto houver papel novo disponível
    const jaUsados = new Set(papeis);
    const proximo =
      preenchimento.find((x) => !jaUsados.has(x)) ?? preenchimento[i % preenchimento.length];
    papeis.push(proximo);
  }
  papeis.length = quantidade;

  const semente =
    filtros.semente ?? sementeDeTexto(`grupo|${nivel}|${quantidade}|${papeis.join(',')}`);

  const membros: PersonagemGerado[] = [];
  const usados: ElementoBaseId[] = [];
  for (let i = 0; i < quantidade; i++) {
    const membro = gerarPersonagem({
      nivel,
      orcamento: filtros.orcamento,
      papel: papeis[i],
      // semente derivada: o grupo inteiro é reprodutível a partir de uma só
      semente: (semente + i * 0x9e3779b1) >>> 0,
      skills: filtros.skills,
      evitarElementos: usados,
    });
    usados.push(...membro.nucleo);
    membros.push(membro);
  }

  return {
    nome: filtros.nome ?? `Companhia ${membros[0]?.personagem.nome.split(' ')[0] ?? 'sem nome'}`,
    nivel,
    semente,
    membros,
  };
}
