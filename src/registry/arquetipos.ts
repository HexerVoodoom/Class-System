/**
 * Registro de arquétipos: identidades que EMERGEM da distribuição de pontos
 * — nunca são escolhidas. Condições podem exigir níveis efetivos de
 * elementos (inclusive DERIVADOS, já que eles têm nível efetivo), níveis de
 * escola e proficiência de recurso.
 *
 * Cada arquétipo libera capacidades que skills podem exigir.
 */

import type { ElementoId } from './elementos';
import type { EscolaId } from './escolas';
import type { RecursoId } from './recursos';

export interface CondicaoArquetipo {
  elementos?: Partial<Record<ElementoId, number>>;
  escolas?: Partial<Record<EscolaId, number>>;
  recursos?: Partial<Record<RecursoId, number>>;
}

export interface ArquetipoDef {
  id: string;
  nome: string;
  descricao: string;
  condicao: CondicaoArquetipo;
  capacidades: string[];
}

const a = (
  id: string,
  nome: string,
  descricao: string,
  condicao: CondicaoArquetipo,
  capacidades: string[],
): ArquetipoDef => ({ id, nome, descricao, condicao, capacidades });

export const ARQUETIPOS: Record<string, ArquetipoDef> = Object.fromEntries(
  [
    // ---------- evocadores ----------
    a('necromante', 'Necromante', 'Morte + Evocação: ergue mortos-vivos para lutar por você.',
      { elementos: { morte: 10 }, escolas: { evocacao: 10 } },
      ['evocar_mortos_vivos']),
    a('verdejante', 'Verdejante', 'Vida + Evocação: invoca plantas guardiãs e vinhas.',
      { elementos: { vida: 10 }, escolas: { evocacao: 10 } },
      ['evocar_plantas']),
    a('demonologista', 'Demonologista', 'Vileza + Evocação: sela pactos e invoca demônios.',
      { elementos: { vileza: 10 }, escolas: { evocacao: 10 } },
      ['evocar_demonios']),
    a('senhor_dos_mortos_vis', 'Senhor dos Mortos Vis', 'Necromante com Vileza: invoca demônios mortos.',
      { elementos: { morte: 15, vileza: 15 }, escolas: { evocacao: 15 } },
      ['evocar_demonios_mortos']),
    a('arsenal_espectral', 'Arsenal Espectral', 'Evocação + Combate Físico + Fúria: armas que orbitam você e lutam sozinhas.',
      { escolas: { evocacao: 12, combate_fisico: 12 }, recursos: { furia: 8 } },
      ['evocar_armas_autonomas']),
    a('piromante_vegetal', 'Piromante Vegetal', 'Verdejante com Fogo: plantas e vinhas em chamas.',
      { elementos: { vida: 12, fogo: 12 }, escolas: { evocacao: 10 } },
      ['evocar_plantas_de_fogo', 'conjurar_vinha_de_fogo']),
    a('engenheiro_galvanico', 'Engenheiro Galvânico', 'Galvanismo + Evocação: constructos de carne e raio reanimados.',
      { elementos: { galvanismo: 10 }, escolas: { evocacao: 12 } },
      ['evocar_constructos_galvanicos']),
    a('senhor_das_feras', 'Senhor das Feras', 'Vigor + Vida + Evocação: feras vivas de carne e instinto.',
      { elementos: { vigor: 12, vida: 12 }, escolas: { evocacao: 10 } },
      ['evocar_feras']),
    a('horologista_do_horror', 'Tecelão de Abominações', 'Abominação + Evocação: costura horrores que não deveriam existir.',
      { elementos: { abominacao: 15 }, escolas: { evocacao: 15 } },
      ['evocar_abominacoes']),
    a('avatar_primordial', 'Avatar Primordial', 'Primordial + Evocação: o próprio terreno luta ao seu lado.',
      { elementos: { primordial: 12 }, escolas: { evocacao: 12 } },
      ['evocar_elementais_primais']),

    // ---------- conjuradores ----------
    a('lavamante', 'Lavamante', 'Lava + Conjuração: erupções e rios de magma.',
      { elementos: { lava: 12 }, escolas: { conjuracao: 10 } },
      ['conjurar_erupcao']),
    a('tempestario', 'Tempestário', 'Tempestade + Conjuração: comanda o céu em fúria.',
      { elementos: { tempestade: 12 }, escolas: { conjuracao: 10 } },
      ['conjurar_tempestade']),
    a('feiticeiro_do_abismo', 'Feiticeiro do Abismo', 'Abismo + Conjuração: pressão das profundezas em terra firme.',
      { elementos: { abismo: 12 }, escolas: { conjuracao: 10 } },
      ['conjurar_abismo']),
    a('arquimago', 'Arquimago', 'Arcano profundo + três escolas mágicas: reescreve as regras.',
      { elementos: { arcano: 20 }, escolas: { conjuracao: 10, evocacao: 10, benca: 10 } },
      ['metamagia']),
    a('portador_do_nulo', 'Portador do Nulo', 'Nulo: nega, absorve e devolve qualquer magia.',
      { elementos: { nulo: 8 } },
      ['anular_magia', 'refletir_magia']),

    // ---------- marciais ----------
    a('berserker', 'Berserker', 'Vigor + Combate Físico + Fúria: quanto mais apanha, mais forte.',
      { elementos: { vigor: 12 }, escolas: { combate_fisico: 12 }, recursos: { furia: 10 } },
      ['furia_crescente']),
    a('cavaleiro_da_morte', 'Cavaleiro da Morte', 'Ceifa + Combate Físico: golpes que colhem almas.',
      { elementos: { ceifa: 12 }, escolas: { combate_fisico: 10 } },
      ['golpe_ceifador']),
    a('paladino', 'Paladino', 'Bravura + Combate Físico + Fé: o muro sagrado.',
      { elementos: { bravura: 10 }, escolas: { combate_fisico: 10 }, recursos: { fe: 8 } },
      ['aura_sagrada', 'golpe_justiceiro']),
    a('espadachim_arcano', 'Espadachim Arcano', 'Encantamento + Combate Físico: lâminas imbuídas de magia.',
      { elementos: { encantamento: 12 }, escolas: { combate_fisico: 10 } },
      ['lamina_arcana']),
    a('sombra_ambulante', 'Sombra Ambulante', 'Assassínio + Combate Físico: o golpe único e perfeito.',
      { elementos: { assassinio: 12 }, escolas: { combate_fisico: 10 } },
      ['execucao_furtiva']),
    a('olho_da_tormenta', 'Olho da Tormenta', 'Tempestade + Longo Alcance: flechas-relâmpago que nunca erram.',
      { elementos: { tempestade: 10 }, escolas: { longo_alcance: 12 } },
      ['flecha_relampago']),
    a('atirador_fantasma', 'Atirador Fantasma', 'Espectro + Longo Alcance: projéteis que atravessam paredes.',
      { elementos: { espectro: 10 }, escolas: { longo_alcance: 12 } },
      ['tiro_fantasma']),
    a('mestre_de_armas', 'Mestre de Armas', 'Marcial + Combate Físico: domina qualquer arma que toca.',
      { elementos: { marcial: 12 }, escolas: { combate_fisico: 10 } },
      ['maestria_de_armas']),
    a('forjador_de_guerra', 'Forjador de Guerra', 'Forja + Evocação: evoca armas incandescentes recém-saídas da bigorna.',
      { elementos: { forja: 12 }, escolas: { evocacao: 10 } },
      ['evocar_armas_flamejantes']),
    a('arsenal_arcano', 'Arsenal Arcano', 'Arsenal + Evocação: um enxame de armas etéreas conjuradas.',
      { elementos: { arsenal: 12 }, escolas: { evocacao: 10 } },
      ['evocar_arsenal_arcano']),
    a('avatar_da_guerra', 'Avatar da Guerra', 'Avatar de Guerra + Soullink: paga com a alma para SER a guerra.',
      { elementos: { avatar_de_guerra: 15 }, recursos: { soullink: 10 } },
      ['forma_avatar_de_guerra']),

    // ---------- suporte / híbridos ----------
    a('santo_guardiao', 'Santo Guardião', 'Santidade + Bênção: a cura mais pura do sistema.',
      { elementos: { santidade: 12 }, escolas: { benca: 12 } },
      ['cura_sagrada']),
    a('mestre_das_runas', 'Mestre das Runas', 'Runa + Bênção: efeitos persistentes gravados em aliados e no chão.',
      { elementos: { runa: 12 }, escolas: { benca: 10 } },
      ['gravar_runas']),
    a('corruptor', 'Corruptor', 'Mutação + Maldição: transforma inimigos contra si mesmos.',
      { elementos: { mutacao: 12 }, escolas: { maldicao: 10 } },
      ['maldicao_mutante']),
    a('toxicologista', 'Toxicologista', 'Veneno + Maldição: toxinas que corroem ao longo do tempo.',
      { elementos: { veneno: 10 }, escolas: { maldicao: 10 } },
      ['maldicao_veneno']),
    a('inquisidor', 'Inquisidor', 'Julgamento + Maldição: pune e executa os enfraquecidos.',
      { elementos: { julgamento: 12 }, escolas: { maldicao: 10 } },
      ['sentenca_final']),
    a('vampiro_espiritual', 'Vampiro Espiritual', 'Parasita + Maldição: drena vida à distância.',
      { elementos: { parasita: 12 }, escolas: { maldicao: 10 } },
      ['dreno_vital']),
    a('guardiao_do_ciclo', 'Guardião do Ciclo', 'Ciclo + Bênção + Maldição: inverte cura e dano, buff e maldição.',
      { elementos: { ciclo: 12 }, escolas: { benca: 10, maldicao: 10 } },
      ['inverter_estado']),

    // ---------- inspirados em Tree of Savior / FF / Ragnarok / WoW / D&D ----------
    a('geomante', 'Geomante', 'Terra + Conjuração (FF/D&D): molda o próprio terreno como arma.',
      { elementos: { terra: 12 }, escolas: { conjuracao: 12 } },
      ['moldar_terreno', 'campo_elemental']),
    a('cronomante', 'Cronomante', 'Tempo + Bênção + Maldição (ToS/FF): dobra o tempo — pressa, lentidão e reversão.',
      { elementos: { tempo: 12 }, escolas: { benca: 10, maldicao: 8 } },
      ['acelerar', 'retardar', 'reverter_tempo']),
    a('senhor_do_paradoxo', 'Senhor do Paradoxo', 'Paradoxo (tempo+arcano+morte) + Conjuração: desfaz causas e efeitos.',
      { elementos: { paradoxo: 12 }, escolas: { conjuracao: 12 } },
      ['anular_acao', 'rebobinar']),
    a('bardo', 'Bardo', 'Ar + Bênção (Ragnarok/D&D/ToS): canções que fortalecem o grupo.',
      { elementos: { ar: 10 }, escolas: { benca: 12 } },
      ['cancoes_de_batalha', 'ensemble']),
    a('alquimista', 'Alquimista', 'Água + Arcano + Bênção (Ragnarok/ToS): poções, bombas e homúnculo.',
      { elementos: { agua: 10, arcano: 10 }, escolas: { benca: 8, conjuracao: 8 } },
      ['pocoes', 'bomba_acida', 'criar_homunculo']),
    a('xama_totemico', 'Xamã Totêmico', 'Eletricidade + Bênção (WoW): finca totens que emanam poder.',
      { elementos: { eletricidade: 12 }, escolas: { benca: 10 } },
      ['fincar_totens']),
    a('feiticeiro_de_cartas', 'Feiticeiro de Cartas', 'Evocação + Doma (ToS Sorcerer): sela monstros em cartas e os invoca.',
      { escolas: { evocacao: 15 }, recursos: { mana: 10 } },
      ['selar_carta', 'invocar_chefe']),
    a('bokor', 'Bokor', 'Morte + Vileza + Maldição (ToS): vodu, bonecos e zumbis servos.',
      { elementos: { morte: 12, vileza: 10 }, escolas: { maldicao: 12 } },
      ['boneco_vodu', 'zumbi_servo']),
    a('tecelao_de_sangue', 'Tecelão de Sangue', 'Soullink + Maldição (ToS Featherfoot): magia de sangue e drenagem.',
      { escolas: { maldicao: 12 }, recursos: { soullink: 12 } },
      ['magia_de_sangue', 'transfusao']),
    a('cavaleiro_dragao', 'Cavaleiro Dragão', 'Esgrima + Combate + Montaria (FF Dragoon): saltos e lanças aladas.',
      { elementos: { esgrima: 12 }, escolas: { combate_fisico: 12 } },
      ['salto_draconico', 'lanca_alada']),
    a('cavalaria_negra', 'Cavalaria Negra', 'Longo Alcance + Fúria montado (ToS Schwarzer Reiter): pistoleiro de cavalaria.',
      { escolas: { longo_alcance: 12, combate_fisico: 8 }, recursos: { furia: 10 } },
      ['tiro_montado', 'salva_de_cavalaria']),
    a('mago_vermelho', 'Mago Vermelho', 'Fogo + Arcano + Bênção + Maldição (FF): meio-mago, meio-espadachim.',
      { elementos: { fogo: 10, arcano: 10 }, escolas: { conjuracao: 8, benca: 8, maldicao: 8 } },
      ['conjuracao_dupla', 'espada_encantada']),
    a('cabalista', 'Cabalista', 'Cristal + Luz + Bênção (ToS Kabbalist): numerologia que manipula vida e sorte.',
      { elementos: { cristal: 10, luz: 10 }, escolas: { benca: 12 } },
      ['gematria', 'ampliar_vida']),
    a('invocador', 'Invocador', 'Arcano + Vida/Morte + Evocação (FF Summoner): chama entidades primordiais.',
      { elementos: { arcano: 15, equilibrio: 12 }, escolas: { evocacao: 12 } },
      ['invocar_esper']),

    // ---------- som / gravidade / espaço ----------
    a('menestrel', 'Menestrel', 'Som + Bênção (Ragnarok Bard/D&D): canções que fortalecem o grupo.',
      { elementos: { som: 12 }, escolas: { benca: 12 } },
      ['reger_sinfonia', 'brado_de_guerra']),
    a('trovador_sombrio', 'Trovador Sombrio', 'Dissonância (som+vileza) + Maldição: canções que quebram a mente.',
      { elementos: { dissonancia: 12 }, escolas: { maldicao: 10 } },
      ['cancao_dissonante']),
    a('senhor_da_gravidade', 'Senhor da Gravidade', 'Gravidade + Conjuração (FF): esmaga e prende com o próprio peso do mundo.',
      { elementos: { gravidade: 12 }, escolas: { conjuracao: 12 } },
      ['campo_gravitacional', 'demi']),
    a('astromante', 'Astromante', 'Espaço + Conjuração (ToS Sage/FF): meteoros, portais e o poder das estrelas.',
      { elementos: { espaco: 12 }, escolas: { conjuracao: 12 } },
      ['chuva_de_meteoros', 'abrir_portal']),
    a('viajante_dimensional', 'Viajante Dimensional', 'Continuum (espaço+tempo) + Arcano: move-se por onde e quando quiser.',
      { elementos: { continuum: 12 }, escolas: { conjuracao: 10, benca: 8 } },
      ['saltar_dimensao', 'ancorar_tempo']),
    a('demiurgo', 'Demiurgo', 'Big Bang (espaço+gravidade+tempo) + Conjuração: cria e destrói mundos.',
      { elementos: { big_bang: 15 }, escolas: { conjuracao: 15 } },
      ['genese', 'colapso_final']),
  ].map((def) => [def.id, def]),
);
