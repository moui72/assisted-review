/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup-env.cjs'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  // Web source uses explicit .ts/.tsx import extensions; strip them so the
  // Jest resolver finds the modules.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.tsx?$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
};
