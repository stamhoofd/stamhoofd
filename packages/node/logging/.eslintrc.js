module.exports = {
    root: true,
    ignorePatterns: ["dist/", "node_modules/"],
    parserOptions: {
        "ecmaVersion": 2017
    },
    env: {
        "es6": true,
        "node": true,
    },
    extends: [
        "eslint:recommended",
    ],
    plugins: ["simple-import-sort"],
    rules: {
        "no-console": "off",
        "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
        "simple-import-sort/sort": "warn",
        "no-prototype-builtins": "off",
    },
    overrides: [
        {
            // Rules for TypeScript
            files: ["*.ts"],
            parserOptions: {
                parser: "@typescript-eslint/parser",
                project: ["./tsconfig.json"]
            },
            plugins: ["@typescript-eslint", "jest", "simple-import-sort"],
            extends: [
                "eslint:recommended",
                "plugin:@typescript-eslint/eslint-recommended",
                "plugin:@typescript-eslint/recommended",
                "plugin:@typescript-eslint/recommended-requiring-type-checking",
                "plugin:jest/recommended",
            ],
            rules: {
                "no-console": "off",
                "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
                "simple-import-sort/sort": "warn",
                "no-prototype-builtins": "off",
                "@typescript-eslint/explicit-function-return-type": "off",
                "@typescript-eslint/no-explicit-any": "off",
                "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
                "@typescript-eslint/no-namespace": "off",
                "@typescript-eslint/no-floating-promises": "error",
                "@typescript-eslint/no-misused-promises": "error",
                "@typescript-eslint/prefer-for-of": "warn",
                "@typescript-eslint/no-empty-interface": "off", // It is convenient to have placeholder interfaces
                "@typescript-eslint/no-this-alias": "off", // No idea why we need this. This breaks code that is just fine. Prohibit the use of function() instead of this rule
                "@typescript-eslint/unbound-method": "off", // Methods are automatically bound in vue, it would break removeEventListeners if we bound it every time unless we save every method in variables again...
            },
        }
    ]
};
