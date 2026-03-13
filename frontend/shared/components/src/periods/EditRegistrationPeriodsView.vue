<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" :loading-view="loading" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p v-if="!isPlatform">
            {{ $t('%1Gz') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="isPlatform && sortedPeriods.length && currentPeriod.id !== sortedPeriods[0].id && (sortedPeriods[0].startDate.getTime() - new Date().getTime()) < 1000 * 60 * 60 * 24 * 30 * 2">
            <hr><h2>{{ $t('%IU') }} {{ sortedPeriods[0].nameShort }}</h2>
            <p>
                {{ $t("%AD") }}
            </p>

            <ul class="style-list">
                <li>{{ $t('%AH') }}</li>
                <li>{{ $t('%8L') }}</li>
                <li>{{ $t('%8M') }}</li>
                <li>{{ $t('%8N') }}</li>
                <li>{{ $t('%8O') }}</li>
            </ul>

            <p class="style-button-bar">
                <button class="button primary" type="button" @click="setCurrent(sortedPeriods[0])">
                    <span class="icon flag" />
                    <span>{{ $t('%IU') }} {{ sortedPeriods[0].nameShort }}</span>
                </button>
            </p>

            <hr><h2>{{ $t('%3i') }}</h2>
        </template>

        <STList>
            <RegistrationPeriodRow v-for="period of sortedPeriods" :key="period.id" :period="period" :current-period-id="currentPeriod.id" @click="editPeriod(period)" @contextmenu.prevent="isPlatform ? showContextMenu($event, period) : undefined" />
        </STList>

        <p>
            <button class="button text" type="button" @click="addPeriod">
                <span class="icon add" />
                <span>{{ $t('%3g') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { ContextMenu, ContextMenuItem } from '#overlays/ContextMenu.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { Toast } from '#overlays/Toast.ts';
import { useContext } from '#hooks/useContext.ts';
import { useErrors } from '#errors/useErrors.ts';
import { usePatch } from '#hooks/usePatch.ts';
import { usePatchArray } from '#hooks/usePatchArray.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { useRequiredOrganization } from '#hooks/useOrganization.ts';
import { useOrganizationManager, usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { Organization, RegistrationPeriod } from '@stamhoofd/structures';
import { Ref, computed, ref } from 'vue';
import EditRegistrationPeriodView from './EditRegistrationPeriodView.vue';
import RegistrationPeriodRow from './RegistrationPeriodRow.vue';

const errors = useErrors();
const pop = usePop();
const present = usePresent();

const isPlatform = STAMHOOFD.userMode === 'platform';

const context = useContext();
const platform = usePlatform();
const platformManager = usePlatformManager();
const organization = isPlatform ? ref(Organization.create({})) as unknown as Ref<Organization> : useRequiredOrganization();
const organizationManager = useOrganizationManager();

const originalPeriods = ref([]) as Ref<RegistrationPeriod[]>;
const loading = ref(true);
const owner = useRequestOwner();

loadData().catch(console.error);

const { patched, patch, addArrayPatch, hasChanges: hasChangesPeriods } = usePatchArray(originalPeriods);
const { patched: patchedPlatform, patch: platformPatch, addPatch: addPlatformPatch, hasChanges: hasChangesPlatform } = usePatch(platform);
const { patched: patchedOrganization, patch: organizationPatch, addPatch: addOrganizationPatch, hasChanges: hasChangesOrganization } = usePatch(organization);

const hasChanges = computed(() => {
    return hasChangesPeriods.value || (isPlatform && hasChangesPlatform.value) || (!isPlatform && hasChangesOrganization.value);
});

const saving = ref(false);

const sortedPeriods = computed(() => {
    return patched.value.slice().sort((b, a) => a.startDate.getTime() - b.startDate.getTime());
});

const currentPeriod = computed(() => isPlatform ? patchedPlatform.value.period : patchedOrganization.value.period.period);

const title = computed(() => $t('%3i'));

async function addPeriod() {
    const arr: PatchableArrayAutoEncoder<RegistrationPeriod> = new PatchableArray();
    const period = currentPeriod.value.clone();
    period.id = RegistrationPeriod.create({}).id;

    period.startDate.setFullYear(period.startDate.getFullYear() + 1);
    period.endDate.setFullYear(period.endDate.getFullYear() + 1);

    arr.addPut(period);

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditRegistrationPeriodView, {
                period,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<RegistrationPeriod>) => {
                    patch.id = period.id;
                    arr.addPatch(patch);
                    addArrayPatch(arr);
                },
            }),
        ],
    });
}

async function editPeriod(period: RegistrationPeriod) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditRegistrationPeriodView, {
                period,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<RegistrationPeriod>) => {
                    const arr: PatchableArrayAutoEncoder<RegistrationPeriod> = new PatchableArray();
                    arr.addPatch(patch);
                    addArrayPatch(arr);
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<RegistrationPeriod> = new PatchableArray();
                    arr.addDelete(period.id);
                    addArrayPatch(arr);
                },
            }),
        ],
    });
}

async function showContextMenu(event: MouseEvent, period: RegistrationPeriod) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t(`%IV`),
                disabled: currentPeriod.value.id === period.id,
                action: async () => {
                    await setCurrent(period);
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

        if (hasChangesPeriods.value) {
            await context.value.authenticatedServer.request({
                method: 'PATCH',
                body: patch.value,
                path: '/registration-periods',
                decoder: new ArrayDecoder(RegistrationPeriod as Decoder<RegistrationPeriod>),
                owner,
                shouldRetry: false,
            });
        }

        if (isPlatform) {
            const changedPeriod = hasChangesPlatform.value;

            if (changedPeriod) {
                await platformManager.value.patch(platformPatch.value, false);
            }

            new Toast($t(`%HA`), 'success green').show();

            if (changedPeriod) {
                new Toast($t('%8P'), 'info').setHide(20 * 1000).show();
            }
        }
        else {
            const changedPeriod = hasChangesOrganization.value;
            if (changedPeriod) {
                await organizationManager.value.patch(organizationPatch.value, { owner, shouldRetry: false });
            }

            new Toast($t(`%HA`), 'success green').show();
        }

        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

async function setCurrent(period: RegistrationPeriod) {
    if (isPlatform) {
        addPlatformPatch({ period });
    }
}

async function loadData() {
    loading.value = true;

    try {
        originalPeriods.value = await platformManager.value.loadPeriods(true, true, owner);
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
