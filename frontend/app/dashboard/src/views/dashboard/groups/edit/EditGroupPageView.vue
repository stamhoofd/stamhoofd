<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" class="group-edit-page-view" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <ImageInput v-model="squarePhoto" :title="$t('%Ls')" :resolutions="hsSquare" :required="false" />
        <p class="style-description-small">
            {{ $t('%Lt') }}
        </p>

        <ImageInput v-model="coverPhoto" :title="$t('%7M')" :resolutions="hs" :required="false" class="max" :max-height="null" />
        <p class="style-description-small">
            {{ $t('%Lr') }}
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import ImageInput from '@stamhoofd/components/inputs/ImageInput.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import type { Image, Organization } from '@stamhoofd/structures';
import { Group, GroupPrivateSettings, GroupSettings, OrganizationRegistrationPeriod, ResolutionFit, ResolutionRequest } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const props = defineProps<{
    group: Group;
    organization: Organization;
    period: OrganizationRegistrationPeriod;
    isNew: boolean;
    saveHandler: ((patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => Promise<void>);
}>();

const saving = ref(false);
const pop = usePop();
const errors = useErrors();

const { patch: patchPeriod, patched: patchedPeriod, addPatch: addPeriodPatch, hasChanges } = usePatch(props.period);

const patchedGroup = computed(() => {
    return patchedPeriod.value.groups.find(c => c.id === props.group.id) ?? props.group;
});

function addPatch(patch: AutoEncoderPatchType<Group>) {
    patch.id = props.group.id;
    const p = OrganizationRegistrationPeriod.patch({ id: props.period.id });
    p.groups.addPatch(patch);
    addPeriodPatch(p);
}

function addSettingsPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<GroupSettings>>) {
    addPatch(Group.patch({
        id: props.group.id,
        settings: GroupSettings.patch(patch),
    }));
}

function addPrivateSettingsPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<GroupPrivateSettings>>) {
    addPatch(Group.patch({
        id: props.group.id,
        privateSettings: GroupPrivateSettings.patch(patch),
    }));
}

const title = $t(`Omslagsfoto en icoontje`);

const coverPhoto = computed({
    get: () => patchedGroup.value.settings.coverPhoto,
    set: (coverPhoto: Image | null) => {
        addSettingsPatch(GroupSettings.patch({ coverPhoto }));
    },
});

const hs = [
    ResolutionRequest.create({ width: 1600 }),
    ResolutionRequest.create({ width: 800 }),
    ResolutionRequest.create({ height: 250, width: 250, fit: ResolutionFit.Cover }),
];

const squarePhoto = computed({
    get: () => patchedGroup.value.settings.squarePhoto,
    set: (squarePhoto: Image | null) => {
        addSettingsPatch(GroupSettings.patch({ squarePhoto }));
    },
});

const hsSquare = [
    ResolutionRequest.create({ width: 250, height: 250, fit: ResolutionFit.Inside }),
];

async function save() {
    if (saving.value) return;
    saving.value = true;

    try {
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }

        await props.saveHandler(patchPeriod.value);
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) return true;
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
