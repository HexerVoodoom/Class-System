import { describe, expect, it } from 'vitest';
import {
  criarPersonagem,
  investirElemento,
  investirEscola,
  investirRecurso,
  investirTalento,
  capturarCriatura,
  domarCriatura,
  soltarCriatura,
} from '../src/engine/personagem';
import { calcularProgressao } from '../src/engine/progressao';
import {
  avaliarCaptura,
  avaliarMontaria,
  bonusSinergiaCombate,
  capacidadeVinculo,
  elementosDeMaestria,
  evocar,
  MAESTRIA_LIMIAR,
} from '../src/engine/evocacao';
import { calcularSkill, type SkillConfig } from '../src/engine/skills';

function evocador(): ReturnType<typeof criarPersonagem> {
  const p = criarPersonagem('t');
  investirEscola(p, 'evocacao', 10);
  return p;
}

describe('captura por afinidade elemental', () => {
  it('sem afinidade no elemento da criatura, não captura', () => {
    const p = evocador();
    investirElemento(p, 'fogo', 12); // salamandra é ígnea (fogo) — ok; lobo exige vida/vigor
    const prog = calcularProgressao(p);
    const lobo = avaliarCaptura(p, prog, 'lobo');
    expect(lobo.capturavel).toBe(false);
    expect(lobo.motivo).toMatch(/afinidade/i);
    const salamandra = avaliarCaptura(p, prog, 'salamandra');
    expect(salamandra.capturavel).toBe(true);
  });

  it('afinidade com vida permite capturar animais', () => {
    const p = evocador();
    investirElemento(p, 'vida', 10);
    const prog = calcularProgressao(p);
    expect(avaliarCaptura(p, prog, 'lobo').capturavel).toBe(true);
  });

  it('criatura poderosa exige mais poder de captura', () => {
    const p = evocador();
    investirElemento(p, 'fogo', 4); // pouco
    const prog = calcularProgressao(p);
    const dragao = avaliarCaptura(p, prog, 'dragao_jovem'); // poderBase 120
    expect(dragao.capturavel).toBe(false);
    expect(dragao.poder).toBeLessThan(dragao.exigido);
  });

  it('instinto de caça aumenta o poder de captura', () => {
    const p = evocador();
    investirElemento(p, 'fogo', 10);
    const semTalento = avaliarCaptura(p, calcularProgressao(p), 'demonio_maior').poder;
    investirTalento(p, 'instinto_de_caca', 3);
    const comTalento = avaliarCaptura(p, calcularProgressao(p), 'demonio_maior').poder;
    expect(comTalento).toBeGreaterThan(semTalento);
  });

  it('capturar adiciona ao bestiário; não captura o incapturável', () => {
    const p = evocador();
    investirElemento(p, 'vida', 10);
    const prog = calcularProgressao(p);
    capturarCriatura(p, prog, 'lobo');
    expect(p.bestiario.map((c) => c.criaturaId)).toContain('lobo');
    expect(() => capturarCriatura(p, prog, 'lobo')).toThrow(/já está/);
    expect(() => capturarCriatura(p, prog, 'dragao_jovem')).toThrow(/afinidade|insuficiente/i);
  });
});

describe('modos de evocação', () => {
  it('elemental: básica, sem captura, escala com nível do elemento', () => {
    const p = evocador();
    investirElemento(p, 'fogo', 12);
    const prog = calcularProgressao(p);
    const r = evocar(p, prog, { modo: 'elemental', elemento: 'fogo' });
    expect(r.valida).toBe(true);
    expect(r.nome).toMatch(/Elemental de Fogo/);
    expect(r.poder).toBeGreaterThan(0);
  });

  it('aleatória: sempre disponível; mais evocação = mais poder', () => {
    const fraco = criarPersonagem('a');
    investirEscola(fraco, 'evocacao', 5);
    const forte = criarPersonagem('b');
    investirEscola(forte, 'evocacao', 15);
    const pf = evocar(fraco, calcularProgressao(fraco), { modo: 'aleatoria' });
    const pF = evocar(forte, calcularProgressao(forte), { modo: 'aleatoria' });
    expect(pf.valida).toBe(true);
    expect(pF.poder).toBeGreaterThan(pf.poder);
  });

  it('capturada imbuída exige maestria no elemento', () => {
    const p = evocador();
    investirElemento(p, 'vida', 10);
    investirElemento(p, 'fogo', 3); // abaixo do limiar de maestria
    const prog = calcularProgressao(p);
    capturarCriatura(p, prog, 'lobo');
    const semMaestria = evocar(p, prog, {
      modo: 'capturada',
      criaturaId: 'lobo',
      elementoImbuido: 'fogo',
    });
    expect(semMaestria.valida).toBe(false);
    expect(semMaestria.erros.join(' ')).toMatch(/maestria/i);
  });

  it('imbuir com elemento de maestria amplifica e renomeia a criatura', () => {
    const p = evocador();
    investirElemento(p, 'vida', 10);
    investirElemento(p, 'fogo', 12); // maestria (>= limiar)
    expect(elementosDeMaestria(calcularProgressao(p))).toContain('fogo');
    const prog = calcularProgressao(p);
    capturarCriatura(p, prog, 'lobo');
    const puro = evocar(p, prog, { modo: 'capturada', criaturaId: 'lobo' });
    const imbuido = evocar(p, prog, {
      modo: 'capturada',
      criaturaId: 'lobo',
      elementoImbuido: 'fogo',
    });
    expect(imbuido.valida).toBe(true);
    expect(imbuido.poder).toBeGreaterThan(puro.poder);
    expect(imbuido.nome).toMatch(/Lobo Cinzento de Fogo/);
    expect(imbuido.imbuido).toBe('fogo');
  });

  it('elemento derivado (chama azul) pode imbuir se tiver maestria', () => {
    const p = evocador();
    investirElemento(p, 'vida', 10);
    investirElemento(p, 'fogo', 14);
    investirElemento(p, 'morte', 13); // chama_azul = min(14,13) = 13 >= limiar
    const prog = calcularProgressao(p);
    expect(prog.niveisEfetivos.chama_azul).toBeGreaterThanOrEqual(MAESTRIA_LIMIAR);
    capturarCriatura(p, prog, 'lobo');
    const r = evocar(p, prog, {
      modo: 'capturada',
      criaturaId: 'lobo',
      elementoImbuido: 'chama_azul',
    });
    expect(r.valida).toBe(true);
    expect(r.nome).toMatch(/Chama Azul/);
  });
});

describe('doma (vínculo)', () => {
  it('domar exige o talento Vínculo Primal', () => {
    const p = evocador();
    investirElemento(p, 'vida', 10);
    const prog = calcularProgressao(p);
    capturarCriatura(p, prog, 'lobo');
    expect(capacidadeVinculo(p)).toBe(0);
    expect(() => domarCriatura(p, 'lobo')).toThrow(/Vínculo Primal/);
  });

  it('vínculo aumenta o poder da criatura evocada e respeita a capacidade', () => {
    const p = criarPersonagem('domador');
    investirElemento(p, 'vida', 12);
    investirEscola(p, 'evocacao', 12);
    investirTalento(p, 'vinculo_primal', 1); // capacidade 1
    const prog = calcularProgressao(p);
    capturarCriatura(p, prog, 'lobo');
    capturarCriatura(p, prog, 'urso');

    const semVinculo = evocar(p, prog, { modo: 'capturada', criaturaId: 'lobo', nivelVinculo: 0 });
    domarCriatura(p, 'lobo'); // vínculo 1
    const loboVinc = p.bestiario.find((c) => c.criaturaId === 'lobo')!;
    const comVinculo = evocar(p, prog, {
      modo: 'capturada',
      criaturaId: 'lobo',
      nivelVinculo: loboVinc.nivelVinculo,
    });
    expect(comVinculo.poder).toBeGreaterThan(semVinculo.poder);
    expect(comVinculo.vinculada).toBe(true);

    // capacidade 1: não dá pra vincular a segunda
    expect(() => domarCriatura(p, 'urso')).toThrow(/[Cc]apacidade/);
  });

  it('matilha domada aumenta a capacidade de vínculo', () => {
    const p = criarPersonagem('matilha');
    investirEscola(p, 'evocacao', 12);
    investirTalento(p, 'vinculo_primal', 1);
    investirTalento(p, 'matilha_domada', 2);
    expect(capacidadeVinculo(p)).toBe(3); // 1 + 2
  });

  it('soltar remove do bestiário', () => {
    const p = evocador();
    investirElemento(p, 'vida', 10);
    capturarCriatura(p, calcularProgressao(p), 'lobo');
    soltarCriatura(p, 'lobo');
    expect(p.bestiario).toHaveLength(0);
  });
});

describe('sinergia de combate e montaria', () => {
  function domador(): ReturnType<typeof criarPersonagem> {
    const p = criarPersonagem('dom');
    investirElemento(p, 'vida', 12);
    investirElemento(p, 'vigor', 12);
    investirEscola(p, 'evocacao', 12);
    investirEscola(p, 'combate_fisico', 8);
    investirTalento(p, 'vinculo_primal', 1);
    return p;
  }

  it('montaria exige talento, vínculo e porte adequado', () => {
    const p = domador();
    capturarCriatura(p, calcularProgressao(p), 'urso'); // besta, poder 42
    capturarCriatura(p, calcularProgressao(p), 'falcao'); // ave, poder 26 (< mínimo)

    // sem talento montaria
    expect(avaliarMontaria(p, 'urso').montavel).toBe(false);
    expect(avaliarMontaria(p, 'urso').motivo).toMatch(/talento Montaria/);

    investirTalento(p, 'montaria', 1);
    // capturado mas não vinculado
    expect(avaliarMontaria(p, 'urso').motivo).toMatch(/vinculada/);
    domarCriatura(p, 'urso');
    expect(avaliarMontaria(p, 'urso').montavel).toBe(true);

    // falcão vinculado, mas porte insuficiente
    // (capacidade 1 já usada pelo urso — solta o vínculo do urso p/ testar porte)
    investirTalento(p, 'matilha_domada', 1); // capacidade 2
    domarCriatura(p, 'falcao');
    expect(avaliarMontaria(p, 'falcao').montavel).toBe(false);
    expect(avaliarMontaria(p, 'falcao').motivo).toMatch(/[Pp]orte/);
  });

  it('família não-montável (imp) nunca é montaria', () => {
    const p = domador();
    investirElemento(p, 'vileza', 10);
    investirTalento(p, 'montaria', 1);
    capturarCriatura(p, calcularProgressao(p), 'imp'); // demônio
    domarCriatura(p, 'imp');
    expect(avaliarMontaria(p, 'imp').montavel).toBe(false);
    expect(avaliarMontaria(p, 'imp').motivo).toMatch(/família|Família/);
  });

  it('sincronia de combate escala com ranks e reforça a invocação', () => {
    const p = domador();
    expect(bonusSinergiaCombate(p)).toBe(0);
    investirTalento(p, 'sincronia_de_combate', 3);
    expect(bonusSinergiaCombate(p)).toBeCloseTo(0.15, 10);
  });
});

describe('evocação como skill (custo + cast + fonte)', () => {
  function evocadorSkill(): ReturnType<typeof criarPersonagem> {
    const p = criarPersonagem('evk');
    investirElemento(p, 'vida', 12);
    investirElemento(p, 'fogo', 12); // maestria p/ imbuir
    investirEscola(p, 'evocacao', 12);
    investirRecurso(p, 'mana', 6);
    return p;
  }
  function skillEvoc(extra: Partial<SkillConfig> = {}): SkillConfig {
    return {
      nome: 'Evocar',
      elemento: 'fogo',
      escola: 'evocacao',
      fontes: [{ recurso: 'mana', proporcao: 100 }],
      energia: 25,
      tempoConjuracaoSegundos: 2,
      alcanceMetros: 0,
      area: { tipo: 'unico' },
      entrega: { tipo: 'instantaneo' },
      ...extra,
    };
  }

  it('skill paga custo e tem cast — invocação básica é um elemental', () => {
    const p = evocadorSkill();
    const r = calcularSkill(p, calcularProgressao(p), skillEvoc());
    expect(r.valida).toBe(true);
    expect(r.custoTotal).toBeGreaterThan(0);
    expect(r.invocacoes!.nome).toMatch(/Elemental de Fogo/);
  });

  it('capturada exige a criatura no bestiário', () => {
    const p = evocadorSkill();
    const cfg = skillEvoc({ evocacao: { modo: 'capturada', criaturaId: 'lobo' } });
    const semCaptura = calcularSkill(p, calcularProgressao(p), cfg);
    expect(semCaptura.valida).toBe(false);
    expect(semCaptura.erros.join(' ')).toMatch(/não está no seu bestiário/);

    capturarCriatura(p, calcularProgressao(p), 'lobo');
    const comCaptura = calcularSkill(p, calcularProgressao(p), cfg);
    expect(comCaptura.valida).toBe(true);
    expect(comCaptura.invocacoes!.nome).toMatch(/Lobo Cinzento de Fogo/); // imbuída (fogo maestria)
    expect(comCaptura.invocacoes!.imbuida).toBe(true);
  });

  it('criatura capturada rende mais que elemental na mesma skill (raridade + vínculo)', () => {
    const p = evocadorSkill();
    capturarCriatura(p, calcularProgressao(p), 'urso'); // poderBase 42
    const elemental = calcularSkill(p, calcularProgressao(p), skillEvoc());
    const capturada = calcularSkill(
      p,
      calcularProgressao(p),
      skillEvoc({ evocacao: { modo: 'capturada', criaturaId: 'urso' } }),
    );
    expect(capturada.invocacoes!.poderTotal).toBeGreaterThan(elemental.invocacoes!.poderTotal);
  });

  it('aleatória rende um pouco menos que o elemental (sem preparo)', () => {
    const p = evocadorSkill();
    const elemental = calcularSkill(p, calcularProgressao(p), skillEvoc());
    const aleatoria = calcularSkill(
      p,
      calcularProgressao(p),
      skillEvoc({ evocacao: { modo: 'aleatoria' } }),
    );
    expect(aleatoria.invocacoes!.poderTotal).toBeLessThan(elemental.invocacoes!.poderTotal);
    expect(aleatoria.invocacoes!.nome).toMatch(/Aleatória/);
  });

  it('vínculo de doma aumenta o poder da criatura evocada pela skill', () => {
    const p = criarPersonagem('domador');
    investirElemento(p, 'vida', 12);
    investirEscola(p, 'evocacao', 12);
    investirRecurso(p, 'mana', 6);
    investirTalento(p, 'vinculo_primal', 1);
    capturarCriatura(p, calcularProgressao(p), 'lobo');
    const cfg: SkillConfig = {
      nome: 'Evocar Lobo',
      elemento: 'vida',
      escola: 'evocacao',
      fontes: [{ recurso: 'mana', proporcao: 100 }],
      energia: 25,
      tempoConjuracaoSegundos: 2,
      alcanceMetros: 0,
      area: { tipo: 'unico' },
      entrega: { tipo: 'instantaneo' },
      evocacao: { modo: 'capturada', criaturaId: 'lobo' },
    };
    const semVinculo = calcularSkill(p, calcularProgressao(p), cfg);
    domarCriatura(p, 'lobo');
    const comVinculo = calcularSkill(p, calcularProgressao(p), cfg);
    expect(comVinculo.invocacoes!.poderTotal).toBeGreaterThan(semVinculo.invocacoes!.poderTotal);
  });
});
