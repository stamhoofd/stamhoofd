<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>{{ $t('Stel hier in waar en wanneer de bestelde producten kunnen worden afgehaald, geleverd of ter plaatse geconsumeerd. Dit is optioneel, maar we raden het wel sterk aan, want zo is de juiste informatie zichtbaar in de bestelbevestiging.') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <STListItem v-for="method in webshop.meta.checkoutMethods" :key="method.id" :selectable="true" class="right-stack" @click="editCheckoutMethod(method)">
                {{ method.typeName }}: {{ method.name }}

                <template #right>
                    <button class="button icon arrow-up gray" type="button" @click.stop="moveCheckoutUp(method)" />
                    <button class="button icon arrow-down gray" type="button" @click.stop="moveCheckoutDown(method)" />
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>

        <p>
            <button class="button text" type="button" @click="addOnSiteMethod">
                <span class="icon add" />
                <span>{{ $t('Ter plaatse consumeren toevoegen') }}</span>
            </button>
        </p>

        <p>
            <button class="button text" type="button" @click="addTakeoutMethod">
                <span class="icon add" />
                <span>{{ $t('Afhaallocatie toevoegen') }}</span>
            </button>
        </p>

        <p>
            <button class="button text" type="button" @click="addDeliveryMethod">
                <span class="icon add" />
                <span>{{ $t('Leveringsoptie toevoegen') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { SaveView, STErrorsDefault, STList, STListItem, useOrganization } from '@stamhoofd/components';
import { CheckoutMethod, PrivateWebshop, WebshopDeliveryMethod, WebshopMetaData, WebshopOnSiteMethod, WebshopTakeoutMethod } from '@stamhoofd/structures';

import EditDeliveryMethodView from './locations/EditDeliveryMethodView.vue';
import EditTakeoutMethodView from './locations/EditTakeoutMethodView.vue';
import { useEditWebshop, UseEditWebshopProps } from './useEditWebshop';

const props = defineProps<UseEditWebshopProps>();

const { webshop, addPatch, errors, saving, save, hasChanges } = useEditWebshop({
    getProps: () => props,
});
const present = usePresent();
const organization = useOrganization();

const viewTitle = 'Afhaal- en leveringsopties';

function addOnSiteMethod() {
    const onSiteMethod = WebshopOnSiteMethod.create({
        address: organization.value!.address,
    });

    const p = PrivateWebshop.patch({});
    const meta = WebshopMetaData.patch({});
    meta.checkoutMethods.addPut(onSiteMethod);
    p.meta = meta;

    present(new ComponentWithProperties(EditTakeoutMethodView, {
        isNew: true,
        takeoutMethod: onSiteMethod,
        webshop: webshop.value.patch(p),
        saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // Merge both patches
            addPatch(p.patch(patch));
        },
    })
        .setDisplayStyle('popup'))
        .catch(console.error);
}

function addTakeoutMethod() {
    const takeoutMethod = WebshopTakeoutMethod.create({
        address: organization.value!.address,
    });

    const p = PrivateWebshop.patch({});
    const meta = WebshopMetaData.patch({});
    meta.checkoutMethods.addPut(takeoutMethod);
    p.meta = meta;

    present(new ComponentWithProperties(EditTakeoutMethodView, {
        isNew: true,
        takeoutMethod,
        webshop: webshop.value.patch(p),
        saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // Merge both patches
            addPatch(p.patch(patch));
        },
    })
        .setDisplayStyle('popup'))
        .catch(console.error);
}

function addDeliveryMethod() {
    const deliveryMethod = WebshopDeliveryMethod.create({});

    const p = PrivateWebshop.patch({});
    const meta = WebshopMetaData.patch({});
    meta.checkoutMethods.addPut(deliveryMethod);
    p.meta = meta;

    present(new ComponentWithProperties(EditDeliveryMethodView, {
        isNew: true,
        deliveryMethod,
        webshop: webshop.value.patch(p),
        saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // Merge both patches
            addPatch(p.patch(patch));
        },
    }).setDisplayStyle('popup'),
    ).catch(console.error);
}

function editCheckoutMethod(checkoutMethod: CheckoutMethod) {
    if (checkoutMethod instanceof WebshopTakeoutMethod || checkoutMethod instanceof WebshopOnSiteMethod) {
        present(
            new ComponentWithProperties(EditTakeoutMethodView, {
                isNew: false,
                takeoutMethod: checkoutMethod,
                webshop: webshop.value,
                saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                    // Merge both patches
                    addPatch(patch);
                },
            }).setDisplayStyle('popup'),
        ).catch(console.error); ;
    }
    else {
        present(
            new ComponentWithProperties(EditDeliveryMethodView, {
                isNew: false,
                deliveryMethod: checkoutMethod,
                webshop: webshop.value,
                saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                    // Merge both patches
                    addPatch(patch);
                },
            }).setDisplayStyle('popup'),
        ).catch(console.error);
    }
}

function moveCheckoutUp(location: CheckoutMethod) {
    const index = webshop.value.meta.checkoutMethods.findIndex(c => location.id === c.id);
    if (index === -1 || index === 0) {
        return;
    }

    const moveTo = index - 2;
    const p = PrivateWebshop.patch({});
    const meta = WebshopMetaData.patch({});
    meta.checkoutMethods.addMove(location.id, webshop.value.meta.checkoutMethods[moveTo]?.id ?? null);
    p.meta = meta;
    addPatch(p);
}

function moveCheckoutDown(location: CheckoutMethod) {
    const index = webshop.value.meta.checkoutMethods.findIndex(c => location.id === c.id);
    if (index === -1 || index >= webshop.value.meta.checkoutMethods.length - 1) {
        return;
    }

    const moveTo = index + 1;
    const p = PrivateWebshop.patch({});
    const meta = WebshopMetaData.patch({});
    meta.checkoutMethods.addMove(location.id, webshop.value.meta.checkoutMethods[moveTo].id);
    p.meta = meta;
    addPatch(p);
}
</script>
