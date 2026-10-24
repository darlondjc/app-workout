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
  | 'chart'
  | 'heart'
  | 'comment'
  | 'people'
  | 'trash'
  | 'camera'
  | 'mirror'
  | 'rotate'
  | 'medal'
  | 'scale'
  | 'logout'
  | 'copy'
  | 'share'
  | 'user-add'
  | 'feed';

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
        @case ('heart') {
          <path d="M12 20s-7.5-4.6-7.5-10.2a4.3 4.3 0 0 1 7.5-2.8 4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" />
        }
        @case ('comment') {
          <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
        }
        @case ('people') {
          <circle cx="9" cy="8" r="3" />
          <path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <circle cx="17" cy="9" r="2.3" />
          <path d="M17 14c2.4 0 4.2 1.9 4.2 4.5" />
        }
        @case ('clipboard') {
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V3h6v1M9 11h6M9 15h4" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('camera') {
          <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
          <circle cx="12" cy="13" r="3.5" />
        }
        @case ('mirror') {
          <path d="M12 3v2M12 8v2M12 14v2M12 19v2" />
          <path d="M9.5 6L3 19h6.5z" />
          <path d="M14.5 6L21 19h-6.5z" />
        }
        @case ('rotate') {
          <path d="M20 12a8 8 0 1 1-2.5-5.8" />
          <path d="M20 4v5h-5" />
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
        @case ('trash') {
          <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />
        }
        @case ('medal') {
          <circle cx="12" cy="9" r="5" />
          <path d="M8.7 13.2L7 21l5-3 5 3-1.7-7.8" />
        }
        @case ('scale') {
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M8 10a4 3 0 0 1 8 0z" />
          <path d="M12 10l1.5-2" />
        }
        @case ('logout') {
          <path d="M10 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
          <path d="M15 8l4 4-4 4M19 12H9" />
        }
        @case ('copy') {
          <rect x="9" y="9" width="11" height="11" rx="2.5" />
          <path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" />
        }
        @case ('share') {
          <path d="M12 15V4M8 8l4-4 4 4" />
          <path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" />
        }
        @case ('user-add') {
          <circle cx="10" cy="8" r="3.2" />
          <path d="M3.5 19.5c0-3.4 2.9-6 6.5-6 1.6 0 3 .5 4.1 1.4" />
          <path d="M18 12.5v6M15 15.5h6" />
        }
        @case ('feed') {
          <circle cx="5.5" cy="6.5" r="1.3" />
          <circle cx="5.5" cy="12" r="1.3" />
          <circle cx="5.5" cy="17.5" r="1.3" />
          <path d="M10 6.5h9M10 12h9M10 17.5h9" />
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
