import { Linter, RuleTester } from 'eslint';
import vueParser from 'vue-eslint-parser';
import { describe, expect, it } from 'vitest';
import hrOnOwnLine from '../src/rules/hr-on-own-line.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        parser: vueParser,
    },
});

const filename = 'test.vue';

ruleTester.run('hr-on-own-line', hrOnOwnLine, {
    valid: [
        {
            filename,
            code: `<template>
    <div>
        <p>Text</p>
        <hr>
        <h2>Title</h2>
    </div>
</template>`,
        },
        {
            filename,
            code: `<template>
    <div>
        <hr/>
        <hr v-if="show" class="line">
    </div>
</template>`,
        },
        {
            // Whitespace is significant inside <pre>.
            filename,
            code: `<template>
    <pre>a<hr>b</pre>
</template>`,
        },
        {
            // Not a template: the rule only checks Vue templates.
            filename: 'test.js',
            code: `const html = '<hr><h2>Title</h2>';`,
        },
        {
            // A component named Hr is not an <hr> element.
            filename,
            code: `<template>
    <div>
        <Hr /><h2>Title</h2>
    </div>
</template>`,
        },
    ],
    invalid: [
        {
            filename,
            code: `<template>
    <div>
        <hr><h2>Title</h2>
    </div>
</template>`,
            output: `<template>
    <div>
        <hr>
        <h2>Title</h2>
    </div>
</template>`,
            errors: [{ messageId: 'ownLine', line: 3 }],
        },
        {
            filename,
            code: `<template>
    <div>
        <p>Text</p>  <hr>
    </div>
</template>`,
            output: `<template>
    <div>
        <p>Text</p>
        <hr>
    </div>
</template>`,
            errors: [{ messageId: 'ownLine', line: 3 }],
        },
        {
            filename,
            code: `<template>
    <div>
        <p>Text</p><hr class="line" /><h2>Title</h2>
    </div>
</template>`,
            output: `<template>
    <div>
        <p>Text</p>
        <hr class="line" />
        <h2>Title</h2>
    </div>
</template>`,
            errors: [{ messageId: 'ownLine', line: 3 }],
        },
        {
            // The <hr> ends up at the parent's indentation; vue/html-indent fixes the nesting.
            filename,
            code: `<template>
    <div><hr></div>
</template>`,
            output: `<template>
    <div>
    <hr>
    </div>
</template>`,
            errors: [{ messageId: 'ownLine', line: 2 }],
        },
        {
            filename,
            code: `<template>
    <div>
        <hr
            v-if="show"
        ><h2>Title</h2>
    </div>
</template>`,
            output: `<template>
    <div>
        <hr
            v-if="show"
        >
        <h2>Title</h2>
    </div>
</template>`,
            errors: [{ messageId: 'ownLine', line: 3 }],
        },
        {
            // Overlapping fixes: only the first is applied in this pass, see the multi-pass test below.
            filename,
            code: `<template>
    <div>
        <hr><hr><h2>Title</h2>
    </div>
</template>`,
            output: `<template>
    <div>
        <hr>
        <hr><h2>Title</h2>
    </div>
</template>`,
            errors: [{ messageId: 'ownLine', line: 3 }, { messageId: 'ownLine', line: 3 }],
        },
        {
            filename,
            code: '<template>\r\n    <div>\r\n        <hr><h2>Title</h2>\r\n    </div>\r\n</template>',
            output: '<template>\r\n    <div>\r\n        <hr>\r\n        <h2>Title</h2>\r\n    </div>\r\n</template>',
            errors: [{ messageId: 'ownLine', line: 3 }],
        },
    ],
});

// Without vue-eslint-parser there is no template to check.
new RuleTester().run('hr-on-own-line without vue parser', hrOnOwnLine, {
    valid: [
        `const html = '<hr><h2>Title</h2>';`,
    ],
    invalid: [],
});

describe('hr-on-own-line autofix', () => {
    it('puts multiple <hr> on one line each after all fix passes', () => {
        const linter = new Linter();
        const result = linter.verifyAndFix(`<template>
    <div>
        <hr><hr><h2>Title</h2>
    </div>
</template>`, {
            files: ['**/*.vue'],
            languageOptions: { parser: vueParser },
            plugins: { stamhoofd: { rules: { 'hr-on-own-line': hrOnOwnLine } } },
            rules: { 'stamhoofd/hr-on-own-line': 'warn' },
        }, { filename });

        expect(result.messages).toEqual([]);
        expect(result.output).toBe(`<template>
    <div>
        <hr>
        <hr>
        <h2>Title</h2>
    </div>
</template>`);
    });
});
