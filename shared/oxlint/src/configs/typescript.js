export default {
    plugins: [
        'typescript'
    ],
    rules: {
        // Recommended
        '@typescript-eslint/ban-ts-comment': 'error',
        'no-array-constructor': 'off',
        '@typescript-eslint/no-array-constructor': 'error',
        '@typescript-eslint/no-duplicate-enum-values': 'error',
        '@typescript-eslint/no-empty-object-type': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-extra-non-null-assertion': 'error',
        '@typescript-eslint/no-misused-new': 'error',
        '@typescript-eslint/no-namespace': 'error',
        '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
        '@typescript-eslint/no-require-imports': 'error',
        '@typescript-eslint/no-this-alias': 'error',
        '@typescript-eslint/no-unnecessary-type-constraint': 'error',
        '@typescript-eslint/no-unsafe-declaration-merging': 'error',
        '@typescript-eslint/no-unsafe-function-type': 'error',
        'no-unused-expressions': 'off',
        '@typescript-eslint/no-unused-expressions': 'error',
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/no-wrapper-object-types': 'error',
        '@typescript-eslint/prefer-as-const': 'error',
        '@typescript-eslint/prefer-namespace-keyword': 'error',
        '@typescript-eslint/triple-slash-reference': 'error',

        // Overrides
        "no-undef": "off", // Does not work with TypeScript
        
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-explicit-any": "off",

        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", "caughtErrors": "none", }],

        "prefer-promise-reject-errors": "off",
        "@typescript-eslint/prefer-promise-reject-errors": "off", // Does not work correctly when passing on 'any' errors in a try catch block using reject()

        "@typescript-eslint/no-namespace": "off",
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-misused-promises": "error",
        "@typescript-eslint/prefer-for-of": "warn",
        "@typescript-eslint/no-empty-interface": "off", // It is convenient to have placeholder interfaces
        "@typescript-eslint/no-this-alias": "off", // No idea why we need this. This breaks code that is just fine. Prohibit the use of function() instead of this rule
        "@typescript-eslint/unbound-method": "off", // Methods are automatically bound in vue, it would break removeEventListeners if we bound it every time unless we save every method in variables again...
        "@typescript-eslint/no-unnecessary-type-assertion": "off", // There is a bug in the autofix that breaks Vue code (it changes code on the wrong position)
        "@typescript-eslint/explicit-module-boundary-types": "off", // Don't need this, since we don't export methods, and is annoying for async methods without return values

        "@typescript-eslint/no-unsafe-assignment": "off", // This is impossible to use with dependencies that don't have types yet, such as tiptap
        "@typescript-eslint/no-unsafe-return": "off", // This is impossible to use with dependencies that don't have types yet, such as tiptap
        "@typescript-eslint/no-unsafe-call": "off", // This is impossible to use with dependencies that don't have types yet, such as tiptap
        "@typescript-eslint/no-unsafe-member-access": "off", // This is impossible to use with dependencies that don't have types yet, such as tiptap
        "@typescript-eslint/restrict-plus-operands": "off", // bullshit one
        "@typescript-eslint/require-await": "off", // You should be able to define async methods if you need to match required interfaces or types
    
        "@typescript-eslint/no-redundant-type-constituents": "off", // Weird behaviour and reduces code readability
        "@typescript-eslint/ban-ts-comment": "off",
    }
