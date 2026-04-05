/**
 * Sample file to test autotest-ai against.
 * Run: npx autotest examples/sample.ts --provider ollama --model llama3
 */

/** Adds two numbers. */
export function add(a: number, b: number): number {
  return a + b;
}

/** Divides a by b. Throws on division by zero. */
export function divide(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

/** Clamps a value between min and max. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) throw new RangeError('min must be <= max');
  return Math.min(Math.max(value, min), max);
}

/** Reverses a string. */
export function reverse(str: string): string {
  return [...str].reverse().join('');
}

/** Checks if a string is a palindrome (case-insensitive). */
export function isPalindrome(str: string): boolean {
  const normalized = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized === reverse(normalized);
}

export interface User {
  id: string;
  name: string;
  email: string;
}

/** Validates user fields. */
export function validateUser(user: Partial<User>): string[] {
  const errors: string[] = [];
  if (!user.id) errors.push('id is required');
  if (!user.name || user.name.trim().length === 0) errors.push('name is required');
  if (!user.email || !user.email.includes('@')) errors.push('valid email is required');
  return errors;
}

export class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  get size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}
