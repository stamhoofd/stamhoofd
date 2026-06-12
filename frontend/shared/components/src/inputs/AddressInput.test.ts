import { Address, ValidatedAddress } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { userEvent } from 'vitest/browser';
import { defineComponent, ref } from 'vue';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import type { RenderResult } from 'vitest-browser-vue';

import AddressInput from './AddressInput.vue';

function renderAddressInput(props: Record<string, unknown>) {
    return render(AddressInput, {
        props,
        global: {
            config: {
                globalProperties: {
                    $t: (value: string) => value,
                } as any,
            },
        },
    });
}

function createAddress(overrides: Partial<Address> = {}): Address {
    return Address.create({
        street: 'Kerkstraat',
        number: '12',
        postalCode: '9000',
        city: 'Gent',
        country: Country.Belgium,
        ...overrides,
    });
}

function getInput(name: string): HTMLInputElement {
    return document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
}

function getLastModelValue(result: RenderResult<any>): Address | ValidatedAddress | null | undefined {
    const events = result.emitted<[Address | ValidatedAddress | null]>('update:modelValue');
    return events?.at(-1)?.[0];
}

async function replaceInputValue(input: HTMLInputElement, value: string) {
    await userEvent.click(input);
    await userEvent.clear(input);
    if (value) {
        await userEvent.keyboard(value);
    }
}

test('initializes all fields from the model value', async () => {
    renderAddressInput({
        modelValue: createAddress(),
    });

    expect(getInput('street-address').value).toBe('Kerkstraat 12');
    expect(getInput('postal-code').value).toBe('9000');
    expect(getInput('city').value).toBe('Gent');
    expect(document.querySelector<HTMLSelectElement>('select[name="country"]')!.value).toBe(Country.Belgium);
});

test('emits a parsed address while typing', async () => {
    const result = renderAddressInput({
        modelValue: null,
    });

    await replaceInputValue(getInput('street-address'), 'Nieuwstraat 5');
    await replaceInputValue(getInput('postal-code'), '1000');
    await replaceInputValue(getInput('city'), 'Brussel');

    await vi.waitFor(() => {
        expect(getLastModelValue(result)?.toString()).toBe(createAddress({
            street: 'Nieuwstraat',
            number: '5',
            postalCode: '1000',
            city: 'Brussel',
        }).toString());
    });
});

test('updates a real parent model while the user completes each address field', async () => {
    const Parent = defineComponent({
        components: { AddressInput },
        setup() {
            const address = ref<Address | null>(null);
            return { address };
        },
        template: `
            <AddressInput v-model="address" />
            <output data-testid="parent-address">{{ address?.toString() ?? 'empty' }}</output>
        `,
    });
    render(Parent, {
        global: {
            config: {
                globalProperties: {
                    $t: (value: string) => value,
                } as any,
            },
        },
    });

    await replaceInputValue(getInput('street-address'), 'Nieuwstraat 5');
    await replaceInputValue(getInput('postal-code'), '1000');
    await replaceInputValue(getInput('city'), 'Brussel');
    await userEvent.click(document.querySelector<HTMLSelectElement>('select[name="country"]')!);
    await userEvent.click(document.querySelector('[data-testid="parent-address"]')!);

    await vi.waitFor(() => {
        expect(document.querySelector('[data-testid="parent-address"]')?.textContent).toContain('Nieuwstraat 5');
        expect(document.querySelector('[data-testid="parent-address"]')?.textContent).toContain('1000 Brussel');
    });
});

test('supports a city-only address without street or postal code', async () => {
    const result = renderAddressInput({
        cityOnly: true,
        modelValue: null,
    });

    expect(getInput('street-address')).toBeNull();
    expect(getInput('postal-code')).toBeNull();

    await replaceInputValue(getInput('city'), 'Antwerpen');

    await vi.waitFor(() => {
        expect(getLastModelValue(result)).toMatchObject({
            street: '',
            number: '',
            postalCode: '',
            city: 'Antwerpen',
            country: Country.Belgium,
        });
    });
});

test('emits null when an optional address is cleared', async () => {
    const result = renderAddressInput({
        modelValue: createAddress(),
        required: false,
    });

    await replaceInputValue(getInput('street-address'), '');
    await replaceInputValue(getInput('postal-code'), '');
    await replaceInputValue(getInput('city'), '');

    await vi.waitFor(() => {
        expect(getLastModelValue(result)).toBeNull();
    });
});

test('does not overwrite the field being edited when the model changes', async () => {
    const result = renderAddressInput({
        modelValue: createAddress(),
    });
    const streetInput = getInput('street-address');

    await replaceInputValue(streetInput, 'Draftstraat 3');
    await result.rerender({
        modelValue: createAddress({
            street: 'Extern',
            number: '99',
        }),
    });

    expect(streetInput.value).toBe('Draftstraat 3');
});

test('synchronizes fields from an external model change when not focused', async () => {
    const result = renderAddressInput({
        modelValue: createAddress(),
    });

    await result.rerender({
        modelValue: createAddress({
            street: 'Extern',
            number: '99',
            postalCode: '2000',
            city: 'Antwerpen',
        }),
    });

    await vi.waitFor(() => {
        expect(getInput('street-address').value).toBe('Extern 99');
        expect(getInput('postal-code').value).toBe('2000');
        expect(getInput('city').value).toBe('Antwerpen');
    });
});

test('uses the server validated address during final validation', async () => {
    const validatedAddress = ValidatedAddress.create({
        ...createAddress({
            street: 'Nieuwstraat',
            number: '5',
            postalCode: '1000',
            city: 'Brussel',
        }),
    });
    const request = vi.fn().mockResolvedValue({ data: validatedAddress });
    const validator = {
        addValidation: vi.fn(),
        removeValidation: vi.fn(),
    };
    const result = renderAddressInput({
        modelValue: createAddress({
            street: 'Nieuwstraat',
            number: '5',
            postalCode: '1000',
            city: 'Brussel',
        }),
        validateServer: { request } as any,
        validator: validator as any,
    });

    const validation = validator.addValidation.mock.calls[0]?.[1] as (() => Promise<boolean>);
    expect(validation).toBeTypeOf('function');
    await expect(validation()).resolves.toBe(true);

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
        method: 'POST',
        path: '/address/validate',
        shouldRetry: false,
    }));
    expect(getLastModelValue(result)).toBe(validatedAddress);
});
