import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';

export function getSelectableColumns() {
    const memberCategory = $t('Lid');
    const organizationCategory = $t('Vereniging');
    const balanceItemCategory = $t('Aanrekening');

    const columns: SelectableColumn[] = [
        new SelectableColumn({
            id: 'id',
            name: $t(`ID aansluiting`),
            description: $t(`Unieke identificatie van de aansluiting`),
            enabled: true,
        }),
        new SelectableColumn({
            id: 'type',
            name: $t(`Type`),
            enabled: true,
        }),
        new SelectableColumn({
            id: 'startDate',
            name: $t(`Startdatum`),
            enabled: true,
        }),
        new SelectableColumn({
            id: 'endDate',
            name: $t(`Einddatum`),
            enabled: true,
        }),
        new SelectableColumn({
            id: 'price',
            name: $t(`Prijs`),
            enabled: true,
        }),
        new SelectableColumn({
            id: 'priceWithoutDiscount',
            name: $t(`Prijs zonder korting`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'trialUntil',
            name: $t(`Einde proefperiode`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'freeAmount',
            name: $t(`Dagen gratis`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'createdAt',
            name: $t(`Aanmaakdatum`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'expireDate',
            name: $t(`Vervaldatum`),
            enabled: false,
        }),

        new SelectableColumn({
            id: 'balanceItem.createdAt',
            name: $t(`Aanrekeningsdatum`),
            category: balanceItemCategory,
            enabled: true,
        }),

        new SelectableColumn({
            id: 'balanceItem.priceOpen',
            name: $t(`Openstaand`),
            category: balanceItemCategory,
            enabled: true,
        }),

        new SelectableColumn({
            id: 'balanceItem.pricePaid',
            name: $t(`Betaald`),
            category: balanceItemCategory,
            enabled: true,
        }),

        new SelectableColumn({
            id: 'balanceItem.pricePending',
            name: $t(`In verwerking`),
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
            name: $t(`Naam`),
            category: organizationCategory,
            enabled: true
        }),
        new SelectableColumn({
            id: 'organization.uri',
            name: $t(`Groepsnummer`),
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
                name: $t(`Aansluitingen`),
                columns: getSelectableColumns(),
            }),
        ],
    });
}
