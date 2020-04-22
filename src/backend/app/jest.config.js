module.exports = {
    preset: "ts-jest",
    roots: ["<rootDir>"],
    testEnvironment: "node",
    setupFilesAfterEnv: ["jest-extended", "./tests/jest.setup.ts"],
    globalSetup: "./tests/jest.global.setup.ts",
    moduleDirectories: [
        "<rootDir>", // support for tsconfig baseUrl, which is .
        "node_modules",
    ],
    //verbose: true,
};
