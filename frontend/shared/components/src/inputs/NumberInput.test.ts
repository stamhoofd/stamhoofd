/// <reference types="@vitest/browser/providers/playwright" />
import { userEvent } from '@vitest/browser/context';
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import NumberInput from './NumberInput.vue';

// DO NOT COPY THIS PATTERN!
// DO NOT COPY THIS PATTERN!
// We should use vitest-browser-vue instead
// user input / keyboard handling is not realistic in @vue/test-utils
// DO NOT COPY THIS PATTERN!
// DO NOT COPY THIS PATTERN!

describe('NumberInput', () => {
    test('Should not update without user input if no min, max or required', async () => {
        const wrapper = await createWrapper({
            min: null,
            max: null,
            required: false,
            floatingPoint: false,
            modelValue: null,
        });

        await wrapper.vm.$nextTick();
        expect(wrapper.emitted()).not.toHaveProperty('update:modelValue');
        expect(wrapper.props('modelValue')).toBe(null);
    });

    describe('Should correctly initialize the modelValue', () => {
        const cases: { name: string; expected: number | null; props: {
            min?: number | null;
            max?: number | null;
            required?: boolean;
        }; }[] = [
            {
                name: 'required with min',
                expected: 5,
                props: {
                    min: 5,
                    max: null,
                    required: true,
                },
            },
            {
                name: 'required',
                expected: 0,
                props: {
                    min: null,
                    max: null,
                    required: true,
                },
            },
        ];

        for (const { name, expected, props } of cases) {
            test(`case - ${name}`, async () => {
                const wrapper = await createWrapper({
                    ...props,
                    floatingPoint: false,
                    modelValue: null,
                });

                await wrapper.vm.$nextTick();
                expect(wrapper.props('modelValue')).toBe(expected);
            });
        }
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
                    modelValue: null,
                    inputValue: '',
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
                    modelValue: 4,
                    inputValue: 'abcd',
                },
                afterChange: {
                    modelValue: 4,
                    inputValue: '4',
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
                    modelValue: 0,
                    inputValue: 'abcd',
                },
                afterChange: {
                    modelValue: 0,
                    inputValue: '0',
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
                    modelValue: 600,
                    inputValue: '6',
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
                    modelValue: 866,
                    inputValue: '8.66',
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
                const wrapper = await createWrapper({
                    ...props,
                    modelValue: null,
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

    describe('key up', () => {
        test('should add 1', async () => {
          const wrapper = await createWrapper({
                    min: 2,
                    max: 4,
                    modelValue: null,
                });

            const inputEl = wrapper.find('input').element;

            // Click the input;
            await userEvent.click(inputEl);

            // Enter arrow up
            await userEvent.keyboard('[ArrowUp]');

            // Check model value after input
            expect(wrapper.props('modelValue')).toBe(3);
            // Check input value after input
            expect(inputEl).toHaveValue('3');

            // Enter arrow up again
            await userEvent.keyboard('[ArrowUp]');

            // Check model value after input
            expect(wrapper.props('modelValue')).toBe(4);
            // Check input value after input
            expect(inputEl).toHaveValue('4');
        })

        test('should not add 1 if max reached', async () => {
          const wrapper = await createWrapper({
                    min: 2,
                    max: 4,
                    modelValue: 4,
                });

            const inputEl = wrapper.find('input').element;

            // Click the input;
            await userEvent.click(inputEl);

            // Enter arrow up
            await userEvent.keyboard('[ArrowUp]');

            // Check model value after input (should not have changed)
            expect(wrapper.props('modelValue')).toBe(4);
            // Check input value after input
            expect(inputEl).toHaveValue('4');
        })

        test('should work if model value NaN', async () => {
          const wrapper = await createWrapper({
                    min: 2,
                    max: 4,
                    modelValue: NaN,
                });

            const inputEl = wrapper.find('input').element;

            // Click the input;
            await userEvent.click(inputEl);

            // Enter arrow up
            await userEvent.keyboard('[ArrowUp]');

            // Check model value after input
            expect(wrapper.props('modelValue')).toBe(3);
            // Check input value after input
            expect(inputEl).toHaveValue('3');
        })
    })

    describe('key down', () => {
        test('should deduct 1', async () => {
          const wrapper = await createWrapper({
                    min: 2,
                    max: 4,
                    modelValue: 4,
                });

            const inputEl = wrapper.find('input').element;

            // Click the input;
            await userEvent.click(inputEl);

            // Enter arrow down
            await userEvent.keyboard('[ArrowDown]');

            // Check model value after input
            expect(wrapper.props('modelValue')).toBe(3);
            // Check input value after input
            expect(inputEl).toHaveValue('3');

            // Enter arrow down again
            await userEvent.keyboard('[ArrowDown]');

            // Check model value after input
            expect(wrapper.props('modelValue')).toBe(2);
            // Check input value after input
            expect(inputEl).toHaveValue('2');
        })

        test('should not deduct 1 if min reached', async () => {
          const wrapper = await createWrapper({
                    min: 2,
                    max: 4,
                    modelValue: 2,
                });

            const inputEl = wrapper.find('input').element;

            // Click the input;
            await userEvent.click(inputEl);

            // Enter arrow up
            await userEvent.keyboard('[ArrowDown]');

            // Check model value after input (should not have changed)
            expect(wrapper.props('modelValue')).toBe(2);
            // Check input value after input
            expect(inputEl).toHaveValue('2');
        })

        test('should set model value to min if model value is NaN', async () => {
          const wrapper = await createWrapper({
                    min: 2,
                    max: 4,
                    modelValue: NaN,
                });

            const inputEl = wrapper.find('input').element;

            // Click the input;
            await userEvent.click(inputEl);

            // Enter arrow up
            await userEvent.keyboard('[ArrowDown]');

            // Check model value after input
            expect(wrapper.props('modelValue')).toBe(2);
            // Check input value after input
            expect(inputEl).toHaveValue('2');
        })
    })
});

/**
 * Helper to create a NumberInput wrapper (recreating the model)
 * @param props
 * @returns
 */
async function createWrapper(props: any) {
    // does not use the correct type of the wrapper because it is too complicated
    let resolveWrapper: ((wrapper: any) => void);

    const getWrapper = new Promise<any>((resolve) => {
        resolveWrapper = resolve;
    });

    /**
     * Problem: onUpdate:modelValue cannot set the modelValue on the wrapper because it is not initialized yet.
     * Solution: we use a promise to wait for the wrapper to be initialized.
     */
    const wrapper = mount(NumberInput, {
        attachTo: document.body,
        props: {
            ...props,
            'onUpdate:modelValue': async (e: number | null) => {
                // make sure the wrapper is initialized
                (await getWrapper).setProps({ modelValue: e });
            },
        } });

    resolveWrapper!(wrapper);
    await getWrapper;

    return wrapper;
}
