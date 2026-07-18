# Class System

Sistema de classes altamente combinável: **elementos**, **recursos**, **escolas**, **talentos** e **arquétipos** se cruzam para gerar uma árvore de progressão única por jogador — com uma calculadora que garante impacto mecânico similar para qualquer build.

```bash
npm install
npm test           # suíte de testes (progressão, recursos, skills, balanceamento, combinações)
npm run demo       # 3 personagens de exemplo + dinâmica de fé/fúria
npm run build:sim  # regenera o simulador interativo (simulador.html)
```

## Simulador interativo

Abra **`simulador.html`** no navegador (arquivo único, auto-contido — o motor real é empacotado dentro dele). Nele você pode:

- distribuir pontos em elementos, escolas, recursos e talentos, com orçamento configurável — talentos em três visualizações: **árvore** (trilhas e tiers), **constelação** (céu noturno interativo) e cartas;
- ver ao vivo os níveis efetivos (com sinergia), o progresso de **todos os elementos combinados** e dos arquétipos;
- montar skills no construtor (elemento + escola + recurso + energia + tempo + área + entrega) e ver custo, impacto, perfil e propriedades calculados na hora;
- salvar skills na build, **exportar/importar** tudo em JSON e **resetar**.

O estado persiste no `localStorage` entre visitas.

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

**Base** (recebem pontos diretos): fogo, água, terra, ar, eletricidade, arcano, sombra, luz, vileza, morte, vida, vigor, **marcial** (maestria de armas e armas evocadas).

**Sinergias de transbordo** — investir num elemento vaza para os vizinhos:

| Origem | Destino | Razão |
|---|---|---|
| vida | fogo, água, terra, ar, eletricidade (primais) | 0.20 (5 pts → +1 em cada) |
| fogo ↔ vileza | — | 0.10 |
| sombra ↔ morte | — | 0.10 |
| luz ↔ vida | — | 0.10 |
| vigor ↔ vida | — | 0.10 |
| terra | vigor | 0.05 |
| eletricidade | ar | 0.05 |
| arcano | todos os elementos mágicos | 0.05 |

Cada elemento (e escola) tem um **perfil mecânico** — pesos de dano/controle/cura/defesa/suporte — que molda o resultado das skills. Derivados herdam a média dos perfis dos componentes: a identidade da combinação emerge sozinha.

**Derivados** (não aceitam ponto direto; nível = **menor** nível efetivo entre os componentes, exigindo o mínimo da receita — ou seja, evoluem quando os componentes evoluem *juntos*):

- **Todos os 78 pares** dos 13 elementos base existem — Vapor (fogo+água), Lava (fogo+terra), Plasma (fogo+eletricidade), Fênix (fogo+vida), Pântano (água+terra), Gelo (água+ar), Veneno (água+morte), Ácido (água+vileza), Abismo (água+sombra), Areia (terra+ar), Magnetismo (terra+eletricidade), Flora (terra+vida), Titã (terra+vigor), Tempestade (ar+eletricidade), Éter (ar+arcano), Miasma (ar+morte), Galvanismo (eletricidade+morte), Runa (arcano+luz), Pacto (arcano+vileza), Alma (arcano+morte), Espectro (sombra+morte), Parasita (sombra+vida), Assassínio (sombra+vigor), Julgamento (luz+morte), Santidade (luz+vida), Praga (vileza+morte), Mutação (vileza+vida), Carnificina (vileza+vigor), Equilíbrio (morte+vida), Ceifa (morte+vigor)… — a lista completa (com descrição de cada um) está em `src/registry/elementos.ts`, e um teste garante que nenhum par falte.
- **Triplas**: Chama Demoníaca (fogo+vileza+morte), Furacão (água+ar+eletricidade), Selva (água+terra+vida), Abominação (sombra+morte+vileza), Eclipse (luz+sombra+arcano), Reencarnação (vida+morte+arcano), Sobrecarga (eletricidade+arcano+vigor), Ascensão (luz+vida+vigor), Núcleo (fogo+terra+eletricidade) — fator 1.30.
- **Amplas**: Primordial (os 5 primais, fator 1.35), Ciclo (vida+morte+luz+sombra, fator 1.35) e **Nulo** (nível 8+ em **todos** os 12 base, fator 1.40).

Pares têm fator de potência 1.15 (opostos como Equilíbrio e Crepúsculo, 1.20–1.25). O *fator de potência* compensa o custo de investir em vários componentes: derivados rendem mais por nível, mas o balanceamento se mantém porque exigem o dobro (ou mais) de pontos.

## Camada 2 — Recursos

| Recurso | Dinâmica |
|---|---|
| **Mana** | Gasto contínuo e previsível: custo fixo, regen constante. |
| **Fé** | Cada uso acumula penalidade que multiplica o custo dos próximos (`custo × (1 + penalidade)`, teto 4×). A penalidade decai com meia-vida de 20s enquanto você não usa. |
| **Fúria** | Não regenera: nasce de dano causado (×0.5) e recebido (×0.8), decai 3/s após 5s fora de combate. |
| **Soullink** | Paga o custo com a própria **vida** e amplifica o poder da skill em +30%; recusa consumir abaixo do limiar vital (10%). |
| **Ressonância** | Começa fraca (×1.0) e cada uso acumula +10% de poder até ×1.5; ficar **8s sem usar reseta** o acúmulo para o estado fraco (o inverso da fé). |

Proficiência em recurso (pontos investidos) aumenta pool/regen e suaviza as penalidades — e também conta para desbloquear arquétipos.

## Camada 3 — Escolas e Talentos

Escolas: combate físico, longo alcance, evocação, conjuração, bênção (buff), maldição (debuff) — cada uma com seu perfil mecânico.

Talentos moldam o *como* (30 talentos em 9 grupos):

- **Gerais**: Área Ampliada, Conjuração Rápida, Alcance Estendido, Canalização Profunda, Economia de Recurso, Persistência.
- **Entrega** (exclusivos): Impacto Imediato vs. Dano ao Longo do Tempo.
- **Conjuração**: Perfuração vs. Estilhaço; Eco Arcano.
- **Evocação**: Enxame vs. Colosso; Autonomia vs. Comando; Vínculo Marcial; Simbiose.
- **Maldição**: Contágio vs. Aflição Profunda.
- **Bênção**: Égide vs. Exaltação; Vínculo de Grupo.
- **Combate Físico**: Sequência Marcial vs. Golpe Devastador; Postura Inabalável.
- **Longo Alcance**: Olho de Águia vs. Rajada.
- **Recursos**: Devoção (fé), Fluxo Constante (mana), Sede de Batalha (fúria) — exigem proficiência no recurso.

Talentos de escola exigem nível na escola; ramos exclusivos definem playstyle e as propriedades deles aparecem na skill calculada (penetração de defesa, saltos de contágio, chance de crítico…).

## Camada 4 — Arquétipos (desbloqueio por combinação)

Não se escolhe arquétipo — ele emerge da distribuição de pontos. São 29, e as condições podem exigir **elementos derivados** (que só existem via combinação):

- **Evocadores**: Necromante (morte+evocação), Verdejante (vida+evocação), Demonologista (vileza+evocação), Senhor dos Mortos Vis (demônios *mortos*), Arsenal Espectral (evocação+combate físico+fúria → armas autônomas), Piromante Vegetal, Engenheiro Galvânico (galvanismo → constructos), Senhor das Feras, Tecelão de Abominações, Avatar Primordial.
- **Conjuradores**: Lavamante, Tempestário, Feiticeiro do Abismo, Arquimago (arcano 20 + três escolas), Portador do Nulo (nega e reflete magia).
- **Marciais**: Berserker, Cavaleiro da Morte (ceifa), Paladino (bravura+fé), Espadachim Arcano (encantamento), Sombra Ambulante (assassínio), Olho da Tormenta (tempestade+longo alcance), Atirador Fantasma (espectro → tiros atravessam paredes).
- **Suporte/híbridos**: Santo Guardião (santidade), Mestre das Runas, Corruptor (mutação), Toxicologista (veneno), Inquisidor (julgamento), Vampiro Espiritual (parasita), Guardião do Ciclo (inverte cura↔dano).

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
- **Perfil**: o impacto se distribui em dano/controle/cura/defesa/suporte pela média dos perfis do elemento e da escola — Água+Maldição pende para controle, Santidade+Bênção para cura, sem mudar o total.

Resultado: `impacto ÷ energia` fica estável entre builds (testado com tolerância <1.35× entre configurações extremas) — **escolhas diferentes, impacto similar**, que era o requisito de design.

Limites configuráveis (energia máx., tempo mín., raio máx.) crescem com escola e talentos, e a validação explica exatamente qual talento destrava o que.

## Estendendo

- **Novo elemento derivado**: adicione em `ELEMENTOS` com `receita` (qualquer aridade — pares, triplas, ou "todos", como o Nulo).
- **Nova sinergia**: uma linha em `SINERGIAS`.
- **Novo arquétipo**: entrada em `ARQUETIPOS` com condição de elementos/escolas/recursos e as capacidades que libera.
- **Ajuste de balanceamento**: todas as constantes estão no topo de `src/engine/skills.ts`.
