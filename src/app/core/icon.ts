import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'home'
  | 'search'
  | 'clipboard'
  | 'plus'
  | 'close'
  | 'back'
  | 'chevron'
  | 'check'
  | 'play'
  | 'up'
  | 'down'
  | 'settings'
  | 'refresh'
  | 'chart';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      aria-hidden="true"
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="stroke()"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      @switch (name()) {
        @case ('home') {
          <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
        }
        @case ('search') {
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        }
        @case ('chart') {
          <path d="M5 20V11M12 20V4M19 20v-7" />
        }
        @case ('clipboard') {
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V3h6v1M9 11h6M9 15h4" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('close') {
          <path d="M6 6l12 12M18 6L6 18" />
        }
        @case ('back') {
          <path d="M15 5l-7 7 7 7" />
        }
        @case ('chevron') {
          <path d="M9 5l7 7-7 7" />
        }
        @case ('check') {
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        }
        @case ('play') {
          <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
        }
        @case ('up') {
          <path d="M6 15l6-6 6 6" />
        }
        @case ('down') {
          <path d="M6 9l6 6 6-6" />
        }
        @case ('settings') {
          <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
          <circle cx="15" cy="7" r="2" />
          <circle cx="9" cy="17" r="2" />
        }
        @case ('refresh') {
          <path d="M20 11a8 8 0 0 0-14.5-4.5M4 13a8 8 0 0 0 14.5 4.5" />
          <path d="M5 3v4h4M19 21v-4h-4" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(24);
  readonly stroke = input(2);
}
