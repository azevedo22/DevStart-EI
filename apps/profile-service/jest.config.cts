module.exports = {
  displayName: 'profile-service',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  // Os testes e2e arrancam a aplicação inteira (migrações incluídas): a frio,
  // pode passar dos 5 s por omissão.
  testTimeout: 30_000,
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/profile-service',
};
