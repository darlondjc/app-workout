# Pendências da sessão de 28/11/2026

Nota de passagem para retomar o trabalho numa sessão nova. Não é para a `main`: só vive nesta branch (`notas/pendencias`).

## 1. Branches abertas (nada foi mesclado na `main`)

Pela regra do `CLAUDE.md`, só mesclar na `main` quando o dono pedir.

| Branch | Commit | Parte de | O que tem |
|---|---|---|---|
| `fix/regras-grupos-conexoes` | `6c8d6c5` | `main` | Regras do Firestore: sair do grupo sem expulsar/colocar outras pessoas nem trocar o dono; entrar, pedir e cancelar só mudam a própria pessoa; dono só aceita quem pediu; conexão (`conexoes`) só vale enquanto as duas pessoas dividem um dos grupos listados (até 3). Testes no emulador em `tools/regras` (README atualizado). |
| `docs/regras-amizades-codigos` | `15c19db` | `fix/regras-grupos-conexoes` | +19 testes das regras de `amizades`, `codigos` e `compartilhado`; README sem a frase falsa de que "foi removido". **Mesclar depois da anterior.** |
| `fix/codigo-convite-seguro` | `c991913` | `main` | Código de convite com `crypto.getRandomValues` no lugar de `Math.random`. |
| `feat/inicio-enxuta` | `adfb8ab` | `main` | Início: sem botão "+" flutuante (virou "Registrar atividade" ao lado do treino customizado), só medalhas ganhas, "Minhas fichas" sem repetir o treino de hoje. Changelog 1.34.0. |
| `chore/skill-ponytail` | `5441c8b` | `main` | Skill `ponytail` em `.claude/skills/ponytail/` (só a skill, sem os hooks do plugin). |

As três últimas e a primeira são independentes entre si. Possível conflito pequeno de README entre as regras e `feat/inicio-enxuta` (linhas diferentes).

**Depois de mesclar `fix/regras-grupos-conexoes`:** colar o `firestore.rules` novo no console do Firebase (aba Regras) e publicar. Sem isso, as regras corrigidas não valem em produção.

## 2. Próximo passo combinado: refatorar `social.service.ts`

Sem mudar API nem comportamento, com os 836 testes como rede de segurança (`npm run test:ci`) e `ng lint`.

- Começar pelas áreas mais isoladas: **Foto do treino** (~linha 897) e **Estatísticas de outros membros** (~994). Os componentes continuam usando `SocialService` (que só repassa), então nenhum dos 14 arquivos que o injetam muda.
- Depois, se valer a pena: Grupos (~579, a maior), Amizades (~451), Timeline (~789), Reações (~886), Peso compartilhado (~533), Perfil (~322).
- Na mesma passada: tirar os `console.warn/error` e o `motivosFoto`, que mostra texto de desenvolvedor ("publique as regras do Firestore") para o usuário; remover o comentário `/** */` duplicado antes de `lerFoto`.
- Fazer numa branch nova a partir da `main` (ou da que já tiver sido mesclada), seguindo a skill `ponytail`: menor mudança completa.

### `plan.service.ts` (depois, só se houver demanda nessas áreas)
1. Juntar `criar`, `criarRascunho`, `criarComItens`, `criarConjunto` e `adicionarTreino` num método privado `incluir(treinos, opções)` (pequeno e seguro).
2. Extrair histórico e sessões (`registrarSessao`, `registrarAtividade`, `editarSessao`, `excluirSessao`, `restaurarSessao`, `mesclarSessoes`, `ultimoRegistro`, cargas) para um `HistoricoService`. Mexe em 23 arquivos que usam `plans.historico`: manter o `PlanService` repassando na transição.
3. Tirar a ponte com a nuvem (`estadoNuvem`, `aplicarEstadoNuvem`, `sessoesParaSincronizar`, `limparLocal`) da classe das fichas.

## 3. Itens da auditoria ainda não feitos

**Decidido: não fazer.** O `maximum-scale=1, user-scalable=no` do `index.html` fica como está (decisão do dono).

Segurança e regras:
- `atividades`, `curtidas` e `comentarios` sem limite de campos/tamanho (spam de avisos); `sessoes`, `perfis` e `compartilhado` sem validação de tamanho.
- Qualquer pessoa logada cria quantos `codigos` quiser apontando para si (só gera escrita, não dá acesso). Fechar exige gravar código e perfil na mesma operação (`iniciar()` do `SocialService`) e travar `perfis.codigo` depois de definido. Baixa prioridade.
- Sem `firebase.json` nem cabeçalhos de segurança (CSP, `X-Frame-Options`, `Referrer-Policy`). O app mostra imagens de URLs de terceiros (`avatar.ts`).
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
- Testes do app: `npm run test:ci` (836 passando) e `npx ng lint`.
- Testes das regras (precisa de Java): `cd tools/regras && npm install && npm test` (42 casos). Depois, **apagar `tools/regras/node_modules` e os logs** se a pasta ficar como "não rastreada" (o hook de fim de turno reclama).
- Prints do app sem login: o app pede login Google quando o Firebase está configurado. Para tirar prints, trocar `FIREBASE_CONFIG` por `null` em `src/app/core/firebase.config.ts` **só localmente** e reverter com `git checkout -- src/app/core/firebase.config.ts`. Serve com `npx ng serve --port 4300 --host 127.0.0.1`.
- A skill `ponytail` só carrega em sessão nova com a branch `chore/skill-ponytail` (ou depois de mesclada). O clone original ficou em `/home/user/dietrichgebert/ponytail` (fora do repositório; pode apagar).
- Ruído conhecido nos testes: `this.plans.estadoNuvem is not a function` aparece também na `main` (mocks de teste incompletos). Não é regressão.
- Regra do repositório: trabalhar em branch própria e **só mesclar na `main` quando o dono pedir**.
