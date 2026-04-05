import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { resolveConfig } from '../src/config/index.js';
import { DEFAULT_CONFIG } from '../src/types.js';

const FIXTURES_DIR = join(__dirname, '__config_fixtures__');

beforeAll(() => {
  mkdirSync(FIXTURES_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

describe('resolveConfig', () => {
  it('returns defaults when no overrides', () => {
    const config = resolveConfig({}, FIXTURES_DIR);
    expect(config.provider).toBe(DEFAULT_CONFIG.provider);
    expect(config.framework).toBe(DEFAULT_CONFIG.framework);
    expect(config.edgeCases).toBe(true);
    expect(config.errorHandling).toBe(true);
  });

  it('applies CLI flags over defaults', () => {
    const config = resolveConfig(
      { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      FIXTURES_DIR,
    );
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-sonnet-4-20250514');
  });

  it('loads config from autotest.config.json', () => {
    const configPath = join(FIXTURES_DIR, 'autotest.config.json');
    writeFileSync(
      configPath,
      JSON.stringify({ provider: 'google', framework: 'jest' }),
    );

    const config = resolveConfig({}, FIXTURES_DIR);
    expect(config.provider).toBe('google');
    expect(config.framework).toBe('jest');

    rmSync(configPath);
  });

  it('CLI flags override config file', () => {
    const configPath = join(FIXTURES_DIR, 'autotest.config.json');
    writeFileSync(configPath, JSON.stringify({ provider: 'google' }));

    const config = resolveConfig({ provider: 'ollama' }, FIXTURES_DIR);
    expect(config.provider).toBe('ollama');

    rmSync(configPath);
  });

  it('detects vitest from package.json', () => {
    const pkgPath = join(FIXTURES_DIR, 'package.json');
    writeFileSync(
      pkgPath,
      JSON.stringify({ devDependencies: { vitest: '^2.0.0' } }),
    );

    const config = resolveConfig({}, FIXTURES_DIR);
    expect(config.framework).toBe('vitest');

    rmSync(pkgPath);
  });

  it('detects jest from package.json', () => {
    const pkgPath = join(FIXTURES_DIR, 'package.json');
    writeFileSync(
      pkgPath,
      JSON.stringify({ devDependencies: { jest: '^29.0.0' } }),
    );

    const config = resolveConfig({}, FIXTURES_DIR);
    expect(config.framework).toBe('jest');

    rmSync(pkgPath);
  });

  it('loads autotest config from package.json', () => {
    const pkgPath = join(FIXTURES_DIR, 'package.json');
    writeFileSync(
      pkgPath,
      JSON.stringify({
        devDependencies: {},
        autotest: { provider: 'anthropic', model: 'claude-haiku' },
      }),
    );

    const config = resolveConfig({}, FIXTURES_DIR);
    expect(config.provider).toBe('anthropic');

    rmSync(pkgPath);
  });
});
