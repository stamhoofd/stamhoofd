<template>
    <LoadingView v-if="loading" />
    <STList v-else>
        <STListItem v-if="nullable" :selectable="true" element-name="label">
            <template #left>
                <Checkbox v-model="allGroups" />
            </template>
            <h3 class="style-title-list">
                {{ $t('07d642d2-d04a-4d96-b155-8dbdb1a9e4ff') }}
            </h3>
        </STListItem>

        <template v-if="model !== null">
            <STListItem v-for="option of groupOptions" :key="option.group.id" :selectable="option.isEnabled" element-name="label">
                <template #left>
                    <Checkbox :model-value="getGroupValue(option.group)" :disabled="!option.isEnabled" @update:model-value="setGroupValue(option.group, $event)" />
                </template>
                <h3 class="style-title-list">
                    {{ option.group.name }}
                </h3>
                <p v-if="option.group.description" class="style-description-small">
                    {{ option.group.description }}
                </p>
            </STListItem>
        </template>
    </STList>
</template>

<script setup lang="ts">
import { useOrganization, usePlatform } from '@stamhoofd/components';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { GroupType, NamedObject, RegistrationPeriodList } from '@stamhoofd/structures';
import { computed, Ref, ref, watch, watchEffect } from 'vue';

const props = withDefaults(
    defineProps<{
        nullable?: boolean;
        date: Date; // indication for selection the right groups in this period
        isGroupEnabledOperator?: (group: NamedObject) => boolean;
    }>(), {
        nullable: false,
    },
);

const model = defineModel<NamedObject[] | null>({ required: true });
const organization = useOrganization();
const organizationManager = useOrganizationManager();
const owner = useRequestOwner();
const platform = usePlatform();

const lastCachedValue = ref<NamedObject[] | null>(null);
const periods = ref(RegistrationPeriodList.create({}) as any) as Ref<RegistrationPeriodList>;
const loading = ref(true);

const visiblePeriodIds = computed(() => {
    const pp = periods.value.periods.filter(period => period.startDate <= props.date && period.endDate >= props.date).map(p => p.id);

    if (pp.length > 0) {
        return pp;
    }

    // Defualt show current
    return [
        platform.value.period.id,
        organization.value?.period.period.id,
    ];
});

const groups = computed(() => {
    return periods.value.organizationPeriods.filter(p => visiblePeriodIds.value.includes(p.period.id)).flatMap((p) => {
        return p.adminCategoryTree.getAllGroups().filter(g => g.type === GroupType.Membership).map(group => NamedObject.create({
            id: group.id,
            name: group.settings.name,
            description: p.period.nameShort,
        }));
    });
});

const missingGroups = computed(() => {
    return model.value === null ? [] : model.value.filter(g => !groups.value.find(group => group.id === g.id));
});

const groupOptions = computed(() => {
    const isEnabledOperator = props.isGroupEnabledOperator;
    const groupsToChoose = [...groups.value, ...missingGroups.value];

    let result: { group: NamedObject; isEnabled: boolean }[] = [];

    if (isEnabledOperator !== undefined) {
        result = groupsToChoose.map((group) => {
            return {
                group,
                isEnabled: isEnabledOperator(group),
            };
        },
        );
    }
    else {
        result = groupsToChoose.map((group) => {
            return {
                group,
                isEnabled: true,
            };
        });
    }

    if (result.filter(x => x.isEnabled).length === 1) {
        const firstEnabled = result.find(x => x.isEnabled);
        if (firstEnabled) {
            firstEnabled.isEnabled = false;
        }
    }

    return result;
});

const enabledGroups = computed(() => groupOptions.value.filter(g => g.isEnabled).map(g => g.group));

watch(enabledGroups, (groups) => {
    if (groups.length === 1 && model.value?.length === 0) {
        model.value = [groups[0]];
    }
});

organizationManager.value.loadPeriods(false, true, owner).then((p) => {
    periods.value = p;
    loading.value = false;
}).catch(console.error);

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
    return !!model.value?.find(v => v.id === group.id);
}

function setGroupValue(group: NamedObject, value: boolean) {
    if (model.value === null) {
        return;
    }
    if (value) {
        model.value = [...model.value.filter(t => t.id !== group.id), group];
    }
    else {
        model.value = model.value.filter(t => t.id !== group.id);
    }
}
</script>
