import { RuleTester } from 'eslint';
import vueParser from 'vue-eslint-parser';
import { describe, it } from 'vitest';
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
    ],
});
