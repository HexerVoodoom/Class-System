/**
 * MODIFICADORES DE SKILL — a camada de 2ª geração.
 *
 * Inspiração declarada: os *support gems* de Path of Exile. Você não inventa
 * uma skill nova; você pega uma que já entende e aumenta a aposta. O contrato
 * que faz isso funcionar é econômico, não decorativo:
 *
 *  1. **O custo é MULTIPLICATIVO.** Cada modificador multiplica o custo da
 *     skill. Três modificadores de 1.25× compõem para 1.95×, não 1.75×. É esse
 *     composto que impede "encaixar tudo".
 *  2. **Compatibilidade por TAG, não por vontade.** Um modificador de projétil
 *     não entra numa skill de área. A maioria das células da matriz
 *     modificador × skill simplesmente não existe — é assim que se evita a
 *     explosão combinatória virar ruído.
 *  3. **Nenhum modificador é ganho puro.** Todo bônus tem contrapartida: custo,
 *     tempo de conjuração, diluição, ou um efeito que não serve a todo build.
 *  4. **Sem unicidade global.** Path of Exile 2 lançou com "cada suporte só uma
 *     vez por build" e removeu na 0.3.0: elegante no papel, irritante na mão.
 *     Aqui a restrição é por compatibilidade e por slots, nunca por escassez.
 *
 * O teto do produto de multiplicadores mora em `engine/skills.ts`
 * (`TETO_MULT_MODIFICADORES`) — sistemas de composição livre sem teto sempre
 * terminam num combo degenerado.
 */

import type { EscolaId } from './escolas';
import type { TalentoId } from './talentos';

/**
 * Tags que uma skill exibe, derivadas da sua configuração. São o contrato
 * legível de compatibilidade — a regra real é a lista `exigeTags`.
 */
export type TagSkill =
  | 'projetil'
  | 'area'
  | 'unico'
  | 'instantaneo'
  | 'continuo'
  | 'invocacao'
  | 'efeito'
  | 'dano'
  | 'marcial'
  | 'magica'
  | 'temporal'
  | 'derivado';

export type ModificadorId =
  // ---- amplificação bruta ----
  | 'sobrecarga_bruta'
  | 'concentracao'
  | 'ressonancia_ampliada'
  // ---- forma ----
  | 'projeteis_multiplos'
  | 'penetracao_encadeada'
  | 'expansao_concentrica'
  | 'implosao_dirigida'
  // ---- tempo ----
  | 'gatilho_atrasado'
  | 'repeticao_ecoada'
  | 'aceleracao_forcada'
  | 'prolongamento'
  // ---- risco e economia ----
  | 'canalizacao_arriscada'
  | 'sangria_arcana'
  | 'contencao_disciplinada'
  // ---- escola ----
  | 'legiao_menor'
  | 'nucleo_reforcado'
  | 'contagio_ampliado'
  | 'graca_estendida'
  | 'mira_absoluta'
  | 'investida_encadeada'
  // ---- elemental ----
  | 'imbuicao_dupla'
  | 'fratura_elemental'
  | 'convergencia_de_receita';

export type EfeitoModificador =
  /** Multiplicativo sobre o orçamento — o "more" do Path of Exile. */
  | { tipo: 'poder_mais'; valor: number }
  /** Aditivo sobre o orçamento, antes dos multiplicativos. */
  | { tipo: 'poder_aumentado'; valor: number }
  /** Soma ao raio efetivo da área (m). */
  | { tipo: 'raio_bonus'; valor: number }
  /** Multiplica os alvos esperados sem mexer no orçamento (dilui por alvo). */
  | { tipo: 'alvos_mult'; valor: number }
  /** Fração somada/subtraída do tempo de conjuração. */
  | { tipo: 'tempo_fracao'; valor: number }
  /** Multiplica a duração de efeitos contínuos. */
  | { tipo: 'duracao_mult'; valor: number }
  /** Multiplica a quantidade de invocações. */
  | { tipo: 'invocacoes_mult'; valor: number }
  /** Propriedade qualitativa exibida no resultado. */
  | { tipo: 'propriedade'; chave: string; rotulo: string; valor: number };

export interface ModificadorDef {
  id: ModificadorId;
  nome: string;
  descricao: string;
  /** Todas estas tags precisam estar presentes na skill. */
  exigeTags: TagSkill[];
  /** Nenhuma destas pode estar presente. */
  proibeTags?: TagSkill[];
  /** Multiplicador de custo — sempre ≥ 1. É o freio do sistema. */
  multiplicadorCusto: number;
  requisito?: { escola?: EscolaId; nivelMinimo?: number; talento?: TalentoId };
  efeitos: EfeitoModificador[];
}

const m = (
  id: ModificadorId,
  nome: string,
  descricao: string,
  exigeTags: TagSkill[],
  multiplicadorCusto: number,
  efeitos: EfeitoModificador[],
  extra: { proibeTags?: TagSkill[]; requisito?: ModificadorDef['requisito'] } = {},
): ModificadorDef => ({ id, nome, descricao, exigeTags, multiplicadorCusto, efeitos, ...extra });

export const MODIFICADORES: Record<ModificadorId, ModificadorDef> = Object.fromEntries(
  [
    // ------------------- amplificação bruta -------------------
    m('sobrecarga_bruta', 'Sobrecarga Bruta',
      'Empurra a skill além do regime seguro: muito mais poder, muito mais caro.',
      ['dano'], 1.45, [{ tipo: 'poder_mais', valor: 0.34 }]),
    m('concentracao', 'Concentração',
      'Aperta o efeito num ponto: mais poder por alvo, área menor.',
      ['area'], 1.2, [
        { tipo: 'poder_mais', valor: 0.22 },
        { tipo: 'raio_bonus', valor: -1.5 },
      ]),
    m('ressonancia_ampliada', 'Ressonância Ampliada',
      'A skill vibra com a anterior: ganha poder proporcional ao acúmulo de ressonância.',
      ['magica'], 1.18, [
        { tipo: 'poder_mais', valor: 0.15 },
        { tipo: 'propriedade', chave: 'ressonancia_encadeada', rotulo: 'Poder extra por acúmulo de ressonância', valor: 0.2 },
      ]),

    // ------------------- forma -------------------
    m('projeteis_multiplos', 'Projéteis Múltiplos',
      'Divide o disparo em três: cobre mais, fere menos por acerto.',
      ['projetil'], 1.35, [
        { tipo: 'alvos_mult', valor: 2.6 },
        { tipo: 'poder_aumentado', valor: 0.15 },
      ], { proibeTags: ['invocacao'] }),
    m('penetracao_encadeada', 'Penetração Encadeada',
      'O efeito atravessa o primeiro alvo e continua na linha.',
      ['projetil'], 1.25, [
        { tipo: 'alvos_mult', valor: 1.8 },
        { tipo: 'propriedade', chave: 'perfura_linha', rotulo: 'Alvos atravessados em linha', valor: 2 },
      ]),
    m('expansao_concentrica', 'Expansão Concêntrica',
      'A área cresce em anéis; o total se espalha por muito mais gente.',
      ['area'], 1.3, [
        { tipo: 'raio_bonus', valor: 3 },
        { tipo: 'poder_aumentado', valor: 0.1 },
      ]),
    m('implosao_dirigida', 'Implosão Dirigida',
      'Em vez de explodir, puxa: converte parte do dano em reposicionamento.',
      ['area'], 1.22, [
        { tipo: 'poder_mais', valor: 0.12 },
        { tipo: 'propriedade', chave: 'atracao', rotulo: 'Força de atração dos alvos', valor: 0.4 },
      ]),

    // ------------------- tempo -------------------
    m('gatilho_atrasado', 'Gatilho Atrasado',
      'O efeito só dispara depois de plantado: mais poder, sem controle de timing.',
      ['magica'], 1.15, [
        { tipo: 'poder_mais', valor: 0.2 },
        { tipo: 'propriedade', chave: 'atraso', rotulo: 'Atraso até detonar (s)', valor: 2 },
      ]),
    m('repeticao_ecoada', 'Repetição Ecoada',
      'A skill se repete uma vez, mais fraca, logo após a primeira.',
      ['magica'], 1.4, [
        { tipo: 'poder_aumentado', valor: 0.55 },
        { tipo: 'tempo_fracao', valor: 0.25 },
        { tipo: 'propriedade', chave: 'repeticoes', rotulo: 'Repetições da conjuração', valor: 1 },
      ]),
    m('aceleracao_forcada', 'Aceleração Forçada',
      'Corta o tempo de conjuração pela metade — e o orçamento sente.',
      [], 1.1, [
        { tipo: 'tempo_fracao', valor: -0.45 },
        { tipo: 'propriedade', chave: 'conjuracao_forcada', rotulo: 'Redução do tempo de conjuração', valor: 0.45 },
      ]),
    m('prolongamento', 'Prolongamento',
      'Estica o efeito contínuo: dura muito mais, com o mesmo total diluído.',
      ['continuo'], 1.2, [
        { tipo: 'duracao_mult', valor: 1.8 },
        { tipo: 'poder_aumentado', valor: 0.12 },
      ]),

    // ------------------- risco e economia -------------------
    m('canalizacao_arriscada', 'Canalização Arriscada',
      'Você se abre enquanto conjura: mais poder, mais tempo parado.',
      [], 1.28, [
        { tipo: 'poder_mais', valor: 0.26 },
        { tipo: 'tempo_fracao', valor: 0.6 },
        { tipo: 'propriedade', chave: 'vulnerabilidade', rotulo: 'Dano recebido durante a conjuração', valor: 0.25 },
      ]),
    m('sangria_arcana', 'Sangria Arcana',
      'Parte do custo sai da sua vida, e o efeito responde à altura.',
      ['magica'], 1.05, [
        { tipo: 'poder_mais', valor: 0.24 },
        { tipo: 'propriedade', chave: 'custo_vital', rotulo: 'Fração do custo paga em vida', valor: 0.35 },
      ]),
    m('contencao_disciplinada', 'Contenção Disciplinada',
      'Abre mão de potência por economia: a única troca negativa do sistema.',
      [], 0.62, [{ tipo: 'poder_mais', valor: -0.2 }]),

    // ------------------- escola -------------------
    m('legiao_menor', 'Legião Menor',
      'Divide o orçamento entre mais criaturas, individualmente mais fracas.',
      ['invocacao'], 1.3, [{ tipo: 'invocacoes_mult', valor: 2 }],
      { requisito: { escola: 'evocacao', nivelMinimo: 8 } }),
    m('nucleo_reforcado', 'Núcleo Reforçado',
      'Uma só criatura, muito mais densa e duradoura.',
      ['invocacao'], 1.34, [
        { tipo: 'poder_mais', valor: 0.28 },
        { tipo: 'duracao_mult', valor: 1.4 },
      ], { requisito: { escola: 'evocacao', nivelMinimo: 8 } }),
    m('contagio_ampliado', 'Contágio Ampliado',
      'A maldição salta sozinha para quem estiver perto do alvo.',
      ['efeito'], 1.32, [
        { tipo: 'alvos_mult', valor: 2.2 },
        { tipo: 'propriedade', chave: 'saltos_extra', rotulo: 'Saltos adicionais da maldição', valor: 2 },
      ], { requisito: { escola: 'maldicao', nivelMinimo: 8 } }),
    m('graca_estendida', 'Graça Estendida',
      'A bênção alcança todo o grupo, sem perder força por alvo.',
      ['efeito'], 1.38, [
        { tipo: 'alvos_mult', valor: 2.4 },
        { tipo: 'poder_aumentado', valor: 0.3 },
      ], { requisito: { escola: 'benca', nivelMinimo: 8 } }),
    m('mira_absoluta', 'Mira Absoluta',
      'Tempo gasto mirando vira dano garantido no ponto fraco.',
      ['projetil'], 1.26, [
        { tipo: 'poder_mais', valor: 0.3 },
        { tipo: 'tempo_fracao', valor: 0.4 },
      ], { requisito: { escola: 'longo_alcance', nivelMinimo: 8 } }),
    m('investida_encadeada', 'Investida Encadeada',
      'O golpe abre uma sequência que se sustenta sozinha.',
      ['marcial'], 1.24, [
        { tipo: 'poder_mais', valor: 0.18 },
        { tipo: 'propriedade', chave: 'elos_sequencia', rotulo: 'Elos da sequência marcial', valor: 3 },
      ], { requisito: { escola: 'combate_fisico', nivelMinimo: 8 } }),

    // ------------------- elemental -------------------
    m('imbuicao_dupla', 'Imbuição Dupla',
      'Carrega a skill com um segundo elemento da sua ficha, somando estados.',
      ['magica'], 1.33, [
        { tipo: 'poder_mais', valor: 0.16 },
        { tipo: 'propriedade', chave: 'segundo_elemento', rotulo: 'Estados de um segundo elemento', valor: 1 },
      ]),
    m('fratura_elemental', 'Fratura Elemental',
      'Racha o alvo na afinidade dele: menos poder cru, muito mais efetividade.',
      ['dano'], 1.16, [
        { tipo: 'poder_mais', valor: -0.08 },
        { tipo: 'propriedade', chave: 'quebra_resistencia', rotulo: 'Resistência elemental ignorada', valor: 0.35 },
      ]),
    m('convergencia_de_receita', 'Convergência de Receita',
      'Só em elementos combinados: cada componente da receita contribui de novo.',
      ['derivado'], 1.42, [
        { tipo: 'poder_mais', valor: 0.3 },
        { tipo: 'propriedade', chave: 'convergencia', rotulo: 'Contribuição extra por componente da receita', valor: 0.08 },
      ]),
  ].map((d) => [d.id, d]),
) as Record<ModificadorId, ModificadorDef>;

export function modificadores(): ModificadorDef[] {
  return Object.values(MODIFICADORES);
}

export const ROTULO_TAG: Record<TagSkill, string> = {
  projetil: 'Projétil',
  area: 'Área',
  unico: 'Alvo único',
  instantaneo: 'Instantâneo',
  continuo: 'Contínuo',
  invocacao: 'Invocação',
  efeito: 'Efeito',
  dano: 'Dano',
  marcial: 'Marcial',
  magica: 'Mágica',
  temporal: 'Temporal',
  derivado: 'Elemento combinado',
};
