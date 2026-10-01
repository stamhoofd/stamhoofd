/* eslint-disable vue/one-component-per-file */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { defineComponent } from 'vue';
import { AutofocusDirective } from './AutofocusDirective';

const VisibleInputView = defineComponent({
    directives: { autofocus: AutofocusDirective },
    template: `
        <div class="st-view" style="padding-top: 100px;">
            <input v-autofocus="true" data-testid="autofocus-input">
            <input data-testid="other-input">
        </div>
    `,
});

// The autofocus input starts out of view, so the directive has to scroll to it first
const ScrollingView = defineComponent({
    directives: { autofocus: AutofocusDirective },
    template: `
        <div class="st-view scrolling-test-view">
            <input data-testid="other-input">
            <div style="height: 2000px;" />
            <input v-autofocus="true" data-testid="autofocus-input">
        </div>
    `,
});

describe('AutofocusDirective', () => {
    // Not an inline style: the scroll animation clears the inline overflow of the scroll element
    const style = document.createElement('style');
    style.textContent = '.scrolling-test-view { height: 200px; overflow-y: auto; }';
    document.head.appendChild(style);

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function getInput(screen: ReturnType<typeof render>, testId: string) {
        return screen.getByTestId(testId).element() as HTMLInputElement;
    }

    test('focuses a visible input once the view has appeared', async () => {
        const screen = render(VisibleInputView);
        const input = getInput(screen, 'autofocus-input');

        await vi.advanceTimersByTimeAsync(299);
        expect(document.activeElement).not.toBe(input);

        await vi.advanceTimersByTimeAsync(1);
        expect(document.activeElement).toBe(input);
    });

    test('does not steal the focus from an input the user focused before it would focus', async () => {
        const screen = render(VisibleInputView);
        const other = getInput(screen, 'other-input');

        await vi.advanceTimersByTimeAsync(200);
        other.focus();
        await vi.advanceTimersByTimeAsync(1_000);

        expect(document.activeElement).toBe(other);
    });

    test('only focuses an input out of view after scrolling to it', async () => {
        const screen = render(ScrollingView);
        const input = getInput(screen, 'autofocus-input');
        const view = input.closest('.st-view')!;

        await vi.advanceTimersByTimeAsync(300 + 100);
        expect(view.scrollTop).toBeGreaterThan(0);
        expect(document.activeElement).not.toBe(input);

        await vi.advanceTimersByTimeAsync(1_000);
        expect(document.activeElement).toBe(input);
    });

    test('does not steal the focus from an input the user focused during the scroll', async () => {
        const screen = render(ScrollingView);
        const other = getInput(screen, 'other-input');

        await vi.advanceTimersByTimeAsync(300 + 100);
        other.focus();
        await vi.advanceTimersByTimeAsync(1_000);

        expect(document.activeElement).toBe(other);
    });
});
