import { describe, expect, it } from 'vitest';
import { FeEstado, FuriaEstado, ManaEstado } from '../src/engine/recursos';

describe('mana', () => {
  it('custo previsível e regen constante', () => {
    const m = new ManaEstado(0);
    expect(m.custoEfetivo(30)).toBe(30);
    expect(m.usar(30)).toBe(true);
    expect(m.atual).toBe(70);
    m.tick(2); // 5/s
    expect(m.atual).toBe(80);
  });

  it('proficiência aumenta pool e regen', () => {
    const m = new ManaEstado(10);
    expect(m.maximo).toBe(200);
  });
});

describe('fé', () => {
  it('cada uso encarece o próximo', () => {
    const f = new FeEstado(0);
    const c1 = f.custoEfetivo(20);
    f.usar(20);
    const c2 = f.custoEfetivo(20);
    f.usar(20);
    const c3 = f.custoEfetivo(20);
    expect(c1).toBe(20);
    expect(c2).toBeGreaterThan(c1);
    expect(c3).toBeGreaterThan(c2);
  });

  it('penalidade decai com o tempo sem usar', () => {
    const f = new FeEstado(0);
    for (let i = 0; i < 5; i++) f.usar(20);
    const custoQuente = f.custoEfetivo(20);
    f.tick(60); // 3 meias-vidas
    const custoFrio = f.custoEfetivo(20);
    expect(custoFrio).toBeLessThan(custoQuente);
    expect(custoFrio).toBeLessThan(20 * 1.4);
  });

  it('multiplicador tem teto', () => {
    const f = new FeEstado(0);
    for (let i = 0; i < 100; i++) {
      f.usar(20);
      f.atual = f.maximo; // ignora pool para testar só a penalidade
    }
    expect(f.custoEfetivo(20)).toBeLessThanOrEqual(20 * 4);
  });
});

describe('fúria', () => {
  it('nasce do combate: ofensiva e defensiva', () => {
    const fu = new FuriaEstado(0);
    expect(fu.atual).toBe(0);
    fu.aoCausarDano(40); // +20
    fu.aoReceberDano(25); // +20
    expect(fu.atual).toBe(40);
  });

  it('decai fora de combate, mas não durante', () => {
    const fu = new FuriaEstado(0);
    fu.aoCausarDano(100);
    const cheia = fu.atual;
    fu.tick(3); // ainda em combate (janela de 5s)
    expect(fu.atual).toBe(cheia);
    fu.tick(10); // saiu de combate → decai
    expect(fu.atual).toBeLessThan(cheia);
  });

  it('não paga o que não tem', () => {
    const fu = new FuriaEstado(0);
    expect(fu.usar(10)).toBe(false);
    fu.aoCausarDano(100);
    expect(fu.usar(10)).toBe(true);
  });
});
