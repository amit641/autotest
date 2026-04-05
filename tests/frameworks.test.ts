import { describe, it, expect } from 'vitest';
import { getFrameworkInfo, detectFramework } from '../src/frameworks/index.js';

describe('getFrameworkInfo', () => {
  it('returns vitest info', () => {
    const info = getFrameworkInfo('vitest');
    expect(info.name).toBe('vitest');
    expect(info.runCommand).toContain('vitest');
  });

  it('returns jest info', () => {
    const info = getFrameworkInfo('jest');
    expect(info.name).toBe('jest');
    expect(info.runCommand).toContain('jest');
  });

  it('returns mocha info', () => {
    const info = getFrameworkInfo('mocha');
    expect(info.name).toBe('mocha');
    expect(info.runCommand).toContain('mocha');
  });

  it('returns node test runner info', () => {
    const info = getFrameworkInfo('node');
    expect(info.name).toBe('node');
    expect(info.runCommand).toContain('node --test');
  });
});

describe('detectFramework', () => {
  it('detects vitest from devDependencies', () => {
    const result = detectFramework({
      devDependencies: { vitest: '^2.0.0' },
    });
    expect(result).toBe('vitest');
  });

  it('detects jest from devDependencies', () => {
    const result = detectFramework({
      devDependencies: { jest: '^29.0.0' },
    });
    expect(result).toBe('jest');
  });

  it('detects mocha from devDependencies', () => {
    const result = detectFramework({
      devDependencies: { mocha: '^10.0.0' },
    });
    expect(result).toBe('mocha');
  });

  it('detects from test script', () => {
    const result = detectFramework({
      scripts: { test: 'vitest run' },
    });
    expect(result).toBe('vitest');
  });

  it('detects node test runner from script', () => {
    const result = detectFramework({
      scripts: { test: 'node --test' },
    });
    expect(result).toBe('node');
  });

  it('defaults to vitest when nothing found', () => {
    const result = detectFramework({});
    expect(result).toBe('vitest');
  });

  it('detects @jest/core', () => {
    const result = detectFramework({
      devDependencies: { '@jest/core': '^29.0.0' },
    });
    expect(result).toBe('jest');
  });
});
