import { Formatter } from '@stamhoofd/utility';
import { mount } from '@vue/test-utils';
import { userEvent } from 'vitest/browser';
import { afterEach, describe, expect, test } from 'vitest';
import DateSelection from './DateSelection.vue';

describe('DateSelection', async () => {
    const originalTimezone = Formatter.timezone;

    afterEach(() => {
        Formatter.timezone = originalTimezone;
    });

    async function createWrapper(props: Record<string, unknown>) {
        let resolveWrapper!: (w: ReturnType<typeof mount>) => void;
        const getWrapper = new Promise<ReturnType<typeof mount>>(r => (resolveWrapper = r));

        const wrapper = mount(DateSelection, {
            attachTo: document.body,
            props: {
                ...props,
                'onUpdate:modelValue': async (e: Date | null) => {
                    await (await getWrapper).setProps({ modelValue: e });
                },
            },
        });

        resolveWrapper(wrapper);
        return wrapper;
    }

    function getInputs(wrapper: ReturnType<typeof mount>) {
        const all = wrapper.findAll('input');
        return { dayEl: all[0].element, monthEl: all[1].element, yearEl: all[2].element };
    }

    test('model does not update without user input', async () => {
        Formatter.timezone = 'UTC';
        const date = new Date(Date.UTC(2024, 5, 15, 12, 0, 0));

        const wrapper = await createWrapper({ modelValue: date });
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted()).not.toHaveProperty('update:modelValue');
    });

    test('inputs display correct day, month, year from model', async () => {
        Formatter.timezone = 'UTC';
        // June 15, 2024 at noon UTC
        const date = new Date(Date.UTC(2024, 5, 15, 12, 0, 0));

        const wrapper = await createWrapper({ modelValue: date });

        const { dayEl, monthEl, yearEl } = getInputs(wrapper);
        expect(dayEl).toHaveValue('15');
        expect(monthEl).toHaveValue('6');
        expect(yearEl).toHaveValue('2024');
    });

    test('inputs update when model changes from parent', async () => {
        Formatter.timezone = 'UTC';
        const date1 = new Date(Date.UTC(2024, 5, 15, 12, 0, 0)); // June 15, 2024
        const date2 = new Date(Date.UTC(2023, 2, 20, 12, 0, 0)); // March 20, 2023

        const wrapper = await createWrapper({ modelValue: date1 });

        await wrapper.setProps({ modelValue: date2 });
        await wrapper.vm.$nextTick();

        const { dayEl, monthEl, yearEl } = getInputs(wrapper);
        expect(dayEl).toHaveValue('20');
        expect(monthEl).toHaveValue('3');
        expect(yearEl).toHaveValue('2023');
    });

    test('model updates when user types a complete date', async () => {
        Formatter.timezone = 'UTC';
        const initial = new Date(Date.UTC(2024, 5, 15, 12, 0, 0));

        const wrapper = await createWrapper({
            modelValue: initial,
            min: new Date(Date.UTC(2000, 0, 1, 12, 0, 0)),
            max: new Date(Date.UTC(2030, 6, 1, 12, 0, 0)),
        });

        const { dayEl } = getInputs(wrapper);

        // Click day input, clear it and type a new date.
        // Auto-advance: "20" fills day (length 2), "3" fills month ("30" > 12), "2023" fills year (length 4).
        await userEvent.click(dayEl);
        await userEvent.clear(dayEl);
        await userEvent.keyboard('2032023');

        await userEvent.click(document.body);
        await wrapper.vm.$nextTick();

        const emitted = wrapper.props('modelValue') as Date;
        expect(Formatter.year(emitted)).toBe(2023);
        expect(Formatter.monthNumber(emitted)).toBe(3);
        expect(Formatter.day(emitted)).toBe('20');
    });

    describe('props.min and props.max year constraints', () => {
        test('year is clamped to props.max year when user types a value beyond max', async () => {
            Formatter.timezone = 'UTC';
            // max year = 2025
            const max = new Date(Date.UTC(2025, 6, 1, 12, 0, 0));

            const wrapper = await createWrapper({
                modelValue: new Date(Date.UTC(2024, 5, 15, 12, 0, 0)),
                max,
            });

            const { yearEl } = getInputs(wrapper);

            await userEvent.click(yearEl);
            await userEvent.clear(yearEl);
            await userEvent.keyboard('2030');

            await userEvent.click(document.body);
            await wrapper.vm.$nextTick();

            const emitted = wrapper.props('modelValue') as Date;
            expect(Formatter.year(emitted)).toBeLessThanOrEqual(2025);
        });

        test('year is clamped to props.min year when user types a value below min', async () => {
            Formatter.timezone = 'UTC';
            // min year = 2020
            const min = new Date(Date.UTC(2020, 0, 1, 12, 0, 0));

            const wrapper = await createWrapper({
                modelValue: new Date(Date.UTC(2024, 5, 15, 12, 0, 0)),
                min,
            });

            const { yearEl } = getInputs(wrapper);

            await userEvent.click(yearEl);
            await userEvent.clear(yearEl);
            await userEvent.keyboard('1990');

            await userEvent.click(document.body);
            await wrapper.vm.$nextTick();

            const emitted = wrapper.props('modelValue') as Date;
            expect(Formatter.year(emitted)).toBeGreaterThanOrEqual(2020);
        });

        describe('ArrowUp / ArrowDown on year input', () => {
            test('ArrowUp increments year and stops at props.max year', async () => {
                Formatter.timezone = 'UTC';
                // model year=2024, max year=2025
                const wrapper = await createWrapper({
                    modelValue: new Date(Date.UTC(2024, 5, 15, 12, 0, 0)),
                    max: new Date(Date.UTC(2025, 6, 1, 12, 0, 0)),
                });

                const { yearEl } = getInputs(wrapper);

                await userEvent.click(yearEl);
                await userEvent.keyboard('[ArrowUp]');
                expect(yearEl).toHaveValue('2025');

                // At max — must not go further
                await userEvent.keyboard('[ArrowUp]');
                expect(yearEl).toHaveValue('2025');
            });

            test('ArrowDown decrements year and stops at props.min year', async () => {
                Formatter.timezone = 'UTC';
                // model year=2024, min year=2023
                const wrapper = await createWrapper({
                    modelValue: new Date(Date.UTC(2024, 5, 15, 12, 0, 0)),
                    min: new Date(Date.UTC(2023, 0, 1, 12, 0, 0)),
                });

                const { yearEl } = getInputs(wrapper);

                await userEvent.click(yearEl);
                await userEvent.keyboard('[ArrowDown]');
                expect(yearEl).toHaveValue('2023');

                // At min — must not go further
                await userEvent.keyboard('[ArrowDown]');
                expect(yearEl).toHaveValue('2023');
            });

            test('ArrowUp respects updated props.max after reactive prop change', async () => {
                Formatter.timezone = 'UTC';
                // Start with max year=2026, model year=2024
                const wrapper = await createWrapper({
                    modelValue: new Date(Date.UTC(2024, 5, 15, 12, 0, 0)),
                    max: new Date(Date.UTC(2026, 6, 1, 12, 0, 0)),
                });

                // Tighten the max to year 2025 after mount
                await wrapper.setProps({ max: new Date(Date.UTC(2025, 6, 1, 12, 0, 0)) });

                const { yearEl } = getInputs(wrapper);

                await userEvent.click(yearEl);
                await userEvent.keyboard('[ArrowUp]');
                expect(yearEl).toHaveValue('2025');

                // Must not exceed the updated max (2025), not the old one (2026)
                await userEvent.keyboard('[ArrowUp]');
                expect(yearEl).toHaveValue('2025');
            });

            test('ArrowDown respects updated props.min after reactive prop change', async () => {
                Formatter.timezone = 'UTC';
                // Start with min year=2022, model year=2024
                const wrapper = await createWrapper({
                    modelValue: new Date(Date.UTC(2024, 5, 15, 12, 0, 0)),
                    min: new Date(Date.UTC(2022, 0, 1, 12, 0, 0)),
                });

                // Raise the min to year 2023 after mount
                await wrapper.setProps({ min: new Date(Date.UTC(2023, 0, 1, 12, 0, 0)) });

                const { yearEl } = getInputs(wrapper);

                await userEvent.click(yearEl);
                await userEvent.keyboard('[ArrowDown]');
                expect(yearEl).toHaveValue('2023');

                // Must not go below the updated min (2023), not the old one (2022)
                await userEvent.keyboard('[ArrowDown]');
                expect(yearEl).toHaveValue('2023');
            });
        });
    });
});
