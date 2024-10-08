<template>
    <SaveView :title="isNew ? 'Sponsor toevoegen' : 'Sponsor bewerken'" :disabled="!hasChanges && !isNew" class="edit-sponsor-view" @save="save">
        <h1 v-if="isNew">
            Sponsor toevoegen
        </h1>
        <h1 v-else>
            Sponsor bewerken
        </h1>

        <STErrorsDefault :error-box="errorBox" />
        <STInputBox title="Naam" error-fields="name" :error-box="errorBox">
            <input
                ref="firstInput"
                v-model="name"
                class="input"
                type="text"
                placeholder="Naam van deze sponsor"
                autocomplete=""
            >
        </STInputBox>

        <UrlInput v-model="url" :title="$t('0e17f20e-e0a6-4fa0-8ec4-378e4325bea5')" :validator="validator" :required="false" />

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

<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage, Checkbox, ErrorBox, ImageComponent, NumberInput, PriceInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, UploadButton, UrlInput, Validator } from '@stamhoofd/components';
import { Image, ResolutionRequest, Sponsor, Version } from '@stamhoofd/structures';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        PriceInput,
        NumberInput,
        STList,
        STListItem,
        Checkbox,
        UploadButton,
        UrlInput,
        ImageComponent,
    },
})
export default class EditSponsorView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null;
    validator = new Validator();

    @Prop({ required: true })
    sponsor: Sponsor;

    @Prop({ required: true })
    isNew!: boolean;

    patchSponsor: AutoEncoderPatchType<Sponsor> = Sponsor.patch({});

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
    saveHandler: ((patch: AutoEncoderPatchType<Sponsor>) => void);

    @Prop({ required: false })
    deleteHandler: (() => void);

    get patchedSponsor() {
        return this.sponsor.patch(this.patchSponsor);
    }

    get name() {
        return this.patchedSponsor.name;
    }

    set name(name: string) {
        this.addPatch(Sponsor.patch({ name }));
    }

    get url() {
        return this.patchedSponsor.url;
    }

    set url(url: string | null) {
        this.addPatch(Sponsor.patch({ url: url ? url : null }));
    }

    get onTickets() {
        return this.patchedSponsor.onTickets;
    }

    set onTickets(onTickets: boolean) {
        this.addPatch(Sponsor.patch({ onTickets }));
    }

    addPatch(patch: AutoEncoderPatchType<Sponsor>) {
        this.patchSponsor = this.patchSponsor.patch(patch);
    }

    async save() {
        if (!await this.validator.validate()) {
            return;
        }

        try {
            this.saveHandler(this.patchSponsor);
            this.pop({ force: true });
        }
        catch (e) {
            this.errorBox = new ErrorBox(e);
        }
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm('Ben je zeker dat je deze keuze wilt verwijderen?', 'Verwijderen')) {
            return;
        }
        this.deleteHandler();
        this.pop({ force: true });
    }

    get hasChanges() {
        return patchContainsChanges(this.patchSponsor, this.sponsor, { version: Version });
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
    }

    get logo() {
        return this.patchedSponsor.logo;
    }

    set logo(logo: Image | null) {
        const p = Sponsor.patch({
            logo,
        });
        this.addPatch(p);
    }

    get banner() {
        return this.patchedSponsor.banner;
    }

    set banner(banner: Image | null) {
        const p = Sponsor.patch({
            banner,
        });
        this.addPatch(p);
    }

    get logoResolutions() {
        return [
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
    }

    get resolutions() {
        return [
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
    }
}
</script>
