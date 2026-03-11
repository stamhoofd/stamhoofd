<template>
    <SaveView :title="isNew ? $t(`%tz`) : $t(`%PM`)" :disabled="!hasChanges && !isNew" class="edit-sponsor-view" @save="save">
        <h1 v-if="isNew">
            {{ $t('%tz') }}
        </h1>
        <h1 v-else>
            {{ $t('%PM') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`%Gq`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`%PQ`)">
        </STInputBox>

        <UrlInput v-model="url" :title="$t('%5I')" :validator="errors.validator" :required="false" />

        <p class="style-description-small">
            {{ $t('%PN') }}
        </p>

        <STList>
            <STListItem element-name="label" :selectable="true">
                <template #left>
                    <Checkbox v-model="onTickets" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%PO') }}
                </h3>
            </STListItem>
        </STList>

        <hr><h2 class="style-with-button">
            <div>{{ $t('%2D') }}</div>
            <div>
                <button v-if="logo" type="button" class="button icon trash" @click="logo = null" />
                <UploadButton v-model="logo" :text="logo ? $t(`%He`) : $t(`%Hf`)" :resolutions="logoResolutions" />
            </div>
        </h2>
        <p>{{ $t('%4D') }}</p>

        <ImageComponent v-if="logo" :image="logo" :max-height="150" :auto-height="true" />

        <hr><h2 class="style-with-button">
            <div>{{ $t('%22') }}</div>
            <div>
                <button v-if="banner" type="button" class="button icon trash" @click="logo = null" />
                <UploadButton v-model="banner" :text="banner ? $t(`%He`) : $t(`%Hf`)" :resolutions="resolutions" />
            </div>
        </h2>
        <p>{{ $t('%4E') }}</p>

        <ImageComponent v-if="banner" :image="banner" :max-height="150" :auto-height="true" />

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('%PP') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('%CJ') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, ErrorBox, ImageComponent, SaveView, STErrorsDefault, STInputBox, STList, STListItem, UploadButton, UrlInput, useErrors, usePatch } from '@stamhoofd/components';
import { Image, ResolutionRequest, Sponsor } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    sponsor: Sponsor;
    isNew: boolean;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: ((patch: AutoEncoderPatchType<Sponsor>) => void);
    deleteHandler?: (() => void);
}>();

const errors = useErrors();
const pop = usePop();

const { patch: patchSponsor, patched: patchedSponsor, addPatch, hasChanges } = usePatch(props.sponsor);

const name = computed({
    get: () => patchedSponsor.value.name,
    set: (name: string) => {
        addPatch(Sponsor.patch({ name }));
    },
});

const url = computed({
    get: () => patchedSponsor.value.url,
    set: (url: string | null) => {
        addPatch(Sponsor.patch({ url: url ? url : null }));
    },
});

const onTickets = computed({
    get: () => patchedSponsor.value.onTickets,
    set: (onTickets: boolean) => {
        addPatch(Sponsor.patch({ onTickets }));
    },
});

async function save() {
    if (!await errors.validator.validate()) {
        return;
    }

    try {
        props.saveHandler(patchSponsor.value);
        pop({ force: true })?.catch(console.error);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function deleteMe() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze keuze wilt verwijderen?', 'Verwijderen')) {
        return;
    }
    if (props.deleteHandler) {
        props.deleteHandler();
    }
    pop({ force: true })?.catch(console.error);
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

const logo = computed({
    get: () => patchedSponsor.value.logo,
    set: (logo: Image | null) => {
        const p = Sponsor.patch({
            logo,
        });
        addPatch(p);
    },
});

const banner = computed({
    get: () => patchedSponsor.value.banner,
    set: (banner: Image | null) => {
        const p = Sponsor.patch({
            banner,
        });
        addPatch(p);
    },
});

const logoResolutions = [
    ResolutionRequest.create({
        height: 80,
    }),
    ResolutionRequest.create({
        height: 80 * 2,
    }),
    ResolutionRequest.create({
        height: 80 * 3,
    }),
];

const resolutions = [
    ResolutionRequest.create({
        height: 150,
    }),
    ResolutionRequest.create({
        height: 300,
    }),
    ResolutionRequest.create({
        height: 450,
    }),
];

defineExpose({
    shouldNavigateAway,
});
</script>
