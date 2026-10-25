import { Routes } from '@angular/router';
import { logado } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [logado],
    title: 'Início · App Workout',
    loadComponent: () => import('./pages/home').then((m) => m.Home),
  },
  {
    path: 'biblioteca',
    canActivate: [logado],
    title: 'Biblioteca · App Workout',
    loadComponent: () => import('./pages/library').then((m) => m.Library),
  },
  {
    path: 'exercicio/:id',
    canActivate: [logado],
    title: 'Exercício · App Workout',
    loadComponent: () => import('./pages/exercise-detail').then((m) => m.ExerciseDetail),
  },
  {
    path: 'fichas',
    canActivate: [logado],
    title: 'Fichas · App Workout',
    loadComponent: () => import('./pages/plans').then((m) => m.Plans),
  },
  {
    path: 'fichas/sugestao',
    canActivate: [logado],
    title: 'Sugerir ficha · App Workout',
    loadComponent: () => import('./pages/suggest').then((m) => m.Suggest),
  },
  {
    path: 'fichas/personalizada',
    canActivate: [logado],
    title: 'Ficha personalizada · App Workout',
    loadComponent: () => import('./pages/custom-plan').then((m) => m.CustomPlan),
  },
  {
    path: 'treino-do-dia',
    canActivate: [logado],
    title: 'Treino do dia · App Workout',
    loadComponent: () => import('./pages/daily-workout').then((m) => m.DailyWorkout),
  },
  {
    path: 'ficha/:id',
    canActivate: [logado],
    title: 'Montar ficha · App Workout',
    loadComponent: () => import('./pages/plan-editor').then((m) => m.PlanEditor),
  },
  {
    path: 'treino/:id',
    canActivate: [logado],
    title: 'Treino · App Workout',
    loadComponent: () => import('./pages/workout').then((m) => m.Workout),
  },
  {
    path: 'social',
    canActivate: [logado],
    title: 'Grupos · App Workout',
    loadComponent: () => import('./pages/social').then((m) => m.Social),
  },
  {
    path: 'grupo/:id',
    canActivate: [logado],
    title: 'Grupo · App Workout',
    loadComponent: () => import('./pages/group').then((m) => m.Group),
  },
  {
    path: 'grupo/:id/convidar',
    canActivate: [logado],
    title: 'Convidar · App Workout',
    loadComponent: () => import('./pages/group-invite').then((m) => m.GroupInvite),
  },
  {
    path: 'convite/:codigo',
    canActivate: [logado],
    title: 'Convite · App Workout',
    loadComponent: () => import('./pages/join').then((m) => m.Join),
  },
  {
    path: 'membro/:uid',
    canActivate: [logado],
    title: 'Estatísticas · App Workout',
    loadComponent: () => import('./pages/member-stats').then((m) => m.MemberStats),
  },
  { path: 'amigos', redirectTo: 'social' },
  { path: 'progresso', redirectTo: 'perfil' },
  { path: 'ajustes', redirectTo: 'perfil' },
  {
    path: 'perfil',
    canActivate: [logado],
    title: 'Perfil · App Workout',
    loadComponent: () => import('./pages/settings').then((m) => m.Settings),
  },
  {
    path: 'entrar',
    title: 'Entrar · App Workout',
    loadComponent: () => import('./pages/login').then((m) => m.Login),
  },
  { path: '**', redirectTo: '' },
];
