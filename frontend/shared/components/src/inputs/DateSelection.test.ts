/// <reference types="@vitest/browser/providers/playwright" />
import { Formatter } from '@stamhoofd/utility';
import { mount, VueWrapper } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import DateSelection from './DateSelection.vue';

// todo: add test that time should not be changed if no time is set + implement

describe('DateSelection', async () => {
    const originalTimezone = Formatter.timezone;
    let wrapper: VueWrapper | undefined;

    afterEach(() => {
        setFormatterTimeZone(originalTimezone);
        wrapper?.unmount();
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

    describe('Input number out of range', async () => {
        test('for day should limit to days in month', async () => {
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
            // 31 should be corrected to 31
            expect(wrapper.props('modelValue')?.getTime()).toEqual((new Date(2023, 0, 31, 11, 0, 0)).getTime());
        });

        test('for month should limit to 12', async () => {
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
            expect(wrapper.props('modelValue')?.getTime()).toEqual((new Date(2023, 11, 1, 11, 0, 0)).getTime());
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
            expect(wrapper.props('modelValue')?.getTime()).toEqual((new Date(2023, 0, 23, 11, 0, 0)).getTime());
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

    describe('keydown', async () => {
        test('ArrowRight should focus next input', async () => {
            setFormatterTimeZone('Asia/Shanghai');

            const date = new Date(2023, 0, 1, 12, 0, 0);

            wrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });

            const dayInput = findDayInput(wrapper);
            await dayInput.trigger('focus');
            expect(document.activeElement).toBe(dayInput.element);

            // first time -> month input should be in focus
            const monthInput = findMonthInput(wrapper);
            await dayInput.trigger('keydown', { key: 'ArrowRight' });

            expect(document.activeElement).not.toBe(dayInput.element);
            expect(document.activeElement).toBe(monthInput.element);

            // second time -> year input should be in focus
            const yearInput = findYearInput(wrapper);
            await monthInput.trigger('keydown', { key: 'ArrowRight' });

            expect(document.activeElement).not.toBe(monthInput.element);
            expect(document.activeElement).toBe(yearInput.element);
        });

        test('ArrowRight should blur all if year input in focus', async () => {
            setFormatterTimeZone('Asia/Shanghai');

            const date = new Date(2023, 0, 1, 12, 0, 0);

            wrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });

            const yearInput = findYearInput(wrapper);
            const monthInput = findMonthInput(wrapper);
            const dayInput = findDayInput(wrapper);

            await yearInput.trigger('focus');
            expect(document.activeElement).not.toBe(dayInput.element);
            expect(document.activeElement).not.toBe(monthInput.element);
            expect(document.activeElement).toBe(yearInput.element);

            await yearInput.trigger('keydown', { key: 'ArrowRight' });
            expect(document.activeElement).not.toBe(dayInput.element);
            expect(document.activeElement).not.toBe(monthInput.element);
            expect(document.activeElement).not.toBe(yearInput.element);
        });

        test('ArrowLeft should focus previous input', async () => {
            setFormatterTimeZone('Asia/Shanghai');

            const date = new Date(2023, 0, 1, 12, 0, 0);

            wrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });

            const yearInput = findYearInput(wrapper);
            await yearInput.trigger('focus');
            expect(document.activeElement).toBe(yearInput.element);

            // first time -> month input should be in focus
            const monthInput = findMonthInput(wrapper);
            await yearInput.trigger('keydown', { key: 'ArrowLeft' });

            expect(document.activeElement).not.toBe(yearInput.element);
            expect(document.activeElement).toBe(monthInput.element);

            // second time -> day input should be in focus
            const dayInput = findDayInput(wrapper);
            await monthInput.trigger('keydown', { key: 'ArrowLeft' });

            expect(document.activeElement).not.toBe(monthInput.element);
            expect(document.activeElement).toBe(dayInput.element);
        });

        test('ArrowLeft should blur all if day input in focus', async () => {
            setFormatterTimeZone('Asia/Shanghai');

            const date = new Date(2023, 0, 1, 12, 0, 0);

            wrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });

            const yearInput = findYearInput(wrapper);
            const monthInput = findMonthInput(wrapper);
            const dayInput = findDayInput(wrapper);

            await dayInput.trigger('focus');
            expect(document.activeElement).not.toBe(yearInput.element);
            expect(document.activeElement).not.toBe(monthInput.element);
            expect(document.activeElement).toBe(dayInput.element);

            await dayInput.trigger('keydown', { key: 'ArrowLeft' });
            expect(document.activeElement).not.toBe(dayInput.element);
            expect(document.activeElement).not.toBe(monthInput.element);
            expect(document.activeElement).not.toBe(yearInput.element);
        });

        test('ArrowUp should set input value + 1', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2023, 0, 1, 11, 0, 0);

            const dateSelectionWrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });
            wrapper = dateSelectionWrapper;

            const yearInput = findYearInput(dateSelectionWrapper);
            const monthInput = findMonthInput(dateSelectionWrapper);
            const dayInput = findDayInput(dateSelectionWrapper);

            // day
            await dayInput.trigger('focus');
            await dayInput.trigger('keydown', { key: 'ArrowUp' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 0, 2, 11, 0, 0).getTime());

            // month
            await monthInput.trigger('focus');
            await monthInput.trigger('keydown', { key: 'ArrowUp' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 1, 2, 11, 0, 0).getTime());

            // year
            await yearInput.trigger('focus');
            await yearInput.trigger('keydown', { key: 'ArrowUp' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2024, 1, 2, 11, 0, 0).getTime());
        });

        test('ArrowUp should set next month if day is last day of month', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2025, 1, 28, 11, 0, 0);

            const dateSelectionWrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });
            wrapper = dateSelectionWrapper;
            const dayInput = findDayInput(dateSelectionWrapper);

            // day
            await dayInput.trigger('focus');
            await dayInput.trigger('keydown', { key: 'ArrowUp' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2025, 2, 1, 11, 0, 0).getTime());
        });

        test('ArrowUp should set next year if last month', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2025, 11, 1, 11, 0, 0);

            const dateSelectionWrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });
            wrapper = dateSelectionWrapper;
            const monthInput = findMonthInput(dateSelectionWrapper);

            // day
            await monthInput.trigger('focus');
            await monthInput.trigger('keydown', { key: 'ArrowUp' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2026, 0, 1, 11, 0, 0).getTime());
        });

        test('PageUp should set input value + 1', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2023, 0, 1, 11, 0, 0);

            const dateSelectionWrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });
            wrapper = dateSelectionWrapper;

            const yearInput = findYearInput(dateSelectionWrapper);
            const monthInput = findMonthInput(dateSelectionWrapper);
            const dayInput = findDayInput(dateSelectionWrapper);

            // day
            await dayInput.trigger('focus');
            await dayInput.trigger('keydown', { key: 'PageUp' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 0, 2, 11, 0, 0).getTime());

            // month
            await monthInput.trigger('focus');
            await monthInput.trigger('keydown', { key: 'PageUp' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 1, 2, 11, 0, 0).getTime());

            // year
            await yearInput.trigger('focus');
            await yearInput.trigger('keydown', { key: 'PageUp' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2024, 1, 2, 11, 0, 0).getTime());
        });

        test('ArrowDown should set input value - 1', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2023, 1, 2, 11, 0, 0);

            const dateSelectionWrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });
            wrapper = dateSelectionWrapper;

            const yearInput = findYearInput(dateSelectionWrapper);
            const monthInput = findMonthInput(dateSelectionWrapper);
            const dayInput = findDayInput(dateSelectionWrapper);

            // day
            await dayInput.trigger('focus');
            await dayInput.trigger('keydown', { key: 'ArrowDown' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 1, 1, 11, 0, 0).getTime());

            // month
            await monthInput.trigger('focus');
            await monthInput.trigger('keydown', { key: 'ArrowDown' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 0, 1, 11, 0, 0).getTime());

            // year
            await yearInput.trigger('focus');
            await yearInput.trigger('keydown', { key: 'ArrowDown' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2022, 0, 1, 11, 0, 0).getTime());
        });

        test('ArrowDown should set previous month if day is first day of month', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2025, 0, 1, 11, 0, 0);

            const dateSelectionWrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });
            wrapper = dateSelectionWrapper;
            const dayInput = findDayInput(dateSelectionWrapper);

            // day
            await dayInput.trigger('focus');
            await dayInput.trigger('keydown', { key: 'ArrowDown' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2024, 11, 31, 11, 0, 0).getTime());
        });

        test('ArrowDown should set previous year if first month', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2025, 0, 1, 11, 0, 0);

            const dateSelectionWrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });
            wrapper = dateSelectionWrapper;
            const monthInput = findMonthInput(dateSelectionWrapper);

            // day
            await monthInput.trigger('focus');
            await monthInput.trigger('keydown', { key: 'ArrowDown' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2024, 11, 1, 11, 0, 0).getTime());
        });

        test('PageDown should set input value - 1', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2023, 1, 2, 11, 0, 0);

            const dateSelectionWrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });
            wrapper = dateSelectionWrapper;

            const yearInput = findYearInput(dateSelectionWrapper);
            const monthInput = findMonthInput(dateSelectionWrapper);
            const dayInput = findDayInput(dateSelectionWrapper);

            // day
            await dayInput.trigger('focus');
            await dayInput.trigger('keydown', { key: 'PageDown' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 1, 1, 11, 0, 0).getTime());

            // month
            await monthInput.trigger('focus');
            await monthInput.trigger('keydown', { key: 'PageDown' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 0, 1, 11, 0, 0).getTime());

            // year
            await yearInput.trigger('focus');
            await yearInput.trigger('keydown', { key: 'PageDown' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2022, 0, 1, 11, 0, 0).getTime());
        });

        test('Key events should be removed before unmount', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2023, 0, 1, 11, 0, 0);

            const dateSelectionWrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });
            wrapper = dateSelectionWrapper;

            const dayInput = findDayInput(dateSelectionWrapper);

            // day
            await dayInput.trigger('focus');

            dateSelectionWrapper.unmount();
            await dayInput.trigger('keydown', { key: 'ArrowUp' });

            expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
            // value should not change due to keydown event
            expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(date.getTime());
        });
    });

    test('Next input should focus while typing if input is full', async () => {
        setFormatterTimeZone('Europe/Brussels');

        const date = new Date(2023, 7, 1, 11, 0, 0);

        const dateSelectionWrapper = mount(DateSelection, { attachTo: document.body });

        await dateSelectionWrapper.setProps({
            'time': { hours: 12, minutes: 0, seconds: 0 },
            'modelValue': date,
            'onUpdate:modelValue': e => dateSelectionWrapper.setProps({ modelValue: e }),
        });

        wrapper = dateSelectionWrapper;

        const dayInput = findDayInput(dateSelectionWrapper);
        const monthInput = findMonthInput(dateSelectionWrapper);
        const yearInput = findYearInput(dateSelectionWrapper);

        // day
        await dayInput.trigger('focus');
        await dayInput.setValue('12');

        expect(dateSelectionWrapper.props('modelValue')).not.toBeNull();
        expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 7, 12, 10, 0, 0).getTime());

        expect(document.activeElement).not.toBe(dayInput.element);
        expect(document.activeElement).toBe(monthInput.element);

        // // month
        await monthInput.setValue('9');

        expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 8, 12, 10, 0, 0).getTime());
        expect(document.activeElement).not.toBe(monthInput.element);
        expect(document.activeElement).toBe(yearInput.element);

        // // year
        await yearInput.setValue('2024');

        expect(dateSelectionWrapper.props('modelValue')?.getTime()).toEqual(new Date(2024, 8, 12, 10, 0, 0).getTime());
        expect(document.activeElement).not.toBe(dayInput.element);
        expect(document.activeElement).not.toBe(monthInput.element);
        expect(document.activeElement).not.toBe(yearInput.element);
    });

    // todo: add test for min and max
    // todo: add test if no time set and no date

    // todo: add test for time prop
    // todo: test is mobile?
    // todo: test display component
});
