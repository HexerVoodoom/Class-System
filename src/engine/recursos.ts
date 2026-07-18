/**
 * Simuladores de recurso em tempo real. Cada um implementa a dinâmica
 * descrita no registro:
 *  - Mana: previsível — custo fixo, regen constante.
 *  - Fé: penalidade acumulada a cada uso encarece os próximos; decai
 *    exponencialmente enquanto você não usa.
 *  - Fúria: só nasce do combate (dano causado/recebido) e escoa fora dele.
 *  - Soullink: o pool É a sua vida; consome-a em troca de mais poder e
 *    trava no limiar vital.
 *  - Ressonância: cada uso empilha um multiplicador de poder; ficar sem
 *    usar além da janela reseta o acúmulo para o estado fraco.
 */

import { RECURSOS, type RecursoId } from '../registry/recursos';

export interface EstadoRecurso {
  readonly recurso: RecursoId;
  readonly atual: number;
  readonly maximo: number;
  /** Custo que este estado cobraria agora por um custo-base dado. */
  custoEfetivo(custoBase: number): number;
  /** Tenta pagar; retorna false (sem efeitos) se não há recurso suficiente. */
  usar(custoBase: number): boolean;
  /** Avança a simulação em dt segundos. */
  tick(dtSegundos: number): void;
}

export class ManaEstado implements EstadoRecurso {
  readonly recurso: RecursoId = 'mana';
  readonly maximo: number;
  atual: number;
  private readonly regen: number;

  constructor(proficiencia = 0) {
    const def = RECURSOS.mana;
    this.maximo = def.poolBase + def.poolPorProficiencia * proficiencia;
    this.atual = this.maximo;
    this.regen =
      def.parametros.regenBasePorSegundo! +
      def.parametros.regenPorProficiencia! * proficiencia;
  }

  custoEfetivo(custoBase: number): number {
    return custoBase;
  }

  usar(custoBase: number): boolean {
    if (this.atual < custoBase) return false;
    this.atual -= custoBase;
    return true;
  }

  tick(dt: number): void {
    this.atual = Math.min(this.maximo, this.atual + this.regen * dt);
  }
}

export class FeEstado implements EstadoRecurso {
  readonly recurso: RecursoId = 'fe';
  readonly maximo: number;
  atual: number;
  /** Penalidade acumulada; multiplicador de custo = 1 + penalidade. */
  penalidade = 0;
  private readonly regen: number;
  private readonly acumuloPorEnergia: number;
  private readonly meiaVida: number;
  private readonly multiplicadorMaximo: number;

  constructor(proficiencia = 0) {
    const def = RECURSOS.fe;
    const par = def.parametros;
    this.maximo = def.poolBase + def.poolPorProficiencia * proficiencia;
    this.atual = this.maximo;
    this.regen = par.regenBasePorSegundo! + par.regenPorProficiencia! * proficiencia;
    this.acumuloPorEnergia =
      par.penalidadePorEnergia! *
      Math.max(0.2, 1 - par.reducaoPenalidadePorProficiencia! * proficiencia);
    this.meiaVida = par.meiaVidaPenalidadeSegundos!;
    this.multiplicadorMaximo = par.multiplicadorMaximo!;
  }

  get multiplicadorAtual(): number {
    return Math.min(this.multiplicadorMaximo, 1 + this.penalidade);
  }

  custoEfetivo(custoBase: number): number {
    return custoBase * this.multiplicadorAtual;
  }

  usar(custoBase: number): boolean {
    const custo = this.custoEfetivo(custoBase);
    if (this.atual < custo) return false;
    this.atual -= custo;
    this.penalidade += custoBase * this.acumuloPorEnergia;
    return true;
  }

  tick(dt: number): void {
    this.atual = Math.min(this.maximo, this.atual + this.regen * dt);
    this.penalidade *= Math.pow(0.5, dt / this.meiaVida);
  }
}

export class FuriaEstado implements EstadoRecurso {
  readonly recurso: RecursoId = 'furia';
  readonly maximo: number;
  atual = 0;
  private segundosDesdeUltimoCombate = Infinity;
  private readonly ganhoCausado: number;
  private readonly ganhoRecebido: number;
  private readonly decaimento: number;
  private readonly janelaCombate: number;

  constructor(proficiencia = 0) {
    const def = RECURSOS.furia;
    const par = def.parametros;
    this.maximo = def.poolBase + def.poolPorProficiencia * proficiencia;
    const escala = 1 + par.ganhoPorProficiencia! * proficiencia;
    this.ganhoCausado = par.ganhoPorDanoCausado! * escala;
    this.ganhoRecebido = par.ganhoPorDanoRecebido! * escala;
    this.decaimento = par.decaimentoForaDeCombatePorSegundo!;
    this.janelaCombate = par.segundosParaSairDeCombate!;
  }

  get emCombate(): boolean {
    return this.segundosDesdeUltimoCombate < this.janelaCombate;
  }

  aoCausarDano(dano: number): void {
    this.atual = Math.min(this.maximo, this.atual + dano * this.ganhoCausado);
    this.segundosDesdeUltimoCombate = 0;
  }

  aoReceberDano(dano: number): void {
    this.atual = Math.min(this.maximo, this.atual + dano * this.ganhoRecebido);
    this.segundosDesdeUltimoCombate = 0;
  }

  custoEfetivo(custoBase: number): number {
    return custoBase;
  }

  usar(custoBase: number): boolean {
    if (this.atual < custoBase) return false;
    this.atual -= custoBase;
    return true;
  }

  tick(dt: number): void {
    this.segundosDesdeUltimoCombate += dt;
    if (!this.emCombate) {
      this.atual = Math.max(0, this.atual - this.decaimento * dt);
    }
  }
}

export class SoullinkEstado implements EstadoRecurso {
  readonly recurso: RecursoId = 'soullink';
  /** O pool é a própria vida do personagem. */
  readonly maximo: number;
  atual: number;
  readonly limiarVital: number;
  private readonly regen: number;

  constructor(proficiencia = 0) {
    const def = RECURSOS.soullink;
    const par = def.parametros;
    this.maximo = def.poolBase + def.poolPorProficiencia * proficiencia;
    this.atual = this.maximo;
    this.limiarVital = this.maximo * par.limiarVidaFracao!;
    this.regen = par.regenBasePorSegundo! + par.regenPorProficiencia! * proficiencia;
  }

  custoEfetivo(custoBase: number): number {
    return custoBase;
  }

  usar(custoBase: number): boolean {
    if (this.atual - custoBase < this.limiarVital) return false;
    this.atual -= custoBase;
    return true;
  }

  tick(dt: number): void {
    this.atual = Math.min(this.maximo, this.atual + this.regen * dt);
  }
}

export class RessonanciaEstado implements EstadoRecurso {
  readonly recurso: RecursoId = 'ressonancia';
  readonly maximo: number;
  atual: number;
  /** Multiplicador de poder acumulado (começa fraco em 1.0). */
  multiplicadorAtual = 1;
  private segundosDesdeUltimoUso = 0;
  private readonly regen: number;
  private readonly acumuloPorUso: number;
  private readonly multiplicadorMaximo: number;
  private readonly janelaReset: number;

  constructor(proficiencia = 0) {
    const def = RECURSOS.ressonancia;
    const par = def.parametros;
    this.maximo = def.poolBase + def.poolPorProficiencia * proficiencia;
    this.atual = this.maximo;
    this.regen = par.regenBasePorSegundo! + par.regenPorProficiencia! * proficiencia;
    this.acumuloPorUso = par.acumuloPorUso!;
    this.multiplicadorMaximo = par.multiplicadorPoderMaximo!;
    this.janelaReset = par.janelaResetSegundos!;
  }

  custoEfetivo(custoBase: number): number {
    return custoBase;
  }

  usar(custoBase: number): boolean {
    if (this.atual < custoBase) return false;
    this.atual -= custoBase;
    this.multiplicadorAtual = Math.min(
      this.multiplicadorMaximo,
      this.multiplicadorAtual + this.acumuloPorUso,
    );
    this.segundosDesdeUltimoUso = 0;
    return true;
  }

  tick(dt: number): void {
    this.atual = Math.min(this.maximo, this.atual + this.regen * dt);
    this.segundosDesdeUltimoUso += dt;
    if (this.segundosDesdeUltimoUso >= this.janelaReset) {
      this.multiplicadorAtual = 1; // o "cooldown" venceu: volta ao estado fraco
    }
  }
}

export function criarEstadoRecurso(recurso: RecursoId, proficiencia = 0): EstadoRecurso {
  switch (recurso) {
    case 'mana':
      return new ManaEstado(proficiencia);
    case 'fe':
      return new FeEstado(proficiencia);
    case 'furia':
      return new FuriaEstado(proficiencia);
    case 'soullink':
      return new SoullinkEstado(proficiencia);
    case 'ressonancia':
      return new RessonanciaEstado(proficiencia);
  }
}
