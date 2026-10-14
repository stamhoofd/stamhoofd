import type { ComponentWithProperties, PushOptions } from '@simonbackx/vue-app-navigation';
import { Formatter } from '@stamhoofd/utility';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import { GroupUIFilter, GroupUIFilterBuilder } from './GroupUIFilter';
import type { GroupUIFilterEditor, GroupUIFilterEditorProperties } from './GroupUIFilterTypes';
import GroupUIFilterView from './GroupUIFilterView.vue';
import { NumberFilterBuilder, NumberUIFilter } from './NumberUIFilter';
import type { UIFilter, UIFilterBuilder } from './UIFilter';

const show = vi.fn<(options: PushOptions) => Promise<void>>().mockResolvedValue(undefined);

const global = {
    components: { STList, STListItem },
    mocks: { $t, capitalizeFirstLetter: Formatter.capitalizeFirstLetter },
    provide: { reactive_navigation_show: show },
};

function createGroupFilter(existingCondition: NumberUIFilter) {
    const existingBuilder = existingCondition.builder;
    const addedBuilder = new NumberFilterBuilder({ key: 'added', name: 'Added condition' });
    const builder = new GroupUIFilterBuilder({
        name: 'Conditions',
        builders: [existingBuilder, addedBuilder],
    });
    const filter = builder.create();
    filter.filters = [existingCondition];

    const props: GroupUIFilterEditorProperties = {
        filter,
        isGroupFilter: (candidate: UIFilter): candidate is GroupUIFilterEditor => candidate instanceof GroupUIFilter,
        isGroupBuilder: (candidate: UIFilterBuilder) => candidate instanceof GroupUIFilterBuilder,
    };

    return { filter, props, addedBuilder };
}

afterEach(() => {
    show.mockReset();
    vi.restoreAllMocks();
});

describe('GroupUIFilterView', () => {
    test('adding a condition preserves the existing conditions', async () => {
        const existingCondition = new NumberUIFilter({
            builder: new NumberFilterBuilder({ key: 'existing', name: 'Existing condition' }),
            value: 1,
        });
        const { filter, props, addedBuilder } = createGroupFilter(existingCondition);
        const screen = render(GroupUIFilterView, { props, global });

        await screen.getByText('Added condition').click();

        const options = show.mock.calls[0][0];
        const editor = await (options.components[0].properties.promise as () => Promise<ComponentWithProperties>)();
        const saveHandler = editor.properties.saveHandler as (filter: UIFilter) => void;
        const addedCondition = new NumberUIFilter({ builder: addedBuilder, value: 2 });
        saveHandler(addedCondition);

        expect(filter.filters).toHaveLength(2);
        expect(filter.filters.map(condition => condition.builder.name)).toEqual(['Existing condition', 'Added condition']);
        expect(filter.filters.map(condition => (condition as NumberUIFilter).value)).toEqual([1, 2]);
    });

    test('deleting the final condition clears the group without reporting an error', async () => {
        const existingCondition = new NumberUIFilter({
            builder: new NumberFilterBuilder({ key: 'existing', name: 'Existing condition' }),
            value: 1,
        });
        const { filter, props } = createGroupFilter(existingCondition);
        const errors: unknown[] = [];
        render(GroupUIFilterView, {
            props,
            global: { ...global, config: { errorHandler: error => errors.push(error) } },
        });

        document.querySelector<HTMLButtonElement>('.group-ui-filter-row button.trash')!.click();

        expect(errors).toEqual([]);
        expect(filter.filters).toEqual([]);
    });
});
