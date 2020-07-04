require("dotenv").config({path: __dirname+'/.test.env'});

module.exports = {
    roots: ["<rootDir>/dist"],
    testEnvironment: "node",
    setupFilesAfterEnv: [
        "jest-extended",
        "./dist/tests/jest.setup.js",
    ],
    globalSetup:  "./dist/tests/jest.global.setup.js"
    //verbose: true,
};