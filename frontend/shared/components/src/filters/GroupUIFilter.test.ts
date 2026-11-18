import { FilterWrapperMarker } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import { GroupUIFilter, GroupUIFilterBuilder, GroupUIFilterMode } from './GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilter, MultipleChoiceUIFilterOption } from './MultipleChoiceUIFilter';

function createTypeBuilder(name: string, types: string[]) {
    return new MultipleChoiceFilterBuilder({
        name,
        options: types.map(type => new MultipleChoiceUIFilterOption(type, type)),
        wrapper: { type: { $in: FilterWrapperMarker } },
    });
}

describe('GroupUIFilterBuilder default mode', () => {
    const members = createTypeBuilder('Leden', ['MemberAdded', 'MemberDeleted']);
    const webshops = createTypeBuilder('Webshops', ['WebshopAdded', 'OrderAdded']);

    test('combines filters with and by default', () => {
        const builder = new GroupUIFilterBuilder({ name: 'Type', builders: [members, webshops] });
        expect(builder.create().mode).toBe(GroupUIFilterMode.And);
    });

    test('creates groups and parses single filters in the default mode', () => {
        const builder = new GroupUIFilterBuilder({ name: 'Type', builders: [members, webshops], defaultMode: GroupUIFilterMode.Or });

        const filter = builder.create();
        expect(filter.mode).toBe(GroupUIFilterMode.Or);

        const membersFilter = members.create();
        membersFilter.selectedOptions = [members.multipleChoiceOptions[0]];
        const webshopsFilter = webshops.create();
        webshopsFilter.selectedOptions = [webshops.multipleChoiceOptions[1]];
        filter.filters = [membersFilter, webshopsFilter];

        expect(filter.build()).toEqual({
            $or: [
                { type: { $in: ['MemberAdded'] } },
                { type: { $in: ['OrderAdded'] } },
            ],
        });

        const parsed = builder.fromFilter({ type: { $in: ['MemberAdded'] } });
        expect(parsed).toBeInstanceOf(GroupUIFilter);
        expect((parsed as GroupUIFilter).mode).toBe(GroupUIFilterMode.Or);
        expect((parsed as GroupUIFilter).filters[0]).toBeInstanceOf(MultipleChoiceUIFilter);
    });

    test('keeps an explicit mode when parsing', () => {
        const builder = new GroupUIFilterBuilder({ name: 'Type', builders: [members, webshops], defaultMode: GroupUIFilterMode.Or });
        const parsed = builder.fromFilter({
            $and: [
                { type: { $in: ['MemberAdded'] } },
                { type: { $in: ['OrderAdded'] } },
            ],
        }) as GroupUIFilter;

        expect(parsed.mode).toBe(GroupUIFilterMode.And);
        expect(parsed.filters).toHaveLength(2);
    });
});
