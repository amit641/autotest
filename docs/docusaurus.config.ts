import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'autotest-ai',
  tagline: 'AI-powered test generation for JavaScript & TypeScript.',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://amit641.github.io',
  baseUrl: '/autotest/',

  organizationName: 'amit641',
  projectName: 'autotest',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl: 'https://github.com/amit641/autotest/tree/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'autotest-ai',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://www.npmjs.com/package/autotest-ai',
          label: 'npm',
          position: 'right',
        },
        {
          href: 'https://github.com/amit641/autotest',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting Started', to: '/getting-started' },
            { label: 'CLI Reference', to: '/guides/cli' },
            { label: 'Configuration', to: '/guides/configuration' },
            { label: 'Providers', to: '/guides/providers' },
          ],
        },
        {
          title: 'Links',
          items: [
            { label: 'GitHub', href: 'https://github.com/amit641/autotest' },
            { label: 'npm', href: 'https://www.npmjs.com/package/autotest-ai' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} autotest-ai. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
