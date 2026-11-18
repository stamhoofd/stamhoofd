import { AuditLogType, AuditLogTypeCategory, getAuditLogTypeCategory, getAuditLogTypeCategoryName } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import { useAuditLogUIFilterBuilders } from './filterBuilders';
import { GroupUIFilterBuilder, GroupUIFilterMode } from './GroupUIFilter';
import { MultipleChoiceFilterBuilder } from './MultipleChoiceUIFilter';

function getTypeBuilder() {
    const typeBuilder = useAuditLogUIFilterBuilders()[1];
    if (!(typeBuilder instanceof GroupUIFilterBuilder)) {
        throw new Error('Expected the type filter to be a group of category filters');
    }
    return typeBuilder;
}

describe('audit log type filter', () => {
    test('has one filter per category that together contain every type once', () => {
        const typeBuilder = getTypeBuilder();
        const categoryBuilders = typeBuilder.builders as MultipleChoiceFilterBuilder[];

        expect(categoryBuilders.map(b => b.name)).toEqual(Object.values(AuditLogTypeCategory).map(c => getAuditLogTypeCategoryName(c)));

        const types = categoryBuilders.flatMap(b => b.multipleChoiceOptions.map(o => o.value));
        expect(types).toHaveLength(Object.values(AuditLogType).length);
        expect(new Set(types)).toEqual(new Set(Object.values(AuditLogType)));

        for (const [index, category] of Object.values(AuditLogTypeCategory).entries()) {
            for (const option of categoryBuilders[index].multipleChoiceOptions) {
                expect(getAuditLogTypeCategory(option.value as AuditLogType)).toBe(category);
            }
        }
    });

    test('combines categories with or', () => {
        const typeBuilder = getTypeBuilder();
        const [members, registrations] = typeBuilder.builders as MultipleChoiceFilterBuilder[];

        const filter = typeBuilder.create();
        expect(filter.mode).toBe(GroupUIFilterMode.Or);

        const membersFilter = members.create();
        membersFilter.selectedOptions = [...members.multipleChoiceOptions];
        const registrationsFilter = registrations.create();
        registrationsFilter.selectedOptions = [registrations.multipleChoiceOptions[0]];
        filter.filters = [membersFilter, registrationsFilter];

        expect(filter.build()).toEqual({
            $or: [
                { type: { $in: members.multipleChoiceOptions.map(o => o.value) } },
                { type: { $in: [registrations.multipleChoiceOptions[0].value] } },
            ],
        });
    });
});
