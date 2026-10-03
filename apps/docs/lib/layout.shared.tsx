import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { homeUrl } from './i18n';
import { gitConfig } from './shared';

export function baseOptions(lang: string): BaseLayoutProps {
  return {
    nav: {
      // Drawn like the TUI's banner, `jinion v0.1.0`.
      title: (
        <span className="font-mono text-[0.95rem]">
          <span className="font-bold text-fd-primary">jinion</span>{' '}
          <span className="text-fd-muted-foreground">docs</span>
        </span>
      ),
      url: homeUrl(lang),
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
