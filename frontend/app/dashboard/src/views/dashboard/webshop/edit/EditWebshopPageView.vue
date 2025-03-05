<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" class="webshop-view-page" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errors.errorBox"/>
        <STInputBox error-fields="meta.title" :error-box="errors.errorBox" :title="$t(`04043e8a-6a58-488e-b538-fea133738532`)">
            <input v-model="title" class="input" type="text" autocomplete="off" :placeholder="$t(`bce04920-960b-4ca2-98f0-b8bf9d6bd931`)"></STInputBox>

        <STInputBox error-fields="meta.description" :error-box="errors.errorBox" class="max" :title="$t(`f72f5546-ed6c-4c93-9b0d-9718f0cc9626`)">
            <WYSIWYGTextInput v-model="description" :color="color || defaultColor" :placeholder="$t(`e9dc4086-e5ff-448b-9b48-ccef46fd3526`)"/>
        </STInputBox>

        <hr><h2>{{ $t('220faaac-3fbe-417b-8489-d39e9ca0cb9a') }}</h2>

        <STList>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="layout" :value="WebshopLayout.Split"/>
                </template>
                <h3 class="style-title-list">
                    {{ $t('7cc86462-1d1b-4c15-bdef-0c5d4f7f1072') }}
                </h3>
                <p class="style-description">
                    {{ $t('a0ca5829-ca61-47d3-a8ee-aab42fb22a11') }}
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="layout" :value="WebshopLayout.Default"/>
                </template>
                <h3 class="style-title-list">
                    {{ $t('8a693f43-cb17-4f47-ba29-56a2b0649e07') }}
                </h3>
                <p class="style-description">
                    {{ $t('f3c29565-754d-40c4-992c-15f90bd5b9a4') }}
                </p>
            </STListItem>
        </STList>

        <hr><h2 class="style-with-button">
            <div>{{ $t('e4a90efd-a536-472b-8f3f-cbd0fac0ba82') }}</div>
            <div>
                <button v-if="coverPhoto" type="button" class="button text only-icon-smartphone" @click="coverPhoto = null">
                    <span class="icon trash"/>
                    <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
                </button>
                <UploadButton v-model="coverPhoto" :text="coverPhoto ? $t(`c01d3d4e-ad4e-45ec-abac-431462c194cf`) : $t(`3370bb72-2817-4096-83ce-318993436513`)" :resolutions="hs"/>
            </div>
        </h2>

        <p>{{ $t('52324943-6f81-4989-b599-b1a98b249a3b') }}</p>

        <figure v-if="coverPhotoSrc" class="webshop-banner">
            <img :src="coverPhotoSrc" :width="coverImageWidth" :height="coverImageHeight"></figure>

        <EditPolicyBox v-for="policy in policies" :key="policy.id" :policy="policy" :validator="errors.validator" :error-box="errors.errorBox" @patch="patchPolicy(policy, $event)" @delete="deletePolicy(policy)"/>

        <hr><h2 class="style-with-button">
            <div>{{ $t('6fc43483-40b4-4444-9824-6d2ffd4813de') }}</div>
            <div>
                <button type="button" class="button icon add" @click="addPolicy"/>
            </div>
        </h2>
        <p>{{ $t('e5189e3f-47eb-4dce-9761-1e99c86a0491') }}</p>

        <p v-if="policies.length === 0" class="info-box">
            {{ $t('b395c7be-7fa9-4704-ac91-531101fa9dda') }}
        </p>
        <p v-if="policies.length > 0 && (organization?.meta.privacyPolicyFile || organization?.meta.privacyPolicyUrl)" class="warning-box">
            {{ $t('cc66a8ee-03a0-4629-854b-a20931ba8ddb') }}
        </p>

        <hr><h2>{{ $t('aeaee12f-20ab-44fa-b7e4-ab1582f7150c') }}</h2>
        <p>
            {{ $t('f0c7b7ce-2365-4b8f-83e1-0d9c5822d6e7') }}
        </p>

        <ColorInput v-model="color" :validator="errors.validator" :required="false" :disallowed="['#FFFFFF']" :title="$t(`14a3d334-8815-495c-8941-cd6842b1a88e`)" :placeholder="$t(`cc6fc88a-f1e0-4e0e-b114-8ca89d0f7abf`)"/>
        <p class="style-description-small">
            {{ $t('7c796093-d146-4972-98ba-c01d164afae4') }}
        </p>

        <STInputBox error-fields="meta.darkMode" :error-box="errors.errorBox" class="max" :title="$t(`3de59df8-f514-49b6-bafd-30bb5ec8d099`)">
            <RadioGroup>
                <Radio v-model="darkMode" :value="'Off'">
                    {{ $t('0e218b0a-a928-44ae-b929-7fa18622d24c') }}
                </Radio>
                <Radio v-model="darkMode" :value="'On'">
                    {{ $t('7345a83c-bd68-4d70-90fa-eaa75922cd43') }}
                </Radio>
                <Radio v-model="darkMode" :value="'Auto'">
                    {{ $t('333ca484-4ab6-40a2-bc61-e77313ac96bd') }}
                </Radio>
            </RadioGroup>
        </STInputBox>
        <p v-if="darkMode !== 'Off'" class="style-description-small">
            {{ $t('9c8b8fdf-ed2d-4743-92ee-7b67069564dd') }}
        </p>

        <hr><h2>{{ $t('f1b4c303-d49b-4e3f-849c-589bb8b8348a') }}</h2>
        <p>
            {{ $t('5dd1a323-20a1-4c5a-b978-1c063a086f6a') }}
        </p>

        <Checkbox v-model="useLogo">
            {{ $t('1f2ece8a-d98c-4d15-840d-cdd8b73a8b53') }}
        </Checkbox>

        <LogoEditor v-if="!useLogo" :meta-data="webshop.meta" :validator="errors.validator" :dark-mode="darkMode" @patch="addMetaPatch"/>

        <template v-if="hasTickets">
            <hr><EditSponsorsBox :config="sponsorConfig" @patch="patchSponsorConfig"/>

            <p class="style-button-bar">
                <button type="button" class="button text" @click="previewTicket">
                    <span class="icon eye"/><span>{{ $t('d5ccda07-464d-470b-a76e-720740744f66') }}</span>
                </button>
            </p>
        </template>

        <template v-if="STAMHOOFD.platformName === 'stamhoofd'">
            <hr><h2>{{ $t("405a811e-ebb1-4948-84cd-8fb5860104e6") }}</h2>
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
