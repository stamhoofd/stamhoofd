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

    test('Model does not update without user input', async () => {
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

    test('Model does update after user input', async () => {
        // +08:00
        setFormatterTimeZone('Asia/Shanghai');

        // 12:00 in UTC -> 20:00 in Shanghai
        const date = new Date(2023, 0, 1, 12, 0, 0);

        const wrapper = mount(TimeInput, {
            props: {
                'title': 'Phone Number',
                'modelValue': date,
                'onUpdate:modelValue': async (e) => {
                    console.error('update model value: ', e);
                    await wrapper.setProps({ modelValue: e });
                },
            },
        });

        const input = wrapper.find('input');

        // 20:30 in Shangai -> 12:30 in UTC
        await input.setValue('20:30');

        expect(wrapper.props('modelValue').getTime()).toEqual(new Date(2023, 0, 1, 12, 30, 0).getTime());
    });
});
