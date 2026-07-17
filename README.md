# Class System

Sistema de classes altamente combinável: **elementos**, **recursos**, **escolas**, **talentos** e **arquétipos** se cruzam para gerar uma árvore de progressão única por jogador — com uma calculadora que garante impacto mecânico similar para qualquer build.

```bash
npm install
npm test        # suíte de testes (progressão, recursos, skills, balanceamento)
npm run demo    # 3 personagens de exemplo + dinâmica de fé/fúria
```

## Arquitetura

```
src/
  registry/     ← DADOS: o conteúdo do jogo, editável sem tocar no motor
    elementos.ts   elementos base, derivados, sinergias de transbordo
    recursos.ts    mana, fé, fúria e seus parâmetros
    escolas.ts     combate físico, longo alcance, evocação, conjuração, bênção, maldição
    talentos.ts    talentos com ranks, requisitos e ramos exclusivos
    arquetipos.ts  identidades desbloqueadas por combinação (necromante etc.)
  engine/       ← MOTOR: cálculo puro em cima dos dados
    personagem.ts  ficha (só pontos diretos) + regras de investimento
    progressao.ts  níveis efetivos, derivados, arquétipos
    skills.ts      construtor + calculadora de skills (orçamento de poder)
    recursos.ts    simuladores em tempo real de mana/fé/fúria
```

A separação é deliberada: **adicionar um elemento, uma receita, uma sinergia ou um arquétipo é só adicionar uma entrada no registro** — o motor lê tudo de forma declarativa.

## Camada 1 — Elementos

**Base** (recebem pontos diretos): fogo, água, terra, ar, eletricidade, arcano, sombra, luz, vileza, morte, vida, vigor.

**Sinergias de transbordo** — investir num elemento vaza para os vizinhos:

| Origem | Destino | Razão |
|---|---|---|
| vida | fogo, água, terra, ar, eletricidade (primais) | 0.20 (5 pts → +1 em cada) |
| fogo ↔ vileza | — | 0.10 |
| sombra ↔ morte | — | 0.10 |
| luz ↔ vida | — | 0.10 |
| arcano | todos os elementos mágicos | 0.05 |

**Derivados** (não aceitam ponto direto; nível = **menor** nível efetivo entre os componentes, exigindo o mínimo da receita — ou seja, evoluem quando os componentes evoluem *juntos*):

| Derivado | Receita | Fator de potência |
|---|---|---|
| Lava | fogo + terra | 1.15 |
| Chama Azul | fogo + morte | 1.20 |
| Vapor | fogo + água | 1.15 |
| Gelo | água + ar | 1.15 |
| Tempestade | ar + eletricidade | 1.15 |
| Cristal | terra + arcano | 1.15 |
| Praga | morte + vileza | 1.20 |
| Equilíbrio | vida + morte | 1.25 |
| Crepúsculo | luz + sombra | 1.25 |
| Chama Demoníaca | fogo + vileza + morte | 1.30 |
| **Nulo** | nível 8+ em **todos** os 12 elementos base | 1.40 |

O *fator de potência* compensa o custo de investir em vários componentes: derivados rendem mais por nível, mas o balanceamento se mantém porque exigem o dobro (ou mais) de pontos.

## Camada 2 — Recursos

| Recurso | Dinâmica |
|---|---|
| **Mana** | Gasto contínuo e previsível: custo fixo, regen constante. |
| **Fé** | Cada uso acumula penalidade que multiplica o custo dos próximos (`custo × (1 + penalidade)`, teto 4×). A penalidade decai com meia-vida de 20s enquanto você não usa. |
| **Fúria** | Não regenera: nasce de dano causado (×0.5) e recebido (×0.8), decai 3/s após 5s fora de combate. |

Proficiência em recurso (pontos investidos) aumenta pool/regen e suaviza as penalidades — e também conta para desbloquear arquétipos.

## Camada 3 — Escolas e Talentos

Escolas: combate físico, longo alcance, evocação, conjuração, bênção (buff), maldição (debuff).

Talentos moldam o *como*: Área Ampliada (+raio máx.), Conjuração Rápida (−tempo mín.), Canalização Profunda (+energia máx.), Economia de Recurso (−custo), e ramos **mutuamente exclusivos**: *Impacto Imediato* vs. *Dano ao Longo do Tempo*; *Enxame* (mais criaturas fracas) vs. *Colosso* (uma criatura poderosa).

## Camada 4 — Arquétipos (desbloqueio por combinação)

Não se escolhe arquétipo — ele emerge da distribuição de pontos:

| Arquétipo | Condição | Libera |
|---|---|---|
| Necromante | morte 10 + evocação 10 | evocar mortos-vivos |
| Verdejante | vida 10 + evocação 10 | evocar plantas |
| Demonologista | vileza 10 + evocação 10 | evocar demônios |
| Senhor dos Mortos Vis | morte 15 + vileza 15 + evocação 15 | evocar **demônios mortos** |
| Arsenal Espectral | evocação 12 + combate físico 12 + fúria 8 | armas autônomas que orbitam você |
| Piromante Vegetal | vida 12 + fogo 12 + evocação 10 | plantas de fogo, vinha de fogo |
| Toxicologista | morte 8 + água 8 + maldição 10 | maldição de veneno |

Skills podem exigir uma capacidade de arquétipo (`capacidadeExigida`), e as condições aceitam níveis **efetivos** — transbordo conta (ex.: fogo alto ajuda a fechar a vileza do Senhor dos Mortos Vis).

## Camada 5 — Construtor de skills e balanceamento

O jogador configura cada skill: elemento + escola + recurso + **energia investida** + **tempo de conjuração** + **área** (único ou círculo com raio) + **entrega** (instantânea ou contínua).

A regra central é um **orçamento único de poder**:

```
orçamento = energia × √(tempo de conjuração)
                    × fatorPotência(elemento)
                    × (1 + 0.04·nívelElemento) × (1 + 0.03·nívelEscola)
                    × (1 + bônus de foco de talento)
```

Toda escolha de forma apenas **redistribui** o orçamento:

- **Área**: alvos esperados = `1 + 0.15·π·raio²`; o total leva taxa de 10% e é dividido entre os alvos → área nunca é dano grátis.
- **Contínuo (DoT)**: até +30% de total, porém diluído na duração.
- **Evocação**: o orçamento vira criaturas; *Enxame* divide por `quantidade^0.9`, *Colosso* concentra.

Resultado: `impacto ÷ energia` fica estável entre builds (testado com tolerância <1.35× entre configurações extremas) — **escolhas diferentes, impacto similar**, que era o requisito de design.

Limites configuráveis (energia máx., tempo mín., raio máx.) crescem com escola e talentos, e a validação explica exatamente qual talento destrava o que.

## Estendendo

- **Novo elemento derivado**: adicione em `ELEMENTOS` com `receita` (qualquer aridade — pares, triplas, ou "todos", como o Nulo).
- **Nova sinergia**: uma linha em `SINERGIAS`.
- **Novo arquétipo**: entrada em `ARQUETIPOS` com condição de elementos/escolas/recursos e as capacidades que libera.
- **Ajuste de balanceamento**: todas as constantes estão no topo de `src/engine/skills.ts`.
