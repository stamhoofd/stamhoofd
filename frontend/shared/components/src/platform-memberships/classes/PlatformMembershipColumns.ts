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
    const formatDate = (placeholder = $t(`%Gr`)) => (v: Date | null, width: number) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : placeholder;
    const styleDate = (v: Date | null) => v ? '' : 'gray';

    const columns: Column<ObjectType, any>[] = [
        new Column<ObjectType, PlatformMembership>({
            id: 'id',
            name: 'ID',
            getValue: m => m,
            format: m => m.id,
            minimumWidth: 60,
            recommendedWidth: 100,
            getStyle: () => 'code',
            index: 0,
            enabled: false
        }),
        new Column<ObjectType, string>({
            id: 'member.name',
            name: $t('%1Ot'),
            getValue: m => m.member.name,
            minimumWidth: 100,
            recommendedWidth: 200,
            enabled: true,
            allowSorting: false
        }),
        new Column<ObjectType, string>({
            id: 'member.name',
            name: $t('%1PT'),
            getValue: m => m.member.memberNumber ?? '',
            format: val => val ? val : $t(`%1FW`),
            getStyle: val => val ? 'code' : 'gray',
            minimumWidth: 100,
            recommendedWidth: 200,
            enabled: false,
            allowSorting: false
        }),
        new Column<ObjectType, string>({
            id: 'organization.name',
            name: $t('%1PI'),
            getValue: m => m.organization.name,
            getStyleForObject: (m) => {
                // Gray if not yet charged
                return m.balanceItemId ? '' : 'gray'
            },
            minimumWidth: 100,
            recommendedWidth: 200,
            enabled: true,
            allowSorting: false
        }),
        new Column<ObjectType, string>({
            id: 'organization.uri',
            name: $t('%1O1'),
            getValue: m => m.organization.uri,
            minimumWidth: 60,
            recommendedWidth: 100,
            enabled: false,
            allowSorting: false
        }),
        new Column<ObjectType, string>({
            id: 'membershipTypeId',
            name: $t('%1PC'),
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
            name: $t('%1Of'),
            getValue: m => m.startDate,
            format: formatDate(),
            getStyle: styleDate,
            minimumWidth: 80,
            recommendedWidth: 200,
            enabled: true,
            allowSorting: true
        }),
        new Column<ObjectType, Date>({
            id: 'endDate',
            name: $t('%1P8'),
            getValue: m => m.endDate,
            format: formatDate(),
            getStyle: styleDate,
            minimumWidth: 80,
            recommendedWidth: 200,
            enabled: true,
            allowSorting: true
        }),
        new Column<ObjectType, Date | null>({
            id: 'expiredDate',
            description: $t('Datum vóór de einddatum waarop de aansluitingstatus overschakelt op \'verlopen\''),
            name: $t('%1O0'),
            getValue: m => m.expireDate,
            format: formatDate('N.v.t.'),
            getStyle: styleDate,
            minimumWidth: 80,
            recommendedWidth: 200,
            enabled: false,
            allowSorting: true
        }),
        new Column<ObjectType, Date | null>({
            id: 'balanceItem.createdAt',
            name: $t('%1OM'),
            getValue: m => m.balanceItem?.createdAt ?? null,
            format: formatDate($t('%1OR')),
            getStyle: styleDate,
            minimumWidth: 100,
            recommendedWidth: 200,
            enabled: true,
            allowSorting: false
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
        new Column<ObjectType, number | null>({
            id: 'balanceItem.priceOpen',
            name: $t('%1Ni'),
            getValue: m => m.balanceItem?.priceOpen ?? null,
            format: (p) => p === null ? $t('%1OJ') : Formatter.price(p),
            getStyle: (p) => p === null || p === 0 ? 'gray' : (p < 0 ? 'negative' : ''),
            minimumWidth: 100,
            recommendedWidth: 100,
            enabled: false,
            allowSorting: false
        }),
        new Column<ObjectType, number | null>({
            id: 'balanceItem.pricePaid',
            name: $t('%1OD'),
            getValue: m => m.balanceItem?.pricePaid ?? null,
            format: (p) => Formatter.price(p ?? 0),
            getStyle: (p) => p === null || p === 0 ? 'gray' : (p < 0 ? 'negative' : ''),
            minimumWidth: 100,
            recommendedWidth: 100,
            enabled: false,
            allowSorting: false
        }),
        new Column<ObjectType, number | null>({
            id: 'balanceItem.pricePending',
            name: $t('%1PL'),
            getValue: m => m.balanceItem?.pricePending ?? null,
            format: (p) => Formatter.price(p ?? 0),
            getStyle: (p) => p === null || p === 0 ? 'gray' : (p < 0 ? 'negative' : ''),
            minimumWidth: 100,
            recommendedWidth: 120,
            enabled: false,
            allowSorting: false
        }),
        new Column<ObjectType, Date>({
            id: 'createdAt',
            name: $t('%1Oh'),
            allowSorting: true,
            getValue: (v) => v.createdAt,
            format: formatDate(),
            getStyle: styleDate,
            minimumWidth: 80,
            recommendedWidth: 220,
            enabled: true
        }),
        new Column<ObjectType, Date | null>({
            id: 'trialUntil',
            name: $t(`%1O7`),
            allowSorting: true,
            getValue: m => m.trialUntil,
            format: (value, width) => {
                if (!value) {
                    return $t('%1Oc');
                }
                const date = formatDate()(value, width);

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
            name: $t('%1Oo'),
            allowSorting: true,
            getValue: (v) => v.freeAmount,
            format: v => v ? v.toString() : $t('%1Oc'),
            getStyle: v => v ?  '' : 'gray',
            minimumWidth: 80,
            recommendedWidth: 220,
            enabled: false
        }),
        new Column<ObjectType, string>({
            id: 'periodId',
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
            format: v => v ? v.toString() : $t('%1No'),
            getStyle: v => v ?  '' : 'gray',
            minimumWidth: 80,
            recommendedWidth: 220,
            enabled: false
        }),
    ];

    return columns;
}
