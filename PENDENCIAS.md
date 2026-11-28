# Pendências

Nota de passagem para retomar o trabalho em sessão nova. Escrita em 28/11/2026, já com as branches abaixo mescladas na `main`. Pode ser apagada quando as pendências acabarem.

## 1. O que já está na `main`

Mescladas em 28/11/2026, nesta ordem (a sessão anterior só mesclou porque o dono pediu; a regra do `CLAUDE.md` continua valendo para as próximas):

- `fix/regras-grupos-conexoes`: regras do Firestore para grupos e conexões (sair do grupo sem expulsar ninguém nem trocar o dono; entrar, pedir e cancelar só mudam a própria pessoa; dono só aceita quem pediu; a conexão só vale enquanto as duas pessoas dividem um dos grupos listados, até 3) e testes no emulador em `tools/regras`.
- `docs/regras-amizades-codigos`: +19 testes das regras de `amizades`, `codigos` e `compartilhado`; README corrigido.
- `fix/codigo-convite-seguro`: código de convite com `crypto.getRandomValues`.
- `feat/inicio-enxuta`: Início sem o "+" flutuante (virou "Registrar atividade"), só medalhas ganhas e "Minhas fichas" sem repetir o treino de hoje. Changelog 1.34.0.
- `chore/skill-ponytail`: skill `ponytail` em `.claude/skills/ponytail/` (só a skill, sem os hooks do plugin).

### Ação do dono que ainda falta
**Publicar o `firestore.rules` novo no console do Firebase** (aba Regras do Firestore). Enquanto não for publicado, as regras corrigidas não valem em produção. O app não precisa de mudança para isso, e as conexões que já existem continuam valendo enquanto as pessoas estiverem no grupo.

## 2. Próximo passo combinado: refatorar `social.service.ts`

Sem mudar API nem comportamento, com os 838 testes como rede de segurança (`npm run test:ci`) e `ng lint`.

- Começar pelas áreas mais isoladas: **Foto do treino** (~linha 897) e **Estatísticas de outros membros** (~994). Os componentes continuam usando `SocialService` (que só repassa), então nenhum dos 14 arquivos que o injetam muda.
- Depois, se valer a pena: Grupos (~579, a maior), Amizades (~451), Timeline (~789), Reações (~886), Peso compartilhado (~533), Perfil (~322).
- Na mesma passada: tirar os `console.warn/error` e o `motivosFoto`, que mostra texto de desenvolvedor ("publique as regras do Firestore") para o usuário; remover o comentário `/** */` duplicado antes de `lerFoto`.
- Fazer numa branch nova a partir da `main`, seguindo a skill `ponytail`: menor mudança completa.

### `plan.service.ts` (depois, só se houver demanda nessas áreas)
1. Juntar `criar`, `criarRascunho`, `criarComItens`, `criarConjunto` e `adicionarTreino` num método privado `incluir(treinos, opções)` (pequeno e seguro).
2. Extrair histórico e sessões (`registrarSessao`, `registrarAtividade`, `editarSessao`, `excluirSessao`, `restaurarSessao`, `mesclarSessoes`, `ultimoRegistro`, cargas) para um `HistoricoService`. Mexe em 23 arquivos que usam `plans.historico`: manter o `PlanService` repassando na transição.
3. Tirar a ponte com a nuvem (`estadoNuvem`, `aplicarEstadoNuvem`, `sessoesParaSincronizar`, `limparLocal`) da classe das fichas.

## 3. Itens da auditoria ainda não feitos

**Decidido: não fazer.** O `maximum-scale=1, user-scalable=no` do `index.html` fica como está (decisão do dono).

Segurança e regras:
- Limites de campos e tamanho nas regras: feito em `atividades`, `curtidas`, `comentarios`, `sessoes`, `perfis` e `compartilhado` (branch `fix/regras-limites`; **publicar o `firestore.rules` de novo depois de mesclar**).
- Qualquer pessoa logada cria quantos `codigos` quiser apontando para si (só gera escrita, não dá acesso). Fechar exige gravar código e perfil na mesma operação (`iniciar()` do `SocialService`) e travar `perfis.codigo` depois de definido. Baixa prioridade.
- Cabeçalhos de segurança: o app publica no GitHub Pages, que não aceita cabeçalhos, então o CSP foi para um `<meta>` no `index.html` (feito). `X-Frame-Options`/`frame-ancestors` só existem como cabeçalho (exigiria outro host). **Conferir em produção o login Google com popup** (não deu para testar sem rede) e olhar o console atrás de bloqueios do CSP.
- Texto do "grupo aberto" deveria avisar que quem tem o link vê histórico, fotos e comentários de todos.
- Código de convite continua com 8 caracteres (~40 bits). Subir para 10 se quiser mais folga (links e QR ficam maiores).
- `.claude/settings.json` libera `git push origin main` sem pedir, o que contradiz o `CLAUDE.md`. Decidir se deve continuar.

Simplificação:
- 4 caminhos para criar ficha (`fichas/nova`, `sugestao`, `personalizada`, `importar`, mais `treino-novo`): fundir num assistente só.
- Medalhas em 6 arquivos / 1.425 linhas para 9 definições.
- 36 usos diretos de `localStorage` e 22 constantes `CHAVE_*`: um helper tipado com versão e migração.
- `Perfil/Ajustes` (`settings.ts`, 644 linhas): tema e paleta numa linha, versão e changelog num rodapé.
- Rotas de compatibilidade (`progresso`, `ajustes`, `estatisticas`), se não há mais usuários antigos.
- `tools/__pycache__/*.pyc` commitado: remover e pôr no `.gitignore`.
- `package.json` está em `1.25.8` e o changelog em `1.34.0`; o `ngsw-config.json` commitado está defasado (gerado no `prebuild`).
- Quatro módulos de saúde (`medidas*`, `peso*`, `calorias`, `mapa-muscular`): perguntar ao dono se o público usa os quatro. As calorias por MET admitem 20–30% de erro.

Performance e custo:
- `public/` tem 150 MB (139 MB em `exercises/`, ~3.600 arquivos no git): mover para CDN/bucket ou Git LFS.
- Cada membro de grupo abre listeners de `sessoes` e `eventos` (`social.service.ts` ~1001 e ~810): custo de leituras cresce com o grupo. Pensar num resumo agregado por membro.
- Fotos em base64 no Firestore (até 400 KB): caro em leitura/escrita e no cache offline; Firebase Storage resolveria (exige plano Blaze).
- Orçamento do bundle `initial` com erro só em 1 MB; hoje o inicial tem ~384 kB. Baixar o limite para algo como 350/600 kB.

Tela Início (ainda em aberto):
- Não confirmei o avatar duplicado (linhas 5 e 16 do `home.html`): só aparece com login Google.
- Com uma medalha só, o cartão ocupa a linha toda (regra antiga do quadro para número ímpar). Limitar a largura se incomodar.
- Os dois botões novos quebram em duas linhas. "Atividade" sozinho caberia em uma, com menos clareza.
- Não conferi o tema escuro nem outras paletas depois da mudança.

## 4. Como retomar

- Dependências do app: `npm install` na raiz.
- Testes do app: `npm run test:ci` (838 passando) e `npx ng lint`.
- Testes das regras (precisa de Java): `cd tools/regras && npm install && npm test` (64 casos). Depois, **apagar `tools/regras/node_modules` e os logs** se a pasta ficar como "não rastreada" (o hook de fim de turno reclama).
- Prints do app sem login: o app pede login Google quando o Firebase está configurado. Para tirar prints, trocar `FIREBASE_CONFIG` por `null` em `src/app/core/firebase.config.ts` **só localmente** e reverter com `git checkout -- src/app/core/firebase.config.ts`. Serve com `npx ng serve --port 4300 --host 127.0.0.1`.
- A skill `ponytail` está em `.claude/skills/ponytail/` e carrega em sessões novas abertas na `main`. O clone original ficou em `/home/user/dietrichgebert/ponytail` (fora do repositório; pode apagar).
- Ruído conhecido nos testes: `this.plans.estadoNuvem is not a function` aparece também na `main` (mocks de teste incompletos). Não é regressão.
- Regra do repositório: trabalhar em branch própria e **só mesclar na `main` quando o dono pedir**.
