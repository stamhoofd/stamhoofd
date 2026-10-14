import type { ComponentWithProperties, PushOptions } from '@simonbackx/vue-app-navigation';
import { FilterWrapperMarker } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { toRaw } from 'vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import { GroupUIFilterBuilder } from './GroupUIFilter';
import type { GroupUIFilter } from './GroupUIFilter';
import { GroupUIFilterMode } from './GroupUIFilterTypes';
import type { GroupUIFilterEditorProperties } from './GroupUIFilterTypes';
import GroupUIFilterView from './GroupUIFilterView.vue';
import { NumberFilterBuilder, NumberUIFilter } from './NumberUIFilter';
import type { UIFilter } from './UIFilter';

const show = vi.fn<(options: PushOptions) => Promise<void>>().mockResolvedValue(undefined);

const global = {
    components: { STList, STListItem },
    mocks: { $t, capitalizeFirstLetter: Formatter.capitalizeFirstLetter },
    provide: { reactive_navigation_show: show },
};

async function getEditorProperties(filter: GroupUIFilter) {
    const component = filter.getComponent();
    const editor = await (component.properties.promise as () => Promise<ComponentWithProperties>)();
    return editor.properties as GroupUIFilterEditorProperties;
}

async function createGroupFilter(existingCondition: NumberUIFilter) {
    const existingBuilder = existingCondition.builder;
    const addedBuilder = new NumberFilterBuilder({ key: 'added', name: 'Added condition' });
    const builder = new GroupUIFilterBuilder({
        name: 'Conditions',
        builders: [existingBuilder, addedBuilder],
    });
    const filter = builder.create();
    filter.filters = [existingCondition];

    const props = await getEditorProperties(filter);

    return { filter, props, addedBuilder };
}

afterEach(() => {
    show.mockReset();
    vi.restoreAllMocks();
});

describe('GroupUIFilterView', () => {
    test('adding a condition after replacing the filter only updates the replacement', async () => {
        const existingCondition = new NumberUIFilter({
            builder: new NumberFilterBuilder({ key: 'existing', name: 'Existing condition' }),
            value: 1,
        });
        const { filter, props, addedBuilder } = await createGroupFilter(existingCondition);
        const replacement = filter.builder.create();
        const replacementCondition = new NumberUIFilter({ builder: existingCondition.builder, value: 3 });
        replacement.filters = [replacementCondition];
        const screen = render(GroupUIFilterView, { props, global });

        await screen.rerender({ filter: replacement });
        await screen.getByText('Added condition').click();

        const options = show.mock.calls[0][0];
        const editor = await (options.components[0].properties.promise as () => Promise<ComponentWithProperties>)();
        const saveHandler = editor.properties.saveHandler as (filter: UIFilter) => void;
        saveHandler(new NumberUIFilter({ builder: addedBuilder, value: 2 }));

        expect(filter.filters).toEqual([existingCondition]);
        expect(replacement.filters.map(condition => (condition as NumberUIFilter).value)).toEqual([3, 2]);
    });

    test('adding a condition preserves the existing conditions', async () => {
        const existingCondition = new NumberUIFilter({
            builder: new NumberFilterBuilder({ key: 'existing', name: 'Existing condition' }),
            value: 1,
        });
        const { filter, props, addedBuilder } = await createGroupFilter(existingCondition);
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
        const { filter, props } = await createGroupFilter(existingCondition);
        const errors: unknown[] = [];
        render(GroupUIFilterView, {
            props,
            global: { ...global, config: { errorHandler: error => errors.push(error) } },
        });

        document.querySelector<HTMLButtonElement>('.group-ui-filter-row button.trash')!.click();

        expect(errors).toEqual([]);
        expect(filter.filters).toEqual([]);
    });

    test('the model supplies predicates that distinguish groups from ordinary conditions', async () => {
        const conditionBuilder = new NumberFilterBuilder({ key: 'age', name: 'Age' });
        const builder = new GroupUIFilterBuilder({ builders: [conditionBuilder] });
        const filter = builder.create();
        const props = await getEditorProperties(filter);

        expect(toRaw(props.filter)).toBe(filter);
        expect(props.isGroupFilter(filter)).toBe(true);
        expect(props.isGroupFilter(conditionBuilder.create())).toBe(false);
        expect(props.isGroupBuilder(builder)).toBe(true);
        expect(props.isGroupBuilder(conditionBuilder)).toBe(false);
    });

    test.each(['wrapper', 'wrapFilter'] as const)('nested groups render recursively while a group with %s opens an editor', async (wrapping) => {
        const conditionBuilder = new NumberFilterBuilder({ key: 'age', name: 'Age' });
        const builder = new GroupUIFilterBuilder({ builders: [conditionBuilder] });
        const nested = builder.create();
        nested.mode = GroupUIFilterMode.Or;
        nested.filters = [conditionBuilder.create(), conditionBuilder.create()];
        const wrappedBuilder = new GroupUIFilterBuilder({
            name: 'Wrapped conditions',
            builders: [conditionBuilder],
            ...(wrapping === 'wrapper'
                ? { wrapper: { wrapped: FilterWrapperMarker } }
                : { wrapFilter: filter => ({ wrapped: filter }) }),
        });
        const wrapped = wrappedBuilder.create();
        wrapped.filters = [conditionBuilder.create()];
        const filter = builder.create();
        filter.filters = [conditionBuilder.create(), nested, wrapped];
        const props = await getEditorProperties(filter);
        const screen = render(GroupUIFilterView, { props, global });

        expect(screen.container.querySelectorAll('.group-ui-filter-list')).toHaveLength(2);
        expect(screen.container.querySelectorAll('.group-ui-filter-list .group-ui-filter-list .group-ui-filter-row')).toHaveLength(2);
        const wrappedRow = screen.container.querySelectorAll<HTMLElement>('.group-ui-filter-row')[4];
        wrappedRow.click();

        expect(show).toHaveBeenCalledOnce();
        const options = show.mock.calls[0][0];
        const editor = await (options.components[0].properties.promise as () => Promise<ComponentWithProperties>)();
        expect(toRaw(editor.properties.filter)).toBe(wrapped);
    });

    test.each(['unwrapped', 'wrapped', 'hidden'] as const)('builder visibility respects a first %s group builder', async (kind) => {
        const conditionBuilder = new NumberFilterBuilder({ key: 'age', name: 'Age' });
        const groupBuilder = new GroupUIFilterBuilder({
            name: 'Group conditions',
            builders: [conditionBuilder],
            wrapper: kind === 'wrapped' ? { wrapped: FilterWrapperMarker } : undefined,
            allowCreation: kind === 'hidden' ? false : undefined,
        });
        const hiddenBuilder = new GroupUIFilterBuilder({ name: 'Hidden condition', builders: [conditionBuilder], allowCreation: false });
        const builder = new GroupUIFilterBuilder({ builders: [groupBuilder, conditionBuilder, hiddenBuilder] });
        const props = await getEditorProperties(builder.create());
        const screen = render(GroupUIFilterView, { props, global });

        await expect.element(screen.getByText('Age', { exact: true })).toBeVisible();
        await expect.element(screen.getByText('Hidden condition', { exact: true })).not.toBeInTheDocument();
        if (kind === 'wrapped') {
            await expect.element(screen.getByText('Group conditions', { exact: true })).toBeVisible();
        }
        else {
            await expect.element(screen.getByText('Group conditions', { exact: true })).not.toBeInTheDocument();
        }
    });
});
