<template>
    <LoadingView v-if="loading" />
    <SaveView v-else :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        
        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <RegistrationPeriodRow v-for="period of sortedPeriods" :key="period.id" :period="period" @click="editPeriod(period)" />
        </STList>

        <p>
            <button class="button text" type="button" @click="addPeriod">
                <span class="icon add" />
                <span>{{ $t('admin.settings.registrationPeriods.new.button') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, Toast, useContext, useErrors, usePatchArray, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { RegistrationPeriod } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { Ref, computed, ref } from 'vue';
import EditRegistrationPeriodView from './EditRegistrationPeriodView.vue';
import RegistrationPeriodRow from './components/RegistrationPeriodRow.vue';

const errors = useErrors();
const pop = usePop();
const present = usePresent();
const $t = useTranslate();
const context = useContext();
const platform = usePlatform();
const platformManager = usePlatformManager()

const originalResponsibilities = ref([]) as Ref<RegistrationPeriod[]>;
const loading = ref(true);
const owner = useRequestOwner();

loadData().catch(console.error);

const {patched, patch, addArrayPatch, hasChanges} = usePatchArray(originalResponsibilities)
const saving = ref(false);

const sortedPeriods = computed(() => {
    return patched.value
})

const title = 'Werkjaren'

async function addPeriod() {
    const arr: PatchableArrayAutoEncoder<RegistrationPeriod> = new PatchableArray()
    const period = platform.value.period.clone()
    period.id = RegistrationPeriod.create({}).id
    arr.addPut(period)

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditRegistrationPeriodView, {
                period,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<RegistrationPeriod>) => {
                    patch.id = period.id
                    arr.addPatch(patch)
                    addArrayPatch(arr)
                }
            })
        ]
    })
}

async function editPeriod(period: RegistrationPeriod) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditRegistrationPeriodView, {
                period,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<RegistrationPeriod>) => {
                    const arr: PatchableArrayAutoEncoder<RegistrationPeriod> = new PatchableArray()
                    arr.addPatch(patch)
                    addArrayPatch(arr)
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<RegistrationPeriod> = new PatchableArray()
                    arr.addDelete(period.id)
                    addArrayPatch(arr)
                }
            })
        ]
    })
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        await context.value.authenticatedServer.request({
            method: 'PATCH',
            body: patch.value,
            path: '/registration-periods',
            decoder: new ArrayDecoder(RegistrationPeriod as Decoder<RegistrationPeriod>),
            owner,
            shouldRetry: false
        })
        new Toast('De wijzigingen zijn opgeslagen', "success green").show()
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

    saving.value = false;

}

async function loadData() {
    loading.value = true;
    
    try {
        originalResponsibilities.value = await platformManager.value.loadPeriods(true, true, owner)
        loading.value = false;
    } catch (e) {
        Toast.fromError(e).show();
        await pop({force: true})
        return;
    }
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('shared.save.shouldNavigateAway.title'), $t('shared.save.shouldNavigateAway.confirm'))
}

defineExpose({
    shouldNavigateAway
})
</script>
