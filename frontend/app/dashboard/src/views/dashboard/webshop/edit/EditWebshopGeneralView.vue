<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errors.errorBox"/>

        <STInputBox error-fields="meta.name" :error-box="errors.errorBox" :title="$t(`13820aaf-6866-4c8b-a6bd-01abfe0f0d61`)">
            <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`e48ade8a-73de-40f4-a143-0fc1ab25eb66`)"><p v-if="name.length > 30" class="style-description-small">
                {{ $t("3bcd2c3e-72db-4352-ade7-e4de63a8d901") }}
            </p>
        </STInputBox>

        <hr><h2>{{ $t('b610d465-2901-4b54-97ae-dbeab72e4762') }}</h2>

        <STList>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="ticketType" :value="WebshopTicketType.None"/>
                </template>
                <h3 class="style-title-list">
                    {{ $t('1dbfb9a1-95fd-414e-b85b-1450b70f853c') }}
                </h3>
                <p class="style-description">
                    {{ $t('6a56b9f7-81dc-48f5-8ace-1289bb54f740') }}
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="ticketType" :value="WebshopTicketType.SingleTicket"/>
                </template>
                <h3 class="style-title-list">
                    {{ $t('17c555ca-e3cb-4b12-a86a-edff1875914f') }}
                </h3>
                <p class="style-description">
                    {{ $t('8c5323cf-05d2-4798-8f0d-7f39a516ba9c') }}
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="ticketType" :value="WebshopTicketType.Tickets"/>
                </template>
                <h3 class="style-title-list">
                    {{ $t('b819223e-d855-4b97-952c-48327513130e') }}
                </h3>
                <p class="style-description">
                    {{ $t('ab8c4033-af75-4874-a786-5fb62003eac1') }}
                </p>
            </STListItem>
        </STList>

        <p v-if="ticketType === WebshopTicketType.SingleTicket" class="info-box">
            {{ $t("384e1319-2248-40c9-970b-6d3a82285360") }}
        </p>
        <p v-if="ticketType === WebshopTicketType.Tickets" class="info-box">
            {{ $t('13d39c1d-e2ed-4b76-959a-7d8ce1eddf61') }}
        </p>

        <hr><h2>{{ $t('bdbaebf3-eae4-4736-959b-97b90f979a8d') }}</h2>

        <Checkbox v-model="useAvailableUntil">
            {{ $t('fade612c-d834-4075-bca6-73a70f74206b') }}
        </Checkbox>

        <div v-if="useAvailableUntil" class="split-inputs">
            <STInputBox error-fields="settings.availableUntil" :error-box="errors.errorBox" :title="$t(`deb17aac-d7c6-40a7-812d-0255be3b3308`)">
                <DateSelection v-model="availableUntil"/>
            </STInputBox>
            <TimeInput v-model="availableUntil" :validator="errors.validator" :title="$t(`6a36a332-b846-4649-9125-0b519cd40c99`)"/>
        </div>

        <Checkbox v-model="useOpenAt">
            {{ $t('f095038b-322f-4a6d-b53e-7213270298f9') }}
        </Checkbox>

        <div v-if="useOpenAt" class="split-inputs">
            <STInputBox error-fields="settings.openAt" :error-box="errors.errorBox" :title="$t(`7a091052-638a-47d2-be57-3c6b3b4a39bd`)">
                <DateSelection v-model="openAt"/>
            </STInputBox>
            <TimeInput v-model="openAt" :validator="errors.validator" :title="$t(`6a36a332-b846-4649-9125-0b519cd40c99`)"/>
        </div>

        <div class="container">
            <hr><h2>{{ $t('e478cf5c-0246-4262-a6aa-c9c00b8d0c0b') }}</h2>

            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="numberingType" :value="WebshopNumberingType.Continuous"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('f7de5251-5998-4167-b303-1c0c1a92296b') }}
                    </h3>
                    <p class="style-description">
                        {{ $t('9be8efb3-5d29-4174-992c-1d2478eda95f') }}
                    </p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="numberingType" :value="WebshopNumberingType.Random"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('c8581633-ef39-4dc5-9975-fa27ee07b102') }}
                    </h3>
                    <p class="style-description">
                        {{ $t('af9f21b4-9225-44dc-baab-b1da83029cd1') }}
                    </p>
                </STListItem>
            </STList>

            <STInputBox v-if="numberingType === WebshopNumberingType.Continuous" error-fields="settings.openAt" :error-box="errors.errorBox" :title="$t(`66a80ef9-acac-473f-8a28-0676c77793a8`)">
                <NumberInput v-model="startNumber" :min="1"/>
            </STInputBox>
            <p v-if="!isNew && numberingType === WebshopNumberingType.Continuous" class="style-description-small">
                {{ $t('50281700-6356-4f30-937d-b463b1686726') }}
            </p>
        </div>

        <template v-if="isNew">
            <hr><h2>{{ $t('47ffc673-424e-4be8-aa64-f01ba8581b64') }}</h2>
            <p>{{ $t('c228c56d-caf0-40a7-aebd-ff883cad7f7f') }} <a class="inline-link" :href="$domains.getDocs('betaalmethodes-voor-webshops-instellen')" target="_blank">{{ $t('7fd04b13-e600-49b1-bafb-e4f642154bcd') }}</a>.</p>

            <EditPaymentMethodsBox type="webshop" :organization="organization" :config="config" :private-config="privateConfig" :validator="errors.validator" :show-administration-fee="false" @patch:config="patchConfig($event)" @patch:private-config="patchPrivateConfig($event)"/>
        </template>

        <div v-if="getFeatureFlag('webshop-auth')" class="container">
            <hr><h2>{{ $t('e146434b-e70f-44de-85d3-6b80dbc21041') }}</h2>
            <p>
                {{ $t('e3b34dc8-9054-46c1-8cc4-5acd0207ceb4') }}
            </p>

            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="authType" :value="WebshopAuthType.Disabled"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('8ca1d7b0-f411-4f44-90f7-c05baa24e506') }}
                    </h3>
                    <p class="style-description">
                        {{ $t('034704db-c10d-4cd2-bc36-51f01b8aa41e') }}
                    </p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="authType" :value="WebshopAuthType.Required"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('f15c7a6e-ed02-40a1-ba8c-b1cdd2f6d213') }}
                    </h3>
                    <p class="style-description">
                        {{ $t('b1db6c7e-5a7f-4f0d-9580-fefc4c2f019a') }}
                    </p>
                </STListItem>
            </STList>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Checkbox, DateSelection, Radio, SaveView, STErrorsDefault, STInputBox, STList, STListItem, TimeInput, Toast, useContext } from '@stamhoofd/components';
import { PaymentConfiguration, PrivatePaymentConfiguration, PrivateWebshop, Product, ProductType, WebshopAuthType, WebshopMetaData, WebshopNumberingType, WebshopPrivateMetaData, WebshopTicketType } from '@stamhoofd/structures';

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
