
module.exports = {
    roots: ["<rootDir>/dist"],
    testEnvironment: "node",
    setupFilesAfterEnv: [
        "jest-extended/all",
        "./dist/tests/jest.setup.js",
    ],
    globalSetup:  "./dist/tests/jest.global.setup.js"
    //verbose: true,
};