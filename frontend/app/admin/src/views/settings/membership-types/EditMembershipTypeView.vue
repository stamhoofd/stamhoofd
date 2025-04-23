<template>
    <SaveView :loading-view="loading" :title="title" :loading="saving" :disabled="!hasChanges" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('9ffdbf7d-83b1-45e3-8ad5-db07b4a22d1e') ">
                <input v-model="name" class="input" type="text" :placeholder="$t('9ffdbf7d-83b1-45e3-8ad5-db07b4a22d1e') ">
            </STInputBox>
            <STInputBox error-fields="behaviour" :error-box="errors.errorBox" :title="$t(`Type`)">
                <Dropdown v-model="behaviour">
                    <option :value="PlatformMembershipTypeBehaviour.Period">
                        {{ $t('Vaste periode') }}
                    </option>
                    <option :value="PlatformMembershipTypeBehaviour.Days">
                        {{ $t('Per dag') }}
                    </option>
                </Dropdown>
            </STInputBox>
        </div>

        <STInputBox :title="$t('1c338881-0940-429b-a47e-7c9d3055f533')" error-fields="settings.description" :error-box="errors.errorBox" class="max">
            <textarea v-model="description" class="input" type="text" :placeholder="$t('3db64326-c892-4fdb-8293-3d713453383a')" autocomplete="off" />
        </STInputBox>

        <hr><h2>{{ $t('3754b38e-3938-4589-801a-450ba0844990') }}</h2>
        <p>{{ $t('8004af94-7b57-4ce2-aa9b-a6658684116d') }}</p>

        <p v-if="sortedPeriods.length === 0" class="info-box">
            {{ $t('Je hebt nog geen instellingen toegevoegd.') }}
        </p>
        <STList v-else>
            <PlatformMembershipTypeConfigRow v-for="{period, config} of sortedPeriods" :key="period.id" :config="config" :period="period" :type="type" @click="editPeriod(config, period)" />
        </STList>

        <p>
            <button class="button text" type="button" @click="addConfig">
                <span class="icon add" />
                <span>{{ $t('0b7c21d5-b9ed-4ddc-9370-7f58255f4eba') }}</span>
            </button>
        </p>

        <hr><h2>{{ $t("db085652-c3d0-4d2c-aa4b-53ef4234d480") }}</h2>

        <Checkbox v-model="requiredTagIdsEnabled">
            {{ $t("5fe7a400-8c6a-42ba-b920-c8518e60e091") }}
        </Checkbox>

        <Checkbox v-model="requiredDefaultAgeGroupIdsEnabled">
            {{ $t("37d201fd-287d-4957-b559-b882744ea886") }}
        </Checkbox>

        <JumpToContainer :visible="requiredTagIds !== null">
            <hr><h2 class="style-with-button">
                <div>{{ $t("02017e6d-47b0-4867-b590-be85a9b72008") }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="() => requiredTagIds = null" />
                </div>
            </h2>
            <p>{{ $t("5fe7a400-8c6a-42ba-b920-c8518e60e091") }}</p>

            <TagIdsInput v-model="requiredTagIds" :validator="errors.validator" />
        </JumpToContainer>

        <JumpToContainer :visible="requiredDefaultAgeGroupIds !== null">
            <hr><h2 class="style-with-button">
                <div>{{ $t("3a75616e-f4ef-4dbd-8e35-8fe74571e442") }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="() => requiredDefaultAgeGroupIds = null" />
                </div>
            </h2>
            <p>{{ $t("37d201fd-287d-4957-b559-b882744ea886") }}</p>

            <DefaultAgeGroupIdsInput v-model="requiredDefaultAgeGroupIds" :validator="errors.validator" :should-select-at-least-one="true" />
        </JumpToContainer>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchMap } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ContextMenu, ContextMenuItem, DefaultAgeGroupIdsInput, Dropdown, ErrorBox, JumpToContainer, SaveView, TagIdsInput, Toast, useErrors, usePatch } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { PlatformMembershipType, PlatformMembershipTypeBehaviour, PlatformMembershipTypeConfig, RegistrationPeriod } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { Ref, computed, ref } from 'vue';
import EditMembershipTypeConfigView from './EditMembershipTypeConfigView.vue';
import PlatformMembershipTypeConfigRow from './components/PlatformMembershipTypeConfigRow.vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();
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
const title = computed(() => props.isNew ? $t('105eefd4-2e16-4b4e-b964-ec51feb11955') : $t('9bc2ae42-208d-475a-8496-82859f04a7be'));
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
                message: $t('9aa8ff59-33ae-4ac4-93b6-97e071b13012'),
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

    if (!await CenteredMessage.confirm($t('866219fd-b946-4a96-b84b-3c2d26850cfa'), $t('838cae8b-92a5-43d2-82ba-01b8e830054b'), $t('b101058a-6b13-4df7-81ef-1f5c925bbf71'))) {
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
        Toast.info($t('3b257435-9ae7-4840-8f0f-f71318013935')).show();
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

    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
