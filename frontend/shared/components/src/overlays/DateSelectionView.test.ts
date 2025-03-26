/// <reference types="@vitest/browser/providers/playwright" />
import { Formatter } from '@stamhoofd/utility';
import { mount, VueWrapper } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';
import TestAppWithModalStackComponent from '../../../../tests/helpers/TestAppWithModalStackComponent.vue';

import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { Locator, page } from '@vitest/browser/context';
import { ref } from 'vue';
import DateSelectionView from './DateSelectionView.vue';

describe('DateSelectionView', () => {
    const originalTimezone = Formatter.timezone;
    let wrapper: VueWrapper | undefined;

    afterEach(() => {
        vi.restoreAllMocks();
        setFormatterTimeZone(originalTimezone);
        wrapper?.unmount();
    });

    // #region helpers
    const getDayButtonLocator = (value: number): Locator => {
        return page.getByText(value.toString(), { exact: true });
    };

    const getDayButton = (value: number): HTMLButtonElement => {
        return getDayButtonLocator(value).element() as HTMLButtonElement;
    };

    const selectYearAndMonth = async (date: Date) => {
        await selectYear(date.getFullYear());
        await selectMonth(date.getMonth() + 1);
    };

    const getDayButtonForDate = async (date: Date): Promise<HTMLButtonElement> => {
        await selectYearAndMonth(date);
        return getDayButton(date.getDate());
    };

    const setFormatterTimeZone = (timezone: string) => {
        // https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
        Formatter.timezone = timezone;
    };

    const selectMonth = async (value: number) => {
        await wrapper!.find('select[data-testid="select-month"]').setValue(value);
    };

    const selectYear = async (value: number) => {
        await wrapper!.find('select[data-testid="select-year"]').setValue(value);
    };

    const selectDay = (value: number) => {
        const dayWrapper = wrapper!.findAll('.days button:not(.other-month)').find(day => day.text() === value.toString());
        if (!dayWrapper) {
            throw new Error('day not found: ' + value);
        }

        (dayWrapper.element as HTMLButtonElement).click();
    };
    // #endregion

    describe('Should set date after selection', async () => {
        test('Select day', () => {
            setFormatterTimeZone('Europe/Brussels');

            const onClose = vi.fn();
            const setDate = vi.fn().mockImplementation(() => {
                // do nothing
            });

            wrapper = mount(TestAppWithModalStackComponent, {
                attachTo: document.body,
                props: {
                    root: new ComponentWithProperties(DateSelectionView, {
                        selectedDay: new Date(2023, 2, 14, 22, 0, 0, 0),
                        onClose,
                        setDate,
                    },
                    ),
                },
            });

            // change date to 17 march
            selectDay(17);

            expect(setDate).toHaveBeenCalledWith(new Date(2023, 2, 17, 22, 0, 0, 0));
        });

        test('Select year', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const selectedDay = ref(new Date(2023, 10, 14, 22, 0, 0, 0));

            const onClose = vi.fn();
            const setDate = vi.fn().mockImplementation((value: Date) => {
                // do nothing
                selectedDay.value = value;
            });

            wrapper = mount(TestAppWithModalStackComponent, {
                attachTo: document.body,
                props: {
                    root: new ComponentWithProperties(DateSelectionView, {
                        selectedDay,
                        onClose,
                        setDate,
                    },
                    ),
                },
            });

            await selectYear(2026);
            expect(setDate).toHaveBeenCalledWith(new Date(2026, 10, 14, 22, 0, 0, 0));
        });

        test('Select month', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const selectedDay = ref(new Date(2023, 10, 14, 22, 0, 0, 0));

            const onClose = vi.fn();
            const setDate = vi.fn().mockImplementation((value: Date) => {
                // do nothing
                selectedDay.value = value;
            });

            wrapper = mount(TestAppWithModalStackComponent, {
                attachTo: document.body,
                props: {
                    root: new ComponentWithProperties(DateSelectionView, {
                        selectedDay,
                        onClose,
                        setDate,
                    },
                    ),
                },
            });

            // select month
            await selectMonth(4);
            // switched to summer time -> 21:00
            expect(setDate).toHaveBeenCalledWith(new Date(2023, 3, 14, 21, 0, 0, 0));
        });

        test('Select year, month and day', async () => {
            setFormatterTimeZone('Europe/Brussels');

            const selectedDay = ref(new Date(2023, 10, 14, 22, 0, 0, 0));

            const onClose = vi.fn();
            const setDate = vi.fn().mockImplementation((value: Date) => {
                // do nothing
                selectedDay.value = value;
            });

            wrapper = mount(TestAppWithModalStackComponent, {
                attachTo: document.body,
                props: {
                    root: new ComponentWithProperties(DateSelectionView, {
                        selectedDay,
                        onClose,
                        setDate,
                    },
                    ),
                },
            });

            // select year
            await selectYear(2025);
            expect(setDate).toHaveBeenCalledWith(new Date(2025, 10, 14, 22, 0, 0, 0));

            // select month
            await selectMonth(1);
            expect(setDate).toHaveBeenCalledWith(new Date(2025, 0, 14, 22, 0, 0, 0));

            // select day
            selectDay(7);
            expect(setDate).toHaveBeenCalledWith(new Date(2025, 0, 7, 22, 0, 0, 0));
        });
    });

    test('Date above max or below min should be disabled', async () => {
        setFormatterTimeZone('Europe/Brussels');

        const selectedDay = ref(new Date(2023, 10, 14, 22, 0, 0, 0));

        const onClose = vi.fn();
        const setDate = vi.fn().mockImplementation((value: Date) => {
            // do nothing
            selectedDay.value = value;
        });

        const min = new Date(2022, 11, 5, 22, 0, 0, 0);
        const max = new Date(2024, 3, 20, 22, 0, 0, 0);

        wrapper = mount(TestAppWithModalStackComponent, {
            attachTo: document.body,
            props: {
                root: new ComponentWithProperties(DateSelectionView, {
                    selectedDay,
                    min,
                    max,
                    onClose,
                    setDate,
                },
                ),
            },
        });

        const testCases: [Date, boolean][] = [
            [new Date(2021, 5, 20, 22, 0, 0, 0), true],
            [new Date(2022, 11, 4, 22, 0, 0, 0), true],
            [new Date(2022, 11, 5, 22, 0, 0, 0), false],
            [new Date(2022, 11, 6, 22, 0, 0, 0), false],
            [new Date(2023, 2, 5, 22, 0, 0, 0), false],
            [new Date(2024, 3, 20, 22, 0, 0, 0), false],
            [new Date(2024, 3, 21, 22, 0, 0, 0), true],
            [new Date(2024, 4, 20, 22, 0, 0, 0), true],
            [new Date(2025, 3, 21, 22, 0, 0, 0), true],
        ];

        for (const [date, disabled] of testCases) {
            const button = await getDayButtonForDate(date);
            expect(button.disabled).toBe(disabled);
        }
    });

    test('Should show button for each day in month', async () => {
        setFormatterTimeZone('Europe/Brussels');

        const selectedDay = ref(new Date(2023, 10, 14, 22, 0, 0, 0));

        const onClose = vi.fn();
        const setDate = vi.fn().mockImplementation((value: Date) => {
            // do nothing
            selectedDay.value = value;
        });

        wrapper = mount(TestAppWithModalStackComponent, {
            attachTo: document.body,
            props: {
                root: new ComponentWithProperties(DateSelectionView, {
                    selectedDay,
                    onClose,
                    setDate,
                },
                ),
            },
        });

        const testCases: [Date, number][] = [
            [new Date(2025, 1, 1, 22, 0, 0, 0), 28],
            // leap year
            [new Date(2028, 1, 1, 22, 0, 0, 0), 29],
            [new Date(2023, 0, 5, 22, 0, 0, 0), 31],
            [new Date(2022, 3, 30, 22, 0, 0, 0), 30],
        ];

        for (const [date, daysInMonth] of testCases) {
            await selectYearAndMonth(date);

            // count buttons without class other-month
            const dayButtons = wrapper.findAll('.days button:not(.other-month)');
            expect(dayButtons.length).toBe(daysInMonth);
        }
    });

    test('Should show correct month and set correct date for timezone', async () => {
        const testCases: [timezone: string, selectedDay: Date, expectedDate: Date, expectedMonthSelected: number][] = [
            // +11:00
            ['Asia/Sakhalin', new Date(2025, 3, 30, 14), new Date(2025, 3, 30, 14), 4],
            // // +12:00 (SDT), +13:00 (DST)
            ['Antarctica/South_Pole', new Date(2025, 3, 30, 14), new Date(2025, 3, 30, 14), 4],
            // // +08:00
            ['Asia/Shanghai', new Date(2025, 3, 30, 16), new Date(2025, 3, 30, 16), 4],
            // // +01:00 (SDT)
            ['Europe/Brussels', new Date(2025, 3, 30, 23), new Date(2025, 3, 30, 23), 4],
            // // -11:00
            ['Pacific/Pago_Pago', new Date(2025, 3, 1, 10), new Date(2025, 2, 2, 10), 2],
        ];

        for (const [timezone, selectedDay, expectedDate, expectedMonthSelected] of testCases) {
            setFormatterTimeZone(timezone);

            const selectedDayRef = ref(selectedDay);

            const onClose = vi.fn();
            const setDate = vi.fn().mockImplementation((value: Date) => {
                // do nothing
                selectedDayRef.value = value;
            });

            wrapper = mount(TestAppWithModalStackComponent, {
                attachTo: document.body,
                props: {
                    root: new ComponentWithProperties(DateSelectionView, {
                        selectedDay: selectedDayRef,
                        onClose,
                        setDate,
                    },
                    ),
                },
            });

            const monthValue = (wrapper!.find('select[data-testid="select-month"]').element as HTMLSelectElement).value;
            expect(monthValue).toBe((expectedMonthSelected + 1).toString());

            selectDay(1);
            expect(setDate).toHaveBeenCalledWith(expectedDate);
        }
    });
});
