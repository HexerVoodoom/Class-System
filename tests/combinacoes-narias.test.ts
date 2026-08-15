import { describe, expect, it } from 'vitest';
import {
  QUADRUPLAS,
  TODAS_COMBINACOES,
  TRIPLAS,
  buscarCombinacoes,
  chaveCombinacao,
  coesaoDe,
  combinacaoInfoPorComponentes,
  combinacoesRelevantes,
  elementoDePorComponentes,
  elementoDef,
  fatorDeCombinacao,
  generoDoNome,
  minimoDeCombinacao,
  nomeProcedural,
  FATOR_BASE_ARIDADE,
} from '../src/registry/combinacoes';
import { elementosBase, type ElementoBaseId } from '../src/registry/elementos';
import {
  criarPersonagem,
  investirElemento,
  investirEscola,
  investirRecurso,
  investirTalento,
} from '../src/engine/personagem';
import { calcularProgressao } from '../src/engine/progressao';
import { calcularSkill, type SkillConfig } from '../src/engine/skills';

const skill = (elemento: string, over: Partial<SkillConfig> = {}): SkillConfig => ({
  nome: 't',
  elemento,
  escola: 'conjuracao',
  fontes: [{ recurso: 'mana', proporcao: 100 }],
  energia: 20,
  tempoConjuracaoSegundos: 2,
  alcanceMetros: 0,
  area: { tipo: 'unico' },
  entrega: { tipo: 'instantaneo' },
  ...over,
});

function ficha(elems: [ElementoBaseId, number][]) {
  const p = criarPersonagem('t');
  for (const [e, n] of elems) investirElemento(p, e, n);
  investirEscola(p, 'conjuracao', 12);
  investirRecurso(p, 'mana', 10);
  return p;
}

describe('o espaço completo de combinações', () => {
  it('enumera exatamente C(17,3) triplas e C(17,4) quádruplas', () => {
    expect(TRIPLAS).toHaveLength(680);
    expect(QUADRUPLAS).toHaveLength(2380);
    expect(TODAS_COMBINACOES).toHaveLength(3060);
  });

  it('toda combinação tem um id único', () => {
    expect(new Set(TODAS_COMBINACOES.map((c) => c.id)).size).toBe(3060);
  });

  it('toda combinação tem um NOME único — a nomenclatura procedural não colide', () => {
    const nomes = new Set(TODAS_COMBINACOES.map((c) => elementoDef(c.id)!.nome));
    expect(nomes.size).toBe(3060);
  });

  it('a ordenação dos componentes não altera a resolução', () => {
    const a = elementoDePorComponentes(['sombra', 'fogo', 'terra']);
    const b = elementoDePorComponentes(['terra', 'sombra', 'fogo']);
    expect(a?.id).toBe(b?.id);
    expect(chaveCombinacao(['sombra', 'fogo'])).toBe(chaveCombinacao(['fogo', 'sombra']));
  });

  it('as combinações curadas mantêm o nome escrito à mão', () => {
    expect(elementoDePorComponentes(['fogo', 'terra', 'ar'])?.nome).toBe('Vulcão');
    expect(elementoDePorComponentes(['espaco', 'fogo', 'gravidade'])?.nome).toBe('Supernova');
    expect(elementoDePorComponentes(['agua', 'ar', 'eletricidade', 'som'])?.nome).toBe(
      'Tempestade Perfeita',
    );
  });

  it('as combinações já registradas à mão em elementos.ts não são duplicadas', () => {
    // chama_demoniaca (fogo+vileza+morte) mora em elementos.ts e deve ser
    // reencontrada pela chave, com o id original
    expect(combinacaoInfoPorComponentes(['fogo', 'vileza', 'morte'])?.id).toBe('chama_demoniaca');
  });
});

describe('nomenclatura procedural', () => {
  it('a tripla herda o nome do par dominante mais o adjetivo do terceiro', () => {
    // fogo+terra = Lava (feminino) → adjetivo de sombra concorda em feminino
    expect(nomeProcedural(['fogo', 'terra', 'sombra'])).toBe('Lava Umbria');
  });

  it('a quádrupla une os dois pares, ensinando a linhagem', () => {
    // fogo+terra = Lava; sombra+morte = Espectro
    expect(nomeProcedural(['fogo', 'terra', 'sombra', 'morte'])).toBe('Lava do Espectro');
  });

  it('a preposição concorda com o gênero do segundo par', () => {
    expect(generoDoNome('Lava')).toBe('f');
    expect(generoDoNome('Espectro')).toBe('m');
    // -ção e -são são femininos; outros -ão não
    expect(generoDoNome('Implosão')).toBe('f');
    expect(generoDoNome('Trovão')).toBe('m');
    // gregos em -ma escapam da regra da terminação
    expect(generoDoNome('Miasma')).toBe('m');
  });

  it('a busca encontra combinações procedurais pelo nome gerado', () => {
    const achados = buscarCombinacoes('Lava do Espectro', 5);
    expect(achados.length).toBeGreaterThan(0);
    expect(elementoDef(achados[0].id)!.nome).toBe('Lava do Espectro');
  });
});

describe('coerência: harmonia, tensão e paradoxo', () => {
  it('componentes que se negam produzem tensão e pagam mais', () => {
    // vida e morte são opostos declarados na tabela de afinidade
    const tenso = coesaoDe(['vida', 'morte', 'luz']);
    const calmo = coesaoDe(['fogo', 'vileza', 'morte']);
    expect(tenso.tensao).toBeGreaterThan(calmo.tensao);
    expect(fatorDeCombinacao(['vida', 'morte', 'luz'])).toBeGreaterThan(
      fatorDeCombinacao(['fogo', 'vileza', 'morte']),
    );
  });

  it('mais tensão custa mais nível mínimo em cada componente', () => {
    const paradoxal = coesaoDe(['agua', 'fogo', 'terra']);
    expect(paradoxal.coerencia).toBe('paradoxo');
    expect(minimoDeCombinacao(['agua', 'fogo', 'terra'])).toBeGreaterThan(
      minimoDeCombinacao(['fogo', 'vileza', 'morte']),
    );
  });

  it('o fator de potência cresce com a aridade', () => {
    expect(FATOR_BASE_ARIDADE[2]).toBeLessThan(FATOR_BASE_ARIDADE[3]);
    expect(FATOR_BASE_ARIDADE[3]).toBeLessThan(FATOR_BASE_ARIDADE[4]);
  });
});

describe('progressão pelas combinações amplas', () => {
  it('quatro elementos no mínimo liberam a quádrupla', () => {
    const comps: ElementoBaseId[] = ['fogo', 'terra', 'sombra', 'morte'];
    const info = combinacaoInfoPorComponentes(comps)!;
    const p = ficha(comps.map((e) => [e, info.nivelMinimo] as [ElementoBaseId, number]));
    const prog = calcularProgressao(p);
    expect(prog.niveisEfetivos[info.id]).toBeGreaterThan(0);
    expect(prog.combinacoesLiberadas.map((c) => c.id)).toContain(info.id);
  });

  it('um componente abaixo do mínimo mantém a combinação fechada', () => {
    const comps: ElementoBaseId[] = ['fogo', 'terra', 'sombra', 'morte'];
    const info = combinacaoInfoPorComponentes(comps)!;
    const p = ficha([
      ['fogo', info.nivelMinimo],
      ['terra', info.nivelMinimo],
      ['sombra', info.nivelMinimo],
      ['morte', info.nivelMinimo - 5],
    ]);
    expect(calcularProgressao(p).niveisEfetivos[info.id] ?? 0).toBe(0);
  });

  it('Sintonia de Receita abaixa o mínimo e destrava combinações antes', () => {
    const comps: ElementoBaseId[] = ['fogo', 'terra', 'sombra', 'morte'];
    const info = combinacaoInfoPorComponentes(comps)!;
    const nivel = info.nivelMinimo - 4;
    const semTalento = ficha(comps.map((e) => [e, nivel] as [ElementoBaseId, number]));
    expect(calcularProgressao(semTalento).niveisEfetivos[info.id] ?? 0).toBe(0);

    const comTalento = ficha(comps.map((e) => [e, nivel] as [ElementoBaseId, number]));
    investirTalento(comTalento, 'sintonia_de_receita', 2); // −4 níveis
    const prog = calcularProgressao(comTalento);
    expect(prog.reducaoMinimoReceita).toBe(4);
    expect(prog.niveisEfetivos[info.id]).toBeGreaterThan(0);
  });

  it('combinacoesRelevantes devolve um recorte pequeno, nunca as 3.060', () => {
    const p = ficha([
      ['fogo', 20],
      ['terra', 20],
      ['sombra', 20],
      ['morte', 20],
    ]);
    const prog = calcularProgressao(p);
    const rel = combinacoesRelevantes(prog.niveisEfetivos, { limite: 50 });
    expect(rel.length).toBeLessThanOrEqual(50);
    // as desbloqueadas vêm primeiro
    expect(rel[0].nivel).toBeGreaterThan(0);
  });
});

describe('compensação de aridade — combinar precisa ser competitivo', () => {
  it('com o mesmo orçamento de pontos, combinar fica dentro de 25% de especializar', () => {
    const PONTOS = 100;
    const pura = ficha([['fogo', PONTOS]]);
    const impPura = calcularSkill(pura, calcularProgressao(pura), skill('fogo')).impactoTotal;

    const comps: ElementoBaseId[] = ['fogo', 'terra', 'sombra', 'morte'];
    const quad = ficha(comps.map((e) => [e, PONTOS / 4] as [ElementoBaseId, number]));
    const progQ = calcularProgressao(quad);
    const defQ = elementoDePorComponentes(comps)!;
    expect(progQ.niveisEfetivos[defQ.id]).toBeGreaterThan(0);
    const impQuad = calcularSkill(quad, progQ, skill(defQ.id)).impactoTotal;

    // especializar ainda vence no poder bruto — e deve vencer, porque combinar
    // já paga em largura. O que não pode é a diferença ser esmagadora.
    expect(impPura).toBeGreaterThan(impQuad);
    expect(impPura / impQuad).toBeLessThan(1.25);
  });

  it('sem a compensação de aridade a quádrupla seria irrelevante — o bônus por nível escala', () => {
    const comps: ElementoBaseId[] = ['fogo', 'terra', 'sombra', 'morte'];
    const p = ficha(comps.map((e) => [e, 25] as [ElementoBaseId, number]));
    const prog = calcularProgressao(p);
    const defQ = elementoDePorComponentes(comps)!;
    const par = elementoDePorComponentes(['fogo', 'terra'])!;
    const impQuad = calcularSkill(p, prog, skill(defQ.id)).impactoTotal;
    const impPar = calcularSkill(p, prog, skill(par.id)).impactoTotal;
    // no mesmo nível efetivo, a quádrupla rende mais que o par
    expect(impQuad).toBeGreaterThan(impPar);
  });
});

describe('meias-identidades: aridade compra largura, não altura', () => {
  it('uma combinação ampla concede capacidades diluídas de arquétipos que a contêm', () => {
    // lava (fogo+terra) + conjuração = Lavamante. Quem abre fogo+terra+sombra
    // recebe a meia-identidade do Lavamante sem ser Lavamante pleno.
    const p = ficha([
      ['fogo', 16],
      ['terra', 16],
      ['sombra', 16],
    ]);
    const prog = calcularProgressao(p);
    expect(prog.capacidades.has('conjurar_erupcao')).toBe(true); // pleno, aqui
    // uma combinação que contenha um arquétipo que a ficha NÃO alcança plenamente
    expect(prog.arquetiposDiluidos.length + prog.arquetipos.length).toBeGreaterThan(0);
  });

  it('a capacidade diluída habilita a skill, com penalidade de impacto', () => {
    const comps: ElementoBaseId[] = ['agua', 'terra', 'morte'];
    const p = ficha(comps.map((e) => [e, 20] as [ElementoBaseId, number]));
    const prog = calcularProgressao(p);
    // veneno = agua+morte → Toxicologista exige maldição, que a ficha não tem;
    // a combinação ampla concede a versão diluída
    const temDiluida = prog.capacidadesDiluidas.size > 0;
    expect(temDiluida).toBe(true);
    const cap = [...prog.capacidadesDiluidas][0];
    const r = calcularSkill(p, prog, skill('veneno', { capacidadeExigida: cap }));
    expect(r.valida).toBe(true);
    expect(r.propriedades.map((x) => x.chave)).toContain('capacidade_diluida');
    const semCap = calcularSkill(p, prog, skill('veneno'));
    expect(r.impactoTotal).toBeLessThan(semCap.impactoTotal);
  });
});

describe('o registro completo continua íntegro', () => {
  it('todos os 17 elementos base seguem aceitando pontos diretos', () => {
    expect(elementosBase()).toHaveLength(17);
    const p = criarPersonagem('t');
    for (const e of elementosBase()) investirElemento(p, e.id as ElementoBaseId, 1);
    expect(Object.keys(p.elementos)).toHaveLength(17);
  });

  it('elementoDef resolve base, curado e procedural pelo mesmo caminho', () => {
    expect(elementoDef('fogo')?.tipo).toBe('base');
    expect(elementoDef('lava')?.tipo).toBe('derivado');
    const proc = combinacaoInfoPorComponentes(['fogo', 'terra', 'sombra'])!;
    expect(elementoDef(proc.id)?.receita).toHaveLength(3);
  });
});
