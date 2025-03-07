/// <reference types="@vitest/browser/providers/playwright" />
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';
import PhoneInput from './PhoneInput.vue';

test('Automatically formats the phone number on blur', async () => {
    const screen = render(PhoneInput, {
        props: {
            title: 'Phone Number',
        },
    });
});
