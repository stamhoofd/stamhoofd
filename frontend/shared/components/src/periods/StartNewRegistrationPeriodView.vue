<template>
    <div class="st-view start-new-registration-period-view">
        <STNavigationBar :title="$t(`%3g`)" />

        <main>
            <h1>{{ $t('%17p', {'year-2025-2026': period.name}) }}</h1>
            <p
                v-if="!$isPlatform" class="pre-wrap style-description-block" v-text="$t('%1bu', {
                    'name-period-old': organization?.period.period.name ?? '',
                    'name-period-new': period.name
                })"
            />
            <p v-else>
                {{ $t('%17q') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />
            <STGrid v-if="rows.length > 0" class="split">
                <STGridItem class="header">
                    <template #default>
                        <span class="style-title-2">
                            {{ organization?.period.period.name }}
                        </span>
                    </template>
                    <template #middleRight />
                    <template #right>
                        <span class="style-title-2">{{ period.name }}</span>
                    </template>
                </STGridItem>
                <template v-for="row in rows" :key="row.key">
                    <STGridItem v-if="row.type === 'category'" class="right-stack no-border">
                        <template #default>
                            <div :class="'group-cell ' + row.type" :style="{ '--depth': row.depth }">
                                <span v-if="row.depth > 0" class="icon small folder-open gray" />
                                <div>
                                    <h2 class="style-title-list bolder">
                                        {{ row.name }}
                                    </h2>
                                </div>
                            </div>
                        </template>
                        <template #middleRight />
                        <template #right>
                            <div :class="'group-cell ' + row.type" :style="{ '--depth': row.depth }">
                                <span v-if="row.depth > 0" class="icon small folder-open gray" />
                                <div>
                                    <h2 class="style-title-list bolder">
                                        {{ row.name }}
                                    </h2>
                                </div>
                            </div>
                        </template>
                    </STGridItem>
                    <STGridItem v-else class="right-stack no-border">
                        <template #default>
                            <div :class="'group-cell ' + row.type" :style="{ '--depth': row.depth }">
                                <GroupAvatar :group="row.old" />
                                <div>
                                    <h2 class="style-title-list">
                                        {{ row.old.settings.name }}
                                    </h2>
                                    <p v-if="row.old.getMemberCount() !== null" class="style-description-small">
                                        {{ pluralText(row.old.getMemberCount()!, $t('%79'), $t('%It')) }}
                                    </p>
                                </div>
                            </div>
                        </template>
                        <template #middleRight>
                            <span class="icon arrow-right tiny gray" />
                        </template>
                        <template #right>
                            <div :class="'group-cell ' + row.type" :style="{ '--depth': row.depth }">
                                <GroupAvatar :group="row.new" />
                                <div>
                                    <h2 class="style-title-list">
                                        {{ row.new.settings.name }}
                                    </h2>
                                    <p class="style-description-small">
                                        {{ pluralText(0, $t('%79'), $t('%It')) }}
                                    </p>
                                </div>
                            </div>
                        </template>
                    </STGridItem>
                </template>
            </STGrid>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="start">
                        <span class="icon tiny copy" />
                        <span>{{ $t('%17t') }}</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script setup lang="ts">
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useErrors } from '#errors/useErrors.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { Toast } from '#overlays/Toast.ts';
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import GroupAvatar from '@stamhoofd/components/GroupAvatar.vue';
import STGrid from '@stamhoofd/components/layout/STGrid.vue';
import STGridItem from '@stamhoofd/components/layout/STGridItem.vue';
import { usePatchOrganizationPeriods } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriods';
import type { Group, GroupCategoryTree, OrganizationRegistrationPeriod, RegistrationPeriod } from '@stamhoofd/structures';
import { GroupStatus } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const props = defineProps<{
    period: RegistrationPeriod;
    callback: () => void;
}>();

type Row =
    | { type: 'category'; key: string; depth: number; name: string }
    | { type: 'group'; key: string; depth: number; old: Group; new: Group };

const loading = ref(false);
const organization = useOrganization();

function buildRows(period: OrganizationRegistrationPeriod, tree: GroupCategoryTree, depth: number): Row[] {
    const rows: Row[] = [];

    for (const category of tree.categories) {
        const c = buildRows(period, category, depth + 1);
        if (c.length === 0) {
            continue;
        }
        rows.push({
            type: 'category',
            key: 'category-' + category.id,
            depth,
            name: category.getName(period),
        });
        rows.push(...c);
    }

    for (const group of tree.groups) {
        rows.push({
            type: 'group',
            key: 'group-' + group.id,
            depth,
            old: group,
            // Force the new (duplicated) group to render as closed
            new: group.patch({ status: GroupStatus.Closed }),
        });
    }

    return rows;
}

const rows = computed(() => {
    const period = organization.value?.period;
    if (!period) {
        return [];
    }

    const result = buildRows(period, period.adminCategoryTree, 0);

    // Waiting lists are stored separately from the category tree, so append them at the bottom
    for (const waitingList of period.waitingLists) {
        result.push({
            type: 'category',
            key: 'watitinglists',
            depth: 0,
            name: $t('%eh'),
        });

        result.push({
            type: 'group',
            key: 'group-' + waitingList.id,
            depth: 1,
            old: waitingList,
            // Force the new (duplicated) waiting list to render as closed
            new: waitingList.patch({ status: GroupStatus.Closed }),
        });
    }

    return result;
});
const errors = useErrors();
const pop = usePop();
const patchOrganizationPeriods = usePatchOrganizationPeriods();

async function start() {
    if (loading.value) {
        return;
    }
    loading.value = true;

    try {
        const currentPeriod = organization.value!.period;
        const newOrganizationPeriod = currentPeriod.duplicate(props.period);

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>;
        arr.addPut(newOrganizationPeriod);

        await patchOrganizationPeriods(arr);
        props.callback();
        Toast.success(
            $t('%17u', { 'werkjaar-2025-2026': newOrganizationPeriod.period.name }),
        ).show();
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}
</script>

<style lang="scss" scoped>
.start-new-registration-period-view {
    --st-list-padding: 6px;
    --st-grid-horizontal-gap: 6px;
}

.group-cell {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    --block-width: 22px;

    &.category {
        padding-top: 15px;
    }

    @media (min-width: 500px) {
        padding-left: calc(var(--depth, 0)  * 10px);
    }

    @media (max-width: 500px) {
        gap: 6px;
    }

    @media (max-width: 550px) {
        --block-width: 16px;
    }
}
</style>
