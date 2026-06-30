import { NumberFilterFormat } from '#filters/NumberFilterFormat.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import type { WrapperFilter } from '@stamhoofd/structures';
import { BalanceItemType, FilterWrapperMarker, GroupType, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, PaymentType, PaymentTypeHelper, getBalanceItemTypeName } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { DateFilterBuilder } from '../DateUIFilter';
import { getCustomerUIFilterBuilders } from '../filterBuilders';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { NumberFilterBuilder } from '../NumberUIFilter';
import { RelationFilterBuilder } from '../RelationUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import type { UIFilterBuilders } from '../UIFilter';
import { useEventGroupsRelationFetcher } from '../relation-fetchers/event-groups';
import { useGroupsRelationFetcher } from '../relation-fetchers/groups';
import { useOrganizationsRelationFetcher } from '../relation-fetchers/organizations';
import { useWebshopsRelationFetcher } from '../relation-fetchers/webshops';
import { useGetOrganizationUIFilterBuilders } from './organizations';
import { usePlatform } from '#hooks/usePlatform.ts';

export class PaymentFilterBuilders {
    static get method() {
        return new MultipleChoiceFilterBuilder({
            name: $t(`%M7`),
            options: Object.values(PaymentMethod).filter(m => m !== PaymentMethod.AccountDeductions).map((method) => {
                return new MultipleChoiceUIFilterOption(PaymentMethodHelper.getNameCapitalized(method), method);
            }),
            wrapper: {
                method: {
                    $in: FilterWrapperMarker,
                },
            },
        });
    }

    static get methodForMembershipOrganization() {
        return new MultipleChoiceFilterBuilder({
            name: $t(`%M7`),
            options: Object.values(PaymentMethod).map((method) => {
                return new MultipleChoiceUIFilterOption(PaymentMethodHelper.getNameCapitalized(method), method);
            }),
            wrapper: {
                method: {
                    $in: FilterWrapperMarker,
                },
            },
        });
    }

    static get status() {
        return new MultipleChoiceFilterBuilder({
            name: $t(`%1A`),
            options: Object.values(PaymentStatus).map((method) => {
                return new MultipleChoiceUIFilterOption(PaymentStatusHelper.getNameCapitalized(method), method);
            }),
            wrapper: {
                status: {
                    $in: FilterWrapperMarker,
                },
            },
        });
    }

    static get invoiced() {
        return new MultipleChoiceFilterBuilder({
            name: $t(`%1JO`),
            options: [
                new MultipleChoiceUIFilterOption($t('%1JB'), null),
            ],
            wrapper: {
                invoiceId: FilterWrapperMarker,
            },
        });
    }

    static get type() {
        return new MultipleChoiceFilterBuilder({
            name: $t(`%1LP`),
            options: Object.values(PaymentType).map((method) => {
                return new MultipleChoiceUIFilterOption(Formatter.capitalizeFirstLetter(PaymentTypeHelper.getName(method)), method);
            }),
            wrapper: {
                type: {
                    $in: FilterWrapperMarker,
                },
            },
        });
    }

    static get price() {
        return new NumberFilterBuilder({
            name: $t(`%1IP`),
            type: NumberFilterFormat.Currency,
            key: 'price',
        });
    }

    static get paidAt() {
        return new DateFilterBuilder({
            name: $t(`%1Jb`),
            key: 'paidAt',
        });
    }

    static get createdAt() {
        return new DateFilterBuilder({
            name: $t(`%1Jc`),
            key: 'createdAt',
        });
    }

    static get transferDescription() {
        return new StringFilterBuilder({
            name: $t('%ox'),
            key: 'transferDescription',
        });
    }
}

export function usePaymentsUIFilterBuilders() {
    const organization = useOrganization();
    const platform = usePlatform();
    const groupsRelationFetcher = useGroupsRelationFetcher();
    const eventGroupsRelationFetcher = useEventGroupsRelationFetcher();
    const webshopsRelationFetcher = useWebshopsRelationFetcher();
    const organizationsRelationFetcher = useOrganizationsRelationFetcher();
    const { getOrganizationUIFilterBuilders } = useGetOrganizationUIFilterBuilders();

    const balanceItemRegistrationWrapper: WrapperFilter = {
        balanceItem: {
            registration: FilterWrapperMarker,
        },
    };

    const balanceItemBuilders: UIFilterBuilders = [
        new MultipleChoiceFilterBuilder({
            name: $t('%1B'),
            options: Object.values(BalanceItemType).map(type => new MultipleChoiceUIFilterOption(getBalanceItemTypeName(type), type)),
            wrapper: {
                balanceItem: {
                    type: {
                        $in: FilterWrapperMarker,
                    },
                },
            },
        }),
        new RelationFilterBuilder({
            name: $t('%14Z'),
            type: GroupType.Membership,
            key: 'groupId',
            wrapper: balanceItemRegistrationWrapper,
            relationFetcher: groupsRelationFetcher({ type: GroupType.Membership }),
        }),
        new RelationFilterBuilder({
            name: $t('%1IR'),
            type: GroupType.EventRegistration,
            key: 'groupId',
            wrapper: balanceItemRegistrationWrapper,
            relationFetcher: eventGroupsRelationFetcher(),
        }),
        new RelationFilterBuilder({
            name: $t('%1AV'),
            key: 'webshopId',
            wrapper: { balanceItem: { order: FilterWrapperMarker } } as WrapperFilter,
            relationFetcher: webshopsRelationFetcher,
        }),
    ];

    balanceItemBuilders.unshift(new GroupUIFilterBuilder({ builders: balanceItemBuilders }));

    const builders: UIFilterBuilders = [
        (!organization.value || organization.value.id === platform.value.membershipOrganizationId) && STAMHOOFD.userMode === 'organization' ? PaymentFilterBuilders.methodForMembershipOrganization : PaymentFilterBuilders.method,
        PaymentFilterBuilders.status,
        PaymentFilterBuilders.type,
        PaymentFilterBuilders.price,
        PaymentFilterBuilders.paidAt,
        PaymentFilterBuilders.createdAt,
        PaymentFilterBuilders.transferDescription,
        getCustomerUIFilterBuilders()[0],
        new GroupUIFilterBuilder({
            name: $t('%Ly'),
            description: $t('%1dk'),
            builders: balanceItemBuilders,
            wrapper: { balanceItemPayments: FilterWrapperMarker } as WrapperFilter,
        }),
    ];

    if (!organization.value || organization.value.id === platform.value.membershipOrganizationId) {
        const payingOrganizationBuilders = getOrganizationUIFilterBuilders();

        // Also allow to specifically select organizations
        const organizationRelationFilter = new RelationFilterBuilder({
            name: $t('Vereniging'),
            key: 'id',
            wrapper: FilterWrapperMarker,
            relationFetcher: organizationsRelationFetcher,
        });
        payingOrganizationBuilders.splice(1, 0, organizationRelationFilter);

        builders.push(new GroupUIFilterBuilder({
            name: $t('Betalende vereniging'),
            builders: payingOrganizationBuilders,
            wrapper: { payingOrganization: FilterWrapperMarker } as WrapperFilter,
        }));
    }

    if (organization.value && organization.value.meta.invoicesEnabled) {
        builders.push(PaymentFilterBuilders.invoiced);
    }

    builders.unshift(
        new GroupUIFilterBuilder({
            builders,
        }),
    );

    return builders;
};
