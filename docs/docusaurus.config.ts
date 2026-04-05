import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'testpilot-ai — AI-Powered Test Generation for JavaScript & TypeScript',
  tagline: 'Generate, verify, and auto-fix unit tests with any LLM. Supports Vitest, Jest, Mocha. OpenAI, Anthropic, Google, Ollama.',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://amit641.github.io',
  baseUrl: '/autotest/',

  organizationName: 'amit641',
  projectName: 'autotest',

  onBrokenLinks: 'throw',

  headTags: [
    {
      tagName: 'meta',
      attributes: {
        name: 'description',
        content: 'testpilot-ai generates unit tests using AI, runs them, and auto-fixes failures. Supports Vitest, Jest, Mocha, Node test runner. Works with OpenAI, Anthropic Claude, Google Gemini, and Ollama.',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'keywords',
        content: 'testpilot-ai, ai test generation, unit test generator, vitest, jest, mocha, auto generate tests, llm test, openai tests, typescript test generator, javascript test generator, ai testing tool, auto fix tests, coverage analysis',
      },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:title', content: 'testpilot-ai — AI-Powered Test Generation That Actually Works' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:description', content: 'Generate, verify, and auto-fix unit tests with any LLM. Vitest, Jest, Mocha. OpenAI, Anthropic, Google, Ollama.' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:type', content: 'website' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:url', content: 'https://amit641.github.io/autotest/' },
    },
  ],

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
        sitemap: {
          lastmod: 'date',
          changefreq: 'weekly',
          priority: 0.5,
        },
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
      title: 'testpilot-ai',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://www.npmjs.com/package/@amit641/testpilot-ai',
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
            { label: 'npm', href: 'https://www.npmjs.com/package/@amit641/testpilot-ai' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} testpilot-ai. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
