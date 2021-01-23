module.exports = {
    root: true,
    ignorePatterns: ["dist/", "node_modules/", "app/dashboard/src/pdfkit.standalone.js"],
    parserOptions: {
        "ecmaVersion": 2017,
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
            files: ["*.ts", "*.vue"],
            parser: "vue-eslint-parser",
            parserOptions: {
                parser: "@typescript-eslint/parser",
                project: ["./tsconfig.json"],
                extraFileExtensions: [".vue"],
            },
            plugins: ["@typescript-eslint", "jest", "simple-import-sort"],
            extends: [
                "eslint:recommended",
                "plugin:@typescript-eslint/eslint-recommended",
                "plugin:@typescript-eslint/recommended",
                "plugin:@typescript-eslint/recommended-requiring-type-checking",
                "plugin:jest/recommended",
                "plugin:vue/recommended",
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
                "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
                "@typescript-eslint/no-namespace": "off",
                "@typescript-eslint/no-floating-promises": "error",
                "@typescript-eslint/no-misused-promises": "error",
                "@typescript-eslint/prefer-for-of": "warn",
                "@typescript-eslint/no-empty-interface": "off", // It is convenient to have placeholder interfaces
                "@typescript-eslint/no-this-alias": "off", // No idea why we need this. This breaks code that is just fine. Prohibit the use of function() instead of this rule
                "@typescript-eslint/unbound-method": "off", // Methods are automatically bound in vue, it would break removeEventListeners if we bound it every time unless we save every method in variables again...
                "@typescript-eslint/no-unnecessary-type-assertion": "off", // There is a bug in the autofix that breaks Vue code (it changes code on the wrong position)
                "@typescript-eslint/explicit-module-boundary-types": "off", // Don't need this, since we don't export methods, and is annoying for async methods without return values
                "vue/html-indent": ["warn", 4],
                "vue/max-attributes-per-line": "off",
                "vue/component-tags-order": [
                    "error",
                    {
                        order: ["template", "script", "style"],
                    },
                ],
            },
        }
    ]
};
