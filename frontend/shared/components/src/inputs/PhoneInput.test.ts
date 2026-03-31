/// <reference types="@vitest/browser/providers/playwright" />
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { userEvent } from '@vitest/browser/context';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';
import { FormatInputDirective } from '../directives/FormatInputDirective';
import STInputBox from './STInputBox.vue';
import PhoneInput from './PhoneInput.vue';

function renderPhoneInput() {
    render(PhoneInput, {
        props: {
            title: 'Phone Number',
            modelValue: '',
        },
        global: {
            components: {
                STInputBox,
            },
            directives: {
                formatInput: FormatInputDirective,
            },
        },
    });
}

test('Automatically formats the phone number on blur', async () => {
    await I18nController.loadDefault(null, Country.Belgium, Language.Dutch, Country.Belgium);

    renderPhoneInput();

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

test('Automatically formats the phone number as you type', async () => {
    await I18nController.loadDefault(null, Country.Belgium, Language.Dutch, Country.Belgium);

    renderPhoneInput();

    // Select the phone input, enter a phone number: 0479444444
    const input = document.querySelector('input')!;

    // Click the input
    await userEvent.click(input);

    // Type the phone number
    await userEvent.keyboard('047944');

    // Check input content
    expect(input).toHaveValue('0479 44');

    await userEvent.keyboard('55');

    expect(input).toHaveValue('0479 44 55');

    await userEvent.keyboard('55');

    // Check input content
    expect(input).toHaveValue('+32 479 44 55 55');

    await userEvent.keyboard('1');

    expect(input).toHaveValue('+32 4794455551');

    await userEvent.keyboard('{backspace}')

    expect(input).toHaveValue('+32 479 44 55 55');

    await userEvent.keyboard('{backspace}')
    await userEvent.keyboard('{backspace}')

    expect(input).toHaveValue('+32 479 44 55');

    await userEvent.keyboard('{arrowLeft}')
    await userEvent.keyboard('{arrowLeft}')

    await userEvent.keyboard('1');
    
    expect(input).toHaveValue('+32 479 44 15 5');
});

test('Automatically formats phone numbers using configured locale on blur', async () => {
    TestUtils.setEnvironment('fixedCountry', Country.Netherlands);
    await I18nController.loadDefault(null, Country.Netherlands, Language.Dutch, Country.Netherlands);
    expect(STAMHOOFD.fixedCountry).toEqual(Country.Netherlands)
    expect(I18nController.shared?.countryCode).toEqual(Country.Netherlands)

    renderPhoneInput();

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
