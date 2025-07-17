<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" :deleting="deleting" @save="save" v-on="!isNew && deleteHandler ? {delete: deleteMe} : {}">
        <h1>
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <GroupPriceBox :period="patchedPeriod" :price="patched" :group="patchedGroup" :errors="errors" :default-membership-type-id="defaultMembershipTypeId" :show-name-always="showNameAlways" :validator="errors.validator" @patch:period="addPeriodPatch" @patch:price="addPatch" />
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { Group, GroupPrice, GroupSettings, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { useErrors } from '../../errors/useErrors';
import { usePatch } from '../../hooks';
import { CenteredMessage } from '../../overlays/CenteredMessage';
import { Toast } from '../../overlays/Toast';

import GroupPriceBox from './GroupPriceBox.vue';

const props = withDefaults(
    defineProps<{
        price: GroupPrice;
        group: Group;
        isNew: boolean;
        period: OrganizationRegistrationPeriod;
        saveHandler: (period: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => Promise<void>;
        deleteHandler?: (() => Promise<void>) | null;
        showToasts?: boolean;
        defaultMembershipTypeId?: string | null;
        showNameAlways?: boolean;
    }>(),
    {
        deleteHandler: null,
        showToasts: true,
        defaultMembershipTypeId: null,
        showNameAlways: false,
    },
);

const { patched: patchedPeriod, hasChanges, addPatch: addPeriodPatch, patch: periodPatch } = usePatch(props.period);
const patchedGroup = computed(() => {
    return patchedPeriod.value.groups.find(g => g.id === props.group.id) ?? props.group;
});
const patched = computed(() => {
    return patchedGroup.value.settings.prices.find(p => p.id === props.price.id) ?? props.price;
});

function addGroupPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<Group>>) {
    const groups: PatchableArrayAutoEncoder<Group> = new PatchableArray();
    groups.addPatch(Group.patch({ id: props.group.id, ...patch }));
    addPeriodPatch({ groups });
}

function addPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<GroupPrice>>) {
    const prices: PatchableArrayAutoEncoder<GroupPrice> = new PatchableArray();
    prices.addPatch(GroupPrice.patch({ id: props.price.id, ...patch }));
    addGroupPatch({ settings: GroupSettings.patch({ prices }) });
}

// const { patched, hasChanges, addPatch, patch } = usePatch(props.price);

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const pop = usePop();

const title = computed(() => {
    return props.isNew ? $t('e70de836-abc7-4fba-ae39-866a3fd0f945') : $t('9470f402-a773-4907-9397-1c047fc96d7f');
});

async function save() {
    if (deleting.value || saving.value) {
        return;
    }

    saving.value = true;
    try {
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }
        await props.saveHandler(periodPatch.value);
        await pop({ force: true });
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    finally {
        saving.value = false;
    }
}

async function deleteMe() {
    if (!await CenteredMessage.confirm($t('a4feed7d-2c8a-404a-a30d-b1035e3a9e42'), $t('201437e3-f779-47b6-b4de-a0fa00f3863e'), $t('8694b1af-38d0-46f5-a9e2-c70bf96488ec'))) {
        return;
    }
    if (deleting.value || saving.value || !props.deleteHandler) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        if (props.showToasts) {
            Toast.success($t('eb66ea67-3c37-40f2-8572-9589d71ffab6')).show();
        }
        await pop({ force: true });
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    finally {
        deleting.value = false;
    }
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
