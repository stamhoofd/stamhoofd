/// <reference types="@vitest/browser/providers/playwright" />
import { I18nController } from '@stamhoofd/frontend-i18n';
import { Country, Language } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { userEvent } from '@vitest/browser/context';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';
import PhoneInput from './PhoneInput.vue';

test('Automatically formats the phone number on blur', async () => {
    await I18nController.loadDefault(null, Country.Belgium, Language.Dutch, Country.Belgium);

    render(PhoneInput, {
        props: {
            title: 'Phone Number',
        },
    });

    // Select the phone input, enter a phone number: 0479444444
    const input = document.querySelector('input')!;

    // Click the input
    await userEvent.click(input);

    // Type the phone number
    await userEvent.keyboard('0479444444');

    // Blur the input
    await userEvent.click(document.body);

    // Check input content
    expect(input).toHaveValue('+32 479 44 44 44');
});

test('Automatically formats Dutch phone numbers on blur', async () => {
    TestUtils.setEnvironment('fixedCountry', Country.Netherlands);
    await I18nController.loadDefault(null, Country.Netherlands, Language.Dutch, Country.Netherlands);

    render(PhoneInput, {
        props: {
            title: 'Phone Number',
        },
    });

    // Select the phone input, enter a phone number: 0479444444
    const input = document.querySelector('input')!;

    // Click the input
    await userEvent.click(input);

    // Type the phone number
    await userEvent.keyboard('0612345678');

    // Blur the input
    await userEvent.click(document.body);

    // Check input content
    expect(input).toHaveValue('+31 6 12345678');
});
