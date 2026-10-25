import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SocialService } from '../core/social.service';
import { GroupInvite } from './group-invite';

describe('GroupInvite', () => {
  let fixture: ComponentFixture<GroupInvite>;
  const el = () => fixture.nativeElement as HTMLElement;
  const grupo = { id: 'ABCD2345', nome: 'Trabalho', dono: 'eu', membros: ['eu'], acesso: 'aberto', pedidos: [], criadoEm: 1 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: SocialService,
          useValue: {
            ativo: signal(true),
            erro: signal(''),
            gruposCarregados: signal(true),
            eu: signal({ uid: 'eu', nome: 'Eu', foto: null }),
            grupo: () => grupo,
            membrosDe: () => [{ uid: 'eu', nome: 'Eu', foto: null }],
          },
        },
      ],
    });
    fixture = TestBed.createComponent(GroupInvite);
    fixture.componentRef.setInput('id', 'ABCD2345');
    fixture.detectChanges();
  });

  it('não tem o botão "Convidar" repetindo o compartilhar', () => {
    const botoes = [...el().querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(botoes).not.toContain('Convidar');
  });

  it('mostra o QR code do link do convite', () => {
    [...el().querySelectorAll('button')].find((b) => b.textContent?.includes('Mostrar QR code'))!.click();
    fixture.detectChanges();
    const caminho = el().querySelector('.qr svg path')?.getAttribute('d') ?? '';
    expect(caminho.length).toBeGreaterThan(200);
    expect(el().querySelector('.qr svg')?.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
  });
});
