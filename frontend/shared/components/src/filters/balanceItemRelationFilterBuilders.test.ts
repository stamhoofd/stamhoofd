import { FilterWrapperMarker, Organization, OrganizationRegistrationPeriod, Platform, RegistrationPeriod } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';
import { defineComponent } from 'vue';
import { useBalanceItemRelationFilterBuilders } from './filterBuilders';
import type { RelationFilterBuilder } from './RelationUIFilter';

function getGroupsSubFilter(context: { organization: Organization | null; platform: Platform }) {
    let builder: RelationFilterBuilder<any> | null = null;

    render(defineComponent({
        setup() {
            const getBuilders = useBalanceItemRelationFilterBuilders();
            builder = getBuilders({
                registrationWrapper: { registration: FilterWrapperMarker },
                orderWrapper: { order: FilterWrapperMarker },
            })[0] as RelationFilterBuilder<any>;
            return () => null;
        },
    }), {
        global: {
            provide: {
                $context: context,
            },
        },
    });

    return builder!.relationFetcher.subFilter!;
}

const periodOptions = ['previous', 'current', 'next'].map(id => ({ name: id, filter: { periodId: id } }));

describe('useBalanceItemRelationFilterBuilders', () => {
    test('defaults the group period to the organization period and keeps all periods available', () => {
        const subFilter = getGroupsSubFilter({
            organization: Organization.create({
                period: OrganizationRegistrationPeriod.create({
                    period: RegistrationPeriod.create({ id: 'current' }),
                }),
            }),
            platform: Platform.create({ period: RegistrationPeriod.create({ id: 'next' }) }),
        });

        expect(subFilter.isRequired).toBe(false);
        expect(subFilter.getDefaultOption(periodOptions).filter).toEqual({ periodId: 'current' });
    });

    test('defaults the group period to the platform period without organization', () => {
        const subFilter = getGroupsSubFilter({
            organization: null,
            platform: Platform.create({ period: RegistrationPeriod.create({ id: 'next' }) }),
        });

        expect(subFilter.getDefaultOption(periodOptions).filter).toEqual({ periodId: 'next' });
    });
});
