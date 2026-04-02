import { Column } from '#tables/classes/Column.ts';
import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import type { PlatformMembership } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ref } from 'vue';
import { usePlatform } from '../../hooks';

type ObjectType = PlatformMembership;

export function useGetPlatformMembershipColumns() {
    const platform = usePlatform();

    const manager = usePlatformManager();
    const owner = useRequestOwner();
    const loading = ref(true);

    manager.value.loadPeriods(false, true, owner).then(() => {
        loading.value = false;
    }).catch((e) => {
        console.error('Failed to load periods in useAdvancedPlatformMembershipUIFilterBuilders', e);
    });

    function getMembershipType(id: string) {
        return platform.value.config.membershipTypes.find(mt => mt.id === id);
    }

    const now = new Date();
    const formatDate = (v: Date | null, width: number) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : $t(`%Gr`);

    const columns: Column<ObjectType, any>[] = [
        new Column<ObjectType, PlatformMembership>({
            id: 'id',
            name: $t('Id'),
            getValue: m => m,
            format: m => m.id,
            minimumWidth: 60,
            recommendedWidth: 100,
            index: 0,
        }),
        new Column<ObjectType, string>({
            id: 'member.name',
            name: $t('Naam lid'),
            getValue: m => m.member.name,
            minimumWidth: 100,
            recommendedWidth: 200,
            enabled: true,
            allowSorting: false
        }),
        new Column<ObjectType, string>({
            id: 'member.name',
            name: $t('Lidnummer'),
            getValue: m => m.member.memberNumber ?? '',
            format: val => val ? val : $t(`%1FW`),
            minimumWidth: 100,
            recommendedWidth: 200,
            enabled: false,
            allowSorting: false
        }),
        new Column<ObjectType, string>({
            id: 'organization.name',
            name: $t('Aangerekend aan'),
            getValue: m => m.organization.name,
            minimumWidth: 100,
            recommendedWidth: 200,
            enabled: true,
            allowSorting: false
        }),
        new Column<ObjectType, string>({
            id: 'organization.uri',
            name: $t('Nummer vereniging'),
            getValue: m => m.organization.uri,
            minimumWidth: 60,
            recommendedWidth: 100,
            enabled: false,
            allowSorting: false
        }),
        new Column<ObjectType, string>({
            id: 'membershipTypeId',
            name: $t('Type'),
            getValue: m => m.membershipTypeId,
            format: (id) => {
                const type = getMembershipType(id);
                if (type) {
                    return type.name;
                }
                return id;
            },
            minimumWidth: 60,
            recommendedWidth: 100,
            enabled: true,
            allowSorting: true
        }),
        new Column<ObjectType, Date>({
            id: 'startDate',
            name: $t('Startdatum'),
            getValue: m => m.startDate,
            format: formatDate,
            minimumWidth: 80,
            recommendedWidth: 200,
            enabled: true,
            allowSorting: true
        }),
        new Column<ObjectType, Date>({
            id: 'endDate',
            name: $t('Einddatum'),
            getValue: m => m.endDate,
            format: formatDate,
            minimumWidth: 80,
            recommendedWidth: 200,
            enabled: true,
            allowSorting: true
        }),
        new Column<ObjectType, Date | null>({
            id: 'expiredDate',
            name: $t('Verloopt op'),
            getValue: m => m.expireDate,
            format: formatDate,
            minimumWidth: 80,
            recommendedWidth: 200,
            enabled: false,
            allowSorting: true
        }),
        new Column<ObjectType, number>({
            id: 'price',
            name: $t(`%1IP`),
            allowSorting: true,
            getValue: m => m.price,
            format: (price) => {
                if (price === 0) {
                    return $t(`%1Mn`);
                }
                return Formatter.price(price);
            },
            getStyle: v => v === 0 ? 'gray' : (v < 0 ? 'negative' : ''),
            minimumWidth: 70,
            recommendedWidth: 80,
            enabled: false,
        }),
        new Column<ObjectType, Date>({
            id: 'createdAt',
            name: $t('Toegevoegd'),
            allowSorting: true,
            getValue: (v) => v.createdAt,
            format: formatDate,
            getStyle: v => v === null ? 'gray' : '',
            minimumWidth: 80,
            recommendedWidth: 220,
            enabled: false
        }),
        new Column<ObjectType, Date | null>({
            id: 'trialUntil',
            name: $t(`Proefperiode`),
            allowSorting: true,
            getValue: m => m.trialUntil,
            format: (value, width) => {
                if (!value) {
                    return $t('Geen');
                }
                const date = formatDate(value, width);

                if (value > now) {
                    return $t('%g8', {date})
                }
                return $t('%16u', {date})
            },
            getStyle: v => v === null ? 'gray' : (v < now ? 'negative' : ''),
            minimumWidth: 70,
            recommendedWidth: 80,
            enabled: false,
        }),
        new Column<ObjectType, number>({
            id: 'freeAmount',
            name: $t('Dagen gratis'),
            allowSorting: true,
            getValue: (v) => v.freeAmount,
            format: v => v ? v.toString() : $t('Geen'),
            getStyle: v => v ?  '' : 'gray',
            minimumWidth: 80,
            recommendedWidth: 220,
            enabled: false
        }),
        new Column<ObjectType, string>({
            id: 'period',
            name: $t('%7Z'),
            allowSorting: false,
            getValue: (v) => {
                const periodId = v.periodId;
                const period = platform.value.periods?.find(p => p.id === periodId);
                if (period) {
                    return period.name;
                }
                return '';
            },
            format: v => v ? v.toString() : $t('?'),
            getStyle: v => v ?  '' : 'gray',
            minimumWidth: 80,
            recommendedWidth: 220,
            enabled: false
        }),
    ];

    return columns;
}
