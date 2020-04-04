module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    setupFilesAfterEnv: ["jest-extended", "./tests/jest.setup.ts"],
    globalSetup: "./tests/jest.global.setup.ts"
};
