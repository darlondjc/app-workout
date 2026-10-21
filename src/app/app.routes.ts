import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Início · App Workout',
    loadComponent: () => import('./pages/home').then((m) => m.Home),
  },
  {
    path: 'biblioteca',
    title: 'Biblioteca · App Workout',
    loadComponent: () => import('./pages/library').then((m) => m.Library),
  },
  {
    path: 'exercicio/:id',
    title: 'Exercício · App Workout',
    loadComponent: () => import('./pages/exercise-detail').then((m) => m.ExerciseDetail),
  },
  {
    path: 'fichas',
    title: 'Fichas · App Workout',
    loadComponent: () => import('./pages/plans').then((m) => m.Plans),
  },
  {
    path: 'fichas/sugestao',
    title: 'Sugestão de fichas · App Workout',
    loadComponent: () => import('./pages/suggest').then((m) => m.Suggest),
  },
  {
    path: 'ficha/:id',
    title: 'Montar ficha · App Workout',
    loadComponent: () => import('./pages/plan-editor').then((m) => m.PlanEditor),
  },
  {
    path: 'treino/:id',
    title: 'Treino · App Workout',
    loadComponent: () => import('./pages/workout').then((m) => m.Workout),
  },
  { path: '**', redirectTo: '' },
];
