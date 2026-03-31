/// <reference types="@vitest/browser/providers/playwright" />
import { userEvent } from '@vitest/browser/context';
import { expect, test } from 'vitest';
import { render, type RenderResult } from 'vitest-browser-vue';
import FloatInput from './FloatInput.vue';

describe('FloatInput', () => {
    test('Should not update without user input if no min, max or required', async () => {
        const result = await renderComponent(null, {
            min: null,
            max: null,
            required: false,
            floatingPoint: false,
            modelValue: null,
        });

        expect(result.emitted()).not.toHaveProperty('update:modelValue');
    });

    describe('Should correctly initialize the modelValue', () => {
        const cases: { name: string; expected: number | null | undefined; props: {
            min?: number | null;
            max?: number | null;
            required?: boolean;
        }; }[] = [
            {
                name: 'required with min',
                expected: 500,
                props: {
                    min: 500,
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
                const result = await renderComponent(null, {
                    ...props,
                    fractionDigits: 2,
                    roundFractionDigits: 4
                });

                expect(lastEmittedModelValue(result)).toBe(expected);
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
                    modelValue: number | null | undefined;
                    inputValue: string;
                };
                afterChange: {
                    modelValue: number | null | undefined;
                    inputValue: string;
                };
            };
            props: {
                min?: number | null;
                max?: number | null;
                required?: boolean;
            };
        }[] = [
        {
            name: 'happy path',
            inputValue: '5,21',
            expected: {
                afterInput: {
                    modelValue: 52100,
                    inputValue: '5,21',
                },
                afterChange: {
                    modelValue: 52100,
                    inputValue: '5.21',
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
                    modelValue: undefined,
                    inputValue: '4',
                },
                afterChange: {
                    modelValue: 30000,
                    inputValue: '3',
                },
            },
            props: {
                min: null,
                max: 30000,
                required: false,
            },
        },
        {
            name: 'equal to max',
            inputValue: '3',
            expected: {
                afterInput: {
                    modelValue: 30000,
                    inputValue: '3',
                },
                afterChange: {
                    modelValue: 30000,
                    inputValue: '3',
                },
            },
            props: {
                min: null,
                max: 30000,
                required: false,
            },
        },
        {
            name: 'one less than max',
            inputValue: '2',
            expected: {
                afterInput: {
                    modelValue: 20000,
                    inputValue: '2',
                },
                afterChange: {
                    modelValue: 20000,
                    inputValue: '2',
                },
            },
            props: {
                min: null,
                max: 30000,
                required: false,
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
        {
            name: 'one less than min',
            inputValue: '3',
            expected: {
                afterInput: {
                    modelValue: undefined,
                    inputValue: '3',
                },
                afterChange: {
                    modelValue: 40000,
                    inputValue: '4',
                },
            },
            props: {
                min: 40000,
                max: 100000,
                required: false,
            },
        },
        {
            name: 'equal to min',
            inputValue: '4',
            expected: {
                afterInput: {
                    modelValue: 40000,
                    inputValue: '4',
                },
                afterChange: {
                    modelValue: 40000,
                    inputValue: '4',
                },
            },
            props: {
                min: 40000,
                max: 100000,
                required: false,
            },
        },
        {
            name: 'one more than min',
            inputValue: '5',
            expected: {
                afterInput: {
                    modelValue: 50000,
                    inputValue: '5',
                },
                afterChange: {
                    modelValue: 50000,
                    inputValue: '5',
                },
            },
            props: {
                min: 40000,
                max: 100000,
                required: false,
            },
        },
        {
            name: 'not a number',
            inputValue: 'abcd',
            expected: {
                afterInput: {
                    modelValue: undefined,
                    inputValue: 'abcd',
                },
                afterChange: {
                    modelValue: undefined,
                    inputValue: '',
                },
            },
            props: {
                min: 40000,
                max: 100000,
                required: false,
            },
        },
        {
            name: 'required and not a number',
            inputValue: 'abcd',
            expected: {
                afterInput: {
                    modelValue: 40000,
                    inputValue: 'abcd',
                },
                afterChange: {
                    modelValue: 40000,
                    inputValue: '4',
                },
            },
            props: {
                min: 40000,
                max: 100000,
                required: true,
            },
        },
        ];

        for (const { name, props, inputValue, expected } of cases) {
            test(`case - ${name}`, async () => {
                const result = await renderComponent(null, {
                    ...props,
                    fractionDigits: 4,
                    roundFractionDigits: 2,
                });

                const inputEl = document.querySelector('input')!;

                // Click the input;
                await userEvent.click(inputEl);

                // Clear the input
                await userEvent.clear(inputEl);

                // Type the value
                await userEvent.keyboard(inputValue);

                // Check model value after input
                expect(lastEmittedModelValue(result)).toBe(expected.afterInput.modelValue);
                // Check input value after input
                expect(inputEl).toHaveValue(expected.afterInput.inputValue);

                // blur
                await userEvent.click(document.body);

                // Check model value after change
                expect(lastEmittedModelValue(result)).toBe(expected.afterChange.modelValue);
                // Check input value after change
                expect(inputEl).toHaveValue(expected.afterChange.inputValue);
            });
        }
    });

    describe('key up', () => {
        test('should add 1', async () => {
          const result = await renderComponent(null, {
                    min: 200,
                    max: 400,
                    fractionDigits: 2,
                    roundFractionDigits: 4
                });

            const inputEl = document.querySelector('input')!;

            // Click the input;
            await userEvent.click(inputEl);

            // Enter arrow up
            await userEvent.keyboard('[ArrowUp]');

            // Check model value after input
            expect(lastEmittedModelValue(result)).toBe(300);
            // Check input value after input
            expect(inputEl).toHaveValue('3');

            // Enter arrow up again
            await userEvent.keyboard('[ArrowUp]');

            // Check model value after input
            expect(lastEmittedModelValue(result)).toBe(400);
            // Check input value after input
            expect(inputEl).toHaveValue('4');
        })

        test('should not add 1 if max reached', async () => {
          const result = await renderComponent(400, {
                    min: 200,
                    max: 400,
                    fractionDigits: 2,
                    roundFractionDigits: 4
                });

            const inputEl = document.querySelector('input')!;

            // Click the input;
            await userEvent.click(inputEl);

            // Enter arrow up
            await userEvent.keyboard('[ArrowUp]');

            // Check model value after input (should not have changed)
            expect(lastEmittedModelValue(result)).toBe(undefined);
            // Check input value after input
            expect(inputEl).toHaveValue('4');
        })
        
        test('should work if model value NaN', async () => {
          const result = await renderComponent(NaN, {
                    min: 200,
                    max: 400,
                    fractionDigits: 2,
                    roundFractionDigits: 4
                });

            const inputEl = document.querySelector('input')!;

            // Click the input;
            await userEvent.click(inputEl);

            // Enter arrow up
            await userEvent.keyboard('[ArrowUp]');

            // Check model value after input
            expect(lastEmittedModelValue(result)).toBe(300);
            // Check input value after input
            expect(inputEl).toHaveValue('3');
        })
    })

    describe('key down', () => {
        test('should deduct 1', async () => {
          const result = await renderComponent(400, {
                    min: 200,
                    max: 400,
                    fractionDigits: 2,
                    roundFractionDigits: 4
                });

            const inputEl = document.querySelector('input')!;

            // Click the input;
            await userEvent.click(inputEl);

            // Enter arrow down
            await userEvent.keyboard('[ArrowDown]');

            // Check model value after input
            expect(lastEmittedModelValue(result)).toBe(300);
            // Check input value after input
            expect(inputEl).toHaveValue('3');

            // Enter arrow down again
            await userEvent.keyboard('[ArrowDown]');

            // Check model value after input
            expect(lastEmittedModelValue(result)).toBe(200);
            // Check input value after input
            expect(inputEl).toHaveValue('2');
        })

        test('should not deduct 1 if min reached', async () => {
          const result = await renderComponent(200, {
                    min: 200,
                    max: 400,
                    fractionDigits: 2,
                    roundFractionDigits: 4
                });

            const inputEl = document.querySelector('input')!;

            // Click the input;
            await userEvent.click(inputEl);

            // Enter arrow up
            await userEvent.keyboard('[ArrowDown]');

            // Check model value after input (should not have changed)
            expect(lastEmittedModelValue(result)).toBe(undefined);
            // Check input value after input
            expect(inputEl).toHaveValue('2');
        })
        
        test('should set model value to min if model value is NaN', async () => {
          const result = await renderComponent(NaN, {
                    min: 200,
                    max: 400
                });

            const inputEl = document.querySelector('input')!;

            // Click the input;
            await userEvent.click(inputEl);

            // Enter arrow up
            await userEvent.keyboard('[ArrowDown]');

            // Check model value after input
            expect(lastEmittedModelValue(result)).toBe(200);
            // Check input value after input
            expect(inputEl).toHaveValue('2');
        })
    })

    describe('Should correctly round value', () => {
        describe('4 fraction digits', () => {
            test('floor', async () => {
                const result = await renderComponent(null, {
                    fractionDigits: 4,
                    roundFractionDigits: 2
                });

                const inputEl = document.querySelector('input')!;

                // Click the input;
                await userEvent.click(inputEl);

                // Clear the input
                await userEvent.clear(inputEl);

                // Type the value
                await userEvent.keyboard('1,4545');

                // Check model value after input
                expect(lastEmittedModelValue(result)).toBe(14500);
                // Check input value after input
                expect(inputEl).toHaveValue('1,4545');

                // blur
                await userEvent.click(document.body);

                // Check model value after change
                expect(lastEmittedModelValue(result)).toBe(14500);
                // Check input value after change
                expect(inputEl).toHaveValue('1.45');
            });

            test('ceil', async () => {
                const result = await renderComponent(null, {
                    fractionDigits: 4,
                    roundFractionDigits: 2
                });

                const inputEl = document.querySelector('input')!;

                // Click the input;
                await userEvent.click(inputEl);

                // Clear the input
                await userEvent.clear(inputEl);

                // Type the value
                await userEvent.keyboard('1,5555');

                // Check model value after input
                expect(lastEmittedModelValue(result)).toBe(15600);
                // Check input value after input
                expect(inputEl).toHaveValue('1,5555');

                // blur
                await userEvent.click(document.body);

                // Check model value after change
                expect(lastEmittedModelValue(result)).toBe(15600);
                // Check input value after change
                expect(inputEl).toHaveValue('1.56');
            });
        })

        describe('2 fraction digits', () => {
            test('floor', async () => {
                const result = await renderComponent(null, {
                    fractionDigits: 2,
                    roundFractionDigits: 2,
                });

                const inputEl = document.querySelector('input')!;

                // Click the input;
                await userEvent.click(inputEl);

                // Clear the input
                await userEvent.clear(inputEl);

                // Type the value
                await userEvent.keyboard('1,4545');

                // Check model value after input
                expect(lastEmittedModelValue(result)).toBe(145);
                // Check input value after input
                expect(inputEl).toHaveValue('1,4545');

                // blur
                await userEvent.click(document.body);

                // Check model value after change
                expect(lastEmittedModelValue(result)).toBe(145);
                // Check input value after change
                expect(inputEl).toHaveValue('1.45');
            });

            test('ceil', async () => {
                const result = await renderComponent(null, {
                    fractionDigits: 2,
                    roundFractionDigits: 2,
                });

                const inputEl = document.querySelector('input')!;

                // Click the input;
                await userEvent.click(inputEl);

                // Clear the input
                await userEvent.clear(inputEl);

                // Type the value
                await userEvent.keyboard('1,5555');

                // Check model value after input
                expect(lastEmittedModelValue(result)).toBe(156);
                // Check input value after input
                expect(inputEl).toHaveValue('1,5555');

                // blur
                await userEvent.click(document.body);

                // Check model value after change
                expect(lastEmittedModelValue(result)).toBe(156);
                // Check input value after change
                expect(inputEl).toHaveValue('1.56');
            });
        })

    });
});

function lastEmittedModelValue(result: RenderResult<any>): number | null | undefined {
    const emitted = result.emitted<(number | null)[]>('update:modelValue');
    if(emitted === undefined) {
        return undefined;
    }

    return emitted[emitted.length - 1][0];
}

/**
 * Helper to create a NumberInput wrapper (recreating the model)
 * @param props
 * @returns
 */
async function renderComponent(modelValue: number | null, props: any): Promise<RenderResult<any>> {    
    return render(FloatInput, {
        props: {
        ...props,
        modelValue,
    }
    });
}
