/// <reference types="@vitest/browser/providers/playwright" />
import { Formatter, sleep } from '@stamhoofd/utility';
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';
import TestAppWithModalStackComponent from '../../../../tests/helpers/TestAppWithModalStackComponent.vue';

import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { page } from '@vitest/browser/context';
import { useIsMobile } from '../hooks';
import DateSelection from './DateSelection.vue';

vi.mock('../hooks/useIsMobile', async (importOriginal) => {
    const original = await importOriginal() as { useIsMobile: typeof useIsMobile };
    const useIsMobileMock = vi.fn().mockImplementation(original.useIsMobile);
    return {
        ...original,
        useIsMobile: useIsMobileMock,
    };
});

describe('DateSelection', async () => {
    const originalTimezone = Formatter.timezone;
    enableAutoUnmount(afterEach);

    afterEach(() => {
        vi.restoreAllMocks();
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

    describe('Text should change if model changes from parent', async () => {
        test('not mobile', async () => {
            setFormatterTimeZone('Asia/Shanghai');

            const wrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'modelValue': new Date(2023, 0, 1, 12, 0, 0),
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });

            await wrapper.vm.$nextTick();

            const dayInput = findDayInput(wrapper);
            const monthInput = findMonthInput(wrapper);
            const yearInput = findYearInput(wrapper);
            expect((dayInput.element as HTMLInputElement)).toHaveValue('1');
            expect((monthInput.element as HTMLInputElement)).toHaveValue('1');
            expect((yearInput.element as HTMLInputElement)).toHaveValue('2023');

            await wrapper.setProps({ modelValue: new Date(2024, 5, 16, 12, 0, 0) });

            expect((dayInput.element as HTMLInputElement)).toHaveValue('16');
            expect((monthInput.element as HTMLInputElement)).toHaveValue('6');
            expect((yearInput.element as HTMLInputElement)).toHaveValue('2024');
        });

        test('mobile', async () => {
            setFormatterTimeZone('Asia/Shanghai');

            vi.mocked(useIsMobile).mockReturnValue(true);

            const wrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'modelValue': new Date(2023, 0, 1, 12, 0, 0),
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });

            const mobileTextEl = page.getByTestId('mobile-text');
            await expect.element(mobileTextEl).toHaveTextContent('1 januari 2023');

            await wrapper.setProps({ modelValue: new Date(2024, 5, 16, 12, 0, 0) });
            await expect.element(mobileTextEl).toHaveTextContent('16 juni 2024');
        });
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

    describe('Timezones', async () => {
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

        // is reverse of previous test
        test('Date should be shown in formatter timezone', async () => {
            const testCases: { timezone: string; expected: { day: string; month: string; year: string }; modelValue: Date }[] = [

                { // +11:00
                    timezone: 'Asia/Sakhalin',
                    expected: {
                        day: '1',
                        month: '9',
                        year: '2024',
                    },
                    modelValue: new Date(2024, 7, 31, 13, 0, 0),
                },
                { // +12:00 (SDT), +13:00 (DST)
                    timezone: 'Antarctica/South_Pole',
                    expected: {
                        day: '1',
                        month: '9',
                        year: '2024',
                    },
                    modelValue: new Date(2024, 7, 31, 12, 0, 0),
                },
                { // +08:00
                    timezone: 'Asia/Shanghai',
                    expected: {
                        day: '1',
                        month: '9',
                        year: '2024',
                    },
                    modelValue: new Date(2024, 7, 31, 16, 0, 0),
                },
                {
                    // +01:00 (SDT)
                    timezone: 'Europe/Brussels',
                    expected: {
                        day: '1',
                        month: '9',
                        year: '2024',
                    },
                    modelValue: new Date(2024, 7, 31, 22, 0, 0),
                },
                {
                    // -11:00
                    timezone: 'Pacific/Pago_Pago',
                    expected: {
                        day: '1',
                        month: '9',
                        year: '2024',
                    },
                    // todo: add different time and check if next month
                    modelValue: new Date(2024, 8, 1, 11, 0, 0),
                },
            ];

            for (const { timezone, expected: { day, month, year }, modelValue } of testCases) {
                setFormatterTimeZone(timezone);

                const wrapper = mount(DateSelection);

                await wrapper.setProps({
                    'time': { hours: 0, minutes: 0, seconds: 0 },
                    modelValue,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                });

                const dayInput = findDayInput(wrapper);
                const monthInput = findMonthInput(wrapper);
                const yearInput = findYearInput(wrapper);

                expect(dayInput.element).toHaveValue(day);
                expect(monthInput.element).toHaveValue(month);
                expect(yearInput.element).toHaveValue(year);
            }
        });

        test('Date should be shown in formatter timezone - mobile', async () => {
            const testCases: { timezone: string; expected: string; modelValue: Date }[] = [

                { // +11:00
                    timezone: 'Asia/Sakhalin',
                    modelValue: new Date(2024, 7, 31, 13, 0, 0),
                    expected: '1 september 2024',
                },
                { // +12:00 (SDT), +13:00 (DST)
                    timezone: 'Antarctica/South_Pole',
                    modelValue: new Date(2024, 7, 31, 12, 0, 0),
                    expected: '1 september 2024',
                },
                { // +08:00
                    timezone: 'Asia/Shanghai',
                    modelValue: new Date(2024, 7, 31, 16, 0, 0),
                    expected: '1 september 2024',
                },
                {
                    // +01:00 (SDT)
                    timezone: 'Europe/Brussels',
                    modelValue: new Date(2024, 7, 31, 22, 0, 0),
                    expected: '1 september 2024',
                },
                {
                    // -11:00
                    timezone: 'Pacific/Pago_Pago',
                    // todo: add different time and check if next month
                    modelValue: new Date(2024, 8, 1, 11, 0, 0),
                    expected: '1 september 2024',
                },
            ];

            vi.mocked(useIsMobile).mockReturnValue(true);

            for (const { timezone, expected, modelValue } of testCases) {
                setFormatterTimeZone(timezone);

                const wrapper = mount(DateSelection, {
                    attachTo: document.body,
                });

                await wrapper.setProps({
                    'time': { hours: 0, minutes: 0, seconds: 0 },
                    modelValue,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                });

                const mobileTextEl = page.getByTestId('mobile-text');
                await expect.element(mobileTextEl).toHaveTextContent(expected);
                wrapper.unmount();
            }
        });
    });

    describe('keydown', async () => {
        test('ArrowRight should focus next input', async () => {
            setFormatterTimeZone('Asia/Shanghai');

            const date = new Date(2023, 0, 1, 12, 0, 0);

            const wrapper = mount(DateSelection, {
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

            const wrapper = mount(DateSelection, {
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

        test('ArrowRight should close the date picker if year input in focus', async () => {
            setFormatterTimeZone('Asia/Shanghai');

            const app = mount(TestAppWithModalStackComponent, {
                attachTo: document.body,
                props: {
                    root: new ComponentWithProperties(DateSelection, {
                        'min': new Date(2023, 2, 14, 20, 0, 0, 0),
                        'max': new Date(2023, 2, 15, 4, 0, 0, 0),
                        'modelValue': new Date(2023, 2, 14, 22, 0, 0, 0),
                        'onUpdate:modelValue': async () => {
                        },
                    }),
                },
            });

            const dateSelection = app.findComponent(DateSelection);
            const yearInput = findYearInput(dateSelection);

            // check if date picker is open after focus
            await yearInput.trigger('focus');
            const dateSelectionViewsBefore = document.getElementsByClassName('date-selection-view');
            expect(dateSelectionViewsBefore.length).toBe(1);

            // act
            await yearInput.trigger('keydown', { key: 'ArrowRight' });

            // Date selection has a timeout of 0, so we need to wait
            await sleep(0);

            // there should be no date picker
            const dateSelectionViews = document.getElementsByClassName('date-selection-view');
            expect(dateSelectionViews.length).toBe(0);
        });

        test('ArrowLeft should focus previous input', async () => {
            setFormatterTimeZone('Asia/Shanghai');

            const date = new Date(2023, 0, 1, 12, 0, 0);

            const wrapper = mount(DateSelection, {
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

            const wrapper = mount(DateSelection, {
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

            const wrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });

            const yearInput = findYearInput(wrapper);
            const monthInput = findMonthInput(wrapper);
            const dayInput = findDayInput(wrapper);

            // day
            await dayInput.trigger('focus');
            await dayInput.trigger('keydown', { key: 'ArrowUp' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 0, 2, 11, 0, 0).getTime());

            // month
            await monthInput.trigger('focus');
            await monthInput.trigger('keydown', { key: 'ArrowUp' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 1, 2, 11, 0, 0).getTime());

            // year
            await yearInput.trigger('focus');
            await yearInput.trigger('keydown', { key: 'ArrowUp' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2024, 1, 2, 11, 0, 0).getTime());
        });

        test('ArrowUp should set next month if day is last day of month', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2025, 1, 28, 11, 0, 0);

            const wrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });

            const dayInput = findDayInput(wrapper);

            // day
            await dayInput.trigger('focus');
            await dayInput.trigger('keydown', { key: 'ArrowUp' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2025, 2, 1, 11, 0, 0).getTime());
        });

        test('ArrowUp should set next year if last month', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2025, 11, 1, 11, 0, 0);

            const wrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });

            const monthInput = findMonthInput(wrapper);

            // day
            await monthInput.trigger('focus');
            await monthInput.trigger('keydown', { key: 'ArrowUp' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2026, 0, 1, 11, 0, 0).getTime());
        });

        test('PageUp should set input value + 1', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2023, 0, 1, 11, 0, 0);

            const wrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });

            const yearInput = findYearInput(wrapper);
            const monthInput = findMonthInput(wrapper);
            const dayInput = findDayInput(wrapper);

            // day
            await dayInput.trigger('focus');
            await dayInput.trigger('keydown', { key: 'PageUp' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 0, 2, 11, 0, 0).getTime());

            // month
            await monthInput.trigger('focus');
            await monthInput.trigger('keydown', { key: 'PageUp' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 1, 2, 11, 0, 0).getTime());

            // year
            await yearInput.trigger('focus');
            await yearInput.trigger('keydown', { key: 'PageUp' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2024, 1, 2, 11, 0, 0).getTime());
        });

        test('ArrowDown should set input value - 1', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2023, 1, 2, 11, 0, 0);

            const wrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });

            const yearInput = findYearInput(wrapper);
            const monthInput = findMonthInput(wrapper);
            const dayInput = findDayInput(wrapper);

            // day
            await dayInput.trigger('focus');
            await dayInput.trigger('keydown', { key: 'ArrowDown' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 1, 1, 11, 0, 0).getTime());

            // month
            await monthInput.trigger('focus');
            await monthInput.trigger('keydown', { key: 'ArrowDown' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 0, 1, 11, 0, 0).getTime());

            // year
            await yearInput.trigger('focus');
            await yearInput.trigger('keydown', { key: 'ArrowDown' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2022, 0, 1, 11, 0, 0).getTime());
        });

        test('ArrowDown should set previous month if day is first day of month', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2025, 0, 1, 11, 0, 0);

            const wrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });

            const dayInput = findDayInput(wrapper);

            // day
            await dayInput.trigger('focus');
            await dayInput.trigger('keydown', { key: 'ArrowDown' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2024, 11, 31, 11, 0, 0).getTime());
        });

        test('ArrowDown should set previous year if first month', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2025, 0, 1, 11, 0, 0);

            const wrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });

            const monthInput = findMonthInput(wrapper);

            // day
            await monthInput.trigger('focus');
            await monthInput.trigger('keydown', { key: 'ArrowDown' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2024, 11, 1, 11, 0, 0).getTime());
        });

        test('PageDown should set input value - 1', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2023, 1, 2, 11, 0, 0);

            const wrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });

            const yearInput = findYearInput(wrapper);
            const monthInput = findMonthInput(wrapper);
            const dayInput = findDayInput(wrapper);

            // day
            await dayInput.trigger('focus');
            await dayInput.trigger('keydown', { key: 'PageDown' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 1, 1, 11, 0, 0).getTime());

            // month
            await monthInput.trigger('focus');
            await monthInput.trigger('keydown', { key: 'PageDown' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 0, 1, 11, 0, 0).getTime());

            // year
            await yearInput.trigger('focus');
            await yearInput.trigger('keydown', { key: 'PageDown' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2022, 0, 1, 11, 0, 0).getTime());
        });

        test('Key events should be removed before unmount', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const date = new Date(2023, 0, 1, 11, 0, 0);

            const wrapper = mount(DateSelection, {
                attachTo: document.body,
                props: {
                    'time': { hours: 12, minutes: 0, seconds: 0 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper!.setProps({ modelValue: e });
                    },
                },
            });

            const dayInput = findDayInput(wrapper);

            // day
            await dayInput.trigger('focus');

            wrapper.unmount();
            await dayInput.trigger('keydown', { key: 'ArrowUp' });

            expect(wrapper.props('modelValue')).not.toBeNull();
            // value should not change due to keydown event
            expect(wrapper.props('modelValue')?.getTime()).toEqual(date.getTime());
        });
    });

    test('Next input should focus while typing if input is full', async () => {
        setFormatterTimeZone('Europe/Brussels');

        const date = new Date(2023, 7, 1, 11, 0, 0);

        const wrapper = mount(DateSelection, { attachTo: document.body });

        await wrapper.setProps({
            'time': { hours: 12, minutes: 0, seconds: 0 },
            'modelValue': date,
            'onUpdate:modelValue': e => wrapper.setProps({ modelValue: e }),
        });

        const dayInput = findDayInput(wrapper);
        const monthInput = findMonthInput(wrapper);
        const yearInput = findYearInput(wrapper);

        // day
        await dayInput.trigger('focus');
        (dayInput.element as HTMLInputElement).value = '12';
        await dayInput.trigger('input');

        expect(document.activeElement).not.toBe(dayInput.element);
        expect(document.activeElement).toBe(monthInput.element);

        await dayInput.trigger('change');
        expect(wrapper.props('modelValue')).not.toBeNull();
        expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 7, 12, 10, 0, 0).getTime());

        // month
        (monthInput.element as HTMLInputElement).value = '9';
        await monthInput.trigger('input');

        expect(document.activeElement).not.toBe(monthInput.element);
        expect(document.activeElement).toBe(yearInput.element);

        await monthInput.trigger('change');
        expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 8, 12, 10, 0, 0).getTime());

        // year
        (yearInput.element as HTMLInputElement).value = '2024';
        await yearInput.trigger('input');

        expect(document.activeElement).not.toBe(dayInput.element);
        expect(document.activeElement).not.toBe(monthInput.element);
        expect(document.activeElement).not.toBe(yearInput.element);

        await yearInput.trigger('change');
        expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2024, 8, 12, 10, 0, 0).getTime());
    });

    test('Model value should not exceed max - default time below max', async () => {
        setFormatterTimeZone('Europe/Brussels');
        const date = new Date(2023, 0, 2, 13, 0, 0);

        const wrapper = mount(DateSelection, {
            props: {
                'max': new Date(2024, 0, 1, 12, 0, 0),
                'modelValue': date,
                'onUpdate:modelValue': async (e) => {
                    await wrapper.setProps({ modelValue: e });
                },
            },
        });

        // set year above max
        const yearInput = findYearInput(wrapper);
        await yearInput.setValue(2025);

        expect(wrapper.props('modelValue')).not.toBeNull();
        expect(wrapper.props('modelValue')?.getTime()).toEqual((new Date(2024, 0, 1, 11, 0, 0)).getTime());

        // set month 1 higher
        const monthInput = findMonthInput(wrapper);
        await monthInput.trigger('focus');
        await monthInput.trigger('keydown', { key: 'ArrowUp' });

        expect(wrapper.props('modelValue')).not.toBeNull();
        expect(wrapper.props('modelValue')?.getTime()).toEqual((new Date(2024, 0, 1, 11, 0, 0)).getTime());

        // set day 1 higher
        const dayInput = findDayInput(wrapper);
        await dayInput.trigger('focus');
        await dayInput.trigger('keydown', { key: 'ArrowUp' });

        expect(wrapper.props('modelValue')).not.toBeNull();
        expect(wrapper.props('modelValue')?.getTime()).toEqual((new Date(2024, 0, 1, 11, 0, 0)).getTime());
    });

    test('Model value should not exceed max - default time above max', async () => {
        setFormatterTimeZone('Europe/Brussels');
        const date = new Date(2023, 0, 2, 13, 0, 0);

        const wrapper = mount(DateSelection, {
            props: {
                'max': new Date(2024, 0, 1, 10, 0, 0),
                'modelValue': date,
                'onUpdate:modelValue': async (e) => {
                    await wrapper.setProps({ modelValue: e });
                },
            },
        });

        // set year above max
        const yearInput = findYearInput(wrapper);
        await yearInput.setValue(2025);

        expect(wrapper.props('modelValue')).not.toBeNull();
        // date -1 day because default local hour 11 (10 in UTC) is below UTC 12
        expect(wrapper.props('modelValue')?.getTime()).toEqual((new Date(2023, 11, 31, 11, 0, 0)).getTime());

        // set month 1 higher
        const monthInput = findMonthInput(wrapper);
        await monthInput.trigger('focus');
        await monthInput.trigger('keydown', { key: 'ArrowUp' });

        expect(wrapper.props('modelValue')).not.toBeNull();
        expect(wrapper.props('modelValue')?.getTime()).toEqual((new Date(2023, 11, 31, 11, 0, 0)).getTime());

        // set day 1 higher
        const dayInput = findDayInput(wrapper);
        await dayInput.trigger('focus');
        await dayInput.trigger('keydown', { key: 'ArrowUp' });

        expect(wrapper.props('modelValue')).not.toBeNull();
        expect(wrapper.props('modelValue')?.getTime()).toEqual((new Date(2023, 11, 31, 11, 0, 0)).getTime());
    });

    test('Model value should not be lower than min - default time above min', async () => {
        setFormatterTimeZone('Europe/Brussels');
        const date = new Date(2023, 0, 2, 13, 0, 0);

        const wrapper = mount(DateSelection, {
            props: {
                'min': new Date(2022, 0, 1, 13, 0, 0),
                'modelValue': date,
                'onUpdate:modelValue': async (e) => {
                    await wrapper.setProps({ modelValue: e });
                },
            },
        });

        // set year below min
        const yearInput = findYearInput(wrapper);
        await yearInput.setValue(2021);

        expect(wrapper.props('modelValue')).not.toBeNull();
        // date +1 day because default local hour 13 (12 in UTC) is above UTC 11
        expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2022, 0, 2, 11, 0, 0).getTime());

        // set month 1 lower
        const monthInput = findMonthInput(wrapper);
        await monthInput.trigger('focus');
        await monthInput.trigger('keydown', { key: 'ArrowDown' });

        expect(wrapper.props('modelValue')).not.toBeNull();
        expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2022, 0, 2, 11, 0, 0).getTime());

        // set day 1 lower
        const dayInput = findDayInput(wrapper);
        await dayInput.trigger('focus');
        await dayInput.trigger('keydown', { key: 'ArrowDown' });

        expect(wrapper.props('modelValue')).not.toBeNull();
        expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2022, 0, 2, 11, 0, 0).getTime());
    });

    test('Model value should not be lower than min - default time below min', async () => {
        setFormatterTimeZone('Europe/Brussels');
        const date = new Date(2023, 0, 2, 13, 0, 0);

        const wrapper = mount(DateSelection, {
            props: {
                'min': new Date(2022, 0, 1, 10, 0, 0),
                'modelValue': date,
                'onUpdate:modelValue': async (e) => {
                    await wrapper.setProps({ modelValue: e });
                },
            },
        });

        // set year below min
        const yearInput = findYearInput(wrapper);
        await yearInput.setValue(2021);

        expect(wrapper.props('modelValue')).not.toBeNull();
        // same day because default local hour 10 (9 in UTC) is below UTC 11
        expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2022, 0, 1, 11, 0, 0).getTime());

        // set month 1 lower
        const monthInput = findMonthInput(wrapper);
        await monthInput.trigger('focus');
        await monthInput.trigger('keydown', { key: 'ArrowDown' });

        expect(wrapper.props('modelValue')).not.toBeNull();
        expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2022, 0, 1, 11, 0, 0).getTime());

        // set day 1 lower
        const dayInput = findDayInput(wrapper);
        await dayInput.trigger('focus');
        await dayInput.trigger('keydown', { key: 'ArrowDown' });

        expect(wrapper.props('modelValue')).not.toBeNull();
        expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2022, 0, 1, 11, 0, 0).getTime());
    });

    describe('Model value should have default local time after emit', async () => {
        test('Europe/Brussels', async () => {
            setFormatterTimeZone('Europe/Brussels');
            const date = new Date(2023, 0, 2, 13, 0, 0);

            const wrapper = mount(DateSelection, {
                props: {
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            const dayInput = findDayInput(wrapper);
            await dayInput.setValue(3);

            expect(wrapper.props('modelValue')).not.toBeNull();
            // default time is 12 in local time -> 11 in UTC
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 0, 3, 11, 0, 0).getTime());
        });

        // test for other timezone
        test('Asia/Shanghai', async () => {
            setFormatterTimeZone('Asia/Shanghai');
            const date = new Date(2023, 0, 2, 13, 0, 0);

            const wrapper = mount(DateSelection, {
                props: {
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            const dayInput = findDayInput(wrapper);
            await dayInput.setValue(3);

            expect(wrapper.props('modelValue')).not.toBeNull();
            // default time is 12 in local time -> 4 in UTC
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 0, 3, 4, 0, 0).getTime());
        });
    });

    describe('Model value should have defined local time after emit', async () => {
        test('Europe/Brussels', async () => {
            setFormatterTimeZone('Europe/Brussels');
            const date = new Date(2023, 0, 2, 13, 0, 0);

            const wrapper = mount(DateSelection, {
                props: {
                    'time': { hours: 15, minutes: 5, seconds: 3, millisecond: 2 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            const dayInput = findDayInput(wrapper);
            await dayInput.setValue(3);

            expect(wrapper.props('modelValue')).not.toBeNull();
            // defined time is 15 in local time -> 14 in UTC
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 0, 3, 14, 5, 3, 2).getTime());
        });

        // test for other timezone
        test('Asia/Shanghai', async () => {
            setFormatterTimeZone('Asia/Shanghai');
            const date = new Date(2023, 0, 2, 13, 0, 0);

            const wrapper = mount(DateSelection, {
                props: {
                    'time': { hours: 15, minutes: 5, seconds: 3, millisecond: 2 },
                    'modelValue': date,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            const dayInput = findDayInput(wrapper);
            await dayInput.setValue(3);

            expect(wrapper.props('modelValue')).not.toBeNull();
            // defined time is 15 in local time -> 7 in UTC
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 0, 3, 7, 5, 3, 2).getTime());
        });
    });

    test('Default date should be today with local time 12', async () => {
        // use timezone without daylight saving time (otherwise the test can fail depending on date)
        setFormatterTimeZone('Asia/Shanghai');

        const wrapper = mount(DateSelection, {
            props: {
                'modelValue': null,
                'onUpdate:modelValue': async (e) => {
                    await wrapper.setProps({ modelValue: e });
                },
            },
        });

        const yearInput = findYearInput(wrapper);
        // trigger update
        await yearInput.setValue((new Date()).getFullYear());

        const now = new Date();

        expect(wrapper.props('modelValue')).not.toBeNull();
        // today with local time 12 (11 in UTC)
        expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 4).getTime());
    });

    describe('Should set date to max if impossible to set time between min and max and default time is closer to max', async () => {
        test('min and max on same day', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const wrapper = mount(DateSelection, {
                props: {
                    'min': new Date(2021, 2, 15, 5, 0, 0, 0),
                    'max': new Date(2021, 2, 15, 6, 0, 0, 0),
                    'modelValue': null,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            const yearInput = findYearInput(wrapper);
            // trigger update
            await yearInput.setValue(2021);

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2021, 2, 15, 6, 0, 0, 0).getTime());
        });

        test('min and max on different day', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const wrapper = mount(DateSelection, {
                props: {
                    'min': new Date(2023, 2, 14, 20, 0, 0, 0),
                    'max': new Date(2023, 2, 15, 4, 0, 0, 0),
                    'modelValue': new Date(2023, 2, 16, 5, 0, 0, 0),
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            const yearInput = findYearInput(wrapper);
            // trigger update
            await yearInput.setValue(2023);

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 2, 15, 4, 0, 0, 0).getTime());
        });
    });

    describe('Should set date to min if impossible to set time between min and max and default time is closer to min', async () => {
        test('min and max on some day', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const wrapper = mount(DateSelection, {
                props: {
                    'min': new Date(2023, 2, 15, 13, 0, 0, 0),
                    'max': new Date(2023, 2, 15, 14, 0, 0, 0),
                    'modelValue': null,
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            const yearInput = findYearInput(wrapper);
            // trigger update
            await yearInput.setValue(2023);

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 2, 15, 13, 0, 0, 0).getTime());
        });

        test('min and max on different day', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const wrapper = mount(DateSelection, {
                props: {
                    'min': new Date(2023, 2, 14, 20, 0, 0, 0),
                    'max': new Date(2023, 2, 15, 4, 0, 0, 0),
                    'modelValue': new Date(2023, 2, 14, 22, 0, 0, 0),
                    'onUpdate:modelValue': async (e) => {
                        await wrapper.setProps({ modelValue: e });
                    },
                },
            });

            const yearInput = findYearInput(wrapper);
            // trigger update
            await yearInput.setValue(2023);

            expect(wrapper.props('modelValue')).not.toBeNull();
            expect(wrapper.props('modelValue')?.getTime()).toEqual(new Date(2023, 2, 14, 20, 0, 0, 0).getTime());
        });
    });

    test('Date picker should not be visible on mount', async () => {
        setFormatterTimeZone('Europe/Brussels');

        mount(TestAppWithModalStackComponent, {
            attachTo: document.body,
            props: {
                root: new ComponentWithProperties(DateSelection, {
                    'min': new Date(2023, 2, 14, 20, 0, 0, 0),
                    'max': new Date(2023, 2, 15, 4, 0, 0, 0),
                    'modelValue': new Date(2023, 2, 14, 22, 0, 0, 0),
                    'onUpdate:modelValue': async () => {
                    },
                }),
            },
        });

        // make sure no date picker is visible before focus
        const dateSelectionViewsBefore = document.getElementsByClassName('date-selection-view');
        expect(dateSelectionViewsBefore.length).toBe(0);
    });

    test('Date picker should appear on focus', async () => {
        setFormatterTimeZone('Europe/Brussels');

        const app = mount(TestAppWithModalStackComponent, {
            attachTo: document.body,
            props: {
                root: new ComponentWithProperties(DateSelection, {
                    'min': new Date(2023, 2, 14, 20, 0, 0, 0),
                    'max': new Date(2023, 2, 15, 4, 0, 0, 0),
                    'modelValue': new Date(2023, 2, 14, 22, 0, 0, 0),
                    'onUpdate:modelValue': async () => {
                    },
                }),
            },
        });

        const dateSelection = app.findComponent(DateSelection);
        const yearInput = findYearInput(dateSelection);

        // make sure no date picker is visible before focus
        const dateSelectionViewsBefore = document.getElementsByClassName('date-selection-view');
        expect(dateSelectionViewsBefore.length).toBe(0);

        // act
        await yearInput.trigger('focus');

        // check if date picker visible after focus
        const dateSelectionViews = document.getElementsByClassName('date-selection-view');
        expect(dateSelectionViews.length).toBe(1);
    });

    test('Date picker should disappear on lose focus', async () => {
        setFormatterTimeZone('Europe/Brussels');

        const app = mount(TestAppWithModalStackComponent, {
            attachTo: document.body,
            props: {
                root: new ComponentWithProperties(DateSelection, {
                    'min': new Date(2023, 2, 14, 20, 0, 0, 0),
                    'max': new Date(2023, 2, 15, 4, 0, 0, 0),
                    'modelValue': new Date(2023, 2, 14, 22, 0, 0, 0),
                    'onUpdate:modelValue': async () => {
                    },
                }),
            },
        });

        const dateSelection = app.findComponent(DateSelection);
        const yearInput = findYearInput(dateSelection);

        // date picker should be visible after focus
        await yearInput.trigger('focus');
        const dateSelectionViewsBefore = document.getElementsByClassName('date-selection-view');
        expect(dateSelectionViewsBefore.length).toBe(1);

        // date picker should disappear after clicking outside the date picker
        const datePickerContainers = document.getElementsByClassName('context-menu-container');
        expect(datePickerContainers.length).toBe(1);
        (datePickerContainers[0] as HTMLElement).click();

        // Date selection has a timeout of 0, so we need to wait
        await sleep(0);
        const dateSelectionViews = document.getElementsByClassName('date-selection-view');
        expect(dateSelectionViews.length).toBe(0);
    });

    test('Mobile date text should be visible if mobile', async () => {
        setFormatterTimeZone('Europe/Brussels');

        vi.mocked(useIsMobile).mockReturnValue(true);

        mount(TestAppWithModalStackComponent, {
            attachTo: document.body,
            props: {
                root: new ComponentWithProperties(DateSelection, {
                    'min': new Date(2023, 2, 14, 20, 0, 0, 0),
                    'max': new Date(2023, 2, 15, 4, 0, 0, 0),
                    'modelValue': new Date(2023, 2, 14, 22, 0, 0, 0),
                    'onUpdate:modelValue': async () => {
                    },
                }),
            },
        });

        const mobileTextEl = page.getByTestId('mobile-text');

        await expect.element(mobileTextEl).toBeVisible();
        await expect.element(mobileTextEl).toHaveTextContent('14 maart 2023');
    });

    test('Component should remember state when removed and added to DOM again', async () => {
        setFormatterTimeZone('Europe/Brussels');

        const app = mount(TestAppWithModalStackComponent, {
            attachTo: document.body,
            props: {
                root: new ComponentWithProperties(DateSelection, {
                    'modelValue': new Date(2023, 2, 14, 22, 0, 0, 0),
                    'onUpdate:modelValue': async () => {
                    },
                }),
            },
        });

        const wrapperBefore = app.findComponent(DateSelection);

        const dayInputBefore = findDayInput(wrapperBefore);
        const monthInputBefore = findMonthInput(wrapperBefore);
        const yearInputBefore = findYearInput(wrapperBefore);

        await dayInputBefore.setValue(18);
        await monthInputBefore.setValue(5);
        await yearInputBefore.setValue(2027);

        await app.setProps({ keepAlive: false });
        await app.setProps({ keepAlive: true });

        const wrapper = app.findComponent(DateSelection);

        const dayInput = findDayInput(wrapper);
        const monthInput = findMonthInput(wrapper);
        const yearInput = findYearInput(wrapper);

        expect(dayInput.element).toHaveValue('18');
        expect(monthInput.element).toHaveValue('5');
        expect(yearInput.element).toHaveValue('2027');
    });
});
