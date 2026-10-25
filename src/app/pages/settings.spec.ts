import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CloudService } from '../core/cloud.service';
import { SocialService } from '../core/social.service';
import { UpdateService } from '../core/update.service';
import { Settings } from './settings';

const LOG = [
  { versao: '1.2.0', data: '2026-10-20', titulo: 'Novidade atual', itens: ['Item A', 'Item B'] },
  { versao: '1.1.0', data: '2026-10-10', titulo: 'Antiga um', itens: ['Item C'] },
  { versao: '1.0.0', data: '2026-10-01', titulo: 'Antiga zero', itens: ['Item D'] },
];

describe('Settings', () => {
  let fixture: ComponentFixture<Settings>;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector(s) as HTMLElement | null;

  function criar(logado: boolean): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CloudService,
          useValue: {
            configurado: true,
            pronto: signal(true),
            usuario: signal(logado ? { uid: 'u', nome: 'Ana Souza', email: 'ana@x.com', foto: null } : null),
            online: signal(true),
            status: signal('ok'),
            erro: signal(''),
            ocupado: signal(false),
            iniciar: () => Promise.resolve(),
            sair: () => Promise.resolve(),
            entrar: () => Promise.resolve(),
          },
        },
        { provide: SocialService, useValue: { meuUsuario: signal(null), eu: signal({ fotoPropria: false }) } },
        {
          provide: UpdateService,
          useValue: { disponivel: false, pronta: signal(null), atualizando: signal(false), verificando: signal(false), ultimaVerificacao: signal(null), falhou: signal(false) },
        },
      ],
    });
    fixture = TestBed.createComponent(Settings);
    TestBed.inject(HttpTestingController).expectOne('data/changelog.json').flush(LOG);
    fixture.detectChanges();
  }

  it('tem um ícone no topo que leva às minhas estatísticas, com ou sem conta', () => {
    criar(false);
    expect(q('a.estatisticas')?.getAttribute('href')).toBe('/estatisticas');
    expect(q('a.estatisticas')?.getAttribute('aria-label')).toBe('Minhas estatísticas');
  });

  it('mostra o botão de sair no topo só com a conta conectada', () => {
    criar(true);
    expect(q('header .sair')).not.toBeNull();
    expect(q('#t-conta')?.textContent?.trim()).toBe('Conta');
  });

  it('sem conta não mostra o botão de sair', () => {
    criar(false);
    expect(q('header .sair')).toBeNull();
  });

  it('pede confirmação antes de sair', () => {
    criar(true);
    q('header .sair')!.click();
    fixture.detectChanges();
    expect(q('app-dialogo')?.textContent).toContain('Sair da conta?');
  });

  it('abre a foto em um diálogo com o botão de alterar', () => {
    criar(true);
    expect(q('app-dialogo')).toBeNull();
    q('.foto')!.click();
    fixture.detectChanges();
    expect(q('app-dialogo')?.textContent).toContain('Foto de perfil');
    expect(q('app-dialogo app-foto-botao')).not.toBeNull();
  });

  it('resume a versão atual e guarda as anteriores no link', () => {
    criar(true);
    expect(q('.resumo')?.textContent).toContain('Novidade atual');
    expect(q('.resumo')?.textContent).toContain('Item B');
    const link = q('.historico > summary');
    expect(link?.textContent?.trim()).toBe('Versões anteriores (2)');
    expect(el().querySelectorAll('.versao-item').length).toBe(2);
    expect((q('.historico') as HTMLDetailsElement).open).toBeFalse();
  });
});
