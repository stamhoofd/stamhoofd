import { AuditLogType, AuditLogTypeCategory, getAuditLogTypeCategory, getAuditLogTypeCategoryName } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import { useAuditLogUIFilterBuilders } from './filterBuilders';
import { GroupUIFilterBuilder, GroupUIFilterMode } from './GroupUIFilter';
import { MultipleChoiceFilterBuilder } from './MultipleChoiceUIFilter';

function getBuilders() {
    const [root, ...categoryBuilders] = useAuditLogUIFilterBuilders();
    if (!(root instanceof GroupUIFilterBuilder) || !categoryBuilders.every(b => b instanceof MultipleChoiceFilterBuilder)) {
        throw new Error('Expected a root group with one multiple choice filter per category');
    }
    return { root, categoryBuilders: categoryBuilders as MultipleChoiceFilterBuilder[] };
}

describe('audit log type filters', () => {
    test('has one filter per category that together contain every type once', () => {
        const { categoryBuilders } = getBuilders();

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

    test('combines categories that are added separately with or', () => {
        const { root, categoryBuilders } = getBuilders();
        const [members, registrations] = categoryBuilders;

        const filter = root.create();
        expect(filter.mode).toBe(GroupUIFilterMode.Or);

        // Same as adding each filter from the filter menu
        const membersFilter = members.create();
        membersFilter.selectedOptions = [...members.multipleChoiceOptions];
        filter.filters.push(membersFilter.flatten()!);

        const registrationsFilter = registrations.create();
        registrationsFilter.selectedOptions = [registrations.multipleChoiceOptions[0]];
        filter.filters.push(registrationsFilter.flatten()!);

        expect(filter.build()).toEqual({
            $or: [
                { type: { $in: members.multipleChoiceOptions.map(o => o.value) } },
                { type: { $in: [registrations.multipleChoiceOptions[0].value] } },
            ],
        });
    });
});
