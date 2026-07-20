# Class System

Sistema de classes altamente combinável: **elementos**, **recursos**, **escolas**, **talentos** e **arquétipos** se cruzam para gerar uma árvore de progressão única por jogador — com uma calculadora que garante impacto mecânico similar para qualquer build.

```bash
npm install
npm test           # suíte de testes (progressão, recursos, skills, balanceamento, combinações)
npm run demo       # 3 personagens de exemplo + dinâmica de fé/fúria
npm run build:sim  # regenera o simulador interativo (simulador.html)
```

## Simulador interativo

Abra **`simulador.html`** no navegador (arquivo único, auto-contido — o motor real é empacotado dentro dele). Está organizado em **abas**, no espírito do License Board do FFXII:

- **Elementos — o Céu dos Elementos**: um tabuleiro celeste onde os 13 elementos base formam o anel externo e as 78 combinações orbitam em anéis concêntricos rumo ao centro (pares de vizinhos na borda, pares de opostos mais fundo), triplas num anel interno e o **Nulo no coração do céu**. Clique numa estrela para investir; derivados acendem quando os componentes evoluem juntos, e as linhas de receita se iluminam.
- **Escolas**: pontos por escola + os arquétipos que emergem da combinação.
- **Recursos**: proficiência nas cinco fontes de energia (mana, fé, fúria, soullink, ressonância). Cada ponto reduz custo, aumenta regeneração/impacto e encurta a conjuração — e a bancada simula as fontes da skill atual em tempo real.
- **Talentos**: em **árvore** (trilhas e tiers) ou **cartas**.
- **Criar Skill**: sliders para energia, tempo de conjuração, **alcance**, raio e duração — cada um **limitado pelos talentos investidos** (o máximo aparece ao lado). Você **combina várias fontes de energia em proporções livres** (só recursos com proficiência), e **custo, impacto, perfil e propriedades recalculam em tempo real**. Skills de **Evocação** ganham o seletor de fonte (Elemental / Aleatória / Capturada) — evocar qualquer coisa é uma skill com custo e cast. Compare até 4 builds lado a lado.

O estado persiste no `localStorage` entre visitas; dá para **exportar/importar** tudo em JSON e **resetar**.

## Arquitetura

```
src/
  registry/     ← DADOS: o conteúdo do jogo, editável sem tocar no motor
    elementos.ts   elementos base, derivados, sinergias de transbordo
    recursos.ts    mana, fé, fúria, soullink, ressonância e seus parâmetros
    escolas.ts     combate físico, longo alcance, evocação, conjuração, bênção, maldição
    talentos.ts    talentos com ranks, requisitos e ramos exclusivos
    arquetipos.ts  identidades desbloqueadas por combinação (necromante etc.)
    criaturas.ts   bestiário: criaturas capturáveis, famílias e afinidades
  engine/       ← MOTOR: cálculo puro em cima dos dados
    personagem.ts  ficha (só pontos diretos) + regras de investimento
    progressao.ts  níveis efetivos, derivados, arquétipos
    skills.ts      construtor + calculadora de skills (orçamento de poder)
    recursos.ts    simuladores em tempo real de mana/fé/fúria
    evocacao.ts    captura, doma (vínculo) e os 3 modos de evocar
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

O jogador configura cada skill: elemento + escola + **fontes de energia** + **energia investida** + **tempo de conjuração** + **alcance** + **área** (único ou círculo com raio) + **entrega** (instantânea ou contínua).

**Fontes de energia combinadas** — uma skill pode misturar recursos em proporções livres (ex.: 60% mana + 40% fúria), desde que o personagem tenha proficiência em cada fonte. O custo é dividido entre as fontes na proporção escolhida, e a **proficiência ponderada** escala tudo: custo −1%/ponto (até −30%), impacto +0.8%/ponto e conjuração mínima −0.01s/ponto.

A regra central é um **orçamento único de poder**:

```
orçamento = energia × √(tempo de conjuração)
                    × fatorPotência(elemento)
                    × (1 + 0.04·nívelElemento) × (1 + 0.03·nívelEscola)
                    × (1 + bônus de foco de talento)
                    × multFontes            (soullink amplia +30%, na proporção)
                    × (1 + 0.008·proficiência ponderada)
```

Toda escolha de forma apenas **redistribui** o orçamento:

- **Área**: alvos esperados = `1 + 0.15·π·raio²`; o total leva taxa de 10% e é dividido entre os alvos → área nunca é dano grátis.
- **Alcance**: encarece de leve (+0.5%/metro), limitado pelo talento Alcance Estendido.
- **Contínuo (DoT)**: até +30% de total, porém diluído na duração.
- **Evocação**: o orçamento vira criaturas; *Enxame* divide por `quantidade^0.9`, *Colosso* concentra.
- **Perfil**: o impacto se distribui em dano/controle/cura/defesa/suporte pela média dos perfis do elemento e da escola — Água+Maldição pende para controle, Santidade+Bênção para cura, sem mudar o total.

Resultado: `impacto ÷ energia` fica estável entre builds (testado com tolerância <1.35× entre configurações extremas) — **escolhas diferentes, impacto similar**, que era o requisito de design.

Limites configuráveis (energia máx., tempo mín., raio máx., alcance máx.) crescem com escola, talentos e proficiência nas fontes; no simulador, cada slider mostra seu teto e a validação explica exatamente o que destrava mais.

## Camada 6 — Evocação: captura, doma e imbuição

**Evocar é sempre uma skill** (escola Evocação): tem custo, fontes de energia, tempo de conjuração e alcance como qualquer outra. O que muda é a **fonte da evocação**, e capturar criaturas é opcional:

- **Elemental (básica)**: invoca um elemental do próprio elemento da skill — não exige captura.
- **Aleatória**: invoca uma criatura qualquer; quanto mais pontos em Evocação, mais poderosa (fator levemente menor, por não exigir preparo).
- **Capturada**: invoca uma criatura do seu bestiário, **imbuída** do elemento da skill quando você tem **maestria** nele (nível efetivo ≥ 8, base *ou* derivado — ex.: um Lobo de **Chama Azul**). O poder da invocação é o orçamento da skill × um fator de raridade da criatura × o bônus de vínculo (doma).

**Captura depende de afinidade elemental**: cada criatura só pode ser capturada por quem tem pontos em um dos seus elementos de afinidade (Fogo captura feras ígneas; Vida/Vigor capturam animais; Morte, mortos-vivos; etc.). O *poder de captura* = base + nível no elemento de afinidade + Evocação (× talento Instinto de Caça) precisa alcançar a raridade da criatura.

**Doma** é o vínculo permanente: com o talento **Vínculo Primal** você domа criaturas capturadas, que ganham poder por nível de vínculo. **Matilha Domada** vs **Fera Alfa** são o ramo de especialização (muitas feras vinculadas × uma fera muito mais forte), e **Evolução da Fera** amplifica o ganho por vínculo. Sem Doma, capturas ainda podem ser evocadas — só não criam vínculo nem evoluem.

**Sinergia de combate & montaria** (ramo de talentos): **Sincronia de Combate** faz você e a fera lutarem juntos (reforça a invocação e o seu corpo a corpo), **Assalto Coordenado** premia focar o mesmo alvo, **Guarda da Fera** faz a criatura interceptar parte do dano. **Montaria** libera cavalgar uma fera vinculada de porte adequado (famílias besta/aquática/ave/construto/dracônico, poder ≥ 30), e **Carga Montada** transforma a investida montada em dano em linha. No bestiário, feras que atendem aos requisitos ganham o selo **🐎 montável**.

## Estendendo

- **Novo elemento derivado**: adicione em `ELEMENTOS` com `receita` (qualquer aridade — pares, triplas, ou "todos", como o Nulo).
- **Nova sinergia**: uma linha em `SINERGIAS`.
- **Novo arquétipo**: entrada em `ARQUETIPOS` com condição de elementos/escolas/recursos e as capacidades que libera.
- **Nova criatura**: entrada em `CRIATURAS` com família, afinidades (elementos que capturam) e poder-base.
- **Ajuste de balanceamento**: todas as constantes estão no topo de `src/engine/skills.ts`.
