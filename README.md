# App Workout

PWA em Angular para montar fichas de treino. A biblioteca tem 876 exercícios com fotos de início e fim do movimento, nomes e filtros em português, e tudo funciona offline depois do primeiro acesso.

## O que já faz

- **Início**: treino do dia (rodízio entre as fichas) com os grupos musculares de cada ficha e semana com os treinos concluídos. Depois de treinar, mostra o resumo do treino de hoje e o próximo treino. Tem também a meta da semana e o quadro de medalhas (as 6 melhores; o resto em Ver todas). Veja [Medalhas](#medalhas).
- **Peso**: em Ajustes se registra o peso do dia; em Social › Estatísticas, o gráfico de evolução por semana, mês ou ano. Os registros sincronizam com a conta, junto com as fichas.
- **Biblioteca**: busca por nome em português ou inglês, filtro por grupo muscular, equipamento e nível.
- **Exercício**: foto alternando entre as duas posições, músculos, equipamento e instruções.
- **Fichas**: criar, renomear, reordenar, remover exercícios e definir séries, repetições, carga e descanso; cada ficha mostra os grupos musculares trabalhados, e um botão de play flutuante inicia o treino.
- **Atividade**: o botão + da Início registra uma atividade fora da ficha (corrida, caminhada, esporte…) com duração, distância e esforço opcionais e foto opcional. Ela vale como o treino do dia (semana, meta, medalhas de treinos e cardio e timeline), mas não avança o rodízio das fichas.
- **Treino**: marcar séries feitas (reps e carga editadas valem para as séries seguintes), cronômetro de descanso progressivo (vermelho no descanso da ficha), pausar ou cancelar pelo X, tempo entre séries e registro do treino concluído.

As fichas e o histórico ficam no `localStorage` do aparelho e funcionam sem conta. Para treinar sem internet, o app pré-carrega as imagens dos exercícios das suas fichas (`core/precarga.service.ts`) e mostra uma faixa de "sem conexão"; o que for feito offline sincroniza quando a conexão volta. Com o login do Google (opcional), são sincronizados pelo Firestore, e dá para adicionar amigos; veja [Conta, backup e sincronização](#conta-backup-e-sincronização-firebase) e [Amigos e timeline](#amigos-e-timeline).

## Como rodar

Requer Node 20.19+ (ou 22.12+).

```bash
npm install
npm start          # desenvolvimento em http://localhost:4200
npm run build      # build de produção em dist/app-workout-ng/browser
npm test           # testes no Chrome (Karma + Jasmine), acompanhando as mudanças
npm run test:ci    # testes uma vez, sem janela (o que a CI roda)
npm run lint       # ESLint (angular-eslint) em src/**/*.ts e nos templates
```

O service worker só é ativado no build de produção. Para testar o modo offline e a instalação:

```bash
npx http-server dist/app-workout-ng/browser -p 8080 -c-1
```

## Estrutura

```
public/data/exercises.json            exercícios (free-exercise-db)
public/data/i18n/pt-BR.names.json     nome de cada exercício em português (chave = id)
public/data/i18n/pt-BR.labels.json    músculos, equipamentos, níveis e categorias
public/data/i18n/pt-BR.instructions.json   instruções passo a passo em português
public/exercises/<id>/0.jpg, 1.jpg    fotos de cada exercício (início e fim)
public/exercises/<id>/anim.webp       animação das duas fotos em loop (gerada)
tools/gerar_animacoes.py              gera os anim.webp a partir das fotos
src/app/core/                         serviços (exercícios, fichas, avisos) e componentes de apoio
src/app/pages/                        telas (as maiores têm .html e .scss ao lado do .ts)
```

## Medalhas

Nove metas, cada uma com bronze, prata, ouro e diamante: treinos concluídos, treinos no ano (zera a cada ano), constância (semanas seguidas cumprindo a meta), dias seguidos, carga levantada, recordes, superiores, inferiores e cardio. A medalha atual substitui a anterior; a galeria mostra a trilha completa e os recordes recentes. A regra fica em `core/medalhas.ts` (funções puras, com testes).

As medalhas **são calculadas ao concluir o treino** e guardadas no aparelho (`core/medalhas.service.ts`, chave `app-workout:medalhas:v1`); a tela inicial só lê o resultado. O serviço recalcula sozinho se o histórico, a meta semanal ou o ano mudarem por fora, por exemplo um treino que chega de outro aparelho; nesse caso o que subiu de nível também vira "nova". As **novas** (chip "N novas" e cards em destaque na Home) ficam até a galeria ser aberta, ou por 7 dias. Ao sair da conta o que está guardado é apagado.

Ao concluir um treino aparece o **resumo** (`core/resumo-treino.ts`): números do treino e as medalhas novas, centralizadas e com rolagem horizontal quando passam de três. Ao tocar numa medalha, a galeria rola até ela e a faz piscar.

## Sugestão automática de fichas

Em **Fichas → Sugerir ficha** você informa objetivo, experiência, dias por semana e onde treina. O app monta uma ficha com os treinos da divisão (corpo inteiro, superior/inferior ou empurrar/puxar/pernas) com exercícios clássicos da base, séries e descanso conforme o objetivo, e você pode gerar outra variação antes de adicionar. A lógica fica em `src/app/core/suggestion.ts`. No objetivo **Emagrecimento** as fichas viram circuitos de corpo inteiro (12 a 15 repetições, descanso de 30 a 45 s), com um exercício dinâmico e uma finalização de cardio em minutos (15, 20 ou 30 conforme a experiência); dias extras são de cardio e abdômen. Cardio em aparelho só aparece na academia. É uma sugestão geral, sem considerar lesões.

## Atualizações e histórico de mudanças

Quando você publica uma versão nova, o app instalado a baixa em segundo plano e mostra um botão suspenso **Atualizar** no canto superior direito (some durante o treino). O **×** ao lado dispensa o aviso; a atualização continua disponível em **Ajustes**, que também tem "Verificar atualizações" e o histórico do que mudou. O app procura versão nova ao abrir, ao voltar para a tela e a cada 30 minutos.

Para lançar uma versão: acrescente uma entrada **no topo** de `public/data/changelog.json` (`versao`, `data`, `titulo`, `itens`) e publique. O script `tools/sincronizar_appdata.mjs` (roda sozinho antes de `npm run build`) copia a entrada mais recente para o `appData` do `ngsw-config.json`; é daí que o aviso tira o texto "o que há de novo" antes de o app ser atualizado. A versão exibida em Ajustes é a primeira entrada do changelog.

## Ícone e abertura

O ícone é um halter lima sobre fundo grafite. `tools/gerar_icones.py` gera tudo a partir do desenho em código: ícones `any` e `maskable` para Android (o Android recorta no formato do aparelho), `apple-touch-icon` de 180 px para iOS (fundo cheio, sem transparência), favicons e 19 imagens de abertura para iPhone e iPad. No Android a abertura vem do manifesto (cor de fundo e ícone). No iOS usa as imagens `apple-touch-startup-image`. Dentro do app, uma abertura em HTML some com um fade assim que o Angular inicia. Se mudar o desenho, rode `python3 tools/gerar_icones.py` (precisa de `pillow` e `playwright`) e copie os `<link>` de `tools/splash-links.html` para o `index.html`.

## Carregamento

Uma barra no topo aparece quando há requisições ou troca de tela demorando mais de cerca de 200 ms (`LoadingService` e interceptor). As telas mostram um indicador enquanto os dados chegam, e as fotos têm um esqueleto animado até carregarem.

## Dados e créditos

Os exercícios e as imagens vêm do [free-exercise-db](https://github.com/yuhonas/free-exercise-db), em domínio público (Unlicense). A licença está em `public/data/LICENSE-free-exercise-db.md`. As traduções dos nomes, dos rótulos e das instruções são deste projeto e merecem revisão.

### Animações

Cada exercício tem um `anim.webp` (as duas fotos alternando, 800 ms, em loop). Escolhi WebP animado no lugar de GIF porque cada arquivo fica com cerca de 35 a 40 KB, contra uns 185 KB do GIF. Com a opção «reduzir movimento» ativada no sistema, o app mostra a foto estática. Para gerar de novo: `pip install pillow` e `python3 tools/gerar_animacoes.py public/exercises`.

## Próximos passos

- Revisar as traduções das instruções (algumas expressões técnicas podem melhorar).
- Exportar e importar fichas para fazer backup.

## Testes

Os testes ficam ao lado do código, em `src/app/core/*.spec.ts`, e rodam com Karma e Jasmine (`npm test`, ou `npm run test:ci` para uma execução só, sem janela). Cobrem:

- `sync.spec.ts`: o `Sincronizador` (primeiro contato, eco da própria gravação, conflito entre aparelhos, envio e reenvio de sessões), com uma nuvem e um armazenamento falsos.
- `stats.spec.ts`: semanas, sequências, recordes, volume e as mensagens de incentivo.
- `social.spec.ts`: código de amigo, ids, timeline, marcos e tempo relativo.
- `firebase.social.spec.ts`: o que `FirebaseSocial` grava e consulta (avisos de curtida com id fixo, comentários, limite de leitura das sessões), com um Firestore falso.
- `social.service.spec.ts`: o `SocialService` (quem é ouvido, o que acontece quando uma amizade acaba, quais erros aparecem na tela, nome e foto atuais de quem fez cada treino ou comentário).

Ainda não há testes das telas (componentes) nem das regras do Firestore; as regras precisam ser testadas no emulador do Firebase.

## Publicação

O workflow `.github/workflows/pages.yml` roda o lint, os testes e o build em todo push, em qualquer branch, e só publica no GitHub Pages quando o push é no `main` e tudo passa. Na primeira vez, em **Settings → Pages**, escolha **Source: GitHub Actions**. O endereço será `https://darlondjc.github.io/app-workout/`.

## Conta, backup e sincronização (Firebase)

Em **Ajustes → Conta e backup** a pessoa entra com o Google. A partir daí fichas, ficha ativa, treino em andamento e histórico (com carga e repetições de cada série) são enviados para o Firestore e voltam sozinhos em outro aparelho ou após reinstalar. Sem login, tudo continua funcionando só no aparelho.

Como funciona (`src/app/core/sync.ts`): o app lê e grava primeiro no aparelho, então funciona sem internet; o Firestore guarda as gravações pendentes e envia quando a conexão volta. No primeiro login os dados do aparelho e os da conta são unidos (nada se perde). Depois, vale a última gravação nas fichas e a união nas sessões concluídas. Ao sair da conta, os dados saem do aparelho e permanecem na nuvem.

### Configurar o projeto Firebase (uma vez)

1. Em <https://console.firebase.google.com> crie um projeto (o Google Analytics pode ficar desligado).
2. **Authentication → Começar → Método de login → Google**: ative e escolha um e-mail de suporte.
3. **Authentication → Configurações → Domínios autorizados**: adicione `darlondjc.github.io`.
4. **Firestore Database → Criar banco de dados** (modo produção; região `southamerica-east1`).
5. Aba **Regras** do Firestore: cole o conteúdo de `firestore.rules` e publique. Isso garante que cada pessoa só acessa os próprios dados.
6. **Configurações do projeto → Seus apps → Web (`</>`)**: registre o app e copie o objeto `firebaseConfig` para `src/app/core/firebase.config.ts` (substitua o `null`). Esses valores não são segredos; quem protege os dados são as regras do passo 5.
7. Faça commit e push: o GitHub Pages publica de novo e o botão **Entrar com Google** passa a funcionar.

No iPhone, o login dentro do app instalado (tela inicial) pode ser bloqueado pelo Safari. Se acontecer, entre uma vez pelo navegador e depois abra o app instalado.

## Progresso

Dentro da aba **Social → Estatísticas**, o **Progresso** mostra um calendário mensal com os dias treinados (toque em um dia para ver o treino), a meta semanal (ajustável; por padrão é o número de fichas), a sequência de semanas cumprindo a meta, a carga total do mês, o gráfico das últimas 8 semanas e os recordes de carga do último treino. As mensagens de motivação são regras simples sobre esses números (retomada após dias parados, meta batida, sequência, comparação com o mês passado, dia favorito). Os cálculos ficam em `src/app/core/stats.ts`, sem dependências. A meta fica salva só no aparelho.

## Amigos e timeline

A aba **Social** tem a **Timeline** (treinos concluídos seus e dos amigos, com curtidas e comentários; curtidas e comentários que você recebe aparecem como avisos; um selo no ícone da aba mostra quantas novidades chegaram desde a última vez que você a viu) e as **Estatísticas**, com a mesma tela de Progresso e um seletor no topo para alternar entre você e cada amigo. Em **Amigos** (ícone no canto da aba Social) você vê seu código de 8 caracteres, adiciona alguém pelo código dele e aceita ou recusa convites.

- Um convite só vira amizade quando a outra pessoa aceita. Depois disso, cada um vê o histórico de treinos (calendário, cargas, recordes), os treinos publicados e pode curtir e comentar. Fichas, treino em andamento e demais dados continuam privados. Desfazer a amizade corta o acesso dos dois lados.
- Ao concluir um treino, ele é publicado na timeline (só treinos recentes são publicados; o histórico antigo não é despejado de uma vez).
- Dados no Firestore: `perfis/{uid}` (nome, foto, meta), `codigos/{codigo}`, `amizades/{id}` e, dentro de `usuarios/{uid}`: `sessoes`, `eventos` (com `curtidas` e `comentarios`), `atividades` e `fotos`. As regras estão em `firestore.rules`.

**Fichas com vários treinos:** uma ficha é um conjunto de treinos (A, B, C…), um por dia. No modelo de dados cada treino continua sendo um item de `fichas` (`Ficha`), e os que pertencem à mesma ficha levam `conjunto: { id, nome }`; sem isso é uma ficha de um treino só, como eram todas antes, então não há migração. **Fichas → Criar ficha personalizada** (`pages/custom-plan.ts`, lógica em `core/ficha-personalizada.ts`) monta os treinos pelos grupos e pelo cardio de cada dia, sem repetir exercício entre os dias; **Sugerir ficha** cria o mesmo formato. Na lista só a ficha atual (a ativa) começa aberta. O treino aleatório do dia, ao ser aceito, entra na ficha atual (`PlanService.adicionarTreino`).

**Foto de perfil:** em Ajustes dá para escolher uma foto (recorte quadrado de 192 px, até 30 KB), guardada no próprio perfil (`perfis/{uid}`, com `fotoPropria: true`) e que o login com Google não troca. Treinos e comentários não carregam essa foto; quem lê busca a atual pelo perfil.

**Foto do treino:** ao concluir um treino (com a conta social ativa) o app oferece uma foto opcional, que também pode ser colocada nas primeiras 24 horas depois do treino, ou removida, no card do próprio treino na timeline. Sem usar o Firebase Storage (que exige o plano Blaze), a foto é reduzida no aparelho (`core/foto.ts`: JPEG de até 900 px e cerca de 100 KB, no máximo 250 KB) e guardada em `usuarios/{uid}/fotos/{sessaoId}` como texto base64; o card e a sessão só levam o aviso `temFoto`, e a foto é lida quando o card aparece. As regras de `fotos` exigem publicar o `firestore.rules` novo (abaixo); sem elas a foto não é enviada e a tela mostra "Sem permissão". Antes de concluir, a foto fica num quadro 4:3 (`core/enquadrar-foto.ts`) onde dá para arrastar e dar zoom; `recortarFoto` recorta o trecho enquadrado e reduz ao limite.

**Tela e orientação:** o app bloqueia o zoom por pinça (meta viewport, `touch-action` e os eventos de gesto do iOS; campos com 16 px para o iOS não aproximar ao focar) e fica em retrato: `screen.orientation.lock` onde o navegador permite e, no iOS, um aviso em CSS quando o celular está deitado. O cronômetro de descanso é do treino, não do exercício.

**Importante:** depois de atualizar o app, publique as regras novas: Console do Firebase → Firestore Database → aba **Regras** → cole o conteúdo de `firestore.rules` → **Publicar**. Sem isso os amigos e a timeline mostram "Sem permissão". A 1.8.1 mudou as regras de `atividades` (quem curtiu pode atualizar o próprio aviso), então publique de novo mesmo que já tenha publicado as da 1.8.0. Sem as regras novas o app continua funcionando, mas curtir de novo um treino que você já curtiu não atualiza o aviso do dono.

Limites desta versão: a timeline carrega de 10 em 10 conforme a rolagem, lendo da nuvem de 15 em 15 treinos por pessoa a cada vez; as estatísticas de um amigo usam os 400 treinos mais recentes dele (os seus são lidos por inteiro, porque a sincronização entre aparelhos precisa do histórico completo); não há notificações push; os nomes e as fotos vêm do Google no momento do login.
