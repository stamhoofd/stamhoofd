<template>
    <SaveView :loading-view="loading" :title="title" :loading="saving" :disabled="!hasChanges" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('%Gq') ">
                <input v-model="name" class="input" type="text" :placeholder="$t('%Gq') ">
            </STInputBox>
            <STInputBox error-fields="behaviour" :error-box="errors.errorBox" :title="$t(`%1B`)">
                <Dropdown v-model="behaviour">
                    <option :value="PlatformMembershipTypeBehaviour.Period">
                        {{ $t('%I5') }}
                    </option>
                    <option :value="PlatformMembershipTypeBehaviour.Days">
                        {{ $t('%I6') }}
                    </option>
                </Dropdown>
            </STInputBox>
        </div>

        <STInputBox :title="$t('%6o')" error-fields="settings.description" :error-box="errors.errorBox" class="max">
            <textarea v-model="description" class="input" type="text" :placeholder="$t('%14p')" autocomplete="off" />
        </STInputBox>

        <hr><h2>{{ $t('%8I') }}</h2>
        <p>{{ $t('%8J') }}</p>

        <p v-if="sortedPeriods.length === 0" class="info-box">
            {{ $t('%I7') }}
        </p>
        <STList v-else>
            <PlatformMembershipTypeConfigRow v-for="{period, config} of sortedPeriods" :key="period.id" :config="config" :period="period" :type="type" @click="editPeriod(config, period)" />
        </STList>

        <p>
            <button class="button text" type="button" @click="addConfig">
                <span class="icon add" />
                <span>{{ $t('%3T') }}</span>
            </button>
        </p>

        <hr><h2>{{ $t("%1CP") }}</h2>

        <Checkbox v-model="requiredTagIdsEnabled">
            {{ $t("%84") }}
        </Checkbox>

        <Checkbox v-model="requiredDefaultAgeGroupIdsEnabled">
            {{ $t("%85") }}
        </Checkbox>

        <JumpToContainer :visible="requiredTagIds !== null">
            <hr><h2 class="style-with-button">
                <div>{{ $t("%86") }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="() => requiredTagIds = null" />
                </div>
            </h2>
            <p>{{ $t("%84") }}</p>

            <TagIdsInput v-model="requiredTagIds" :validator="errors.validator" />
        </JumpToContainer>

        <JumpToContainer :visible="requiredDefaultAgeGroupIds !== null">
            <hr><h2 class="style-with-button">
                <div>{{ $t("%87") }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="() => requiredDefaultAgeGroupIds = null" />
                </div>
            </h2>
            <p>{{ $t("%85") }}</p>

            <DefaultAgeGroupIdsInput v-model="requiredDefaultAgeGroupIds" :validator="errors.validator" :should-select-at-least-one="true" />
        </JumpToContainer>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchMap } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { ContextMenu, ContextMenuItem } from '@stamhoofd/components/overlays/ContextMenu.ts';
import DefaultAgeGroupIdsInput from '@stamhoofd/components/inputs/DefaultAgeGroupIdsInput.vue';
import Dropdown from '@stamhoofd/components/inputs/Dropdown.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import JumpToContainer from '@stamhoofd/components/containers/JumpToContainer.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import TagIdsInput from '@stamhoofd/components/inputs/TagIdsInput.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { PlatformMembershipType, PlatformMembershipTypeBehaviour, PlatformMembershipTypeConfig, RegistrationPeriod } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { Ref, computed, ref } from 'vue';
import EditMembershipTypeConfigView from './EditMembershipTypeConfigView.vue';
import PlatformMembershipTypeConfigRow from './components/PlatformMembershipTypeConfigRow.vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const platformManager = usePlatformManager();
const owner = useRequestOwner();
const loading = ref(false);
const originalPeriods = ref([]) as Ref<RegistrationPeriod[]>;
const present = usePresent();

loadData().catch(console.error);

const props = defineProps<{
    type: PlatformMembershipType;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<PlatformMembershipType>) => Promise<void>;
    deleteHandler: (() => Promise<void>) | null;
}>();
const title = computed(() => props.isNew ? $t('%3U') : $t('%3Q'));
const pop = usePop();

const { patched, addPatch, hasChanges, patch } = usePatch(props.type);

const sortedPeriods = computed(() => {
    const result: { period: RegistrationPeriod; config: PlatformMembershipTypeConfig }[] = Array.from(patched.value.periods.entries())
        .map(([periodId, config]) => ({ config, period: originalPeriods.value.find(p => p.id === periodId)! }))
        .filter(p => !!p.period);

    result.sort((a, b) => Sorter.byDateValue(a.period.startDate, b.period.startDate));
    return result;
});

async function loadData() {
    loading.value = true;

    try {
        originalPeriods.value = await platformManager.value.loadPeriods(true, true, owner);
        loading.value = false;
    }
    catch (e) {
        Toast.fromError(e).show();
        await pop({ force: true });
        return;
    }
}

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
        if (name.value.length < 2) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t('%56'),
                field: 'name',
            });
        }

        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
};

const doDelete = async () => {
    if (saving.value || deleting.value) {
        return;
    }

    if (!props.deleteHandler) {
        return;
    }

    if (!await CenteredMessage.confirm($t('%3O'), $t('%CJ'), $t('%3N'))) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    deleting.value = false;
};

const name = computed({
    get: () => patched.value.name,
    set: name => addPatch({ name }),
});

const description = computed({
    get: () => patched.value.description,
    set: description => addPatch({ description }),
});

const behaviour = computed({
    get: () => patched.value.behaviour,
    set: behaviour => addPatch({ behaviour }),
});

const requiredTagIdsEnabled = computed({
    get: () => patched.value.requiredTagIds !== null,
    set: requiredTagIdsEnabled => addPatch({ requiredTagIds: requiredTagIdsEnabled ? (requiredTagIds.value ?? [] as any) : null }),
});

const requiredTagIds = computed({
    get: () => patched.value.requiredTagIds,
    set: requiredTagIds => addPatch({ requiredTagIds: requiredTagIds as any }),
});

const requiredDefaultAgeGroupIdsEnabled = computed({
    get: () => patched.value.requiredDefaultAgeGroupIds !== null,
    set: requiredDefaultAgeGroupIdsEnabled => addPatch({ requiredDefaultAgeGroupIds: requiredDefaultAgeGroupIdsEnabled ? (requiredDefaultAgeGroupIds.value ?? [] as any) : null }),
});

const requiredDefaultAgeGroupIds = computed({
    get: () => patched.value.requiredDefaultAgeGroupIds,
    set: requiredDefaultAgeGroupIds => addPatch({ requiredDefaultAgeGroupIds: requiredDefaultAgeGroupIds as any }),
});

async function editPeriod(config: PlatformMembershipTypeConfig, period: RegistrationPeriod) {
    await present({
        components: [
            new ComponentWithProperties(EditMembershipTypeConfigView, {
                type: patched.value,
                period,
                config,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<PlatformMembershipTypeConfig>) => {
                    const periods = new PatchMap<string, AutoEncoderPatchType<PlatformMembershipTypeConfig>>();
                    periods.set(period.id, patch);
                    addPatch({
                        periods,
                    });
                },
                deleteHandler: () => {
                    const periods = new PatchMap<string, AutoEncoderPatchType<PlatformMembershipTypeConfig> | null>();
                    periods.set(period.id, null);
                    addPatch({
                        periods,
                    });
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function addConfig(event: MouseEvent) {
    const availablePeriods = originalPeriods.value.filter(p => !patched.value.periods.has(p.id));

    if (availablePeriods.length === 0) {
        Toast.info($t('%3Y')).show();
        return;
    }

    const menu = new ContextMenu([
        availablePeriods.map((period) => {
            return new ContextMenuItem({
                name: period.name,
                icon: period.id === platformManager.value.$platform.period.id ? 'dot' : undefined,
                action: () => addConfigForPeriod(period),
            });
        }),
    ]);

    await menu.show({
        button: event.currentTarget as HTMLElement,
    });
}

async function addConfigForPeriod(period: RegistrationPeriod) {
    const { config: previousConfig, period: previousPeriod } = sortedPeriods.value[0] ?? { config: null, period: null };
    const config = previousConfig ? previousConfig.clone() : PlatformMembershipTypeConfig.create({});

    if (previousConfig && previousPeriod) {
        const yearDifference = period.startDate.getFullYear() - previousPeriod.startDate.getFullYear();

        // Change all dates
        config.startDate = new Date(config.startDate);
        config.startDate.setFullYear(config.startDate.getFullYear() + yearDifference);

        config.endDate = new Date(config.endDate);
        config.endDate.setFullYear(config.endDate.getFullYear() + yearDifference);

        if (config.expireDate) {
            config.expireDate = new Date(config.expireDate);
            config.expireDate.setFullYear(config.expireDate.getFullYear() + yearDifference);
        }

        for (const price of config.prices) {
            if (price.startDate) {
                price.startDate = new Date(price.startDate);
                price.startDate.setFullYear(price.startDate.getFullYear() + yearDifference);
            }
        }
    }
    else {
        config.startDate = period.startDate;
        config.endDate = period.endDate;
    }

    await present({
        components: [
            new ComponentWithProperties(EditMembershipTypeConfigView, {
                type: patched.value,
                period,
                config,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<PlatformMembershipTypeConfig>) => {
                    const periods = new PatchMap<string, PlatformMembershipTypeConfig>();
                    periods.set(period.id, config.patch(patch));
                    addPatch({
                        periods,
                    });
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }

    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
