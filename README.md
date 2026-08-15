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

- **Elementos — o Céu dos Elementos**: um tabuleiro celeste onde os 17 elementos base formam o anel externo e **3.196 combinações de 2 a 4 elementos** orbitam rumo ao centro em faixas por aridade — pares, triplas, quádruplas — com o **Nulo no coração do céu**. Cada combinação tem um **endereço permanente**: a direção diz de quais elementos ela nasce, a profundidade diz quão dispersos eles são, e a faixa diz quantos são. Uma estrela nunca se move porque outra apareceu. Controles de **profundidade (2/3/4)**, **lente**, **zoom** e **busca** decidem o que vira desenho; o **foco de linhagem** acende ancestrais e descendentes do que você selecionou e apaga o resto.
- **Escolas**: pontos por escola + os arquétipos que emergem da combinação.
- **Recursos**: proficiência nas cinco fontes de energia (mana, fé, fúria, soullink, ressonância). Cada ponto reduz custo, aumenta regeneração/impacto e encurta a conjuração — e a bancada simula as fontes da skill atual em tempo real.
- **Talentos**: em **árvore** (trilhas e tiers) ou **cartas**.
- **Criar Skill**: sliders para energia, tempo de conjuração, **alcance**, raio e duração — cada um **limitado pelos talentos investidos** (o máximo aparece ao lado). Você **combina várias fontes de energia em proporções livres** (só recursos com proficiência), e **custo, impacto, perfil e propriedades recalculam em tempo real**. Skills de **Evocação** ganham o seletor de fonte (Elemental / Aleatória / Capturada) — evocar qualquer coisa é uma skill com custo e cast. Compare até 4 builds lado a lado.

O estado persiste no `localStorage` entre visitas; dá para **exportar/importar** tudo em JSON e **resetar**.

## Arquitetura

```
src/
  registry/     ← DADOS: o conteúdo do jogo, editável sem tocar no motor
    elementos.ts   17 elementos base, os 136 pares nomeados, sinergias
    combinacoes.ts as 680 triplas + 2.380 quádruplas: curadas onde importa,
                   procedurais no resto, resolvidas sob demanda
    modificadores.ts modificadores de skill (2ª geração), com tags e custo
    recursos.ts    mana, fé, fúria, soullink, ressonância e seus parâmetros
    escolas.ts     combate físico, longo alcance, evocação, conjuração, bênção, maldição
    talentos.ts    talentos com ranks, requisitos e ramos exclusivos
    arquetipos.ts  identidades desbloqueadas por combinação (necromante etc.)
    criaturas.ts   bestiário: criaturas capturáveis, famílias e afinidades
    afinidades.ts  tabela de efetividade elemental (forte/fraco/neutro)
    estados.ts     condições/status (queimadura, veneno, atordoamento…)
    profissoes.ts  ofícios, itens-base e propriedades emergentes de craft
  engine/       ← MOTOR: cálculo puro em cima dos dados
    personagem.ts  ficha (só pontos diretos) + regras de investimento
    progressao.ts  níveis efetivos, derivados, arquétipos
    skills.ts      construtor + calculadora de skills (orçamento de poder)
    recursos.ts    simuladores em tempo real de mana/fé/fúria
    evocacao.ts    captura, doma (vínculo) e os 3 modos de evocar
    fusao.ts       fusão de 2 a 4 skills → 2ª e 3ª geração
  ui/
    ceu-layout.ts  matemática pura do Céu dos Elementos (sem DOM, testável)
```

A separação é deliberada: **adicionar um elemento, uma receita, uma sinergia ou um arquétipo é só adicionar uma entrada no registro** — o motor lê tudo de forma declarativa.

## Camada 1 — Elementos

**Base** (recebem pontos diretos): fogo, água, terra, ar, eletricidade, arcano, sombra, luz, vileza, morte, vida, vigor, **marcial** (armas), **tempo** (pressa/lentidão — Cronomancer), **som** (canções, ondas de choque — Bardo), **gravidade** (peso, colapso — FF Demi), **espaço** (portais, meteoros — Sage/Astromante). São **17 elementos base**.

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

- **Todos os 136 pares** dos 17 elementos base existem — incluindo Trovão (som+eletricidade), Terremoto (som+terra), Réquiem (som+morte), Buraco Negro (gravidade+sombra), Singularidade (gravidade+arcano), Implosão (gravidade+morte), Meteoro (espaço+fogo), Portal (espaço+arcano), Constelação (espaço+luz), Continuum (espaço+tempo)… — incluindo os de **Tempo**: Pira Eterna (tempo+fogo), Erosão (tempo+água), Fossilização (tempo+terra), Aceleração (tempo+ar), Instante (tempo+eletricidade), **Cronomancia** (tempo+arcano), Entropia (tempo+sombra), Éon (tempo+luz), Ruína (tempo+vileza), Ocaso (tempo+morte), Florescer (tempo+vida), Frenesi (tempo+vigor), Contratempo (tempo+marcial) — além de Vapor (fogo+água), Lava (fogo+terra), Plasma (fogo+eletricidade), Fênix (fogo+vida), Pântano (água+terra), Gelo (água+ar), Veneno (água+morte), Ácido (água+vileza), Abismo (água+sombra), Areia (terra+ar), Magnetismo (terra+eletricidade), Flora (terra+vida), Titã (terra+vigor), Tempestade (ar+eletricidade), Éter (ar+arcano), Miasma (ar+morte), Galvanismo (eletricidade+morte), Runa (arcano+luz), Pacto (arcano+vileza), Alma (arcano+morte), Espectro (sombra+morte), Parasita (sombra+vida), Assassínio (sombra+vigor), Julgamento (luz+morte), Santidade (luz+vida), Praga (vileza+morte), Mutação (vileza+vida), Carnificina (vileza+vigor), Equilíbrio (morte+vida), Ceifa (morte+vigor)… — a lista completa (com descrição de cada um) está em `src/registry/elementos.ts`, e um teste garante que nenhum par falte.
- **Triplas**: Chama Demoníaca (fogo+vileza+morte), Paradoxo (tempo+arcano+morte), Furacão (água+ar+eletricidade), Selva (água+terra+vida), Abominação (sombra+morte+vileza), Eclipse (luz+sombra+arcano), Reencarnação (vida+morte+arcano), Sobrecarga (eletricidade+arcano+vigor), Ascensão (luz+vida+vigor), Núcleo (fogo+terra+eletricidade) — fator 1.30.
- **Amplas**: Primordial (os 5 primais, fator 1.35), Ciclo (vida+morte+luz+sombra, fator 1.35) e **Nulo** (nível 8+ em **todos** os 17 base, fator 1.40). Amplas cósmicas: **Big Bang** (espaço+gravidade+tempo) e **Sinfonia** (som+luz+vida).

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

Talentos moldam o *como* (**65 talentos em 16 grupos**):

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

Não se escolhe arquétipo — ele emerge da distribuição de pontos. São **79**, e as condições podem exigir **elementos derivados** (que só existem via combinação):

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

**Montaria nas skills**: qualquer skill pode ser lançada **cavalgando** uma fera montável — o construtor mostra o seletor de Montaria quando você tem o talento e uma fera elegível. O resultado amplifica pelo bônus de Carga Montada + Sincronia + porte da fera (ex.: `🐎 Montado em Urso das Cavernas +50%`).

## Camada 7 — Afinidade elemental, estados e classes (inspirações)

Enriquecimentos trazidos de **Tree of Savior** (principalmente), Ragnarok, Final Fantasy, Warcraft e D&D:

- **Afinidade elemental** (Ragnarok/FF/D&D): cada elemento é forte (×1.5), fraco (×0.5) ou neutro contra os outros. No construtor de skill, escolha o **Alvo (afinidade)** e veja o impacto ajustado — sem alterar o impacto base (o invariante de balanceamento é preservado; a efetividade é uma leitura "vs alvo"). Derivados herdam a tabela do componente dominante. A aba Elementos mostra a **matriz completa** 17×17.
- **Estados/condições** (D&D/FF/Ragnarok): cada elemento e escola declara os status que pode infligir (queimadura, congelamento, choque, veneno, sangramento, atordoamento, silêncio, cegueira, medo, maldição, lentidão, definhamento… e positivos como regeneração, pressa, escudo). A skill calculada lista "pode causar…", agrupando por ofensivo/controle/positivo.
- **Novas classes** (arquétipos): Geomante (FF/D&D), Cronomante (ToS/FF — tempo), Bardo (canções), Alquimista/Homúnculo (Ragnarok/ToS), Xamã Totêmico (WoW), Feiticeiro de Cartas (ToS Sorcerer — sela e invoca monstros), Bokor (ToS — vodu), Tecelão de Sangue (ToS Featherfoot), Cavaleiro Dragão (FF Dragoon — salto), Cavalaria Negra (ToS Schwarzer Reiter — pistoleiro montado), Mago Vermelho (FF — híbrido), Cabalista (ToS — numerologia), Invocador (FF — espers).
- **Novos talentos**: Metamagia Gêmea (D&D), Auto-Feitiço e Endossar Elemento (Ragnarok Sage), Canção Persistente (Bardo), Salto (Dragoon).

## Camada 8 — Cosmos: Som, Gravidade, Espaço e a pressa do Cronomante

- **Três novos elementos base** completam a matriz (17 base, 136 pares): **Som** (canções, ondas de choque — Bardo/Menestrel), **Gravidade** (peso, colapso, buraco negro — FF Demi/Senhor da Gravidade) e **Espaço** (portais, meteoros, o cosmos — Sage/Astromante). Trazem novas triplas cósmicas (Big Bang, Sinfonia), afinidades (espaço supera gravidade e tempo; som é absorvido pela terra), estados (silêncio, derrubada, lentidão) e sigilos próprios.
- **Pressa do Cronomante**: skills de elemento temporal (Tempo e derivados como Cronomancia) **aceleram a conjuração** — rendem mais poder por segundo de cast, escalando com o nível do elemento (até +35%). Aparece como propriedade "Pressa" no resultado.
- **Novas classes**: Menestrel, Trovador Sombrio, Senhor da Gravidade, Astromante, Viajante Dimensional (Continuum), Demiurgo (Big Bang).
- **Sigilos por família de criatura** no bestiário (besta, ave, aquática, ígnea, morto-vivo, aberração, planta, espírito, construto, demônio, dracônico) e **presets** prontos: Cronomante e Cavaleiro Dragão (já com wyvern capturado, domado e montado).

## Camada 9 — Profissões (ofícios de criação)

Inspirada nas professions de **World of Warcraft** (Ferraria, Alfaiataria, Engenharia…) e na forja elemental de **Ragnarok**. A regra central: **o resto da ficha molda o que você cria.**

- **11 profissões** (as 6 originais + as 5 da Camada 12): Ferreiro (metal), Tecelão (vestes), Artesão (engenhocas), Joalheiro (joias), Alquimista (poções), Curtidor (couro). Cada uma **escala a qualidade** com atributos específicos da ficha (o Ferreiro com vigor/marcial/fogo/terra; o Artesão com arcano/eletricidade/gravidade/espaço…).
- **Propriedades emergentes**: a qualidade base vem do nível da profissão + atributos, mas as *propriedades* do item **emergem dos seus elementos com maestria, talentos e nível**. Um ferreiro com **fogo e frio** faz **Têmpera Perfeita**; com **veneno**, uma lâmina **Envenenada**; com **gravidade/espaço**, um machado **Flutuante** (orbita e ataca sozinho). Há 16 propriedades (Flamejante, Gélida, Condutora, Abençoada, Espectral, Regenerativa, Gravitacional, Dimensional, Temporal, Vampírica, Rúnica, Ressonante, Obra-Prima…), cada uma exigindo a combinação certa da ficha e restrita à categoria do item (arma/armadura/acessório/consumível).
- **Qualidade → raridade**: Comum → Incomum → Raro → Épico → Lendário → Mítico. No simulador, a aba **🔨 Profissão** mostra a bancada de criação com o item resultante, sua raridade, as propriedades que emergiram e de onde veio cada ponto de qualidade — tudo em tempo real.
- **Ponte com o bestiário**: o **Curtidor** trabalha as **peles das criaturas que você capturou**. Cada família vira um material (Couro Ígneo da salamandra, Escama de Dragão do wyvern, Éctoplasma do espectro…) que adiciona qualidade proporcional ao poder da fera e uma **propriedade própria** — uma Escama de Dragão faz uma peça **Dracônica** (resistência elemental lendária). Assim captura → doma → **couro** conecta a Camada 6 (Evocação) à Camada 9 (Profissões).


## Camada 10 — O espaço completo de combinações

Os 136 pares dos 17 elementos base são nomeados à mão. A partir de 3 componentes o espaço explode: **C(17,3) = 680 triplas** e **C(17,4) = 2.380 quádruplas**. Curar 3.060 entradas é inviável — e desnecessário.

A estratégia é **híbrida**:

- **Curadas** (64 e contando): combinações com identidade forte ganham nome, descrição e arquétipo à mão — Vulcão, Supernova, Peste Negra, Hipnose, Tempestade Perfeita, Ragnarök, Arquiteto da Realidade.
- **Procedurais** (as outras ~3.000): existem, são alcançáveis e aparecem na constelação, mas nome, descrição, perfil e números são **derivados das partes**, sob demanda e em cache.

**A nomenclatura procedural é composicional e ensina a linhagem:**

```
tripla     {a,b,c}   →  "{Par(a,b)} {adjetivo(c)}"     →  Lava Umbria
quádrupla  {a,b,c,d} →  "{Par(a,b)} d{o|a} {Par(c,d)}" →  Lava do Espectro
```

Como os pares já são únicos e a ordenação dos componentes é determinística, os nomes gerados são **provadamente únicos** — um teste verifica os 3.060. E a preposição concorda em gênero (`Lava do Espectro`, `Vapor da Praga`), com heurística de português e uma lista de exceções para os casos que a terminação engana (Miasma é masculino, Fênix é feminino).

**Coerência: nem toda convergência custa o mesmo.** Para cada par de componentes o motor olha as sinergias (aliados) e a tabela de afinidade (opostos):

| Coerência | Quando | Efeito |
|---|---|---|
| **Harmônica** | maioria de componentes aliados | mínimo menor, potência contida |
| **Neutra** | componentes independentes | valores medianos |
| **Em Tensão** | ≥25% dos pares em oposição | exige mais de cada parte, paga melhor |
| **Paradoxal** | ≥50% dos pares em oposição | o extremo dos dois eixos |

Distribuição real do espaço: 85 harmônicas, 1.701 neutras, 1.000 em tensão, 274 paradoxais.

**Compensação de aridade.** Um derivado de N componentes no nível L custou N×L pontos, mas rendia como um elemento no nível L — o que fazia especializar dominar qualquer combinação. Agora o bônus por nível escala com a aridade:

```
bônus por nível = 0.04 × (1 + 0.30 × (N − 1))
```

A compensação é **deliberadamente parcial**: combinar já paga em largura. Medido, com 100 pontos de orçamento:

| Rota | Impacto | vs. especializar |
|---|---|---|
| Fogo puro (100 pts) | 208 | — |
| Par (50+50) | 172 | 83% |
| Tripla (33×3) | 175 | 84% |
| Quádrupla (25×4) | 185 | 89% |

Especializar ainda vence no poder bruto de uma skill — e deve vencer. Quem combina troca ~11% de poder por 15 elementos disponíveis em vez de 1, mais arquétipos e mais fusões.

**Meias-identidades.** Toda combinação de 3+ componentes concede versões **diluídas** das capacidades dos arquétipos contidos na sua receita (−18% de impacto). É a resposta ao modo de falha clássico dos sistemas de aridade alta: se combinar mais só desse um multiplicador maior, o jogador ótimo sempre subiria a escada e as combinações menores virariam conteúdo de passagem. Aqui, combinar mais compra **largura de identidade** — várias meias-classes em vez de uma classe mais forte.

**Talentos que mexem na estrutura**: *Sintonia de Receita* (−2 níveis/rank no mínimo de toda receita — o caminho prático para as quádruplas), *Convergência Elemental* (+1 nível em todo derivado), *Transbordo Ampliado*, *Maestria Paradoxal*, *Leitor de Constelação*.

## Camada 11 — Skills de 2ª e 3ª geração

Duas camadas independentes que se compõem.

### Modificadores (o modelo *support gem*)

Você não inventa uma skill nova; pega uma que já entende e **aumenta a aposta**. 23 modificadores, e quatro regras que fazem isso funcionar:

1. **O custo é multiplicativo.** Sobrecarga Bruta (×1.45) + Canalização Arriscada (×1.28) = ×1.86, não ×1.73. É esse composto que impede encaixar tudo.
2. **Compatibilidade por tag.** Cada skill exibe tags derivadas da configuração (`projetil`, `area`, `continuo`, `invocacao`, `derivado`…); um modificador de área não entra numa skill de alvo único. A maioria das células da matriz simplesmente não existe.
3. **Nenhum é ganho puro.** Sobrecarga Bruta rende 1.34× de impacto por 1.45× de custo — eficiência 0.92. *Contenção Disciplinada* é a troca inversa: 0.80× de impacto por 0.62× de custo.
4. **Slots, não escassez global.** 2 slots de base, +1 por rank de *Engenho de Skill*. Nada de "cada modificador uma vez por build" — essa regra é elegante no papel e irritante na mão.

Um **teto duro** (×2.2) grampeia o produto dos multiplicadores e avisa quando mordeu.

### Fusão

**Fundir skills funde os elementos delas.** Uma skill de Fogo + uma de Terra viram uma skill de **Lava**. Três viram a tripla. Quatro, a quádrupla. A árvore de combinações deixa de ser só um mapa de progressão e vira a **gramática das fusões**.

- **2 componentes → 2ª geração · 3 ou 4 → 3ª geração.**
- **O modo emerge da relação**, não da escolha: *Sequência* (mesma escola), *Amálgama* (escolas distintas), *Ressonância* (elementos aliados — a mais barata), *Catálise* (elementos em oposição — a mais potente e cara), *Prisma* (3+ correntes, o efeito se abre em faixas simultâneas).
- **Sem fórmula própria.** A fusão monta uma `SkillConfig` sintética e chama `calcularSkill`, herdando o invariante de orçamento inteiro. Por cima aplica só o fator do modo e a taxa de custo (1.15× na 2ª geração, 1.35× na 3ª).

**O teto é de eficiência relativa, não de impacto absoluto.** Um teto sobre o impacto teria de ser recalibrado a cada aridade, e concentrar energia numa skill já é naturalmente superlinear neste motor. Medido antes da correção, um Prisma de 3 componentes entregava 1.90× o impacto somado por 1.46× o custo — fundir virava obrigatório. Amarrando o teto na eficiência (1.10×), a intenção de design fica escrita direto na regra:

| | ganho de impacto | taxa de custo | eficiência vs. separado |
|---|---|---|---|
| 2ª geração (Catálise) | 1.39× | 1.36× | **1.03×** |
| 3ª geração (Prisma) | 1.60× | 1.46× | **1.10×** (no teto) |

Fundir é **aproximadamente neutro no numérico**. O que se compra é qualitativo: uma ação em vez de N, o perfil e os estados do elemento combinado, e as propriedades emergentes. Fusão sempre melhor seria fusão obrigatória, e escolha obrigatória não é escolha.

## Camada 12 — Mais cinco ofícios

Além de Ferreiro, Tecelão, Artesão, Joalheiro, Alquimista e Curtidor:

- **Encantador** — grava elementos em objetos prontos. É a profissão que mais depende de combinações.
- **Escriba** — pergaminhos, glifos e contratos vinculantes.
- **Cozinheiro** — banquetes e rações que sustentam o grupo.
- **Luthier** — instrumentos que conduzem canções de guerra (o ofício do elemento Som).
- **Cartógrafo** — cartas do espaço, do tempo e do que há entre eles.

E **14 propriedades emergentes novas**, seis delas exigindo combinações de aridade alta: *Tempestuosa* (água+ar+eletricidade), *Cataclísmica* (terra+gravidade+fogo), *Sepulcral* (morte+sombra+vileza), *Consagrada* (luz+vida+vigor), *Paradoxal* (tempo+espaço) e *Primordial* (os cinco primais, nível 15 de profissão).

## Os agentes do projeto

`.claude/agents/` traz seis especialistas que sabem as regras deste sistema:

| Agente | Papel |
|---|---|
| **arquiteto-de-sistema** | Onde uma mecânica nova entra, e o que ela quebra |
| **combinador** | Nomeia e dá alma a combinações; desenha léxicos |
| **experimentador** | Mede. Varreduras de build, curvas, outliers — número, não palpite |
| **supervisor-de-balanceamento** | Cético profissional: caça build degenerada e combinação morta |
| **pesquisador-benchmark** | Traz padrões já familiares ao público de outros jogos |
| **curador-de-constelacao** | Mantém o céu legível enquanto o conteúdo cresce |


## Para programas e agentes

O sistema tem uma superfície própria para consumo por máquina, em `src/api/` —
determinística, paginada, com erro que ensina. **`AGENTS.md` é o documento que
um agente de IA lê antes de tocar em qualquer coisa.**

```bash
npm run cs -- panorama                     # o tamanho do sistema, em números
npm run cs -- buscar "vulcao"              # acha qualquer coisa por nome
npm run cs -- explicar lava                # ficha técnica de um elemento
npm run cs -- integridade                  # consistência interna do conteúdo

npm run cs -- analisar --ficha ficha.json           # o que esta ficha é hoje
npm run cs -- proximas --ficha ficha.json           # o que está a um passo, e por quanto
npm run cs -- caminho vulcanologo --ficha ficha.json # plano de pontos até um arquétipo
npm run cs -- skill --ficha ficha.json --skill s.json
```

O planejamento é **verificado ponta a ponta**: `caminhoParaArquetipo` monta a
ficha resultante, roda a progressão e confirma que o arquétipo destrava — um
plano marcado como não provado é melhor que um número inventado.

`verificarIntegridade()` varre o conteúdo procurando id órfão, requisito
impossível e arquétipo inalcançável. Rode depois de adicionar conteúdo; leva
milissegundos.

## Estendendo

- **Novo elemento derivado**: adicione em `ELEMENTOS` com `receita` (qualquer aridade — pares, triplas, ou "todos", como o Nulo).
- **Nova sinergia**: uma linha em `SINERGIAS`.
- **Novo arquétipo**: entrada em `ARQUETIPOS` com condição de elementos/escolas/recursos e as capacidades que libera.
- **Nova criatura**: entrada em `CRIATURAS` com família, afinidades (elementos que capturam) e poder-base.
- **Ajustar afinidade elemental**: edite `AFINIDADES` (forte/fraco por elemento base).
- **Novo estado/condição**: entrada em `ESTADOS` + mapeie em `ESTADOS_POR_ELEMENTO`/`ESTADOS_POR_ESCOLA`.
- **Nova profissão/item/propriedade**: entradas em `PROFISSOES`, `ITENS_BASE` e `PROPRIEDADES_ITEM` (com os requisitos de elemento/talento/nível que a fazem emergir).
- **Nova combinação curada de 3/4**: uma entrada em `CURADAS` (`src/registry/combinacoes.ts`). Tudo que não está lá continua existindo, gerado sob demanda.
- **Novo modificador de skill**: entrada em `MODIFICADORES` com `exigeTags` e `multiplicadorCusto`.
- **Novo modo de fusão**: entrada em `MODOS_FUSAO` + a regra em `determinarModo`.
- **Ajuste de balanceamento**: as constantes estão no topo de `src/engine/skills.ts` (orçamento e modificadores), `src/engine/fusao.ts` (fusão) e `src/registry/combinacoes.ts` (fator de potência e mínimos por aridade).
