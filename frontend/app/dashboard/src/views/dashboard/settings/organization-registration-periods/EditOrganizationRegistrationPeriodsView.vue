<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" :loading-view="loading" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="sortedPeriods.length && patchedOrganization.period.id !== sortedPeriods[0].id && (sortedPeriods[0].period.startDate.getTime() - new Date().getTime()) < 1000 * 60 * 60 * 24 * 30 * 2">
            <hr><h2>{{ $t('3b3be211-9a70-4345-abd6-760b39cef51d') }} {{ sortedPeriods[0].period.nameShort }}</h2>
            <p>{{ $t("31e91d3b-16e5-4608-9390-75e61d4d090d") }}</p>

            <ul class="style-list">
                <li>{{ $t('9c916015-e69c-44b3-a568-d0af15854787') }}</li>
                <li>{{ $t('b78d9c9e-9099-4fb6-93e1-6bf58e39165f') }}</li>
                <li>{{ $t('c95eb07d-15e3-45da-b2c2-7754c134ae65') }}</li>
                <li>{{ $t('865bfcae-44c2-49a5-a887-c70725d53d8b') }}</li>
                <li>{{ $t('9de0900d-9daa-48e5-ab82-496c61dfc5db') }}</li>
            </ul>

            <p class="style-button-bar">
                <button class="button primary" type="button" @click="setCurrent(sortedPeriods[0])">
                    <span class="icon flag" />
                    <span>{{ $t('3b3be211-9a70-4345-abd6-760b39cef51d') }} {{ sortedPeriods[0].period.nameShort }}</span>
                </button>
            </p>

            <hr><h2>{{ $t('c28ace1d-50ff-4f1a-b403-bd5ab55d9dcb') }}</h2>
        </template>

        <STList>
            <OrganizationRegistrationPeriodRow v-for="period of sortedPeriods" :key="period.id" :organization-registration-period="period" :organization="patchedOrganization" @click="editPeriod(period)" @contextmenu.prevent="showContextMenu($event, period)" />
        </STList>

        <p>
            <button class="button text" type="button" @click="addPeriod">
                <span class="icon add" />
                <span>{{ $t('1929850b-e0ad-4b35-b3e5-6652dd4774e2') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ContextMenu, ContextMenuItem, ErrorBox, Toast, useContext, useErrors, usePatch, usePatchArray, useRequiredOrganization } from '@stamhoofd/components';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { OrganizationRegistrationPeriod, RegistrationPeriod } from '@stamhoofd/structures';
import { Ref, computed, ref } from 'vue';
import EditOrganizationRegistrationPeriodView from './EditOrganizationRegistrationPeriodView.vue';
import OrganizationRegistrationPeriodRow from './components/OrganizationRegistrationPeriodRow.vue';

const errors = useErrors();
const pop = usePop();
const present = usePresent();

const context = useContext();
const organization = useRequiredOrganization();
const organizationManager = useOrganizationManager();

const originalOrganizationPeriods = ref([]) as Ref<OrganizationRegistrationPeriod[]>;
const loading = ref(true);
const owner = useRequestOwner();

loadData().catch(console.error);

const { patched, patch, addArrayPatch: addOrganizationPeriodArrayPatch, hasChanges: hasChangesPeriods } = usePatchArray(originalOrganizationPeriods);

// const {addArrayPatch: addPeriodArrayPatch} = usePatchArray(originalPeriods);
let newPeriodsPatch: PatchableArrayAutoEncoder<RegistrationPeriod> = new PatchableArray();

const { patched: patchedOrganization, patch: organizationPatch, addPatch: addOrganizationPatch, hasChanges: hasChangesOrganization } = usePatch(organization);
const hasChanges = computed(() => hasChangesPeriods.value || hasChangesOrganization.value);

const saving = ref(false);

const sortedPeriods = computed(() => {
    return patched.value.slice().sort((b, a) => a.period.startDate.getTime() - b.period.startDate.getTime());
});

const title = computed(() => $t('c28ace1d-50ff-4f1a-b403-bd5ab55d9dcb'));

async function addPeriod() {
    const arr: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod> = new PatchableArray();
    const organizationRegistrationPeriod = organization.value.period.clone();
    organizationRegistrationPeriod.id = RegistrationPeriod.create({}).id;
    organizationRegistrationPeriod.period.id = RegistrationPeriod.create({}).id;

    organizationRegistrationPeriod.period.startDate.setFullYear(organizationRegistrationPeriod.period.startDate.getFullYear() + 1);
    organizationRegistrationPeriod.period.endDate.setFullYear(organizationRegistrationPeriod.period.endDate.getFullYear() + 1);

    arr.addPut(organizationRegistrationPeriod);

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditOrganizationRegistrationPeriodView, {
                organizationRegistrationPeriod,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    patch.id = organizationRegistrationPeriod.id;
                    arr.addPatch(patch);
                    addOrganizationPeriodArrayPatch(arr);
                    newPeriodsPatch.addPut(organizationRegistrationPeriod.period);
                },
            }),
        ],
    });
}

async function editPeriod(organizationRegistrationPeriod: OrganizationRegistrationPeriod) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditOrganizationRegistrationPeriodView, {
                organizationRegistrationPeriod,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    const arr: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod> = new PatchableArray();
                    arr.addPatch(patch);
                    addOrganizationPeriodArrayPatch(arr);
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod> = new PatchableArray();
                    arr.addDelete(organizationRegistrationPeriod.id);
                    addOrganizationPeriodArrayPatch(arr);
                },
            }),
        ],
    });
}

async function showContextMenu(event: MouseEvent, period: OrganizationRegistrationPeriod) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t(`5119aacc-24c1-43e6-b025-0efa7ea60ea3`),
                disabled: patchedOrganization.value.period.id === period.id,
                action: () => {
                    setCurrent(period);
                    return true;
                },
            }),
        ],
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }

        if (newPeriodsPatch.getPuts().length > 0) {
            // todo: what if period is added but adding the organization registration period fails?
            await context.value.authenticatedServer.request({
                method: 'PATCH',
                body: newPeriodsPatch,
                path: '/registration-periods',
                decoder: new ArrayDecoder(RegistrationPeriod as Decoder<RegistrationPeriod>),
                owner,
                shouldRetry: false,
            });

            // prevent adding the periods again
            newPeriodsPatch = new PatchableArray();
        }

        if (hasChangesPeriods.value) {
            await context.value.authenticatedServer.request({
                method: 'PATCH',
                body: patch.value,
                path: '/organization/registration-periods',
                decoder: new ArrayDecoder(OrganizationRegistrationPeriod as Decoder<OrganizationRegistrationPeriod>),
                owner,
                shouldRetry: false,
            });
        }

        const changedPeriod = hasChangesOrganization.value;

        if (changedPeriod) {
            await organizationManager.value.patch(organizationPatch.value, { owner, shouldRetry: false });
        }

        new Toast($t(`17017abf-c2e0-4479-86af-300ad37347aa`), 'success green').show();

        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

function setCurrent(period: OrganizationRegistrationPeriod) {
    addOrganizationPatch({ period });
}

async function loadData() {
    loading.value = true;

    try {
        const registrationPeriodList = (await organizationManager.value.loadPeriods(true, true, owner));
        originalOrganizationPeriods.value = registrationPeriodList.organizationPeriods;
        loading.value = false;
    }
    catch (e) {
        Toast.fromError(e).show();
        await pop({ force: true });
        return;
    }
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
