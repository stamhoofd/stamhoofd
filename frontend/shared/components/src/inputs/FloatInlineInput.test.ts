import { userEvent } from 'vitest/browser';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';
import { nextTick } from 'vue';

import FloatInlineInput from './FloatInlineInput.vue';
import PermyriadInlineInput from './PermyriadInlineInput.vue';

type Props = {
    min?: number | null;
    max?: number | null;
    disabled?: boolean;
    suffix?: string;
    suffixSingular?: string | null;
    fractionDigits?: number;
    roundFractionDigits?: number | null;
    autoFix?: boolean;
    selectOnFocus?: boolean;
    label?: string | null;
};

/**
 * Renders the input and keeps the model value in sync, like a parent component would.
 */
function renderInput(value: number | null, props: Props = {}) {
    const state: { value: number | null } = { value };
    const rendered: { result?: ReturnType<typeof render> } = {};

    const result = render(FloatInlineInput, {
        props: {
            ...props,
            'modelValue': value,
            'onUpdate:modelValue': (updated: number | null) => {
                state.value = updated;
                void rendered.result?.rerender({ modelValue: updated });
            },
        },
    });
    rendered.result = result;

    return { result, state };
}

function container(): HTMLElement {
    return document.querySelector('.st-inline-input')!;
}

function input(): HTMLInputElement {
    return document.querySelector('.st-inline-input input')!;
}

/**
 * Types text in the input, without leaving it: the value is only committed on change.
 */
async function type(text: string) {
    await userEvent.click(input());
    await userEvent.clear(input());
    await userEvent.keyboard(text);
    await nextTick();
}

async function commit() {
    await userEvent.click(document.body);
    await nextTick();
}

test('Shows the value with its suffix', async () => {
    renderInput(30, { suffix: '%' });

    expect(input()).toHaveValue('30');
    expect(container()).toHaveTextContent('30%');
});

test('Uses the singular suffix for a value of one', async () => {
    const { state } = renderInput(2, { suffix: 'dagen', suffixSingular: 'dag' });

    expect(container()).toHaveTextContent('2dagen');

    await type('1');

    expect(state.value).toBe(1);
    expect(container()).toHaveTextContent('1dag');
});

test('Updates the model value while typing, so a linked value can follow along', async () => {
    const { state } = renderInput(30, { min: 0, max: 100, suffix: '%' });

    await type('70');

    // Without leaving the input, so a computed 100 - value stays in sync while typing
    expect(state.value).toBe(70);
});

test('Grows and shrinks with the width of its content', async () => {
    renderInput(5, { min: 0, max: 10000 });

    const narrow = container().offsetWidth;

    await type('5000');

    expect(container().offsetWidth).toBeGreaterThan(narrow);

    await type('5');

    expect(container().offsetWidth).toBe(narrow);
});

test('Does not apply a value above the maximum while typing, but corrects it on change', async () => {
    const { state } = renderInput(30, { min: 0, max: 100, suffix: '%' });

    await type('120');

    // 12 was a valid intermediate value, 120 is not applied
    expect(state.value).toBe(12);
    expect(container().classList).toContain('error');

    await commit();

    expect(state.value).toBe(100);
    expect(input()).toHaveValue('100');
    expect(container().classList).not.toContain('error');
});

test('Corrects a value below the minimum on change', async () => {
    const { state } = renderInput(30, { min: 10, max: 100 });

    await type('5');
    await commit();

    expect(state.value).toBe(10);
    expect(input()).toHaveValue('10');
});

test('Falls back to the minimum when the text is invalid on change', async () => {
    const { state } = renderInput(30, { min: 10, max: 100 });

    await type('abc');

    expect(container().classList).toContain('error');

    await commit();

    // A sentence always needs a value, so the input never ends up empty
    expect(state.value).toBe(10);
    expect(input()).toHaveValue('10');
});

test('Steps the value with the arrow keys', async () => {
    const { state } = renderInput(30, { min: 0, max: 100 });

    await userEvent.click(input());
    await userEvent.keyboard('{ArrowUp}');

    expect(state.value).toBe(31);
    expect(input()).toHaveValue('31');

    await userEvent.keyboard('{ArrowDown}{ArrowDown}');

    expect(state.value).toBe(29);
    expect(input()).toHaveValue('29');
});

test('Does not step past the minimum or maximum', async () => {
    const { state } = renderInput(100, { min: 0, max: 100 });

    await userEvent.click(input());
    await userEvent.keyboard('{ArrowUp}');

    expect(state.value).toBe(100);
});

test('Accepts decimals when fraction digits are used', async () => {
    const { state } = renderInput(1250, { fractionDigits: 2 });

    expect(input().value).toMatch(/^12[.,]5$/);

    await type('8,5');
    await commit();

    expect(state.value).toBe(850);
    expect(input().value).toMatch(/^8[.,]5$/);
});

test('Selects the value on focus, so typing replaces it', async () => {
    renderInput(30, { min: 0, max: 100 });

    await userEvent.click(input());

    expect(input().selectionStart).toBe(0);
    expect(input().selectionEnd).toBe(2);
});

test('Only places the caret on focus when selectOnFocus is off', async () => {
    renderInput(30, { min: 0, max: 100, selectOnFocus: false });

    await userEvent.click(input());

    expect(input().selectionStart).toBe(input().selectionEnd);
});

test('Commits the value when pressing enter', async () => {
    const { state } = renderInput(30, { min: 0, max: 100 });

    await type('120');
    await userEvent.keyboard('{Enter}');
    await nextTick();

    expect(state.value).toBe(100);
    expect(input()).toHaveValue('100');
    expect(input()).not.toBe(document.activeElement);
});

test('Follows the model value when it is changed from the outside', async () => {
    const { result } = renderInput(30, { min: 0, max: 100 });

    await result.rerender({ modelValue: 45 });

    expect(input()).toHaveValue('45');
});

test('Cannot be edited when disabled', async () => {
    renderInput(30, { disabled: true, suffix: '%' });

    expect(input()).toBeDisabled();
    expect(container().classList).toContain('disabled');
});

test('Labels the input for screen readers', async () => {
    renderInput(30, { label: 'Percentage dat je terugbetaalt' });

    expect(input()).toHaveAttribute('aria-label', 'Percentage dat je terugbetaalt');
});

test('Keeps the suffix while the input is empty', async () => {
    const { state } = renderInput(30, { min: 0, max: 100, suffix: '%' });

    expect(container()).toHaveTextContent('30%');

    await userEvent.click(input());
    await userEvent.clear(input());
    await nextTick();

    // The suffix keeps its place, so the words behind it do not shift while typing
    expect(container()).toHaveTextContent('%');
    expect(state.value).toBe(30);

    await commit();

    expect(state.value).toBe(0);
    expect(container()).toHaveTextContent('0%');
});

test('PermyriadInlineInput edits a permyriad value as a percentage', async () => {
    const state: { value: number | null } = { value: 30_00 };
    const rendered: { result?: ReturnType<typeof render> } = {};

    const result = render(PermyriadInlineInput, {
        props: {
            'modelValue': state.value,
            'label': 'Percentage annuleringskost',
            'onUpdate:modelValue': (updated: number | null) => {
                state.value = updated;
                void rendered.result?.rerender({ modelValue: updated });
            },
        },
    });
    rendered.result = result;

    expect(input()).toHaveValue('30');
    expect(container()).toHaveTextContent('30%');

    await type('70');

    expect(state.value).toBe(70_00);

    await type('120');
    await commit();

    // The maximum of 100% is applied
    expect(state.value).toBe(100_00);
    expect(input()).toHaveValue('100');
});
