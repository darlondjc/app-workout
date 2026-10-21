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
public/exercises/<id>/0.jpg, 1.jpg    fotos de cada exercício
src/app/core/                         serviços (exercícios, fichas, avisos) e componentes de apoio
src/app/pages/                        telas
```

## Dados e créditos

Os exercícios e as imagens vêm do [free-exercise-db](https://github.com/yuhonas/free-exercise-db), em domínio público (Unlicense). A licença está em `public/data/LICENSE-free-exercise-db.md`. As traduções dos nomes e dos rótulos são deste projeto e merecem revisão.

## Próximos passos

- Traduzir as instruções passo a passo (hoje estão em inglês).
- Publicar o app (por exemplo no GitHub Pages ou no Firebase Hosting) para instalar no celular.
- Exportar e importar fichas para fazer backup.
