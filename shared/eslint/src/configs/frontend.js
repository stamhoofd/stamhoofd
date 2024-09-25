import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint';


export default [
    ...pluginVue.configs['flat/recommended'],
    {
        files: ['*.vue', '**/*.vue'],
        languageOptions: {
          parserOptions: {
            parser: tseslint.parser,
            projectService: true,
            tsconfigRootDir: import.meta.dirname,
            extraFileExtensions: ['.vue'],
          }
        }
    },
    {

        rules: {
            "vue/html-indent": ["warn", 4],
            "vue/html-button-has-type": "error",

            "vue/html-indent": ["warn", 4],
            "vue/no-mutating-props": "off",
            "vue/max-attributes-per-line": "off",
            "vue/component-tags-order": [
                "error",
                {
                    order: ["template", "script", "style"],
                },
            ],
            "vue/no-unused-components": "warn",
            "vue/no-multiple-template-root": "off", // For some reason when you have html comments inside components, they are treated as root elements too, which cause unwanted bugs
            "vue/multi-word-component-names": "off"
        }
    }
]
