import { describe, it, expect } from 'vitest';
import { hashPassword, randomSalt, secureContextAvailable, sha256Hex } from './crypto';

describe('sha256Hex', () => {
  it('hashea la cadena vacía correctamente', async () => {
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('hashea "abc" correctamente', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('hashPassword', () => {
  it('es determinista y produce 64 caracteres hex', async () => {
    const a = await hashPassword('secreta123', 'saltsaltsaltsalt');
    const b = await hashPassword('secreta123', 'saltsaltsaltsalt');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('difiere cuando cambia la sal', async () => {
    const a = await hashPassword('secreta123', 'saltsaltsaltsalt');
    const b = await hashPassword('secreta123', 'otraSaltDistinta1');
    expect(a).not.toBe(b);
  });
});

describe('randomSalt', () => {
  it('devuelve 32 caracteres hex en minúsculas', () => {
    expect(randomSalt()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('dos llamadas producen valores distintos', () => {
    expect(randomSalt()).not.toBe(randomSalt());
  });
});

describe('secureContextAvailable', () => {
  it('devuelve un booleano', () => {
    expect(typeof secureContextAvailable()).toBe('boolean');
  });
});
