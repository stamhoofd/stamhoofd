<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="periods" class="st-view start-new-registration-period-view">
            <STNavigationBar :title="$t(`%3g`)" />

            <main>
                <h1>{{ $t('%17p', {'year-2025-2026': period.name}) }}</h1>

                <STErrorsDefault :error-box="errors.errorBox" />

                <STInputBox :title="$t('Kopie maken vanaf')" :error-box="errors.errorBox" error-fields="fromPeriod">
                    <Dropdown v-model="fromPeriod">
                        <option :value="null">
                            {{ $t('Geen kopie maken') }}
                        </option>

                        <option v-for="p of periods.organizationPeriods" :key="p.id" :value="p">
                            {{ p.period.name }}
                        </option>
                    </Dropdown>
                </STInputBox>

                <p
                    v-if="fromPeriod && !$isPlatform" class="pre-wrap style-description-block" v-text="$t('%1bu', {
                        'name-period-old': fromPeriod.period.name ?? '',
                        'name-period-new': period.name
                    })"
                />
                <p
                    v-else-if="!fromPeriod && !$isPlatform" class="pre-wrap style-description-block" v-text="$t('Je staat op het punt om een nieuw leeg werkjaar aan te maken ({name-period-new}), zonder een kopie te maken van een bestaand werkjaar.\n\nZodra {name-period-new} volledig is ingesteld, kan je overschakelen. Vanaf dat moment kunnen leden zich via het ledenportaal inschrijven. Tot die tijd blijft de nieuwe periode verborgen voor leden.', {
                        'name-period-new': period.name
                    })"
                />
                <p v-else>
                    {{ $t('%17q') }}
                </p>

                <hr v-if="rows.length > 0 && fromPeriod">

                <STGrid v-if="rows.length > 0 && fromPeriod" class="split">
                    <STGridItem class="header">
                        <template #default>
                            <span class="style-title-2">
                                {{ fromPeriod.period.name }}
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
                        <button v-if="fromPeriod" class="button primary" type="button" @click="start">
                            <span class="icon tiny copy" />
                            <span>{{ $t('%17t') }}</span>
                        </button>
                        <button v-else class="button primary" type="button" @click="start">
                            <span class="icon tiny add" />
                            <span>{{ $t('Leeg aanmaken') }}</span>
                        </button>
                    </LoadingButton>
                </template>
            </STToolbar>
        </div>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import LoadingViewTransition from '#containers/LoadingViewTransition.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useErrors } from '#errors/useErrors.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import Dropdown from '#inputs/Dropdown.vue';
import STInputBox from '#inputs/STInputBox.vue';
import { Toast } from '#overlays/Toast.ts';
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { usePop } from '@simonbackx/vue-app-navigation';
import GroupAvatar from '@stamhoofd/components/GroupAvatar.vue';
import STGrid from '@stamhoofd/components/layout/STGrid.vue';
import STGridItem from '@stamhoofd/components/layout/STGridItem.vue';
import { useFetchOrganizationRegistrationPeriods } from '@stamhoofd/networking/hooks/useFetchOrganizationRegistrationPeriods';
import { usePatchOrganizationPeriods } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriods';
import { OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import type { Group, GroupCategoryTree, RegistrationPeriod, RegistrationPeriodList } from '@stamhoofd/structures';
import { GroupStatus } from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';
import type { Ref } from 'vue';

const props = defineProps<{
    period: RegistrationPeriod;
    callback: () => void;
}>();

type Row
    = | { type: 'category'; key: string; depth: number; name: string }
        | { type: 'group'; key: string; depth: number; old: Group; new: Group };

const loading = ref(false);
const organization = useOrganization();
const fromPeriod = ref(organization.value?.period ?? null) as Ref<OrganizationRegistrationPeriod | null>;
const periods = ref<RegistrationPeriodList | null>(null);
const fetchOrganizationRegistrationPeriods = useFetchOrganizationRegistrationPeriods();

onMounted(async () => {
    try {
        periods.value = await fetchOrganizationRegistrationPeriods({ shouldRetry: true, force: true });
    } catch (e) {
        if (Request.isAbortError(e)) {
            return;
        }
        Toast.fromError(e).show();
        errors.errorBox = new ErrorBox(e);
    }
});

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
    const period = fromPeriod.value;
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
        const currentPeriod = fromPeriod.value;
        let newOrganizationPeriod = OrganizationRegistrationPeriod.create({
            period: props.period,
        });
        if (currentPeriod) {
            newOrganizationPeriod = currentPeriod.duplicate(props.period);
        }

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>;
        arr.addPut(newOrganizationPeriod);

        await patchOrganizationPeriods(arr);
        props.callback();

        if (currentPeriod && currentPeriod.id === organization.value?.period.id) {
            Toast.success(
                $t('%17u', { 'werkjaar-2025-2026': newOrganizationPeriod.period.name }),
            ).show();
        } else if (currentPeriod) {
            Toast.success(
                $t('{werkjaar-2025-2026} is nu aangemaakt. Kijk de prijzen en instellingen goed na van je kopie.', { 'werkjaar-2025-2026': newOrganizationPeriod.period.name }),
            ).show();
        } else {
            Toast.success(
                $t('{werkjaar-2025-2026} is nu aangemaakt. Voeg zeker één of meerdere inschrijvingsgroepen toe en kijk alle instelingen grondig na.', { 'werkjaar-2025-2026': newOrganizationPeriod.period.name }),
            ).show();
        }
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
