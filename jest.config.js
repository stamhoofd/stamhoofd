module.exports = {
    preset: "ts-jest",
    roots: ["<rootDir>"],
    testEnvironment: "node",
    setupFilesAfterEnv: ["jest-extended"],
    moduleDirectories: [
        "<rootDir>", // support for tsconfig baseUrl, which is .
        "node_modules",
    ],
    //verbose: true,
};