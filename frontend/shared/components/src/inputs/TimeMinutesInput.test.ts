/// <reference types="@vitest/browser/providers/playwright" />
import { Formatter } from '@stamhoofd/utility';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import TimeMinutesInput from './TimeMinutesInput.vue';

// DO NOT COPY THIS PATTERN!
// DO NOT COPY THIS PATTERN!
// We should use vitest-browser-vue instead
// user input / keyboard handling is not realistic in @vue/test-utils
// DO NOT COPY THIS PATTERN!
// DO NOT COPY THIS PATTERN!

describe('TimeInput', async () => {
    const originalTimezone = Formatter.timezone;
    enableAutoUnmount(afterEach);

    afterEach(() => {
        setFormatterTimeZone(originalTimezone);
    });

    const setFormatterTimeZone = (timezone: string) => {
        // https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
        Formatter.timezone = timezone;
    };

    test('Model should not update without user input', async () => {
        setFormatterTimeZone('Asia/Shanghai');

        const date = 500;

        const wrapper = mount(TimeMinutesInput, {
            props: {
                modelValue: date,
            },
        });

        await wrapper.vm.$nextTick();
        expect(wrapper.emitted()).not.toHaveProperty('update:modelValue');
        expect(wrapper.vm.modelValue).toBe(date);
    });

    test('Text should change if model changes from parent', async () => {
        setFormatterTimeZone('Europe/Brussels');

        const wrapper = mount(TimeMinutesInput, {
            props: {
                modelValue: 180,
            },
        });

        const inputWrapper = wrapper.find('input');

        await wrapper.setProps({modelValue: 120})
        expect(inputWrapper.element).toHaveValue('02:00')
    })

    test('Model should not update if invalid input', async () => {
        const invalidInputs = ['invalid input', '24:00', '12:60'];

        for (const invalidInput of invalidInputs) {
            setFormatterTimeZone('Europe/Brussels');

            const wrapper = mount(TimeMinutesInput, {
                props: {
                    'modelValue': 600,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            const inputWrapper = wrapper.find('input');

            await inputWrapper.setValue(invalidInput);

            // model should not update
            expect(wrapper.props('modelValue')).toEqual(600);
        }
    });

    test('Error should be shown if invalid input', async () => {
        const invalidInputs = ['invalid input', '24:00', '12:60'];

        for (const invalidInput of invalidInputs) {
            setFormatterTimeZone('Europe/Brussels');

            const wrapper = mount(TimeMinutesInput, {
                props: {
                    'modelValue': 600,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            const inputWrapper = wrapper.find('input');

            await inputWrapper.setValue(invalidInput);

            // error should be shown
            const errorBox = wrapper.find('.error-box');
            expect(errorBox.exists()).toBe(true);
            expect(inputWrapper.classes()).toContain('error');
        }
    });

    test('Model should output correct Date after user input', async () => {
        setFormatterTimeZone('Europe/Brussels');

        const testCases: { input: string; expected: number }[] = [

            {
                input: '20:30',
                expected: 1230,
            },
            { 
                input: '05:00',
                expected: 300,
            },
            {
                input: '20:15',
                expected: 1215,
            },
            {
                input: '00:00',
                expected: 0,
            },
            {
                input: '00:01',
                expected: 1,
            },
            {
                input: '23:59',
                expected: 1439,
            },
        ];

        for (const { input, expected } of testCases) {

            const wrapper = mount(TimeMinutesInput, {
                props: {
                    'modelValue': 100,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            const inputWrapper = wrapper.find('input');

            await inputWrapper.setValue(input);

            expect(wrapper.props('modelValue')).toEqual(expected);
        }
    });

    test('Should show correct minutes', async () => {
        setFormatterTimeZone('Europe/Brussels');

        const testCases: { expected: string; input: number }[] = [

            {
                expected: '20:30',
                input: 1230,
            },
            { 
                expected: '05:00',
                input: 300,
            },
            {
                expected: '20:15',
                input: 1215,
            },
            {
                expected: '00:00',
                input: 0,
            },
            {
                expected: '00:01',
                input: 1,
            },
            {
                expected: '23:59',
                input: 1439,
            },
        ];

        for (const { input, expected } of testCases) {

            const wrapper = mount(TimeMinutesInput, {
                props: {
                    'modelValue': input,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            const inputWrapper = wrapper.find('input');

            expect(inputWrapper.element).toHaveValue(expected);
        }
    });
});
