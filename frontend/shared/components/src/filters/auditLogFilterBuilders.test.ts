import { AuditLogType, AuditLogTypeCategory, auditLogTypeOrder, getAuditLogTypeCategory, getAuditLogTypeCategoryName } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import { getAuditLogUIFilterBuilders } from './filterBuilders';
import { GroupUIFilterBuilder, GroupUIFilterMode } from './GroupUIFilter';
import { MultipleChoiceFilterBuilder } from './MultipleChoiceUIFilter';

function getBuilders(options = { isPlatform: true, isOrganizationLog: false }) {
    const [root, ...categoryBuilders] = getAuditLogUIFilterBuilders(options);
    if (!(root instanceof GroupUIFilterBuilder) || !categoryBuilders.every(b => b instanceof MultipleChoiceFilterBuilder)) {
        throw new Error('Expected a root group with one multiple choice filter per category');
    }
    return { root, categoryBuilders: categoryBuilders as MultipleChoiceFilterBuilder[] };
}

describe('audit log type filters', () => {
    test('has one filter per category that together contain every known type once in the platform admin', () => {
        const { categoryBuilders } = getBuilders();
        const categories = Object.values(AuditLogTypeCategory).filter(c => c !== AuditLogTypeCategory.Other);
        const knownTypes = Object.values(AuditLogType).filter(t => t !== AuditLogType.Unknown);

        expect(categoryBuilders.map(b => b.name)).toEqual(categories.map(c => getAuditLogTypeCategoryName(c)));

        const types = categoryBuilders.flatMap(b => b.multipleChoiceOptions.map(o => o.value));
        expect(types).toHaveLength(knownTypes.length);
        expect(new Set(types)).toEqual(new Set(knownTypes));

        for (const [index, category] of categories.entries()) {
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

    test('leaves out types that never appear in the log of an organization', () => {
        const typesOf = (options: { isPlatform: boolean; isOrganizationLog: boolean }) => {
            const { categoryBuilders } = getBuilders(options);
            expect(categoryBuilders.every(b => b.multipleChoiceOptions.length > 0)).toBe(true);
            return {
                categories: categoryBuilders.map(b => b.name),
                types: new Set(categoryBuilders.flatMap(b => b.multipleChoiceOptions.map(o => o.value))),
            };
        };

        const platformOrganization = typesOf({ isPlatform: true, isOrganizationLog: true });
        expect(platformOrganization.types.has(AuditLogType.MemberPlatformMembershipAdded)).toBe(true);
        expect(platformOrganization.types.has(AuditLogType.EventNotificationAdded)).toBe(true);
        expect(platformOrganization.types.has(AuditLogType.OrganizationEdited)).toBe(true);
        expect(platformOrganization.types.has(AuditLogType.OrganizationAdded)).toBe(false);
        expect(platformOrganization.types.has(AuditLogType.PlatformSettingsChanged)).toBe(false);
        expect(platformOrganization.categories).not.toContain(getAuditLogTypeCategoryName(AuditLogTypeCategory.Organizations));

        const organization = typesOf({ isPlatform: false, isOrganizationLog: true });
        expect(organization.types.has(AuditLogType.MemberPlatformMembershipAdded)).toBe(false);
        expect(organization.types.has(AuditLogType.EventNotificationAdded)).toBe(false);
        expect(organization.types.has(AuditLogType.EventAdded)).toBe(true);
        expect(organization.types.has(AuditLogType.OrganizationEdited)).toBe(true);
        expect(organization.categories).not.toContain(getAuditLogTypeCategoryName(AuditLogTypeCategory.PlatformMemberships));

        const admin = typesOf({ isPlatform: false, isOrganizationLog: false });
        expect(admin.types.has(AuditLogType.OrganizationAdded)).toBe(true);
        expect(admin.types.has(AuditLogType.PlatformSettingsChanged)).toBe(false);
    });

    test('lists new, changed and deleted objects in that order', () => {
        expect(new Set(auditLogTypeOrder)).toEqual(new Set(Object.values(AuditLogType)));
        expect(auditLogTypeOrder).toHaveLength(Object.values(AuditLogType).length);

        const { categoryBuilders } = getBuilders();
        const typesOf = (category: AuditLogTypeCategory) => categoryBuilders
            .find(b => b.name === getAuditLogTypeCategoryName(category))!
            .multipleChoiceOptions.map(o => o.value);

        expect(typesOf(AuditLogTypeCategory.Members)).toEqual([AuditLogType.MemberAdded, AuditLogType.MemberEdited, AuditLogType.MemberDeleted]);
        expect(typesOf(AuditLogTypeCategory.Webshops)).toEqual([
            AuditLogType.WebshopAdded,
            AuditLogType.WebshopEdited,
            AuditLogType.WebshopDeleted,
            AuditLogType.OrderAdded,
            AuditLogType.OrderEdited,
            AuditLogType.OrderDeleted,
        ]);
        expect(typesOf(AuditLogTypeCategory.Emails).slice(5, 10)).toEqual([
            AuditLogType.EmailAddressHardBounced,
            AuditLogType.EmailAddressSoftBounced,
            AuditLogType.EmailAddressMarkedAsSpam,
            AuditLogType.EmailAddressFraudComplaint,
            AuditLogType.EmailAddressUnsubscribed,
        ]);
    });
});
