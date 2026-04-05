import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectFramework } from '../frameworks/index.js';
import { DEFAULT_CONFIG, type AutotestConfig } from '../types.js';

const CONFIG_FILES = [
  'autotest.config.json',
  '.autotestrc',
  '.autotestrc.json',
];

/**
 * Resolve the final config by merging: defaults < config file < CLI flags.
 */
export function resolveConfig(
  cliFlags: Partial<AutotestConfig>,
  cwd: string = process.cwd(),
): AutotestConfig {
  const fileConfig = loadConfigFile(cwd);
  const pkgConfig = loadFromPackageJson(cwd);
  const detectedFramework = detectFrameworkFromProject(cwd);

  return {
    ...DEFAULT_CONFIG,
    ...(detectedFramework && { framework: detectedFramework }),
    ...pkgConfig,
    ...fileConfig,
    ...stripUndefined(cliFlags),
  };
}

function loadConfigFile(cwd: string): Partial<AutotestConfig> {
  for (const fileName of CONFIG_FILES) {
    const filePath = resolve(cwd, fileName);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      } catch {
        // Ignore invalid config files
      }
    }
  }
  return {};
}

function loadFromPackageJson(cwd: string): Partial<AutotestConfig> {
  const pkgPath = resolve(cwd, 'package.json');
  if (!existsSync(pkgPath)) return {};

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return (pkg['autotest'] as Partial<AutotestConfig>) ?? {};
  } catch {
    return {};
  }
}

function detectFrameworkFromProject(cwd: string): AutotestConfig['framework'] | undefined {
  const pkgPath = resolve(cwd, 'package.json');
  if (!existsSync(pkgPath)) return undefined;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return detectFramework(pkg);
  } catch {
    return undefined;
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}
