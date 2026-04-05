import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'getting-started',
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/cli',
        'guides/configuration',
        'guides/providers',
        'guides/how-it-works',
        'guides/programmatic-api',
      ],
    },
    'api-reference',
  ],
};

export default sidebars;
