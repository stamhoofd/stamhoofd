/// <reference types="@vitest/browser/providers/playwright" />
import { Formatter } from '@stamhoofd/utility';
import { mount, VueWrapper } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import DateSelection from './DateSelection.vue';

// todo: add test that time should not be changed if no time is set + implement

describe('DateSelection', async () => {
    const originalTimezone = Formatter.timezone;

    afterEach(() => {
        setFormatterTimeZone(originalTimezone);
    });

    const setFormatterTimeZone = (timezone: string) => {
        // https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
        Formatter.timezone = timezone;
    };

    const findDayInput = <T>(wrapper: VueWrapper<T>) => wrapper.find({ ref: 'dayInput' });
    const findMonthInput = <T>(wrapper: VueWrapper<T>) => wrapper.find({ ref: 'monthInput' });
    const findYearInput = <T>(wrapper: VueWrapper<T>) => wrapper.find({ ref: 'yearInput' });

    test('Model should not update without user input', async () => {
        setFormatterTimeZone('Asia/Shanghai');

        const date = new Date(2023, 0, 1, 12, 0, 0);

        const wrapper = mount(DateSelection, {
            props: {
                modelValue: date,
            },
        });

        await wrapper.vm.$nextTick();
        expect(wrapper.emitted()).not.toHaveProperty('update:modelValue');
        expect(wrapper.vm.modelValue).toBe(date);
    });

    test('Model should not update if input is not a number', async () => {
        const invalidInputs = ['invalid input', '', 'a'];

        for (const invalidInput of invalidInputs) {
            setFormatterTimeZone('Europe/Brussels');
            const date = new Date(2023, 0, 1, 12, 0, 0);

            const wrapper = mount(DateSelection, {
                props: {
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            // #region day
            const dayInput = findDayInput(wrapper);
            await dayInput.setValue(invalidInput);

            // model should not update
            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(date.getTime());
            // #endregion

            // #region month
            const monthInput = findMonthInput(wrapper);
            await monthInput.setValue(invalidInput);

            // model should not update
            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(date.getTime());
            // #endregion

            // #region year
            const yearInput = findYearInput(wrapper);
            await yearInput.setValue(invalidInput);

            // model should not update
            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(date.getTime());
            // #endregion
        }
    });

    describe('Input number out of range should be limited', async () => {
        test('for day', async () => {
            setFormatterTimeZone('Europe/Brussels');
            const date = new Date(2023, 0, 1, 12, 0, 0);

            const wrapper = mount(DateSelection, {
                props: {
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            const numberOutOfRange = '32';
            const dayInput = findDayInput(wrapper);
            await dayInput.setValue(numberOutOfRange);

            expect(wrapper.props('modelValue')).not.toBeNull();
            // 32 should be corrected to 31
            expect(wrapper.props('modelValue')?.getTime()).toEqual((new Date(2023, 0, 31, 12, 0, 0)).getTime());
        });

        test('for month', async () => {
            setFormatterTimeZone('Europe/Brussels');
            const date = new Date(2023, 0, 1, 12, 0, 0);

            const wrapper = mount(DateSelection, {
                props: {
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            const numberOutOfRange = '13';
            const monthInput = findMonthInput(wrapper);
            await monthInput.setValue(numberOutOfRange);

            expect(wrapper.props('modelValue')).not.toBeNull();
            // 32 should be corrected to 31
            expect(wrapper.props('modelValue')?.getTime()).toEqual((new Date(2023, 11, 1, 12, 0, 0)).getTime());
        });
    });

    describe('Input negative number should become positive', async () => {
        test('for day', async () => {
            setFormatterTimeZone('Europe/Brussels');
            const date = new Date(2023, 0, 1, 12, 0, 0);

            const wrapper = mount(DateSelection, {
                props: {
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            const dayInput = findDayInput(wrapper);
            await dayInput.setValue('-23');

            expect(wrapper.props('modelValue')).not.toBeNull();
            // 32 should be corrected to 31
            expect(wrapper.props('modelValue')?.getTime()).toEqual((new Date(2023, 0, 23, 12, 0, 0)).getTime());
        });

        test('for month', async () => {
            setFormatterTimeZone('Europe/Brussels');
            const date = new Date(2023, 0, 1, 12, 0, 0);

            const wrapper = mount(DateSelection, {
                props: {
                    // -> 10 in UTC
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            const monthInput = findMonthInput(wrapper);
            await monthInput.setValue('-10');

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual((new Date(2023, 9, 1, 10, 0, 0)).getTime());
        });
    });

    test('Model should not update if input date exceeds max Date value', async () => {
        setFormatterTimeZone('Europe/Brussels');
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
        // max date is September 13, 275760 AD
        const maxDate = new Date(275760, 8, 13);

        const wrapper = mount(DateSelection, {
            props: {
                'modelValue': maxDate,
                'onUpdate:modelValue': async (e) => {
                    await wrapper.setProps({ modelValue: e });
                },
            },
        });

        const numberOutOfRange = 275761;
        const yearInput = findMonthInput(wrapper);
        await yearInput.setValue(numberOutOfRange);

        expect(wrapper.props('modelValue')).not.toBeNull();
        expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(275760, 8, 13).getTime());

        const monthOutOfRange = 10;
        const monthInput = findMonthInput(wrapper);
        await monthInput.setValue(monthOutOfRange);

        expect(wrapper.props('modelValue')).not.toBeNull();
        expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(275760, 8, 13).getTime());

        const dayOutOfRange = 14;
        const dayInput = findMonthInput(wrapper);
        await dayInput.setValue(dayOutOfRange);

        expect(wrapper.props('modelValue')).not.toBeNull();
        expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(275760, 8, 13).getTime());
    });

    test('Model should output correct Date after user input', async () => {
        const date = new Date(2012, 7, 13, 0, 0, 0);

        const testCases: { timezone: string; input: { day: string; month: string; year: string }; output: Date }[] = [

            { // +11:00
                timezone: 'Asia/Sakhalin',
                input: {
                    day: '1',
                    month: '9',
                    year: '2024',
                },
                output: new Date(2024, 7, 31, 13, 0, 0),
            },
            { // +12:00 (SDT), +13:00 (DST)
                timezone: 'Antarctica/South_Pole',
                input: {
                    day: '1',
                    month: '9',
                    year: '2024',
                },
                output: new Date(2024, 7, 31, 12, 0, 0),
            },
            { // +08:00
                timezone: 'Asia/Shanghai',
                input: {
                    day: '1',
                    month: '9',
                    year: '2024',
                },
                output: new Date(2024, 7, 31, 16, 0, 0),
            },
            {
                // +01:00 (SDT)
                timezone: 'Europe/Brussels',
                input: {
                    day: '1',
                    month: '9',
                    year: '2024',
                },
                output: new Date(2024, 7, 31, 22, 0, 0),
            },
            {
                // -11:00
                timezone: 'Pacific/Pago_Pago',
                input: {
                    day: '1',
                    month: '9',
                    year: '2024',
                },
                // todo: add different time and check if next month
                output: new Date(2024, 8, 1, 11, 0, 0),
            },
        ];

        for (const { timezone, input: { day, month, year }, output } of testCases) {
            setFormatterTimeZone(timezone);

            const wrapper = mount(DateSelection);

            await wrapper.setProps({
                'time': { hours: 0, minutes: 0, seconds: 0 },
                'modelValue': new Date(date),
                'onUpdate:modelValue': async (e) => {
                    await wrapper.setProps({ modelValue: e });
                },
            });

            const dayInput = findDayInput(wrapper);
            const monthInput = findMonthInput(wrapper);
            const yearInput = findYearInput(wrapper);

            await dayInput.setValue(day);
            await monthInput.setValue(month);
            await yearInput.setValue(year);

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(output.getTime());
        }
    });
});
