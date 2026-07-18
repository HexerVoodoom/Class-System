import { describe, expect, it } from 'vitest';
import {
  FeEstado,
  FuriaEstado,
  ManaEstado,
  RessonanciaEstado,
  SoullinkEstado,
} from '../src/engine/recursos';

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

describe('soullink', () => {
  it('consome a própria vida ao usar', () => {
    const s = new SoullinkEstado(0);
    expect(s.atual).toBe(100);
    expect(s.usar(30)).toBe(true);
    expect(s.atual).toBe(70);
  });

  it('recusa consumir abaixo do limiar vital (10%)', () => {
    const s = new SoullinkEstado(0);
    s.usar(80); // fica com 20
    expect(s.usar(15)).toBe(false); // 20 - 15 = 5 < 10
    expect(s.atual).toBe(20);
    expect(s.usar(10)).toBe(true); // 20 - 10 = 10 = limiar exato
  });

  it('vida regenera devagar', () => {
    const s = new SoullinkEstado(0);
    s.usar(50);
    s.tick(10); // 1/s
    expect(s.atual).toBe(60);
  });
});

describe('ressonância', () => {
  it('começa fraca e fica mais forte a cada uso, até o teto', () => {
    const r = new RessonanciaEstado(0);
    expect(r.multiplicadorAtual).toBe(1);
    r.usar(10);
    r.usar(10);
    expect(r.multiplicadorAtual).toBeCloseTo(1.2, 10);
    for (let i = 0; i < 10; i++) {
      r.usar(5);
      r.tick(1); // segue usando dentro da janela
    }
    expect(r.multiplicadorAtual).toBeCloseTo(1.5, 10); // teto
  });

  it('ficar sem usar além da janela reseta para o estado fraco', () => {
    const r = new RessonanciaEstado(0);
    r.usar(10);
    r.usar(10);
    r.tick(5); // dentro da janela de 8s: mantém
    expect(r.multiplicadorAtual).toBeCloseTo(1.2, 10);
    r.tick(4); // 9s acumulados sem usar: reset
    expect(r.multiplicadorAtual).toBe(1);
  });

  it('usar dentro da janela zera o relógio do reset', () => {
    const r = new RessonanciaEstado(0);
    r.usar(10);
    r.tick(6);
    r.usar(10); // relógio volta a zero
    r.tick(6); // ainda dentro da nova janela
    expect(r.multiplicadorAtual).toBeCloseTo(1.2, 10);
  });
});
