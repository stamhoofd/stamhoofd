module.exports = {
    roots: ["<rootDir>/dist"],
    setupFilesAfterEnv: [
        "jest-extended/all",
    ],
    testEnvironment: "node",
    //verbose: true,
};