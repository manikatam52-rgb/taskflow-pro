/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  // mongodb-memory-server can take a few seconds to boot its first download.
  testTimeout: 60000,
  clearMocks: true,
};
