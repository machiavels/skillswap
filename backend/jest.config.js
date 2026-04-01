module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  globalSetup: './src/__tests__/setup.js',
  globalTeardown: './src/__tests__/teardown.js',
  testTimeout: 15000,
  verbose: true,
};
