/// <reference types="@vitest/browser/providers/playwright" />
import { userEvent } from '@vitest/browser/context';
import { expect, test } from 'vitest';
import { render  } from 'vitest-browser-vue';
import type {RenderResult} from 'vitest-browser-vue';
import type { ErrorBox } from '../errors/ErrorBox';
import type { Validator } from '../errors/Validator';
import FloatInputBox from './FloatInputBox.vue';

describe('FloatInputBox', () => {
    test('Should not update without user input if no min, max or required', async () => {
        const result = await renderComponentWithDefaultProps(null);

        expect(result.emitted()).not.toHaveProperty('update:modelValue');
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
                floatingPoint?: boolean;
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
                    modelValue: 40000,
                    inputValue: '4',
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
                    modelValue: undefined,
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
        {
            name: 'one less than min',
            inputValue: '3',
            expected: {
                afterInput: {
                    modelValue: undefined,
                    inputValue: '3',
                },
                afterChange: {
                    modelValue: 30000,
                    inputValue: '3',
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
                    modelValue: NaN,
                    inputValue: 'abcd',
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
                    modelValue: undefined,
                    inputValue: 'abcd',
                },
                afterChange: {
                    modelValue: NaN,
                    inputValue: 'abcd',
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
                const result = await renderComponentWithDefaultProps(null, {
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

    test('Should correctly update model on repeated changes', async () => {
                const result = await renderComponentWithDefaultProps(null, {
                    fractionDigits: 4,
                    roundFractionDigits: 2,
                });

                const inputEl = document.querySelector('input')!;

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
                        modelValue: 50000,
                        inputValue: '5',
                    },
                },
                {
                    text: '6',
                    expected: {
                        modelValue: 60000,
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
                        modelValue: 10000,
                        inputValue: '1',
                    }
                },
            ];

            for (const {text, expected} of inputValues) {
                // clear input
                await userEvent.clear(inputEl);

                // Type the value
                await userEvent.keyboard(text);

                // blur
                await userEvent.click(document.body);

                // Check model value after change
                expect(lastEmittedModelValue(result)).toBe(expected.modelValue);
                // Check input value after change
                expect(inputEl).toHaveValue(expected.inputValue);
            }

    });

    test('Should not immediately show an error on mounted', async () => {
        await renderComponentWithDefaultProps(6, {
            max: 30000,
            fractionDigits: 4,
            roundFractionDigits: 2,
        });

        const inputError = document.querySelector('[data-testid="input-error"]')

        // Should not exist before change
        expect(inputError).toBeNull();
    });

    describe('Should only update error on change', () => {
        test('not a number', async () => {
               await renderComponentWithDefaultProps(null, {
                    fractionDigits: 4,
                    roundFractionDigits: 2,
               });

                const inputEl = document.querySelector('input')!;

                // Click the input;
                await userEvent.click(inputEl);

                // Clear the input
                await userEvent.clear(inputEl);

                // Type the value
                await userEvent.keyboard('abc');

                let inputError = document.querySelector('[data-testid="input-error"]');
    
                // Should not exist before change
                expect(inputError).toBeNull();

                // blur
                await userEvent.click(document.body);

                inputError = document.querySelector('[data-testid="input-error"]');

                // should exist after change and contain the correct error message
                expect(inputError).not.toBeNull();
                expect(inputError).toHaveTextContent('Vul een geldig getal in');
        });

        test('min', async () => {
            await renderComponentWithDefaultProps(null, {
                min: 50000,
                fractionDigits: 4,
                roundFractionDigits: 2,
            });

            const inputEl = document.querySelector('input')!;

            // Click the input;
            await userEvent.click(inputEl);

            // Clear the input
            await userEvent.clear(inputEl);

            // Type the value
            await userEvent.keyboard('3');

            let inputError = document.querySelector('[data-testid="input-error"]')

            // Should not exist before change
            expect(inputError).toBeNull();

            // blur
            await userEvent.click(document.body);

            inputError = document.querySelector('[data-testid="input-error"]');

            // should exist after change and contain the correct error message
            expect(inputError).not.toBeNull();
            expect(inputError).toHaveTextContent('Het minimum is');
        });

        test('max', async () => {
            await renderComponentWithDefaultProps(null, {
                max: 50000,
                fractionDigits: 4,
                roundFractionDigits: 2,
            });

            const inputEl = document.querySelector('input')!;

            // Click the input;
            await userEvent.click(inputEl);

            // Clear the input
            await userEvent.clear(inputEl);

            // Type the value
            await userEvent.keyboard('6');

            let inputError = document.querySelector('[data-testid="input-error"]')

            // Should not exist before change
            expect(inputError).toBeNull();

            // blur
            await userEvent.click(document.body);

            inputError = document.querySelector('[data-testid="input-error"]');

            // should exist after change and contain the correct error message
            expect(inputError).not.toBeNull();
            expect(inputError).toHaveTextContent('Het maximum is');
        });
    });

    describe('Should correctly round value', () => {
        describe('4 fraction digits', () => {
            test('floor', async () => {
                const result = await renderComponentWithDefaultProps(null, {
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
                const result = await renderComponentWithDefaultProps(null, {
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
                const result = await renderComponentWithDefaultProps(null, {
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
                const result = await renderComponentWithDefaultProps(null, {
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

async function renderComponentWithDefaultProps(value: number | null, overrideProps: Partial<FloatInputBoxProps> = {}) {
    const defaultProps: FloatInputBoxProps = {
        title: 'test number input',
        validator: null,
    };

    return renderComponent(value, {
        ...defaultProps,
        ...overrideProps,
    });
}

type FloatInputBoxProps = {
    title?: string;
    errorFields?: string;
    class?: string | null;
    validator: Validator | null;
    errorBox?: ErrorBox | null;

    /** Price in cents */
    min?: number | null;
    /** Price in cents */
    max?: number | null;
    required?: boolean;
    disabled?: boolean;
    suffix?: string;
    placeholder?: string;
    fractionDigits?: number;
    roundFractionDigits?: number | null;
};

function lastEmittedModelValue(result: RenderResult<any>): number | null | undefined {
    const emitted = result.emitted<(number | null)[]>('update:modelValue');
    if (emitted === undefined) {
        return undefined;
    }

    return emitted[emitted.length - 1][0];
}

/**
 * Helper to create a NumberInput wrapper (recreating the model)
 * @param props
 * @returns
 */
async function renderComponent(modelValue: number | null, props: FloatInputBoxProps): Promise<RenderResult<any>> {    
    return render(FloatInputBox, {
        props: {
        ...props,
        modelValue,
    }
    });
}
