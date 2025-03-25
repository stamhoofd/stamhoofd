/// <reference types="@vitest/browser/providers/playwright" />
import { Formatter } from '@stamhoofd/utility';
import { mount, VueWrapper } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';
import TestAppWithModalStackComponent from '../../../../tests/helpers/TestAppWithModalStackComponent.vue';

import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { page } from '@vitest/browser/context';
import DateSelectionView from './DateSelectionView.vue';

describe('DateSelectionView', () => {
    const originalTimezone = Formatter.timezone;
    let wrapper: VueWrapper | undefined;

    afterEach(() => {
        vi.restoreAllMocks();
        setFormatterTimeZone(originalTimezone);
        wrapper?.unmount();
    });

    const setFormatterTimeZone = (timezone: string) => {
        // https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
        Formatter.timezone = timezone;
    };

    test('Should set date after selection', () => {
        setFormatterTimeZone('Europe/Brussels');

        const onClose = vi.fn();
        const setDate = vi.fn().mockImplementation(() => {
            // do nohting
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
        const day17 = page.getByText('17', { exact: true });
        (day17.element() as HTMLElement).click();

        expect(setDate).toHaveBeenCalledWith(new Date(2023, 2, 17, 22, 0, 0, 0));
    });

    // test swith month and year

    // min and max -> disabled

    // test for specific date number of elements? (generateDays)

    // test timezones
});
