<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" class="webshop-view-page" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="meta.title" :error-box="errors.errorBox" :title="$t(`cbe7db4a-b65b-452b-a5d2-d369182fd28f`)">
            <input v-model="title" class="input" type="text" autocomplete="off" :placeholder="$t(`4915968a-8d8d-4632-8ad8-27965c3e3dba`)">
        </STInputBox>

        <STInputBox error-fields="meta.description" :error-box="errors.errorBox" class="max" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)">
            <WYSIWYGTextInput v-model="description" :color="color || defaultColor" :placeholder="$t(`8cc2eb71-2a22-4a82-9a60-33c91dc9a829`)" />
        </STInputBox>

        <hr><h2>{{ $t('cdd1fd85-1c4e-416b-b166-48a4ee6ee51f') }}</h2>

        <STList>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="layout" :value="WebshopLayout.Split" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('672ceeaf-53d2-4281-8e0d-05eaea6a614a') }}
                </h3>
                <p class="style-description">
                    {{ $t('18444ea0-bbae-4acb-bf53-71df2badf2fb') }}
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="layout" :value="WebshopLayout.Default" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('4179cc8f-b7a1-4b19-ab06-3187eb699023') }}
                </h3>
                <p class="style-description">
                    {{ $t('e38aa6c0-8d5c-4eea-8a7e-491ce22c4b98') }}
                </p>
            </STListItem>
        </STList>

        <hr><h2 class="style-with-button">
            <div>{{ $t('b8a111c0-5f3d-480b-833a-6d7f05bf134d') }}</div>
            <div>
                <button v-if="coverPhoto" type="button" class="button text only-icon-smartphone" @click="coverPhoto = null">
                    <span class="icon trash" />
                    <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
                </button>
                <UploadButton v-model="coverPhoto" :text="coverPhoto ? $t(`b7c71a71-9523-4748-a6cd-80b9314b05b2`) : $t(`5be27263-6804-4f1c-92b0-f20cdacc141b`)" :resolutions="hs" />
            </div>
        </h2>

        <p>{{ $t('fa7399a8-7628-49fd-b5b5-2dfa757494f6') }}</p>

        <figure v-if="coverPhotoSrc" class="webshop-banner">
            <img :src="coverPhotoSrc" :width="coverImageWidth" :height="coverImageHeight">
        </figure>

        <EditPolicyBox v-for="policy in policies" :key="policy.id" :policy="policy" :validator="errors.validator" :error-box="errors.errorBox" @patch="patchPolicy(policy, $event)" @delete="deletePolicy(policy)" />

        <hr><h2 class="style-with-button">
            <div>{{ $t('0ee815f9-8937-43f6-9332-83d5b80415c4') }}</div>
            <div>
                <button type="button" class="button icon add" @click="addPolicy" />
            </div>
        </h2>
        <p>{{ $t('602bda22-49ba-4460-b478-0f432c369102') }}</p>

        <p v-if="policies.length === 0" class="info-box">
            {{ $t('b639cbb2-6fd1-464e-aa2a-6e01c5d4d125') }}
        </p>
        <p v-if="policies.length > 0 && (organization?.meta.privacyPolicyFile || organization?.meta.privacyPolicyUrl)" class="warning-box">
            {{ $t('63ec0782-6f98-480c-a150-b6e0870d49f4') }}
        </p>

        <hr><h2>{{ $t('f1cf2763-71a1-4376-82c8-48509e573f8c') }}</h2>
        <p>
            {{ $t('2f311e82-a71b-4ef6-9902-715fb1a8486a') }}
        </p>

        <ColorInput v-model="color" :validator="errors.validator" :required="false" :disallowed="['#FFFFFF']" :title="$t(`d111d211-9cc2-48be-9c8f-9483dded7fef`)" :placeholder="$t(`d53646df-1caa-49a7-8181-22319561de36`)" />
        <p class="style-description-small">
            {{ $t('c244a546-ac11-4aee-be3e-99b0b6079703') }}
        </p>

        <STInputBox error-fields="meta.darkMode" :error-box="errors.errorBox" class="max" :title="$t(`c199c994-944e-4bd6-91dd-b43b8883165d`)">
            <RadioGroup>
                <Radio v-model="darkMode" :value="'Off'">
                    {{ $t('a858109d-d5b8-447c-9288-ef496e118c9a') }}
                </Radio>
                <Radio v-model="darkMode" :value="'On'">
                    {{ $t('17a71942-a3d7-4d19-97bb-307cabffc1d6') }}
                </Radio>
                <Radio v-model="darkMode" :value="'Auto'">
                    {{ $t('674bcea5-c383-4cdb-a6ae-bf9330a97f45') }}
                </Radio>
            </RadioGroup>
        </STInputBox>
        <p v-if="darkMode !== 'Off'" class="style-description-small">
            {{ $t('ca3f89e1-c922-496a-992e-82919c959b80') }}
        </p>

        <hr><h2>{{ $t('d101ec4a-219f-4f23-afa0-e8dc4862c354') }}</h2>
        <p>
            {{ $t('89e0fd6e-3069-41d8-8e2b-74caf363b956') }}
        </p>

        <Checkbox v-model="useLogo">
            {{ $t('d8662e1d-2f43-4342-91de-ef9a44cf3e86') }}
        </Checkbox>

        <LogoEditor v-if="!useLogo" :meta-data="webshop.meta" :validator="errors.validator" :dark-mode="darkMode" @patch="addMetaPatch" />

        <template v-if="hasTickets">
            <hr><EditSponsorsBox :config="sponsorConfig" @patch="patchSponsorConfig" />

            <p class="style-button-bar">
                <button type="button" class="button text" @click="previewTicket">
                    <span class="icon eye" /><span>{{ $t('d23266af-9e15-4e53-8863-4e3fa7c53fd0') }}</span>
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

        <div v-if="hasFullAccess && areAdvancedWebshopSettingsEnabled" class="container">
            <hr>
            <h2>{{ $t('badafccc-80ac-4716-87dc-0385f4741af7') }}</h2>
            <p v-if="!hasCustomDomain" class="info-box">
                {{ $t('4b9e6ec2-a698-43b7-aa6e-be4b05dfd34e') }}
            </p>
            <STInputBox error-fields="meta.customCode" :error-box="errors.errorBox" class="max" :title="$t('239382e0-0906-4e0f-ba1a-c58574b92e78')">
                <textarea v-model="customCode" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t('887a8ef4-989d-4dff-a565-d67fdcb95c48')" :disabled="!hasCustomDomain" />
            </STInputBox>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { Checkbox, ColorInput, DetailedTicketView, LogoEditor, Radio, RadioGroup, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, UploadButton, useAuth, useFeatureFlag, useOrganization, WYSIWYGTextInput } from '@stamhoofd/components';
import { Cart, CartItem, CartReservedSeat, DarkMode, Image, Policy, PrivateWebshop, ProductType, ResolutionRequest, RichText, SponsorConfig, TicketPublic, WebshopLayout, WebshopMetaData } from '@stamhoofd/structures';

import { computed } from 'vue';
import EditSponsorsBox from '../../sponsors/EditSponsorsBox.vue';
import EditPolicyBox from './EditPolicyBox.vue';
import { useEditWebshop, UseEditWebshopProps } from './useEditWebshop';

const props = defineProps<UseEditWebshopProps>();

const { webshop, addPatch, errors, saving, save, hasChanges, shouldNavigateAway } = useEditWebshop({
    getProps: () => props,
});
const present = usePresent();
const organization = useOrganization();
const viewTitle = 'Webshop pagina wijzigen';
const auth = useAuth();
const hasFullAccess = computed(() => auth.permissions?.hasFullAccess() ?? false);

const areAdvancedWebshopSettingsEnabled = useFeatureFlag()('webshop-advanced-settings');

const hasTickets = computed(() => webshop.value.hasTickets);

const hasCustomDomain = computed(() => webshop.value.hasCustomDomain || STAMHOOFD.environment === 'development');

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

const customCode = computed({
    get: () => webshop.value.meta.customCode ?? '',
    set: (customCode: string) => {
        const patch = WebshopMetaData.patch({ customCode });
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

defineExpose({
    shouldNavigateAway,
});
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
