module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    setupFilesAfterEnv: ["./tests/jest.setup.ts"],
    globalSetup: "./tests/jest.global.setup.ts"
};
