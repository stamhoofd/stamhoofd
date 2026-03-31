/// <reference types="@vitest/browser/providers/playwright" />
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import type { VueWrapper } from '@vue/test-utils';
import { mount } from '@vue/test-utils';
import { page } from '@vitest/browser/context';
import { defineComponent, h, withDirectives } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { TooltipDirective } from '@stamhoofd/components';
import TestAppWithModalStackComponent from '../../../../tests/helpers/TestAppWithModalStackComponent.vue';

// DO NOT COPY THIS PATTERN!
// DO NOT COPY THIS PATTERN!
// We should use vitest-browser-vue instead
// user input / keyboard handling is not realistic in @vue/test-utils
// DO NOT COPY THIS PATTERN!
// DO NOT COPY THIS PATTERN!

describe('TooltipDirective', () => {
    let wrapper: VueWrapper | undefined;

    afterEach(() => {
        wrapper?.unmount();
    });

    test('shows tooltip after hover', async () => {
        const tooltipHarness = defineComponent({
            setup() {
                return () => withDirectives(
                    h('button', {
                        type: 'button',
                        'data-testid': 'tooltip-target',
                    }, 'Hover me'),
                    [[TooltipDirective, 'Tooltip test']],
                );
            },
        });

        wrapper = mount(TestAppWithModalStackComponent, {
            attachTo: document.body,
            props: {
                root: new ComponentWithProperties(tooltipHarness, {}),
            },
        });

        await page.getByTestId('tooltip-target').hover();
        await vi.waitFor(async () => {
            await expect.element(page.getByText('Tooltip test')).toBeVisible();
        }, { timeout: 1500 });
    });
});
