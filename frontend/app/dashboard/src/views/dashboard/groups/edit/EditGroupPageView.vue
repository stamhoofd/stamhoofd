<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" class="group-edit-page-view" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <hr><h2 class="style-with-button">
            <div>{{ $t('%7M') }}</div>
            <div>
                <button v-if="coverPhoto" class="button text only-icon-smartphone" type="button" @click="coverPhoto = null">
                    <span class="icon trash" />
                    <span>{{ $t('%CJ') }}</span>
                </button>
                <UploadButton v-model="coverPhoto" :text="coverPhoto ? $t(`%He`) : $t(`%Hf`)" :resolutions="hs" />
            </div>
        </h2>

        <p>{{ $t('%Lr') }}</p>

        <figure v-if="coverPhotoSrc" class="cover-photo">
            <img :src="coverPhotoSrc" :width="coverImageWidth" :height="coverImageHeight">
        </figure>

        <hr><h2 class="style-with-button">
            <div>{{ $t('%Ls') }}</div>
            <div>
                <button v-if="squarePhoto" class="button text only-icon-smartphone" type="button" @click="squarePhoto = null">
                    <span class="icon trash" />
                    <span>{{ $t('%CJ') }}</span>
                </button>
                <UploadButton v-model="squarePhoto" :text="squarePhoto ? $t(`%He`) : $t(`%Hf`)" :resolutions="hsSquare" />
            </div>
        </h2>

        <p>{{ $t('%Lt') }}</p>

        <figure v-if="squarePhotoSrc" class="square-photo">
            <img :src="squarePhotoSrc">
        </figure>
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import UploadButton from '@stamhoofd/components/inputs/UploadButton.vue';
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

const title = 'Bijkomende informatie';

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

const coverPhotoResolution = computed(() => {
    const image = coverPhoto.value;
    if (!image) return null;
    return image.getResolutionForSize(800, 200);
});

const coverPhotoSrc = computed(() => coverPhotoResolution.value?.file.getPublicPath() ?? null);
const coverImageWidth = computed(() => coverPhotoResolution.value?.width);
const coverImageHeight = computed(() => coverPhotoResolution.value?.height);

const squarePhoto = computed({
    get: () => patchedGroup.value.settings.squarePhoto,
    set: (squarePhoto: Image | null) => {
        addSettingsPatch(GroupSettings.patch({ squarePhoto }));
    },
});

const hsSquare = [
    ResolutionRequest.create({ width: 250 }),
];

const squarePhotoSrc = computed(() => {
    const image = squarePhoto.value;
    if (!image) return null;
    return image.getResolutionForSize(250, 250).file.getPublicPath();
});

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
    }
    catch (e) {
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

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.group-edit-page-view {
    .cover-photo {
        height: 0;
        position: relative;
        padding-bottom: calc(750 / 1800 * 100%);
        background: $color-gray-3;
        border-radius: $border-radius;
        margin-top: 20px;

        img {
            border-radius: $border-radius;
            height: 100%;
            width: 100%;
            object-fit: cover;
            position: absolute;
            left: 0;
            top: 0;
        }
    }

    .square-photo {
        img {
            height: 200px;
            width: 200px;
            border-radius: $border-radius;
            object-fit: contain;
        }
    }

}
</style>
