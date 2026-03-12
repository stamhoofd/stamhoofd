<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" class="webshop-view-page" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="meta.title" :error-box="errors.errorBox" :title="$t(`%vC`)">
            <input v-model="title" class="input" type="text" autocomplete="off" :placeholder="$t(`%Rb`)">
        </STInputBox>

        <STInputBox error-fields="meta.description" :error-box="errors.errorBox" class="max" :title="$t(`%6o`)">
            <WYSIWYGTextInput v-model="description" :color="color || defaultColor" :placeholder="$t(`%Rc`)" />
        </STInputBox>

        <hr><h2>{{ $t('%2A') }}</h2>

        <STList>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="layout" :value="WebshopLayout.Split" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%RI') }}
                </h3>
                <p class="style-description">
                    {{ $t('%RJ') }}
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="layout" :value="WebshopLayout.Default" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%RK') }}
                </h3>
                <p class="style-description">
                    {{ $t('%RL') }}
                </p>
            </STListItem>
        </STList>

        <hr><h2 class="style-with-button">
            <div>{{ $t('%7M') }}</div>
            <div>
                <button v-if="coverPhoto" type="button" class="button text only-icon-smartphone" @click="coverPhoto = null">
                    <span class="icon trash" />
                    <span>{{ $t('%CJ') }}</span>
                </button>
                <UploadButton v-model="coverPhoto" :text="coverPhoto ? $t(`%He`) : $t(`%Hf`)" :resolutions="hs" />
            </div>
        </h2>

        <p>{{ $t('%RM') }}</p>

        <figure v-if="coverPhotoSrc" class="webshop-banner">
            <img :src="coverPhotoSrc" :width="coverImageWidth" :height="coverImageHeight">
        </figure>

        <EditPolicyBox v-for="policy in policies" :key="policy.id" :policy="policy" :validator="errors.validator" :error-box="errors.errorBox" @patch="patchPolicy(policy, $event)" @delete="deletePolicy(policy)" />

        <hr><h2 class="style-with-button">
            <div>{{ $t('%RN') }}</div>
            <div>
                <button type="button" class="button icon add" @click="addPolicy" />
            </div>
        </h2>
        <p>{{ $t('%RO') }}</p>

        <p v-if="policies.length === 0" class="info-box">
            {{ $t('%RP') }}
        </p>
        <p v-if="policies.length > 0 && (organization?.meta.privacyPolicyFile || organization?.meta.privacyPolicyUrl)" class="warning-box">
            {{ $t('%RQ') }}
        </p>

        <hr><h2>{{ $t('%RR') }}</h2>
        <p>
            {{ $t('%RS') }}
        </p>

        <ColorInput v-model="color" :validator="errors.validator" :required="false" :disallowed="['#FFFFFF']" :title="$t(`%OQ`)" :placeholder="$t(`%Rd`)" />
        <p class="style-description-small">
            {{ $t('%RT') }}
        </p>

        <STInputBox error-fields="meta.darkMode" :error-box="errors.errorBox" class="max" :title="$t(`%Re`)">
            <RadioGroup>
                <Radio v-model="darkMode" :value="'Off'">
                    {{ $t('%RU') }}
                </Radio>
                <Radio v-model="darkMode" :value="'On'">
                    {{ $t('%RV') }}
                </Radio>
                <Radio v-model="darkMode" :value="'Auto'">
                    {{ $t('%RW') }}
                </Radio>
            </RadioGroup>
        </STInputBox>
        <p v-if="darkMode !== 'Off'" class="style-description-small">
            {{ $t('%RX') }}
        </p>

        <hr><h2>{{ $t('%2D') }}</h2>
        <p>
            {{ $t('%RY') }}
        </p>

        <Checkbox v-model="useLogo">
            {{ $t('%RZ') }}
        </Checkbox>

        <LogoEditor v-if="!useLogo" :meta-data="webshop.meta" :validator="errors.validator" :dark-mode="darkMode" @patch="addMetaPatch" />

        <template v-if="hasTickets">
            <hr><EditSponsorsBox :config="sponsorConfig" @patch="patchSponsorConfig" />

            <p class="style-button-bar">
                <button type="button" class="button text" @click="previewTicket">
                    <span class="icon eye" /><span>{{ $t('%Ra') }}</span>
                </button>
            </p>
        </template>

        <template v-if="STAMHOOFD.platformName === 'stamhoofd'">
            <hr><h2>{{ $t("%q") }}</h2>
            <p>
                {{ $t('%46') }}
            </p>

            <Checkbox v-model="reduceBranding">
                {{ $t('%47') }}
            </Checkbox>
        </template>

        <div v-if="hasFullAccess && areAdvancedWebshopSettingsEnabled" class="container">
            <hr>
            <h2>{{ $t('%HQ') }}</h2>
            <p v-if="!hasCustomDomain" class="info-box">
                {{ $t('%15s') }}
            </p>
            <STInputBox error-fields="meta.customCode" :error-box="errors.errorBox" class="max" :title="$t('%15t')">
                <textarea v-model="customCode" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t('%15u')" :disabled="!hasCustomDomain" />
            </STInputBox>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import ColorInput from '@stamhoofd/components/inputs/ColorInput.vue';
import DetailedTicketView from '@stamhoofd/components/views/DetailedTicketView.vue';
import LogoEditor from '@stamhoofd/components/views/LogoEditor.vue';
import Radio from '@stamhoofd/components/inputs/Radio.vue';
import RadioGroup from '@stamhoofd/components/inputs/RadioGroup.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import UploadButton from '@stamhoofd/components/inputs/UploadButton.vue';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import WYSIWYGTextInput from '@stamhoofd/components/inputs/WYSIWYGTextInput.vue';
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
