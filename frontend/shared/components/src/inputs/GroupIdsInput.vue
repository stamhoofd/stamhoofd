<template>
    <LoadingBoxTransition>
        <div v-if="!loading" class="container">
            <hr>
            <h2 class="style-with-button">
                <span>{{ title }}</span>
                <div>
                    <button v-long-press="(e: any) => switchCycle(e)" type="button" class="button text" @click.prevent="switchCycle" @contextmenu.prevent="switchCycle">
                        {{ period.name }}
                        <span class="icon arrow-down-small" />
                    </button>
                </div>
            </h2>

            <STList v-if="nullable || groups.length > 0">
                <STListItem v-if="nullable" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="allGroups" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('07d642d2-d04a-4d96-b155-8dbdb1a9e4ff') }}
                    </h3>
                </STListItem>

                <template v-if="model !== null">
                    <STListItem v-for="group of groups" :key="group.id" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox :model-value="getGroupValue(group)" @update:model-value="setGroupValue(group, $event)" />
                        </template>
                        <h3 class="style-title-list">
                            {{ group.name }}
                        </h3>
                        <p v-if="group.description" class="style-description-small">
                            {{ group.description }}
                        </p>
                    </STListItem>
                </template>
            </STList>

            <p v-if="groups.length === 0" class="info-box">
                {{ $t('fd52fa36-16e6-4106-807c-c387bc0acc0e') }}
            </p>
        </div>
    </LoadingBoxTransition>
</template>

<script setup lang="ts">
import { ContextMenu, ContextMenuItem, LoadingBoxTransition, useOrganization, usePlatform } from '@stamhoofd/components';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { GroupType, NamedObject, RegistrationPeriod, RegistrationPeriodList } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, Ref, ref, watchEffect } from 'vue';

const props = withDefaults(
    defineProps<{
        nullable?: boolean;
        defaultPeriodId?: string | null;
        title?: string;
    }>(), {
        nullable: false,
        defaultPeriodId: null,
        title: () => $t(`2a033cd8-b9e4-4a92-a8a6-b4a687d87e79`),
    },
);

const model = defineModel<string[] | null>({ required: true });
const organization = useOrganization();
const organizationManager = useOrganizationManager();
const owner = useRequestOwner();
const platform = usePlatform();
const defaultPeriod = organization.value?.period?.period ?? platform.value.period;
const period = ref(defaultPeriod) as Ref<RegistrationPeriod>;

const lastCachedValue = ref<string[] | null>(null);
const periods = ref(RegistrationPeriodList.create({}) as any) as Ref<RegistrationPeriodList>;
const loading = ref(true);
const organizationPeriod = computed(() => periods.value.organizationPeriods.find(p => p.period.id === period.value.id));

const groups = computed(() => {
    const p = organizationPeriod.value;
    if (!p) {
        return [];
    }
    return p.adminCategoryTree.getAllGroups().filter(g => g.type === GroupType.Membership).map(group => NamedObject.create({
        id: group.id,
        name: group.settings.name.toString(),
        description: p.period.nameShort,
    }));
});

organizationManager.value.loadPeriods(false, true, owner).then((p) => {
    periods.value = p;

    if (props.defaultPeriodId !== null) {
        const pp = periods.value.periods.find(p => p.id === props.defaultPeriodId);

        if (pp) {
            period.value = pp;
        }
    }

    loading.value = false;
}).catch(console.error);

function switchCycle(event: MouseEvent) {
    const menu = new ContextMenu([
        (periods.value.organizationPeriods ?? []).map((p) => {
            const c = p.adminCategoryTree.getAllGroups().map(g => g.id).reduce((a, b) => a + (model.value?.includes(b) ? 1 : 0), 0);

            return new ContextMenuItem({
                name: p.period.name,
                selected: p.period.id === period.value.id,
                rightText: c > 0 ? Formatter.integer(c) : '',
                action: () => {
                    period.value = p.period;
                    return true;
                },
            });
        }),
    ]);
    menu.show({ button: event.currentTarget as HTMLElement, yOffset: -10 }).catch(console.error);
}

watchEffect(() => {
    if (model.value !== null) {
        lastCachedValue.value = model.value;
    }
});

const allGroups = computed({
    get: () => model.value === null,
    set: (allGroups) => {
        if (allGroups) {
            model.value = null;
        }
        else {
            model.value = (lastCachedValue.value ?? []).slice();
        }
    },
});

function getGroupValue(group: NamedObject) {
    return !!model.value?.find(id => id === group.id);
}

function setGroupValue(group: NamedObject, value: boolean) {
    if (model.value === null) {
        return;
    }
    if (value) {
        model.value = [...model.value.filter(id => id !== group.id), group.id];
    }
    else {
        model.value = model.value.filter(id => id !== group.id);
    }
}
</script>
