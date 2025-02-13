<template>
    <SaveView :title="isNew ? 'Sponsor toevoegen' : 'Sponsor bewerken'" :disabled="!hasChanges && !isNew" class="edit-sponsor-view" @save="save">
        <h1 v-if="isNew">
            Sponsor toevoegen
        </h1>
        <h1 v-else>
            Sponsor bewerken
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox title="Naam" error-fields="name" :error-box="errors.errorBox">
            <input
                ref="firstInput"
                v-model="name"
                class="input"
                type="text"
                placeholder="Naam van deze sponsor"
                autocomplete="off"
            >
        </STInputBox>

        <UrlInput v-model="url" :title="$t('0e17f20e-e0a6-4fa0-8ec4-378e4325bea5')" :validator="errors.validator" :required="false" />

        <p class="style-description-small">
            Op plaatsen waar technisch mogelijk, kan men op het logo klikken om de website te bezoeken.
        </p>

        <STList>
            <STListItem element-name="label" :selectable="true">
                <template #left>
                    <Checkbox v-model="onTickets" />
                </template>

                <h3 class="style-title-list">
                    Toon op tickets
                </h3>
            </STListItem>
        </STList>

        <hr>
        <h2 class="style-with-button">
            <div>Logo</div>
            <div>
                <button v-if="logo" type="button" class="button icon trash" @click="logo = null" />
                <UploadButton v-model="logo" :text="logo ? 'Vervangen' : 'Uploaden'" :resolutions="logoResolutions" />
            </div>
        </h2>
        <p>{{ $t('df8e9385-314f-4403-b0d5-e5893f68d442') }}</p>

        <ImageComponent v-if="logo" :image="logo" :max-height="150" :auto-height="true" />

        <hr>
        <h2 class="style-with-button">
            <div>Banner</div>
            <div>
                <button v-if="banner" type="button" class="button icon trash" @click="logo = null" />
                <UploadButton v-model="banner" :text="banner ? 'Vervangen' : 'Uploaden'" :resolutions="resolutions" />
            </div>
        </h2>
        <p>{{ $t('b375f5be-879c-4696-8ccf-0e7066e3f5f4') }}</p>

        <ImageComponent v-if="banner" :image="banner" :max-height="150" :auto-height="true" />

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijder deze sponsor
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
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
