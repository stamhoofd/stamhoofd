module.exports = {
    root: true,
    parser: "vue-eslint-parser",
    parserOptions: {
        parser: "@typescript-eslint/parser",
        project: ["./tsconfig.json"],
        extraFileExtensions: [".vue"],
    },
    plugins: ["@typescript-eslint", "jest"],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "plugin:jest/recommended",
        "plugin:vue/vue3-recommended",
    ],
    rules: {
        "no-console": "off",
        "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        "@typescript-eslint/no-namespace": "off",
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-misused-promises": "error",
        "@typescript-eslint/prefer-for-of": "warn",
        "@typescript-eslint/no-empty-interface": "off", // It is convenient to have placeholder interfaces
        "@typescript-eslint/no-this-alias": "off", // No idea why we need this. This breaks code that is just fine. Prohibit the use of function() instead of this rule
        "@typescript-eslint/unbound-method": "warn", // Automatically bind in vue
        "vue/html-indent": ["warn", 4],
        "vue/max-attributes-per-line": "off",
        "vue/component-tags-order": [
            "error",
            {
                order: ["template", "script", "style"],
            },
        ],
    },
};
