module.exports = {
  displayName: 'auth-service',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  // Os ficheiros e2e partilham a base de dados de testes e limpam as tabelas
  // antes de cada teste: em paralelo, um apagava os dados de outro a meio, e
  // numa base de dados vazia dois criavam as mesmas tabelas ao mesmo tempo.
  // Um ficheiro de cada vez (os serviços continuam em paralelo entre si).
  maxWorkers: 1,
  // Os testes e2e arrancam a aplicação inteira (migrações incluídas): a frio,
  // numa máquina de CI, pode passar dos 5 s por omissão.
  testTimeout: 30_000,
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/auth-service',
};
