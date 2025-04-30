<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="meta.name" :error-box="errors.errorBox" :title="$t(`21d2abc5-55c1-4ad2-a7ba-44061fae2fd1`)">
            <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`0554f2e8-0345-43b6-9652-eff5cbfece03`)"><p v-if="name.length > 30" class="style-description-small">
                {{ $t("5da7a306-4054-429b-a680-a9ba0d020121") }}
            </p>
        </STInputBox>

        <hr><h2>{{ $t('6c9d45e5-c9f6-49c8-9362-177653414c7e') }}</h2>

        <STList>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="ticketType" :value="WebshopTicketType.None" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('57bbb3fe-8c53-4aab-b103-38d86df4de84') }}
                </h3>
                <p class="style-description">
                    {{ $t('0addd055-9318-46b7-9fc9-ec534974eef3') }}
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="ticketType" :value="WebshopTicketType.SingleTicket" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('2916b5d4-0ccd-4031-b03d-53db31bf6076') }}
                </h3>
                <p class="style-description">
                    {{ $t('26cce912-b9b2-49c3-8768-d98173286458') }}
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="ticketType" :value="WebshopTicketType.Tickets" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('638202df-48b7-49c7-b5d6-b5dca451896a') }}
                </h3>
                <p class="style-description">
                    {{ $t('ade46780-b07f-48f0-9964-0a9b89403be5') }}
                </p>
            </STListItem>
        </STList>

        <p v-if="ticketType === WebshopTicketType.SingleTicket" class="info-box">
            {{ $t("ec75e8ea-c2d5-40e2-b81a-358c20e44fe2") }}
        </p>
        <p v-if="ticketType === WebshopTicketType.Tickets" class="info-box">
            {{ $t('b56f4d0f-93c0-4f22-9597-735ee03cc9e2') }}
        </p>

        <hr><h2>{{ $t('bf2af52c-de5d-4089-b46d-9be48594cdb4') }}</h2>

        <Checkbox v-model="hasStatusClosed">
            {{ $t('4ae26268-586e-41f7-875d-90137f9ed836') }}
        </Checkbox>

        <template v-if="!hasStatusClosed">
            <Checkbox v-model="useAvailableUntil">
                {{ $t('4b6cb3f4-a5a7-40db-8e79-e7a892ae14a7') }}
            </Checkbox>
            <div v-if="useAvailableUntil" class="split-inputs">
                <STInputBox error-fields="settings.availableUntil" :error-box="errors.errorBox" :title="$t(`bdbe9ec5-11f1-4c79-9c36-ca1f8c434fb9`)">
                    <DateSelection v-model="availableUntil" />
                </STInputBox>
                <TimeInput v-model="availableUntil" :validator="errors.validator" :title="$t(`125db847-73bc-4494-9732-fe2ef4e55f66`)" />
            </div>
            <Checkbox v-model="useOpenAt">
                {{ $t('bd1870d2-eaaf-463a-88aa-b1ea5b916f05') }}
            </Checkbox>
            <div v-if="useOpenAt" class="split-inputs">
                <STInputBox error-fields="settings.openAt" :error-box="errors.errorBox" :title="$t(`0af19444-2686-4142-b14f-f2169033233f`)">
                    <DateSelection v-model="openAt" />
                </STInputBox>
                <TimeInput v-model="openAt" :validator="errors.validator" :title="$t(`125db847-73bc-4494-9732-fe2ef4e55f66`)" />
            </div>
        </template>

        <div class="container">
            <hr><h2>{{ $t('901ee313-afe3-4baa-9e79-077a32d9825f') }}</h2>

            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="numberingType" :value="WebshopNumberingType.Continuous" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('be895e24-ac95-4d1b-8962-9bc23e59728a') }}
                    </h3>
                    <p class="style-description">
                        {{ $t('cd7dec4c-5183-4c18-b447-b4095436bb5c') }}
                    </p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="numberingType" :value="WebshopNumberingType.Random" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('e9d7b5ad-5938-4e96-a089-582854d0d9a8') }}
                    </h3>
                    <p class="style-description">
                        {{ $t('8982ff9e-7905-4b82-9e9c-cb37a6a9481e') }}
                    </p>
                </STListItem>
            </STList>

            <STInputBox v-if="numberingType === WebshopNumberingType.Continuous" error-fields="settings.openAt" :error-box="errors.errorBox" :title="$t(`acd40eea-3b58-434b-8be9-52e7a32d7b52`)">
                <NumberInput v-model="startNumber" :min="1" :max="100000000 - 100000" />
            </STInputBox>
            <p v-if="!isNew && numberingType === WebshopNumberingType.Continuous" class="style-description-small">
                {{ $t('290f637c-9313-44c1-8e4f-4e5922e9768a') }}
            </p>
        </div>

        <template v-if="isNew">
            <hr><h2>{{ $t('12b644c9-c1a7-4930-afb2-79f62648d243') }}</h2>
            <p>{{ $t('ac5ca0b0-0b1d-47bc-ab42-c23153dd7521') }} <a class="inline-link" :href="$domains.getDocs('betaalmethodes-voor-webshops-instellen')" target="_blank">{{ $t('3280290b-f43e-4e95-a7bd-3c13a153888b') }}</a>.</p>

            <EditPaymentMethodsBox type="webshop" :organization="organization" :config="config" :private-config="privateConfig" :validator="errors.validator" :show-administration-fee="false" @patch:config="patchConfig($event)" @patch:private-config="patchPrivateConfig($event)" />
        </template>

        <div v-if="getFeatureFlag('webshop-auth')" class="container">
            <hr><h2>{{ $t('1627a32a-56b8-4c74-8715-b885c1795af6') }}</h2>
            <p>
                {{ $t('68fa95be-f609-4e82-9c66-496c40c95503') }}
            </p>

            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="authType" :value="WebshopAuthType.Disabled" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('3729f1c6-ec66-4530-9012-48e0821c0bc1') }}
                    </h3>
                    <p class="style-description">
                        {{ $t('8b0dcdca-56da-4c94-b574-668d2758359d') }}
                    </p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="authType" :value="WebshopAuthType.Required" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('bbe18b42-bbd7-4c1f-9f1c-367b27e5c18d') }}
                    </h3>
                    <p class="style-description">
                        {{ $t('821d94ff-3d9f-4b47-b399-acc5a90771ae') }}
                    </p>
                </STListItem>
            </STList>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Checkbox, DateSelection, NumberInput, Radio, SaveView, STErrorsDefault, STInputBox, STList, STListItem, TimeInput, Toast, useContext } from '@stamhoofd/components';
import { PaymentConfiguration, PrivatePaymentConfiguration, PrivateWebshop, Product, ProductType, WebshopAuthType, WebshopMetaData, WebshopNumberingType, WebshopPrivateMetaData, WebshopStatus, WebshopTicketType } from '@stamhoofd/structures';

import { computed } from 'vue';
import EditPaymentMethodsBox from '../../../../components/EditPaymentMethodsBox.vue';
import { useEditWebshop, UseEditWebshopProps } from './useEditWebshop';

const props = defineProps<UseEditWebshopProps>();

const { isNew, webshop, addPatch, patch: webshopPatch, originalWebshop, errors, saving, save, hasChanges, shouldNavigateAway } = useEditWebshop({
    getProps: () => props,
    validate: () => {
        if (webshop.value.meta.name.trim().length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Name is empty',
                human: 'Vul een naam in voor jouw webshop voor je doorgaat',
                field: 'meta.name',
            });
        }
    },
});
const context = useContext();
const organization = computed(() => context.value.organization);

const viewTitle = computed(() => {
    if (isNew.value) {
        return 'Nieuwe verkoop, inschrijvingsformulier of geldinzameling starten';
    }
    return 'Algemene instellingen';
});

const name = computed({
    get: () => webshop.value.meta.name,
    set: (name: string) => addPatch(PrivateWebshop.patch({ meta: WebshopMetaData.patch({ name }) })),
});

// const roles = computed(() => organization.value?.privateMeta?.roles ?? []);

const ticketType = computed({
    get: () => webshop.value.meta.ticketType,
    set: (ticketType: WebshopTicketType) => {
        const patch = WebshopMetaData.patch({ ticketType });
        const p = PrivateWebshop.patch({ meta: patch });

        // Restore any chagnes to locations
        if (webshopPatch.value.meta) {
            webshopPatch.value.meta.checkoutMethods = patch.checkoutMethods;
        }

        // Restore any changes to products
        if (webshopPatch.value) {
            webshopPatch.value.products = p.products;
        }

        if (ticketType === WebshopTicketType.Tickets) {
            let used = false;
            // Update all products to not ticket or voucher if needed
            for (const product of webshop.value.products) {
                if (product.type !== ProductType.Ticket && product.type !== ProductType.Voucher) {
                    const productPatch = Product.patch({
                        id: product.id,
                        type: ProductType.Ticket,
                    });
                    p.products.addPatch(productPatch);
                    used = true;
                }
            }

            if (used) {
                new Toast('Sommige artikelen zullen worden omgezet in tickets waardoor je hun locatie en datum nog zal moeten invullen', 'warning yellow').setHide(null).show();
            }

            // Remove all locations
            let deletedLocation = false;
            for (const location of webshop.value.meta.checkoutMethods) {
                patch.checkoutMethods.addDelete(location.id);
                deletedLocation = true;
            }

            if (deletedLocation) {
                new Toast('Alle afhaal- en leveringslocaties zullen worden verwijderd als je opslaat omdat deze niet ondersteund worden bij een ticketverkoop voor personen', 'warning yellow').setHide(null).show();
            }
        }
        else {
            let used = false;
            // Update all products to not ticket or voucher if needed
            for (const product of webshop.value.products) {
                if (product.type === ProductType.Ticket || product.type === ProductType.Voucher) {
                    const productPatch = Product.patch({
                        id: product.id,
                        type: ProductType.Product,
                        location: null,
                        dateRange: null,
                    });
                    p.products.addPatch(productPatch);
                    used = true;
                }
            }

            if (used) {
                new Toast('Sommige tickets zullen worden omgezet in gewone artikels waardoor hun locatie en datum informatie verloren gaat als je nu opslaat.', 'warning yellow').setHide(null).show();
            }
        }

        addPatch(p);
    },
});

const numberingType = computed({
    get: () => webshop.value.privateMeta.numberingType,
    set: (numberingType: WebshopNumberingType) => {
        const patch = WebshopPrivateMetaData.patch({ numberingType });
        addPatch(PrivateWebshop.patch({ privateMeta: patch }));
    },
});

const authType = computed({
    get: () => webshop.value.meta.authType,
    set: (authType: WebshopAuthType) => {
        const patch = WebshopMetaData.patch({ authType });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const startNumber = computed({
    get: () => webshop.value.privateMeta.startNumber,
    set: (startNumber: number) => {
        addPatch(PrivateWebshop.patch({ privateMeta: WebshopPrivateMetaData.patch({ startNumber }) }));
    },
});

const availableUntil = computed({
    get: () => webshop.value.meta.availableUntil ?? new Date(),
    set: (availableUntil: Date) => {
        const p = PrivateWebshop.patch({});
        const meta = WebshopMetaData.patch({});
        meta.availableUntil = availableUntil;
        p.meta = meta;
        addPatch(p);
    },
});

const useAvailableUntil = computed({
    get: () => webshop.value.meta.availableUntil !== null,
    set: (use: boolean) => {
        if (use === useAvailableUntil.value) {
            return;
        }
        const p = PrivateWebshop.patch({});
        const meta = WebshopMetaData.patch({});
        if (use) {
            meta.availableUntil = new Date();
        }
        else {
            meta.availableUntil = null;
        }
        p.meta = meta;
        addPatch(p);
    },
});

const hasStatusClosed = computed({
    get: () => webshop.value.meta.status === WebshopStatus.Closed,
    set: (value: boolean) => {
        const status = value ? WebshopStatus.Closed : WebshopStatus.Open;
        addPatch(PrivateWebshop.patch({ meta: WebshopMetaData.patch({ status }) }));
    },
});

const useOpenAt = computed({
    get: () => webshop.value.meta.openAt !== null,
    set: (use: boolean) => {
        if (use === useOpenAt.value) {
            return;
        }
        const p = PrivateWebshop.patch({});
        const meta = WebshopMetaData.patch({});
        if (use) {
            meta.openAt = new Date();
        }
        else {
            meta.openAt = null;
        }
        p.meta = meta;
        addPatch(p);
    },
});

const openAt = computed({
    get: () => webshop.value.meta.openAt ?? new Date(),
    set: (openAt: Date) => {
        const p = PrivateWebshop.patch({});
        const meta = WebshopMetaData.patch({});
        meta.openAt = openAt;
        p.meta = meta;
        addPatch(p);
    },
});

const config = computed(() => webshop.value.meta.paymentConfiguration);

function patchConfig(patch: AutoEncoderPatchType<PaymentConfiguration>) {
    addPatch(
        PrivateWebshop.patch({
            meta: WebshopMetaData.patch({
                paymentConfiguration: patch,
            }),
        }),
    );
}

const privateConfig = computed(() => webshop.value.privateMeta.paymentConfiguration);

function patchPrivateConfig(patch: PrivatePaymentConfiguration) {
    addPatch(
        PrivateWebshop.patch({
            privateMeta: WebshopPrivateMetaData.patch({
                paymentConfiguration: patch,
            }),
        }),
    );
}

function getFeatureFlag(flag: string) {
    return organization.value?.privateMeta?.featureFlags.includes(flag) ?? false;
}

defineExpose({
    shouldNavigateAway,
});
</script>
