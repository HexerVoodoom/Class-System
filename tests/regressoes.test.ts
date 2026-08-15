/**
 * Regressões: um teste por bug real encontrado, escrito a partir do cenário
 * que o revelou. Cada `describe` cita quem achou e o que estava errado.
 */
import { describe, expect, it } from 'vitest';
import {
  criarPersonagem,
  investirElemento,
  investirEscola,
  investirRecurso,
  investirTalento,
} from '../src/engine/personagem';
import { calcularProgressao } from '../src/engine/progressao';
import {
  TETO_EFICIENCIA_MODIFICADORES,
  calcularSkill,
  type SkillConfig,
} from '../src/engine/skills';
import { calcularFusao } from '../src/engine/fusao';
import { ARQUETIPOS } from '../src/registry/arquetipos';
import { TALENTOS, type TalentoId } from '../src/registry/talentos';
import { elementoDef, elementoDePorComponentes } from '../src/registry/combinacoes';
import { ELEMENTOS } from '../src/registry/elementos';
import type { ElementoBaseId, ElementoId } from '../src/registry/elementos';

const skill = (elemento: string, over: Partial<SkillConfig> = {}): SkillConfig => ({
  nome: 't',
  elemento,
  escola: 'conjuracao',
  fontes: [{ recurso: 'mana', proporcao: 100 }],
  energia: 15,
  tempoConjuracaoSegundos: 2,
  alcanceMetros: 0,
  area: { tipo: 'unico' },
  entrega: { tipo: 'instantaneo' },
  ...over,
});

function ficha(elems: [ElementoBaseId, number][], escola = 12) {
  const p = criarPersonagem('t');
  for (const [e, n] of elems) investirElemento(p, e, n);
  investirEscola(p, 'conjuracao', escola);
  investirRecurso(p, 'mana', 10);
  return p;
}

describe('a fusão não pode perder aridade em silêncio', () => {
  it('fundir Lava (fogo+terra) com Gelo (água+ar) produz a QUÁDRUPLA, não um par', () => {
    const p = ficha([
      ['fogo', 20],
      ['terra', 20],
      ['agua', 20],
      ['ar', 20],
    ]);
    const prog = calcularProgressao(p);
    const r = calcularFusao(p, prog, {
      nome: 'f',
      componentes: [skill('lava'), skill('gelo')],
    });
    // antes: colapsava cada componente na sua base dominante → fogo+agua = Vapor
    expect(r.basesEnvolvidas).toEqual(['fogo', 'agua', 'terra', 'ar']);
    expect(r.elementoResultante).toBe(
      elementoDePorComponentes(['fogo', 'agua', 'terra', 'ar'])!.id,
    );
    expect(r.nomeElementoResultante).not.toBe('Vapor');
  });

  it('a união de bases respeita a aridade máxima e avisa o que ficou de fora', () => {
    const comps: ElementoBaseId[] = ['fogo', 'terra', 'agua', 'ar', 'sombra', 'morte'];
    const p = ficha(comps.map((e) => [e, 20] as [ElementoBaseId, number]));
    const prog = calcularProgressao(p);
    // Lava (fogo+terra) + Gelo (agua+ar) + Espectro (sombra+morte) = 6 bases
    const r = calcularFusao(p, prog, {
      nome: 'f',
      componentes: [skill('lava'), skill('gelo'), skill('espectro')],
    });
    expect(r.basesEnvolvidas).toHaveLength(4);
    expect(r.avisos.some((a) => a.includes('aridade máxima'))).toBe(true);
  });
});

describe('o teto dos modificadores tem que ser relativo, não absoluto', () => {
  it('nenhum encadeamento supera o teto de eficiência', () => {
    const p = ficha([['fogo', 20]], 20);
    investirRecurso(p, 'mana', 10);
    investirTalento(p, 'engenho_de_skill', 3);
    const prog = calcularProgressao(p);
    const base = skill('fogo', {
      energia: 40,
      area: { tipo: 'circulo', raioMetros: 4 },
    });
    const nua = calcularSkill(p, prog, base);
    const eficiencia = (r: { impactoTotal: number; custoTotal: number }) =>
      r.impactoTotal / r.custoTotal;

    // o encadeamento que rendia 2.26× antes da correção
    const combo = calcularSkill(p, prog, {
      ...base,
      modificadores: [
        'repeticao_ecoada',
        'canalizacao_arriscada',
        'sangria_arcana',
        'contencao_disciplinada',
      ],
    });
    const relativa = eficiencia(combo) / eficiencia(nua);
    expect(relativa).toBeLessThanOrEqual(TETO_EFICIENCIA_MODIFICADORES + 0.001);
    expect(combo.tetoModificadoresAtingido).toBe(true);
  });

  it('a troca honesta de Contenção Disciplinada continua valendo a pena', () => {
    const p = ficha([['fogo', 20]], 20);
    const prog = calcularProgressao(p);
    const base = skill('fogo', { energia: 40, area: { tipo: 'circulo', raioMetros: 4 } });
    const nua = calcularSkill(p, prog, base);
    const contido = calcularSkill(p, prog, { ...base, modificadores: ['contencao_disciplinada'] });
    const rel = contido.impactoTotal / contido.custoTotal / (nua.impactoTotal / nua.custoTotal);
    expect(rel).toBeGreaterThan(1.2);
    expect(rel).toBeLessThan(TETO_EFICIENCIA_MODIFICADORES);
    expect(contido.tetoModificadoresAtingido).toBe(false);
  });

  it('alongar a conjuração não compra poder de graça', () => {
    const p = ficha([['fogo', 20]], 20);
    const prog = calcularProgressao(p);
    const base = skill('fogo', { energia: 40 });
    const nua = calcularSkill(p, prog, base);
    // Canalização Arriscada soma +60% ao tempo, que alimenta √tempo no orçamento
    const lenta = calcularSkill(p, prog, { ...base, modificadores: ['canalizacao_arriscada'] });
    const rel = lenta.impactoTotal / lenta.custoTotal / (nua.impactoTotal / nua.custoTotal);
    expect(rel).toBeLessThanOrEqual(TETO_EFICIENCIA_MODIFICADORES + 0.001);
  });
});

describe('requisitos declarados precisam ser alcançáveis de fato', () => {
  it('nenhum arquétipo exige um derivado abaixo do piso da própria receita', () => {
    const mentirosos: string[] = [];
    for (const arq of Object.values(ARQUETIPOS)) {
      for (const [id, limiar] of Object.entries(arq.condicao.elementos ?? {}) as [
        ElementoId,
        number,
      ][]) {
        const def = elementoDef(id);
        if (!def?.receita) continue;
        const piso = def.receita[0].nivelMinimo;
        // o nível de um derivado é o MENOR dos componentes, e cada um precisa
        // atingir o mínimo da receita — logo o derivado nunca existe abaixo do piso
        if (limiar < piso) mentirosos.push(`${arq.id}: ${id}=${limiar} (piso ${piso})`);
      }
    }
    expect(mentirosos).toEqual([]);
  });

  it('todo elemento citado por um arquétipo existe', () => {
    const orfaos: string[] = [];
    for (const arq of Object.values(ARQUETIPOS)) {
      for (const id of Object.keys(arq.condicao.elementos ?? {})) {
        if (!elementoDef(id)) orfaos.push(`${arq.id} → ${id}`);
      }
    }
    expect(orfaos).toEqual([]);
  });
});

describe('a interface precisa alcançar todo o conteúdo', () => {
  it('todo talento do registro aparece em algum grupo da árvore', async () => {
    // a UI agrupa talentos à mão; o registro é a fonte de verdade. 23 dos 65
    // talentos ficaram invisíveis por estarem fora da lista manual.
    const fonte = await import('node:fs').then((fs) =>
      fs.readFileSync('src/ui/app.ts', 'utf8'),
    );
    const ausentes = (Object.keys(TALENTOS) as TalentoId[]).filter(
      (id) => !fonte.includes(`'${id}'`),
    );
    expect(ausentes).toEqual([]);
  });

  it('a entrada pública do pacote expõe as camadas 10 e 11', async () => {
    const api = await import('../src/index');
    expect(typeof (api as Record<string, unknown>).elementoDef).toBe('function');
    expect(typeof (api as Record<string, unknown>).calcularFusao).toBe('function');
    expect((api as Record<string, unknown>).MODIFICADORES).toBeTruthy();
    expect(typeof (api as Record<string, unknown>).caminhoParaArquetipo).toBe('function');
  });
});

describe('o Nulo continua exigindo TODOS os elementos base', () => {
  it('a receita do Nulo cobre os 17 elementos base', () => {
    const bases = Object.values(ELEMENTOS)
      .filter((d) => d.tipo === 'base')
      .map((d) => d.id)
      .sort();
    const receita = ELEMENTOS.nulo.receita!.map((c) => c.elemento).sort();
    expect(receita).toEqual(bases);
  });
});
