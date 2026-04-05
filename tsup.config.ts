import { defineConfig } from 'tsup';

const shared = {
  format: ['esm'] as const,
  splitting: false,
  treeshake: true,
  sourcemap: true,
  target: 'es2022' as const,
  outDir: 'dist',
  external: [
    'typescript',
    'aiclientjs',
    'commander',
    'picocolors',
  ],
  noExternal: [] as string[],
};

export default defineConfig([
  {
    ...shared,
    entry: ['src/index.ts'],
    dts: true,
    clean: true,
  },
  {
    ...shared,
    entry: ['src/cli.ts'],
    dts: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
