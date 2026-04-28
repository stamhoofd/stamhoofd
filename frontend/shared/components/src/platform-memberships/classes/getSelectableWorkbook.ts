import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';

export function getSelectableColumns() {
    const memberCategory = $t('%1PM');
    const organizationCategory = $t('%1PI');
    const balanceItemCategory = $t('%1P6');

    const columns: SelectableColumn[] = [
        new SelectableColumn({
            id: 'id',
            name: $t(`%1P2`),
            description: $t(`%1O2`),
            enabled: true,
        }),
        new SelectableColumn({
            id: 'type',
            name: $t(`%1LP`),
            enabled: true,
        }),
        new SelectableColumn({
            id: 'startDate',
            name: $t(`%1Of`),
            enabled: true,
        }),
        new SelectableColumn({
            id: 'endDate',
            name: $t(`%1P8`),
            enabled: true,
        }),
        new SelectableColumn({
            id: 'price',
            name: $t(`%1IP`),
            enabled: true,
        }),
        new SelectableColumn({
            id: 'priceWithoutDiscount',
            name: $t(`%1Nm`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'trialUntil',
            name: $t(`%1PU`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'freeAmount',
            name: $t(`%1Oo`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'createdAt',
            name: $t(`%1Jc`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'expireDate',
            name: $t(`%1J7`),
            enabled: false,
        }),

        new SelectableColumn({
            id: 'balanceItem.createdAt',
            name: $t(`%1OM`),
            category: balanceItemCategory,
            enabled: true,
        }),

        new SelectableColumn({
            id: 'balanceItem.priceOpen',
            name: $t(`%1Ni`),
            category: balanceItemCategory,
            enabled: true,
        }),

        new SelectableColumn({
            id: 'balanceItem.pricePaid',
            name: $t(`%1OD`),
            category: balanceItemCategory,
            enabled: true,
        }),

        new SelectableColumn({
            id: 'balanceItem.pricePending',
            name: $t(`%1PL`),
            category: balanceItemCategory,
            enabled: true,
        }),

        // member
        new SelectableColumn({
            id: 'member.memberNumber',
            name: $t(`%19j`),
            category: memberCategory,
            enabled: true
        }),
        new SelectableColumn({
            id: 'member.firstName',
            name: $t(`%1MT`),
            category: memberCategory,
            enabled: true
        }),
        new SelectableColumn({
            id: 'member.lastName',
            name: $t(`%1MU`),
            category: memberCategory,
            enabled: true
        }),
        // organization
        new SelectableColumn({
            id: 'organization.name',
            name: $t(`%1Os`),
            category: organizationCategory,
            enabled: true
        }),
        new SelectableColumn({
            id: 'organization.uri',
            name: $t(`%1O1`),
            category: organizationCategory,
            enabled: true
        }),
    ].filter(column => column !== null);

    return columns;
}

export function getSelectableWorkbook() {
    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'platform-memberships',
                name: $t(`%1Nt`),
                columns: getSelectableColumns(),
            }),
        ],
    });
}
