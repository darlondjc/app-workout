# App Workout

PWA em Angular para montar fichas de treino. A biblioteca tem 876 exercícios com fotos de início e fim do movimento, nomes e filtros em português, e tudo funciona offline depois do primeiro acesso.

## O que já faz

- **Início**: treino do dia (rodízio entre as fichas) e semana com os treinos concluídos.
- **Biblioteca**: busca por nome em português ou inglês, filtro por grupo muscular, equipamento e nível.
- **Exercício**: foto alternando entre as duas posições, músculos, equipamento e instruções.
- **Fichas**: criar, renomear, reordenar, remover exercícios e definir séries, repetições, carga e descanso.
- **Treino**: marcar séries feitas, cronômetro de descanso e registro do treino concluído.

As fichas e o histórico ficam no `localStorage` do aparelho (não há conta nem servidor).

## Como rodar

Requer Node 20.19+ (ou 22.12+).

```bash
npm install
npm start          # desenvolvimento em http://localhost:4200
npm run build      # build de produção em dist/app-workout-ng/browser
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
src/app/pages/                        telas
```

## Sugestão automática de fichas

Em **Fichas → Sugerir fichas para mim** você informa objetivo, experiência, dias por semana e onde treina. O app monta a divisão (corpo inteiro, superior/inferior ou empurrar/puxar/pernas) com exercícios clássicos da base, séries e descanso conforme o objetivo, e você pode gerar outra variação antes de adicionar. A lógica fica em `src/app/core/suggestion.ts`. É uma sugestão geral, sem considerar lesões.

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

## Publicação

O workflow `.github/workflows/pages.yml` compila e publica no GitHub Pages a cada push no `main`. Na primeira vez, em **Settings → Pages**, escolha **Source: GitHub Actions**. O endereço será `https://darlondjc.github.io/app-workout/`.
