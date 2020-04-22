const base = require("../jest.base.config")

base.setupFilesAfterEnv.push("./tests/jest.setup.ts")
base.globalSetup = "./tests/jest.global.setup.ts";

module.exports = base;