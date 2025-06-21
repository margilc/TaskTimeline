module.exports = {
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/__mocks__/obsidian.ts'
  },
  testEnvironment: 'node',
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {}]
  }
}; 