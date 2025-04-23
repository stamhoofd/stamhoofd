<template>
    <SaveView :title="isNew ? $t(`7230cd66-d5b3-4f3e-9cf6-27f5486b52f1`) : $t(`b5de4be6-b533-4949-97d8-ad8f1d3ca896`)" :disabled="!hasChanges && !isNew" class="edit-sponsor-view" @save="save">
        <h1 v-if="isNew">
            {{ $t('84c9db16-05a3-42a1-a10f-db4514f314d4') }}
        </h1>
        <h1 v-else>
            {{ $t('8f236ffd-4cf4-49e7-9056-78105932ea83') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`a67e18e6-6159-40c9-8515-4de601ff586b`)">
        </STInputBox>

        <UrlInput v-model="url" :title="$t('0e17f20e-e0a6-4fa0-8ec4-378e4325bea5')" :validator="errors.validator" :required="false" />

        <p class="style-description-small">
            {{ $t('aca8abb6-64f7-4554-99bb-d7b721be80af') }}
        </p>

        <STList>
            <STListItem element-name="label" :selectable="true">
                <template #left>
                    <Checkbox v-model="onTickets" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('a5c520a9-1351-4bca-ad1f-c71550f6c017') }}
                </h3>
            </STListItem>
        </STList>

        <hr><h2 class="style-with-button">
            <div>{{ $t('d101ec4a-219f-4f23-afa0-e8dc4862c354') }}</div>
            <div>
                <button v-if="logo" type="button" class="button icon trash" @click="logo = null" />
                <UploadButton v-model="logo" :text="logo ? $t(`b7c71a71-9523-4748-a6cd-80b9314b05b2`) : $t(`5be27263-6804-4f1c-92b0-f20cdacc141b`)" :resolutions="logoResolutions" />
            </div>
        </h2>
        <p>{{ $t('df8e9385-314f-4403-b0d5-e5893f68d442') }}</p>

        <ImageComponent v-if="logo" :image="logo" :max-height="150" :auto-height="true" />

        <hr><h2 class="style-with-button">
            <div>{{ $t('c56ee3f1-b83d-4118-a703-6f98450508cd') }}</div>
            <div>
                <button v-if="banner" type="button" class="button icon trash" @click="logo = null" />
                <UploadButton v-model="banner" :text="banner ? $t(`b7c71a71-9523-4748-a6cd-80b9314b05b2`) : $t(`5be27263-6804-4f1c-92b0-f20cdacc141b`)" :resolutions="resolutions" />
            </div>
        </h2>
        <p>{{ $t('b375f5be-879c-4696-8ccf-0e7066e3f5f4') }}</p>

        <ImageComponent v-if="banner" :image="banner" :max-height="150" :auto-height="true" />

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('092a4a76-8fa0-4a51-b629-dfac29ec2e15') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
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
