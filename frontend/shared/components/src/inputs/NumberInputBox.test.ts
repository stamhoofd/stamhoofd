/// <reference types="@vitest/browser/providers/playwright" />
import { userEvent } from '@vitest/browser/context';
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import type { ErrorBox } from '../errors/ErrorBox';
import type { Validator } from '../errors/Validator';
import NumberInputBox from './NumberInputBox.vue';

describe('NumberInputBox', () => {
    test('Should not update without user input if no min, max or required', async () => {
        const wrapper = await createWrapperWithDefaultProps(null);

        await wrapper.vm.$nextTick();
        expect(wrapper.emitted()).not.toHaveProperty('update:modelValue');
        expect(wrapper.props('modelValue')).toBe(null);
    });

    describe('Should correctly update model value and el input value', () => {
        const cases: {
        // name of test
            name: string;
            inputValue: string;
            expected: {
                afterInput: {
                    modelValue: number | null;
                    inputValue: string;
                };
                afterChange: {
                    modelValue: number | null;
                    inputValue: string;
                };
            };
            props: {
                min?: number | null;
                max?: number | null;
                required?: boolean;
                floatingPoint?: boolean;
            };
        }[] = [{
            name: 'happy path',
            inputValue: '5',
            expected: {
                afterInput: {
                    modelValue: 5,
                    inputValue: '5',
                },
                afterChange: {
                    modelValue: 5,
                    inputValue: '5',
                },
            },
            props: {
                min: null,
                max: null,
                required: false,
            },
        },
        // test min, max, NaN and required
        {
            name: 'one more than max',
            inputValue: '4',
            expected: {
                afterInput: {
                    modelValue: null,
                    inputValue: '4',
                },
                afterChange: {
                    modelValue: 4,
                    inputValue: '4',
                },
            },
            props: {
                min: null,
                max: 3,
                required: false,
            },
        },
        {
            name: 'equal to max',
            inputValue: '3',
            expected: {
                afterInput: {
                    modelValue: 3,
                    inputValue: '3',
                },
                afterChange: {
                    modelValue: 3,
                    inputValue: '3',
                },
            },
            props: {
                min: null,
                max: 3,
                required: false,
            },
        },
        {
            name: 'one less than max',
            inputValue: '2',
            expected: {
                afterInput: {
                    modelValue: 2,
                    inputValue: '2',
                },
                afterChange: {
                    modelValue: 2,
                    inputValue: '2',
                },
            },
            props: {
                min: null,
                max: 3,
                required: false,
            },
        },
        {
            name: 'one less than min',
            inputValue: '3',
            expected: {
                afterInput: {
                    modelValue: null,
                    inputValue: '3',
                },
                afterChange: {
                    modelValue: 3,
                    inputValue: '3',
                },
            },
            props: {
                min: 4,
                max: 10,
                required: false,
            },
        },
        {
            name: 'equal to min',
            inputValue: '4',
            expected: {
                afterInput: {
                    modelValue: 4,
                    inputValue: '4',
                },
                afterChange: {
                    modelValue: 4,
                    inputValue: '4',
                },
            },
            props: {
                min: 4,
                max: 10,
                required: false,
            },
        },
        {
            name: 'one more than min',
            inputValue: '5',
            expected: {
                afterInput: {
                    modelValue: 5,
                    inputValue: '5',
                },
                afterChange: {
                    modelValue: 5,
                    inputValue: '5',
                },
            },
            props: {
                min: 4,
                max: 10,
                required: false,
            },
        },
        {
            name: 'not a number',
            inputValue: 'abcd',
            expected: {
                afterInput: {
                    modelValue: null,
                    inputValue: 'abcd',
                },
                afterChange: {
                    modelValue: NaN,
                    inputValue: 'abcd',
                },
            },
            props: {
                min: 4,
                max: 10,
                required: false,
            },
        },
        {
            name: 'required and not a number',
            inputValue: 'abcd',
            expected: {
                afterInput: {
                    modelValue: null,
                    inputValue: 'abcd',
                },
                afterChange: {
                    modelValue: NaN,
                    inputValue: 'abcd',
                },
            },
            props: {
                min: 4,
                max: 10,
                required: true,
            },
        },
        {
            name: 'required without min',
            inputValue: 'abcd',
            expected: {
                afterInput: {
                    modelValue: null,
                    inputValue: 'abcd',
                },
                afterChange: {
                    modelValue: NaN,
                    inputValue: 'abcd',
                },
            },
            props: {
                required: true,
            },
        },
        // test floating point
        {
            name: 'floating point - absolute number',
            inputValue: '5',
            expected: {
                afterInput: {
                    modelValue: 500,
                    inputValue: '5',
                },
                afterChange: {
                    modelValue: 500,
                    inputValue: '5',
                },
            },
            props: {
                floatingPoint: true,
                required: false,
            },
        },
        {
            name: 'floating point - negative number',
            inputValue: '-5',
            expected: {
                afterInput: {
                    modelValue: -500,
                    inputValue: '-5',
                },
                afterChange: {
                    modelValue: -500,
                    inputValue: '-5',
                },
            },
            props: {
                floatingPoint: true,
                required: false,
            },
        },
        {
            name: 'floating point - one decimal (with comma)',
            inputValue: '5,3',
            expected: {
                afterInput: {
                    modelValue: 530,
                    inputValue: '5,3',
                },
                afterChange: {
                    modelValue: 530,
                    inputValue: '5.30',
                },
            },
            props: {
                floatingPoint: true,
                required: false,
            },
        },
        {
            name: 'floating point - two decimals (with comma)',
            inputValue: '5,34',
            expected: {
                afterInput: {
                    modelValue: 534,
                    inputValue: '5,34',
                },
                afterChange: {
                    modelValue: 534,
                    inputValue: '5.34',
                },
            },
            props: {
                floatingPoint: true,
                required: false,
            },
        },
        {
            name: 'floating point - multiple decimals round down (with point)',
            inputValue: '5.3400001',
            expected: {
                afterInput: {
                    modelValue: 534,
                    inputValue: '5.3400001',
                },
                afterChange: {
                    modelValue: 534,
                    inputValue: '5.34',
                },
            },
            props: {
                floatingPoint: true,
                required: false,
            },
        },
        {
            name: 'floating point - multiple decimals round up (with point)',
            inputValue: '5.34999999999',
            expected: {
                afterInput: {
                    modelValue: 535,
                    inputValue: '5.34999999999',
                },
                afterChange: {
                    modelValue: 535,
                    inputValue: '5.35',
                },
            },
            props: {
                floatingPoint: true,
                required: false,
            },
        },
        {
            name: 'floating point - multiple decimals - less than min',
            inputValue: '5.34999999999',
            expected: {
                afterInput: {
                    modelValue: null,
                    inputValue: '5.34999999999',
                },
                afterChange: {
                    modelValue: 535,
                    inputValue: '5.35',
                },
            },
            props: {
                min: 600,
                floatingPoint: true,
                required: false,
            },
        },
        {
            name: 'floating point - multiple decimals - more than max',
            inputValue: '9.34999999999',
            expected: {
                afterInput: {
                    modelValue: null,
                    inputValue: '9.34999999999',
                },
                afterChange: {
                    modelValue: 935,
                    inputValue: '9.35',
                },
            },
            props: {
                min: 600,
                max: 866,
                floatingPoint: true,
                required: false,
            },
        },
        ];

        for (const { name, props, inputValue, expected } of cases) {
            test(`case - ${name}`, async () => {
                const wrapper = await createWrapperWithDefaultProps(null, {
                    ...props,
                });

                const inputEl = wrapper.find('input').element;

                // Click the input;
                await userEvent.click(inputEl);

                // Clear the input
                await userEvent.clear(inputEl);

                // Type the value
                await userEvent.keyboard(inputValue);

                // Check model value after input
                expect(wrapper.props('modelValue')).toBe(expected.afterInput.modelValue);
                // Check input value after input
                expect(inputEl).toHaveValue(expected.afterInput.inputValue);

                // blur
                await userEvent.click(document.body);

                // Check model value after change
                expect(wrapper.props('modelValue')).toBe(expected.afterChange.modelValue);
                // Check input value after change
                expect(inputEl).toHaveValue(expected.afterChange.inputValue);
            });
        }
    });

    test('Should correctly update model on repeated changes', async () => {
                const wrapper = await createWrapperWithDefaultProps(null);

                const inputEl = wrapper.find('input').element;

                // Click the input;
                await userEvent.click(inputEl);

                // Clear the input
                await userEvent.clear(inputEl);

                const inputValues: {
                    text: string,
                    expected: {
                        modelValue: number | null,
                        inputValue: string
                    }
                } [] = [
                {
                    text: '5',
                    expected: {
                        modelValue: 5,
                        inputValue: '5',
                    },
                },
                {
                    text: '6',
                    expected: {
                        modelValue: 6,
                        inputValue: '6',
                    }
                },
                {
                    text: 'abc',
                    expected: {
                        modelValue: NaN,
                        inputValue: 'abc',
                    }
                },
                {
                    text: '1',
                    expected: {
                        modelValue: 1,
                        inputValue: '1',
                    }
                },
            ];

            for(const {text, expected} of inputValues) {
                // clear input
                await userEvent.clear(inputEl);

                // Type the value
                await userEvent.keyboard(text);

                // blur
                await userEvent.click(document.body);

                // Check model value after change
                expect(wrapper.props('modelValue')).toBe(expected.modelValue);
                // Check input value after change
                expect(inputEl).toHaveValue(expected.inputValue);
            }

    });

    test('Should not immediately show an error on mounted', async () => {
        const wrapper = await createWrapperWithDefaultProps(6, {max: 3});

        const inputError = wrapper.find('[data-testid="input-error"]')

        // Should not exist before change
        expect(inputError.exists()).toBe(false);
    });

    describe('Should only update error on change', () => {
        test('not a number', async () => {
               const wrapper = await createWrapperWithDefaultProps(null);

                const inputEl = wrapper.find('input').element;

                // Click the input;
                await userEvent.click(inputEl);

                // Clear the input
                await userEvent.clear(inputEl);

                // Type the value
                await userEvent.keyboard('abc');

                let inputError = wrapper.find('[data-testid="input-error"]')
    
                // Should not exist before change
                expect(inputError.exists()).toBe(false);

                // blur
                await userEvent.click(document.body);

                inputError = wrapper.find('[data-testid="input-error"]');

                // should exist after change and contain the correct error message
                expect(inputError.exists()).toBe(true);
                expect(inputError.element).toHaveTextContent('Vul een geldig getal in');
        });

        test('min', async () => {
            const wrapper = await createWrapperWithDefaultProps(null, {min: 5});

            const inputEl = wrapper.find('input').element;

            // Click the input;
            await userEvent.click(inputEl);

            // Clear the input
            await userEvent.clear(inputEl);

            // Type the value
            await userEvent.keyboard('3');

            let inputError = wrapper.find('[data-testid="input-error"]')

            // Should not exist before change
            expect(inputError.exists()).toBe(false);

            // blur
            await userEvent.click(document.body);

            inputError = wrapper.find('[data-testid="input-error"]');

            // should exist after change and contain the correct error message
            expect(inputError.exists()).toBe(true);
            expect(inputError.element).toHaveTextContent('Het minimum is');
        });

        test('max', async () => {
            const wrapper = await createWrapperWithDefaultProps(null, {max: 5});

            const inputEl = wrapper.find('input').element;

            // Click the input;
            await userEvent.click(inputEl);

            // Clear the input
            await userEvent.clear(inputEl);

            // Type the value
            await userEvent.keyboard('6');

            let inputError = wrapper.find('[data-testid="input-error"]')

            // Should not exist before change
            expect(inputError.exists()).toBe(false);

            // blur
            await userEvent.click(document.body);

            inputError = wrapper.find('[data-testid="input-error"]');

            // should exist after change and contain the correct error message
            expect(inputError.exists()).toBe(true);
            expect(inputError.element).toHaveTextContent('Het maximum is');
        });
    });

    describe('Should correctly round value', () => {
        test('floor', async () => {
                const wrapper = await createWrapperWithDefaultProps(null, {
                    floatingPoint: false
                });

                const inputEl = wrapper.find('input').element;

                // Click the input;
                await userEvent.click(inputEl);

                // Clear the input
                await userEvent.clear(inputEl);

                // Type the value
                await userEvent.keyboard('1,45');

                // Check model value after input
                expect(wrapper.props('modelValue')).toBe(1);
                // Check input value after input
                expect(inputEl).toHaveValue('1,45');

                // blur
                await userEvent.click(document.body);

                // Check model value after change
                expect(wrapper.props('modelValue')).toBe(1);
                // Check input value after change
                expect(inputEl).toHaveValue('1');
        });

        test('ceil', async () => {
                const wrapper = await createWrapperWithDefaultProps(null, {
                    floatingPoint: false
                });

                const inputEl = wrapper.find('input').element;

                // Click the input;
                await userEvent.click(inputEl);

                // Clear the input
                await userEvent.clear(inputEl);

                // Type the value
                await userEvent.keyboard('1,55');

                // Check model value after input
                expect(wrapper.props('modelValue')).toBe(2);
                // Check input value after input
                expect(inputEl).toHaveValue('1,55');

                // blur
                await userEvent.click(document.body);

                // Check model value after change
                expect(wrapper.props('modelValue')).toBe(2);
                // Check input value after change
                expect(inputEl).toHaveValue('2');
        });
    });
});

async function createWrapperWithDefaultProps(value: number | null, overrideProps: Partial<NumberInputBoxProps> = {}) {
    const defaultProps: NumberInputBoxProps = {
        title: 'test number input',
        validator: null,
    };

    return createWrapper(value, {
        ...defaultProps,
        ...overrideProps,
    });
}

type NumberInputBoxProps = {
    title?: string;
    errorFields?: string;
    class?: string | null;
    validator: Validator | null;
    errorBox?: ErrorBox | null;

    /** Price in cents */
    min?: number | null;
    /** Price in cents */
    max?: number | null;
    stepper?: boolean;
    required?: boolean;
    disabled?: boolean;
    suffix?: string;
    suffixSingular?: string | null;
    placeholder?: string;
    floatingPoint?: boolean; // In cents if floating point, never returns floats!
};

/**
 * Helper to create a NumberInputBox wrapper (recreating the model)
 * @param props
 * @returns
 */
async function createWrapper(value: number | null, props: NumberInputBoxProps) {
    // does not use the correct type of the wrapper because it is too complicated
    let resolveWrapper: ((wrapper: any) => void);

    const getWrapper = new Promise<any>((resolve) => {
        resolveWrapper = resolve;
    });

    /**
     * Problem: onUpdate:modelValue cannot set the modelValue on the wrapper because it is not initialized yet.
     * Solution: we use a promise to wait for the wrapper to be initialized.
     */
    const wrapper = mount(NumberInputBox, {
        attachTo: document.body,
        props: {
            ...props,
            validator: null,
            'modelValue': value,
            'onUpdate:modelValue': async (e: number | null) => {
                // make sure the wrapper is initialized
                (await getWrapper).setProps({ modelValue: e });
            },
        } });

    resolveWrapper!(wrapper);
    await getWrapper;

    return wrapper;
}
