/// <reference types="@vitest/browser/providers/playwright" />
import { Formatter } from '@stamhoofd/utility';
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import TimeInput from './TimeInput.vue';

describe('TimeInput', async () => {
    const originalTimezone = Formatter.timezone;

    afterEach(() => {
        setFormatterTimeZone(originalTimezone);
    });

    const setFormatterTimeZone = (timezone: string) => {
        // https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
        Formatter.timezone = timezone;
    };

    test('Model should not update without user input', async () => {
        setFormatterTimeZone('Asia/Shanghai');

        const date = new Date(2023, 0, 1, 12, 0, 0);

        const wrapper = mount(TimeInput, {
            props: {
                title: 'Phone Number',
                modelValue: date,
            },
        });

        await wrapper.vm.$nextTick();
        expect(wrapper.emitted()).not.toHaveProperty('update:modelValue');
        expect(wrapper.vm.modelValue).toBe(date);
    });

    describe('Model should output correct Date after user input', async () => {
        const date = new Date(2023, 0, 1, 12, 0, 0);

        const testCases: { timezone: string; input: string; output: Date }[] = [

            { // +11:00
                timezone: 'Asia/Sakhalin',
                input: '20:30',
                // 20:30 in Sakhalin -> 09:30 in UTC
                output: new Date(2023, 0, 1, 9, 30, 0),
            },
            { // +12:00 (SDT), +13:00 (DST)
                timezone: 'Antarctica/South_Pole',
                input: '05:00',
                // 05:00 on South_Pole -> 16:00 in UTC
                // the date will be shown as 2023-01-02
                output: new Date(2023, 0, 1, 16, 0, 0),
            },
            { // +08:00
                timezone: 'Asia/Shanghai',
                input: '20:30',
                // 20:30 in Shangai -> 12:30 in UTC
                output: new Date(2023, 0, 1, 12, 30, 0),
            },
            {
                // +01:00 (SDT)
                timezone: 'Europe/Brussels',
                input: '20:15',
                // 19:15 in Brussels -> 19:15 in UTC
                output: new Date(2023, 0, 1, 19, 15, 0),
            },
            {
                // -11:00
                timezone: 'Pacific/Pago_Pago',
                input: '20:30',
                // 20:30 in Pago_Pago -> 7:30 (+ 1 day) in UTC
                output: new Date(2023, 0, 2, 7, 30, 0),
            },
        ];

        for (const { timezone, input, output } of testCases) {
            test(`organization time zone ${timezone}`, async () => {
                setFormatterTimeZone(timezone);

                const wrapper = mount(TimeInput, {
                    props: {
                        'title': 'Phone Number',
                        'modelValue': new Date(date),
                        'onUpdate:modelValue': async (e) => {
                            await wrapper.setProps({ modelValue: e });
                        },
                    },
                });

                const inputWrapper = wrapper.find('input');

                await inputWrapper.setValue(input);

                expect(wrapper.props('modelValue').getTime()).toEqual(output.getTime());
            });
        }
    });
});
