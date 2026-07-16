import { Address, File as StructFile, RichText } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';

import { FormatInputDirective } from '../directives/FormatInputDirective';
import AgeInput from './AgeInput.vue';
import Checkbox from './Checkbox.vue';
import CodeInput from './CodeInput.vue';
import ColorInput from './ColorInput.vue';
import CompanyNumberInput from './CompanyNumberInput.vue';
import Dropdown from './Dropdown.vue';
import EmailInput from './EmailInput.vue';
import FileInput from './FileInput.vue';
import IBANInput from './IBANInput.vue';
import MultiSelectInput from './MultiSelectInput.vue';
import PasswordStrength from './PasswordStrength.vue';
import PrefixInput from './PrefixInput.vue';
import Radio from './Radio.vue';
import RadioGroup from './RadioGroup.vue';
import SegmentedControl from './SegmentedControl.vue';
import SelectionAddressInput from './SelectionAddressInput.vue';
import Slider from './Slider.vue';
import STInputBox from './STInputBox.vue';
import SuffixInput from './SuffixInput.vue';
import UploadButton from './UploadButton.vue';
import UploadFileButton from './UploadFileButton.vue';
import UrlInput from './UrlInput.vue';
import VATNumberInput from './VATNumberInput.vue';
import WYSIWYGTextInput from './WYSIWYGTextInput.vue';

const context = {
    authenticatedServer: {
        request: vi.fn(),
    },
};

function renderInput(component: any, props: Record<string, unknown> = {}, slots?: Record<string, string>) {
    return render(component, {
        props,
        slots,
        global: {
            provide: {
                $context: context,
                reactive_navigation_pop: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_present: vi.fn().mockResolvedValue(undefined),
            },
            config: {
                globalProperties: {
                    $t: (value: string) => value,
                    $isMobile: false,
                } as any,
            },
            directives: {
                autofocus: {},
                tooltip: {},
                formatInput: FormatInputDirective,
            },
        },
    });
}

function lastModelValue<T>(result: ReturnType<typeof renderInput>): T | undefined {
    return result.emitted<[T]>('update:modelValue')?.at(-1)?.[0];
}

async function replaceValue(input: HTMLInputElement, value: string) {
    await userEvent.click(input);
    await userEvent.clear(input);
    if (value) {
        await userEvent.keyboard(value);
    }
}

test('AgeInput constrains typed values and supports nullable empty input', async () => {
    const bounded = renderInput(AgeInput, { modelValue: 10, min: 5, max: 20 });
    const input = document.querySelector<HTMLInputElement>('.age-input input')!;
    await replaceValue(input, '99');
    expect(lastModelValue<number>(bounded)).toBe(20);
    await bounded.unmount();

    const nullable = renderInput(AgeInput, { modelValue: 10, nullable: true });
    await replaceValue(document.querySelector<HTMLInputElement>('.age-input input')!, '');
    expect(lastModelValue<number | null>(nullable)).toBeNull();
});

test('Checkbox and Radio emit their selected values', async () => {
    const checkbox = renderInput(Checkbox, { modelValue: false }, { default: 'Akkoord' });
    await userEvent.click(document.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
    expect(lastModelValue<boolean>(checkbox)).toBe(true);
    expect(document.querySelector('.checkbox.with-text')).not.toBeNull();
    await checkbox.unmount();

    const radio = renderInput(Radio, { modelValue: 'a', value: 'b', name: 'choice' }, { default: 'B' });
    await userEvent.click(document.querySelector<HTMLInputElement>('input[type="radio"]')!);
    expect(lastModelValue<string>(radio)).toBe('b');
    expect(document.querySelector('.radio.with-text')).not.toBeNull();
});

test('CodeInput normalizes characters, formats with dashes, updates the model, and emits complete', async () => {
    const result = renderInput(CodeInput, {
        modelValue: '',
        codeLength: 4,
        numbersOnly: false,
    });
    const input = document.querySelector<HTMLInputElement>('.code-input input')!;

    await userEvent.click(input);
    await userEvent.keyboard('a1');

    await vi.waitFor(() => {
        expect(input.value).toBe('A1');
        expect(document.querySelector('.code-input .suffix')!.textContent).toBe('_-_');
    });

    await userEvent.keyboard('b2');

    await vi.waitFor(() => {
        expect(input.value).toBe('A1B-2');
        expect(document.querySelector('.code-input .suffix')!.textContent).toBe('');
        expect(lastModelValue<string>(result)).toBe('A1B2');
        expect(result.emitted('complete')).toHaveLength(1);
    });
});

test('ColorInput normalizes valid colors and clears optional empty values', async () => {
    const result = renderInput(ColorInput, {
        modelValue: null,
        required: false,
    });
    const input = document.querySelector<HTMLInputElement>('.color-input-box .text-input')!;

    await replaceValue(input, 'aabbcc');
    await userEvent.click(document.body);
    await vi.waitFor(() => expect(lastModelValue<string>(result)).toBe('#AABBCC'));

    await replaceValue(input, '');
    await userEvent.click(document.body);
    await vi.waitFor(() => expect(lastModelValue<string | null>(result)).toBeNull());
});

test('CompanyNumberInput trims values and uses the country-specific title', async () => {
    const result = renderInput(CompanyNumberInput, {
        country: Country.Netherlands,
        modelValue: null,
    });
    const input = document.querySelector<HTMLInputElement>('input')!;
    await replaceValue(input, ' 1234 ');
    await userEvent.click(document.body);

    expect(lastModelValue<string>(result)).toBe('1234');
    expect(document.querySelector('h4')?.textContent).toContain('KVK-nummer');
});

test('Dropdown proxies model updates and focus events', async () => {
    const result = renderInput(Dropdown, {
        modelValue: 'a',
        dataTestid: 'dropdown',
    }, {
        default: '<option value="a">A</option><option value="b">B</option>',
    });
    const select = document.querySelector<HTMLSelectElement>('select')!;

    select.focus();
    select.value = 'b';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();

    expect(lastModelValue<string>(result)).toBe('b');
    expect(result.emitted('focus')).toHaveLength(1);
});

test('EmailInput lowercases valid addresses and exposes native attributes', async () => {
    const result = renderInput(EmailInput, {
        modelValue: '',
        placeholder: 'E-mail',
        disabled: false,
    });
    const input = document.querySelector<HTMLInputElement>('[data-testid="email-input"]')!;
    await replaceValue(input, 'TEST@EXAMPLE.COM');
    await userEvent.click(document.body);

    await vi.waitFor(() => expect(lastModelValue<string>(result)).toBe('test@example.com'));
    expect(input.placeholder).toBe('E-mail');
});

test('FileInput renders file metadata and removes optional files', async () => {
    const file = new StructFile({
        id: 'file',
        server: 'https://cdn.example.com',
        path: 'document.pdf',
        name: 'Document.pdf',
        size: 100,
    });
    const result = renderInput(FileInput, {
        modelValue: file,
        required: false,
    });

    expect(document.querySelector('.file-pdf')).not.toBeNull();
    expect(document.querySelector('.file-input-box .text')?.textContent).toBe('Document.pdf');
    await userEvent.click(document.querySelector('.trash')!);
    expect(lastModelValue<StructFile | null>(result)).toBeNull();
});

test('IBANInput formats a valid account number', async () => {
    const result = renderInput(IBANInput, {
        modelValue: null,
    });
    const input = document.querySelector<HTMLInputElement>('input')!;
    await replaceValue(input, 'BE42631299159354');
    await userEvent.click(document.body);

    await vi.waitFor(() => expect(lastModelValue<string>(result)).toBe('BE42 6312 9915 9354'));
});

test('MultiSelectInput renders labels and removes selected values', async () => {
    const result = renderInput(MultiSelectInput, {
        modelValue: ['a', 'b'],
        choices: [
            { value: 'a', label: 'Alpha', categories: ['Group'] },
            { value: 'b', label: 'Beta' },
        ],
    });

    expect(document.body.textContent).toContain('Group');
    expect(document.body.textContent).toContain('Alpha');
    expect(document.body.textContent).toContain('Beta');

    await userEvent.click(document.querySelector<HTMLButtonElement>('.trash')!);
    expect(lastModelValue<string[]>(result)).toEqual(['b']);
});

test('PasswordStrength resets its meter for an empty password', async () => {
    const result = renderInput(PasswordStrength, {
        modelValue: 'temporary password',
    });
    await result.rerender({ modelValue: '' });

    await vi.waitFor(() => {
        const meter = document.querySelector<HTMLElement>('.password-strength > div')!;
        expect(meter.style.width).toBe('0%');
        expect(meter.classList.contains('none')).toBe(true);
    });
});

test('PrefixInput and SuffixInput retain attributes and emit focus state', async () => {
    const prefix = renderInput(PrefixInput, {
        modelValue: '',
        prefix: 'https://',
        focusPrefix: 'URL: ',
    });
    const prefixInput = document.querySelector<HTMLInputElement>('.prefix-input input')!;
    prefixInput.focus();
    await nextTick();
    expect(document.querySelector('.prefix')?.textContent?.trim()).toBe('URL:');
    expect(prefix.emitted('focus')).toHaveLength(1);
    await prefix.unmount();

    const suffix = renderInput(SuffixInput, {
        modelValue: '',
        suffix: 'kg',
        focusSuffix: 'kilogram',
        placeholder: 'Gewicht',
    });
    const suffixInput = document.querySelector<HTMLInputElement>('.suffix-input input')!;
    suffixInput.focus();
    await nextTick();
    expect(document.querySelector('.suffix')?.textContent?.trim()).toBe('kilogram');
    expect(suffixInput.placeholder).toBe('Gewicht');
    expect(suffix.emitted('focus')).toHaveLength(1);
});

test('RadioGroup, STInputBox, and SegmentedControl preserve slots and selection', async () => {
    renderInput(RadioGroup, {}, { default: '<span>Choices</span>' });
    expect(document.querySelector('.radio-group')?.textContent).toContain('Choices');

    const inputBox = renderInput(STInputBox, { title: 'Titel', indent: true }, {
        default: '<input>',
        right: '<button>Help</button>',
    });
    expect(document.querySelector('.st-input-box.indent h4')?.textContent).toContain('Titel');
    expect(document.querySelector('.st-input-box button')?.textContent).toBe('Help');
    await inputBox.unmount();

    const segmented = renderInput(SegmentedControl, {
        modelValue: 'a',
        items: ['a', 'b'],
        labels: ['Eerste', 'Tweede'],
    });
    await userEvent.click(document.querySelectorAll('.segmented-control .item')[1]);
    expect(lastModelValue<string>(segmented)).toBe('b');
    expect(document.querySelector<HTMLElement>('.segmented-control .pointer')!.style.transform).toBe('translateX(50%)');
});

test('SelectionAddressInput selects the first address when required', () => {
    const address = Address.create({
        street: 'Kerkstraat',
        number: '1',
        postalCode: '9000',
        city: 'Gent',
        country: Country.Belgium,
    });
    const result = renderInput(SelectionAddressInput, {
        modelValue: null,
        addresses: [address],
        required: true,
    });

    expect(lastModelValue<Address>(result)?.toString()).toBe(address.toString());
    expect(document.body.textContent).toContain('Kerkstraat 1');
});

test('Slider initializes and updates from its number input', async () => {
    const result = renderInput(Slider, {
        modelValue: 100,
        min: 0,
        max: 500,
    });
    const input = document.querySelector<HTMLInputElement>('.slider-box input[type="number"]')!;
    expect(input.value).toBe('100');

    await replaceValue(input, '235');
    await userEvent.click(document.body);
    expect(lastModelValue<number>(result)).toBe(235);
});

test('UploadButton and UploadFileButton preserve their element, text, and accept settings', async () => {
    const imageUpload = renderInput(UploadButton, {
        modelValue: null,
        elementName: 'button',
        text: 'Afbeelding kiezen',
    });
    expect(document.querySelector('.upload-button')?.tagName).toBe('BUTTON');
    expect(document.querySelector('.upload-button')?.textContent).toContain('Afbeelding kiezen');
    expect(document.querySelector<HTMLInputElement>('.file-upload')!.accept).toContain('image/png');
    await imageUpload.unmount();

    renderInput(UploadFileButton, {
        elementName: 'label',
        text: 'Bestand kiezen',
        accept: 'application/pdf',
    });
    expect(document.querySelector('.upload-button')?.tagName).toBe('LABEL');
    expect(document.querySelector('.upload-button')?.textContent).toContain('Bestand kiezen');
    expect(document.querySelector<HTMLInputElement>('.file-upload')!.accept).toBe('application/pdf');
});

test('UrlInput silently preserves typed text and normalizes it on change', async () => {
    const result = renderInput(UrlInput, {
        modelValue: null,
    });
    const input = document.querySelector<HTMLInputElement>('input')!;
    await replaceValue(input, 'example.com');
    expect(lastModelValue<string>(result)).toBe('example.com');

    await userEvent.click(document.body);
    await vi.waitFor(() => {
        expect(lastModelValue<string>(result)).toBe('https://example.com');
        expect(input.value).toBe('https://example.com');
    });
});

test('VATNumberInput validates and formats a Belgian VAT number', async () => {
    const result = renderInput(VATNumberInput, {
        country: Country.Belgium,
        modelValue: null,
    });
    const input = document.querySelector<HTMLInputElement>('input')!;
    await replaceValue(input, '0428759497');
    await userEvent.click(document.body);

    await vi.waitFor(() => expect(lastModelValue<string>(result)).toBe('BE0428759497'));
});

test('WYSIWYGTextInput initializes from RichText and tears down cleanly', async () => {
    const result = renderInput(WYSIWYGTextInput, {
        modelValue: RichText.create({
            text: 'Hallo',
            html: '<p>Hallo</p>',
        }),
        placeholder: 'Schrijf iets',
    });

    await vi.waitFor(() => {
        expect(document.querySelector('.wysiwyg-text-input .ProseMirror')?.textContent).toContain('Hallo');
    });
    await result.unmount();
    expect(document.querySelector('.wysiwyg-text-input')).toBeNull();
});
