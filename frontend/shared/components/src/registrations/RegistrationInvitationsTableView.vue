<template>
    <ModernTableView ref="modernTableView" :table-object-fetcher="tableObjectFetcher" :title="title" :column-configuration-id="'registration-invitations'" :actions="actions" :all-columns="allColumns" :default-sort-column="defaultSortColumn" :default-sort-direction="defaultSortDirection" :estimated-rows="estimatedRows">
        <p class="style-description-block">
            {{ $t('Uitnodigingen zijn zichtbaar voor leden in het ledenportaal. Zo kunnen ze zelf inschrijven voor de groep.') }}
        </p>
        <template #empty>
            {{ $t('Geen uitnodigingen') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { useGlobalEventListener } from '#hooks/useGlobalEventListener.ts';
import ModernTableView from '#tables/ModernTableView.vue';
import { Column } from '#tables/classes/Column.ts';
import { useTableObjectFetcher } from '#tables/classes/TableObjectFetcher.ts';
import type { Group, RegistrationInvitation, StamhoofdFilter } from '@stamhoofd/structures';
import { SortItemDirection } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { watch } from 'vue';
import { useRegistrationInvitationsObjectFetcher } from '../fetchers/useRegistrationInvitationsObjectFetcher';
import { useRegistrationInvitationActionBuilder } from './classes/RegistrationInvitationActionBuilder';
import { useRegistrationInvitationEventListener } from './classes/useRegistrationInvitationEventListener';

type ObjectType = RegistrationInvitation;

const props = withDefaults(defineProps<{
    group: Group;
    estimatedRows?: number | null;
    updateTotal?: (total: number | null) => void;
}>(), {
    estimatedRows: null,
    updateTotal: undefined
});

const getActionBuilder = useRegistrationInvitationActionBuilder();
const actions = getActionBuilder({group: props.group, eventOrigin: 'invitations-table'}).getActions();

const title = $t('Uitnodigingen');

useRegistrationInvitationEventListener('updated', async (value) => {
    if (value.groupIds.has(props.group.id)) {
        tableObjectFetcher.reset(true, true);
    }
});

useGlobalEventListener('members-deleted', async () => {
    tableObjectFetcher.reset(true, true);
});
useGlobalEventListener('members-added', async () => {
    tableObjectFetcher.reset(true, true);
});
useGlobalEventListener('members-registered', async () => {
    tableObjectFetcher.reset(true, true);
});

function getRequiredFilter(): StamhoofdFilter | null {
    return {
        groupId: props.group.id
    }
}

const objectFetcher = useRegistrationInvitationsObjectFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

if (props.updateTotal) {
    watch(() => tableObjectFetcher.totalCount, (value) => {
        props.updateTotal?.(value);
    })
}

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string>({
        id: 'memberName',
        name: $t('Naam'),
        getValue: invitation => invitation.member.name,
        minimumWidth: 100,
        recommendedWidth: 200,
        grow: true,
        enabled: true,
        allowSorting: false
    }),
    new Column<ObjectType, Date | null>({
        id: 'birthDay',
        name: $t(`%17w`),
        getValue: invitation => invitation.member.birthDay,
        format: date => date ? Formatter.dateNumber(date, true) : '',
        minimumWidth: 50,
        recommendedWidth: 170,
        allowSorting: false,
        enabled: false,
    }),
    new Column<ObjectType, Date>({
        id: 'createdAt',
        name: $t('Uitgenodigd op'),
        getValue: invitation => invitation.createdAt,
        format: (value, width) => {
            if (width < 150) {
                return Formatter.dateNumber(value);
            }
            if (width < 250) {
                return Formatter.date(value, true)
            }

            // show time because enough space in table
            return Formatter.dateTime(value);
        },
        recommendedWidth: 170,
        allowSorting: true,
        grow: true,
        enabled: true
    })
]

const defaultSortColumn = allColumns.find(c => c.id === 'createdAt') ?? null;
const defaultSortDirection = defaultSortColumn ? SortItemDirection.DESC : null;
</script>
