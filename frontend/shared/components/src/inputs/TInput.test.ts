import { SimpleError } from '@common/errors';
import { TranslatedString } from '@stamhoofd/structures';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';

import { ErrorBox } from '../errors/ErrorBox';
import { EditorContext } from './hooks/useEditorContext';
import STInputBox from './STInputBox.vue';
import TInput from './TInput.vue';
import TTextarea from './TTextarea.vue';

const translatedInputs = [
    ['TInput', TInput],
    ['TTextarea', TTextarea],
] as const;

function renderWithError(component: any, field: string) {
    return render(component, {
        props: {
            modelValue: new TranslatedString('A'),
            title: 'Name',
            errorFields: 'name',
            errorBox: new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: `${field} is invalid`,
                human: `Fix the ${field}`,
                field,
            })),
        },
        global: {
            components: {
                STInputBox,
            },
            config: {
                globalProperties: {
                    $t: (globalThis as any).$t,
                    $isMobile: false,
                } as any,
            },
            directives: {
                autofocus: {},
                tooltip: {},
            },
            provide: {
                'editor-context': new EditorContext(),
            },
        },
    });
}

test.each(translatedInputs)('%s renders the errors of its own field', async (_name, component) => {
    renderWithError(component, 'name');

    await expect.element(document.querySelector<HTMLElement>('[data-testid="input-error"]')!).toBeVisible();
    expect(document.body.textContent).toContain('Fix the name');
});

test.each(translatedInputs)('%s leaves the errors of other fields alone', (_name, component) => {
    renderWithError(component, 'typeId');

    expect(document.querySelector('[data-testid="input-error"]')).toBeNull();
});
