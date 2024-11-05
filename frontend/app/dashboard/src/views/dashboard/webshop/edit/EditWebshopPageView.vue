<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" class="webshop-view-page" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox title="Titel" error-fields="meta.title" :error-box="errors.errorBox">
            <input
                v-model="title"
                class="input"
                type="text"
                placeholder="bv. Bestel je wafels"
                autocomplete=""
            >
        </STInputBox>

        <STInputBox title="Beschrijving" error-fields="meta.description" :error-box="errors.errorBox" class="max">
            <WYSIWYGTextInput
                v-model="description"
                placeholder="Beschrijving die op jouw webshop staat"
                :color="color || defaultColor"
            />
        </STInputBox>

        <hr>
        <h2>Layout</h2>

        <STList>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="layout" :value="WebshopLayout.Split" />
                </template>
                <h3 class="style-title-list">
                    Naast elkaar
                </h3>
                <p class="style-description">
                    Indien er voldoende plaats is. Meerdere artikels worden in lijstweergave getoond.
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="layout" :value="WebshopLayout.Default" />
                </template>
                <h3 class="style-title-list">
                    Onder elkaar
                </h3>
                <p class="style-description">
                    Meerdere artikels worden in vakjes getoond, indien er voldoende plaats is.
                </p>
            </STListItem>
        </STList>

        <hr>
        <h2 class="style-with-button">
            <div>Omslagfoto</div>
            <div>
                <button v-if="coverPhoto" type="button" class="button text only-icon-smartphone" @click="coverPhoto = null">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <UploadButton v-model="coverPhoto" :text="coverPhoto ? 'Vervangen' : 'Uploaden'" :resolutions="hs" />
            </div>
        </h2>

        <p>We raden aan om een foto van minstens 1600 pixels breed up te loaden. De foto zal volledig zichtbaar zijn, knip dus indien nodig bij voor het uploaden.</p>

        <figure v-if="coverPhotoSrc" class="webshop-banner">
            <img :src="coverPhotoSrc" :width="coverImageWidth" :height="coverImageHeight">
        </figure>

        <EditPolicyBox v-for="policy in policies" :key="policy.id" :policy="policy" :validator="errors.validator" :error-box="errors.errorBox" @patch="patchPolicy(policy, $event)" @delete="deletePolicy(policy)" />

        <hr>
        <h2 class="style-with-button">
            <div>Externe links</div>
            <div>
                <button type="button" class="button icon add" @click="addPolicy" />
            </div>
        </h2>
        <p>Soms wil je ook jouw algemene voorwaarden, retourbeleid, contactformulier en privacyvoorwaarden op jouw webshop vermelden. Als je online betaalmethodes wilt gebruiken, kan dit noodzakelijk zijn. Deze links worden dan onderaan jouw webshop toegevoegd.</p>

        <p v-if="policies.length === 0" class="info-box">
            Je hebt momenteel geen externe links toegevoegd.
        </p>
        <p v-if="policies.length > 0 && (organization?.meta.privacyPolicyFile || organization?.meta.privacyPolicyUrl)" class="warning-box">
            De privacyvoorwaarden die je bij de algemene instellingen hebt ingesteld, worden niet weergegeven in deze webshop. Voeg deze ook toe als externe link als je dezelfde privacy voorwaarden op deze webshop wilt vermelden.
        </p>

        <hr>
        <h2>Kleuren</h2>
        <p>
            Je kan de hoofdkleur voor al je webshops instellen via de algemene instellingen → Personaliseren. Dan hoef je het niet voor elke webshop apart in te stellen. Het kleur hier invullen heeft enkel nut als je het bewust anders wilt instellen.
        </p>

        <ColorInput v-model="color" title="Hoofdkleur (optioneel)" :validator="errors.validator" placeholder="Standaardkleur" :required="false" :disallowed="['#FFFFFF']" />
        <p class="style-description-small">
            Vul hierboven de HEX-kleurcode van jouw hoofdkleur in. Laat leeg om de kleur van je vereniging te behouden (bij algemene instellingen > personalisatie).
        </p>

        <STInputBox title="Donkere mode" error-fields="meta.darkMode" :error-box="errors.errorBox" class="max">
            <RadioGroup>
                <Radio v-model="darkMode" :value="'Off'">
                    Uit
                </Radio>
                <Radio v-model="darkMode" :value="'On'">
                    Aan
                </Radio>
                <Radio v-model="darkMode" :value="'Auto'">
                    Automatisch
                </Radio>
            </RadioGroup>
        </STInputBox>
        <p v-if="darkMode !== 'Off'" class="style-description-small">
            Test zeker het contrast van jouw gekozen kleur en logo als je voor een donkere modus kiest.
        </p>

        <hr>
        <h2>Logo</h2>
        <p>
            Je kan een logo voor al je webshops instellen via de algemene instellingen > personalisatie. Dan hoef je het niet voor elke webshop apart in te stellen.
        </p>

        <Checkbox v-model="useLogo">
            Logo van vereniging gebruiken
        </Checkbox>

        <LogoEditor v-if="!useLogo" :meta-data="webshop.meta" :validator="errors.validator" :dark-mode="darkMode" @patch="addMetaPatch" />

        <template v-if="hasTickets">
            <hr>
            <EditSponsorsBox :config="sponsorConfig" @patch="patchSponsorConfig" />

            <p class="style-button-bar">
                <button type="button" class="button text" @click="previewTicket">
                    <span class="icon eye" /><span>Ticketvoorbeeld</span>
                </button>
            </p>
        </template>

        <template v-if="STAMHOOFD.platformName === 'stamhoofd'">
            <hr>
            <h2>{{ $t("405a811e-ebb1-4948-84cd-8fb5860104e6") }}</h2>
            <p>
                {{ $t('768afe13-5f57-4a82-a6ac-77c8999b8aeb') }}
            </p>

            <Checkbox v-model="reduceBranding">
                {{ $t('f8f3a5be-624a-4d39-b401-78ad833b64dd') }}
            </Checkbox>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { Checkbox, ColorInput, DetailedTicketView, LogoEditor, Radio, RadioGroup, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, UploadButton, useOrganization, WYSIWYGTextInput } from '@stamhoofd/components';
import { Cart, CartItem, CartReservedSeat, DarkMode, Image, Policy, PrivateWebshop, ProductType, ResolutionRequest, RichText, SponsorConfig, TicketPublic, WebshopLayout, WebshopMetaData } from '@stamhoofd/structures';

import { computed } from 'vue';
import EditSponsorsBox from '../../sponsors/EditSponsorsBox.vue';
import EditPolicyBox from './EditPolicyBox.vue';
import { useEditWebshop, UseEditWebshopProps } from './useEditWebshop';

const props = defineProps<UseEditWebshopProps>();

const { webshop, addPatch, errors, saving, save, hasChanges } = useEditWebshop({
    getProps: () => props,
});
const present = usePresent();
const organization = useOrganization();
const viewTitle = 'Webshop pagina wijzigen';

const hasTickets = computed(() => webshop.value.hasTickets);

function addMetaPatch(patch: AutoEncoderPatchType<WebshopMetaData>) {
    addPatch(PrivateWebshop.patch({ meta: patch }));
}

function patchPolicy(policy: Policy, patch: AutoEncoderPatchType<Policy>) {
    const p = WebshopMetaData.patch({});
    patch.id = policy.id;
    p.policies.addPatch(patch);
    addPatch(PrivateWebshop.patch({ meta: p }));
}

function deletePolicy(policy: Policy) {
    const p = WebshopMetaData.patch({});
    p.policies.addDelete(policy.id);
    addPatch(PrivateWebshop.patch({ meta: p }));
}

function addPolicy() {
    const p = WebshopMetaData.patch({});
    p.policies.addPut(Policy.create({}));
    addPatch(PrivateWebshop.patch({ meta: p }));
}

const policies = computed(() => webshop.value.meta.policies);
const title = computed({
    get: () => webshop.value.meta.title,
    set: (title: string) => {
        const patch = WebshopMetaData.patch({ title });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const description = computed({
    get: () => webshop.value.meta.description,
    set: (description: RichText) => {
        const patch = WebshopMetaData.patch({ description });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const reduceBranding = computed({
    get: () => webshop.value.meta.reduceBranding,
    set: (reduceBranding: boolean) => {
        const patch = WebshopMetaData.patch({ reduceBranding });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const layout = computed({
    get: () => webshop.value.meta.layout,
    set: (layout: WebshopLayout) => {
        const patch = WebshopMetaData.patch({ layout });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const color = computed({
    get: () => webshop.value.meta.color,
    set: (color: string | null) => {
        const patch = WebshopMetaData.patch({ color });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const darkMode = computed({
    get: () => webshop.value.meta.darkMode,
    set: (darkMode: DarkMode) => {
        const patch = WebshopMetaData.patch({ darkMode });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const useLogo = computed({
    get: () => !webshop.value.meta.useLogo,
    set: (useLogo: boolean) => {
        addMetaPatch(WebshopMetaData.patch({ useLogo: !useLogo }));
    },
});

const defaultColor = computed(() => organization.value?.meta.color ?? null);

const coverPhoto = computed({
    get: () => webshop.value.meta.coverPhoto,
    set: (coverPhoto: Image | null) => {
        const patch = WebshopMetaData.patch({ coverPhoto });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const hs = [
    ResolutionRequest.create({
        width: 1800,
    }),
    ResolutionRequest.create({
        width: 900,
    }),
];

const coverPhotoResolution = computed(() => {
    const image = coverPhoto.value;
    if (!image) {
        return null;
    }
    return image.getResolutionForSize(800, 200);
});

const coverPhotoSrc = computed(() => {
    const image = coverPhoto.value;
    if (!image) {
        return null;
    }
    return coverPhotoResolution.value?.file.getPublicPath();
});

const coverImageWidth = computed(() => coverPhotoResolution.value?.width);
const coverImageHeight = computed(() => coverPhotoResolution.value?.height);
const sponsorConfig = computed(() => webshop.value.meta.sponsors);

function patchSponsorConfig(config: AutoEncoderPatchType<SponsorConfig> | null) {
    addMetaPatch(WebshopMetaData.patch({ sponsors: config }));
}

function previewTicket() {
    // Example product:
    const product = webshop.value.products.find(p => p.type === ProductType.Ticket) ?? webshop.value.products[0];

    if (!product) {
        new Toast('Voeg ten minste één ticket toe aan je webshop om een voorbeeld van een ticket te bekijken', 'error red').show();
        return;
    }
    const cart = Cart.create({});
    const item = CartItem.createDefault(product, cart, webshop.value, { admin: true });

    const seatingPlan = product.seatingPlanId ? webshop.value.meta.seatingPlans.find(s => s.id === product.seatingPlanId) : null;
    const section = seatingPlan ? seatingPlan.sections[0] : null;
    const row = section ? section.rows.filter(r => r.label && r.seatCount > 0)[Math.floor(section.rows.filter(r => r.label && r.seatCount > 0).length / 2)] : null;
    const seat = row ? row.seats.filter(s => s.isValidSeat)[Math.floor(row.seats.filter(s => s.isValidSeat).length / 2)] : null;

    const reservedSeat = seat
        ? CartReservedSeat.create({
            section: section!.id,
            row: row!.label,
            seat: seat.label,
        })
        : null;

    if (reservedSeat && seatingPlan) {
        reservedSeat.calculatePrice(seatingPlan);
    }

    const ticket = TicketPublic.create({
        items: [item],
        secret: 'VRBLDTICKET',
        index: 1,
        total: 1,
        seat: reservedSeat,
    });

    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(DetailedTicketView, {
                    organization: organization.value,
                    webshop: webshop.value,
                    ticket,
                }),
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.webshop-view-page {
    .image {
        display: block;
        max-width: 100%;
        max-height: 200px;
        width: auto;
        height: auto;
    }

     .webshop-banner {
        height: 300px;
        background: $color-gray-3;
        border-radius: $border-radius;
        margin-top: 20px;

        img {
            border-radius: $border-radius;
            height: 100%;
            width: 100%;
            object-fit: cover;
        }

        @media (max-width: 800px) {
            border-radius: 0;
            margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
            margin-top: 20px;
            height: calc(100vw / 720 * 300);

            img {
                border-radius: 0;
            }
        }
    }
}
</style>
