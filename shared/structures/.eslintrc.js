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
        "simple-import-sort/imports": "warn",
        "simple-import-sort/exports": "warn",
        "sort-imports": "off",
        "import/order": "off"
    },
    overrides: [
        {
            // Rules for TypeScript and vue
            files: ["*.ts"],
            parser: "@typescript-eslint/parser",
            parserOptions: {
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
                "simple-import-sort/imports": "warn",
                "simple-import-sort/exports": "warn",
                "sort-imports": "off",
                "import/order": "off",
                "@typescript-eslint/explicit-function-return-type": "off",
                "@typescript-eslint/no-explicit-any": "off",
                "@typescript-eslint/no-unused-vars": "off", // disabled because broken: marks imports that are only used as types as 'unused'...
                "@typescript-eslint/no-namespace": "off",
                "@typescript-eslint/no-floating-promises": "error",
                "@typescript-eslint/no-misused-promises": "error",
                "@typescript-eslint/prefer-for-of": "warn",
                "@typescript-eslint/no-empty-interface": "off", // It is convenient to have placeholder interfaces
                "@typescript-eslint/no-this-alias": "off", // No idea why we need this. This breaks code that is just fine. Prohibit the use of function() instead of this rule
                "@typescript-eslint/unbound-method": "off", // Methods are automatically bound in vue, it would break removeEventListeners if we bound it every time unless we save every method in variables again...
                "@typescript-eslint/explicit-module-boundary-types": "off",
                "@typescript-eslint/restrict-plus-operands": "off" // why remove useful language features?
            },
        }
    ]
};
