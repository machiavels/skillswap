'use strict';

/**
 * Smoke-test for logger: verifies the module loads correctly and exposes
 * the winston log-level methods used across the codebase.
 * Actual log output is suppressed in tests (silent transport).
 */
const logger = require('../../utils/logger');

describe('logger utils', () => {
  it('exports a winston-compatible logger object', () => {
    expect(typeof logger).toBe('object');
  });

  it('exposes an info() method', () => {
    expect(typeof logger.info).toBe('function');
  });

  it('exposes an error() method', () => {
    expect(typeof logger.error).toBe('function');
  });

  it('exposes a warn() method', () => {
    expect(typeof logger.warn).toBe('function');
  });

  it('calling logger.info() does not throw', () => {
    expect(() => logger.info('test log message', { ctx: 'unit-test' })).not.toThrow();
  });

  it('calling logger.error() does not throw', () => {
    expect(() => logger.error('test error', { code: 42 })).not.toThrow();
  });
});
