<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main>
            <h1>{{ title }}</h1>
            <template v-if="overview">
                <p>
                    {{ $t('Een schatting op basis van de huidige termijnen.') }}
                    <a :href="$domains.getDocs('bewaartermijnen')" class="inline-link" target="_blank" rel="noopener">{{ $t('%19t') }}</a>
                </p>
                <p class="style-description-small">
                    {{ $t('Berekend op {date}', { date: formatDateTime(overview.calculatedAt) }) }}
                </p>

                <template v-if="groups.length === 0">
                    <hr>
                    <p class="info-box">
                        {{ $t('Met de huidige termijnen wordt er voorlopig niets verwerkt.') }}
                    </p>
                </template>
                <template v-for="group of groups" :key="group.key">
                    <hr>
                    <h2>{{ group.title }}</h2>
                    <STList :data-testid="'data-retention-overview-' + group.key">
                        <STListItem v-for="item of group.items" :key="item.key">
                            <p class="style-description">
                                {{ item.title }}
                            </p>
                            <template #right>
                                <span class="style-description">{{ formatNumber(item.amount) }}</span>
                            </template>
                        </STListItem>
                    </STList>
                </template>

                <template v-if="heldRows.length > 0">
                    <hr>
                    <h2>{{ $t('Blijft voorlopig bewaard') }}</h2>
                    <p>{{ $t('De termijn is al verstreken, maar deze gegevens blijven bewaard zolang de reden geldt.') }}</p>
                    <STList>
                        <STListItem v-for="row of heldRows" :key="row.key">
                            <h3 class="style-title-list">
                                {{ row.title }}
                            </h3>
                            <p class="style-description-small">
                                {{ row.reason }}
                            </p>
                        </STListItem>
                    </STList>
                </template>
            </template>
            <p v-else class="info-box">
                {{ $t('Het overzicht wordt ’s nachts berekend. Kom morgen terug om te zien wat er staat te gebeuren.') }}
            </p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import type { DataRetentionCount, DataRetentionOverview } from '@stamhoofd/structures';
import { DataRetentionAction, DataRetentionCategory, DataRetentionHoldReason, getDataRetentionActionTitle } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { DateTime } from 'luxon';
import { computed } from 'vue';

import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';

const props = defineProps<{
    overview: DataRetentionOverview | null;
}>();

const title = $t('Wat staat er te gebeuren?');

function formatNumber(value: number) {
    return Formatter.integer(value);
}

function formatDateTime(date: Date) {
    return Formatter.dateTime(date);
}


function getHeldTitle(category: DataRetentionCategory, amount: number): string {
    const count = formatNumber(amount);
    switch (category) {
        case DataRetentionCategory.Members:
            return $t('{count} leden', { count });
        case DataRetentionCategory.SensitiveData:
            return $t('Gevoelige gegevens van {count} leden', { count });
        case DataRetentionCategory.Documents:
            return $t('{count} documenten', { count });
        case DataRetentionCategory.Accounts:
            return $t('{count} accounts', { count });
        case DataRetentionCategory.Orders:
            return $t('{count} bestellingen', { count });
        case DataRetentionCategory.Emails:
            return $t('{count} e-mails', { count });
        case DataRetentionCategory.AuditLogs:
            return $t('{count} logboekregels', { count });
    }
}

function getHoldReason(reason: DataRetentionHoldReason): string {
    switch (reason) {
        case DataRetentionHoldReason.ProtectedPeriod:
            return $t('Inschrijving of aansluiting in de beschermde werkjaren, door de instelling bij Leden.');
        case DataRetentionHoldReason.OpenBalance:
            return $t('Openstaand bedrag of betaling in verwerking. De verwerking volgt zodra dit is afgehandeld.');
        case DataRetentionHoldReason.ActiveResponsibility:
            return $t('Actieve functie.');
        case DataRetentionHoldReason.ActiveMembership:
            return $t('Huidige of toekomstige aansluiting.');
        case DataRetentionHoldReason.AdminAccount:
            return $t('Eigen account met beheerdersrechten.');
        case DataRetentionHoldReason.UnchargedMembership:
            return $t('Aansluiting die nog aangerekend moet worden. Dit houdt enkel verwijderen tegen.');
    }
}

/**
 * Months shown one by one, starting with the month of the count. Everything after them is added up, to keep the list short.
 */
const SEPARATE_MONTHS = 3;

/**
 * Within a moment, the categories are always in this order.
 */
const CATEGORY_ORDER = [
    DataRetentionCategory.Members,
    DataRetentionCategory.SensitiveData,
    DataRetentionCategory.Orders,
    DataRetentionCategory.Emails,
    DataRetentionCategory.Documents,
    DataRetentionCategory.Accounts,
    DataRetentionCategory.AuditLogs,
];

function sortCounts(counts: DataRetentionCount[]) {
    return [...counts].sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
        // Anonymizing comes before deleting
        || (a.action === DataRetentionAction.Delete ? 1 : 0) - (b.action === DataRetentionAction.Delete ? 1 : 0));
}

/**
 * What happens first is shown first: now, the first months one by one, and the rest together.
 * The count stores 13 months and 'later'; this only groups them.
 */
const groups = computed(() => {
    const overview = props.overview;
    if (!overview) {
        return [];
    }
    const firstMonth = DateTime.fromJSDate(overview.calculatedAt, { zone: Formatter.timezone }).startOf('month');
    const moments = [
        { key: 'now', title: $t('Nu'), includes: (_: string) => false },
        ...Array.from({ length: SEPARATE_MONTHS }, (_, index) => {
            const month = firstMonth.plus({ months: index });
            const monthKey = month.toFormat('yyyy-MM');
            return {
                key: monthKey,
                title: Formatter.capitalizeFirstLetter(Formatter.dateWithoutDay(month.toJSDate())),
                includes: (key: string) => key === monthKey,
            };
        }),
        {
            key: 'later',
            title: $t('Vanaf {month}', { month: Formatter.dateWithoutDay(firstMonth.plus({ months: SEPARATE_MONTHS }).toJSDate()) }),
            includes: (key: string) => key === 'later' || key >= firstMonth.plus({ months: SEPARATE_MONTHS }).toFormat('yyyy-MM'),
        },
    ];

    return moments
        .map(moment => ({
            key: moment.key,
            title: moment.title,
            items: sortCounts(overview.counts)
                .map(count => ({
                    key: count.category + '-' + count.action,
                    title: getDataRetentionActionTitle(count.category, count.action),
                    amount: moment.key === 'now'
                        ? count.due
                        : [...count.upcoming.entries()].filter(([key]) => moment.includes(key)).reduce((sum, [, amount]) => sum + amount, 0),
                }))
                .filter(item => item.amount > 0),
        }))
        .filter(group => group.items.length > 0);
});

const heldRows = computed(() => {
    return (props.overview?.counts ?? []).flatMap(count => [...count.heldBy.entries()]
        .filter(([, amount]) => amount > 0)
        .map(([reason, amount]) => ({
            key: count.category + '-' + count.action + '-' + reason,
            title: getHeldTitle(count.category, amount),
            reason: getHoldReason(reason),
        })));
});
</script>
