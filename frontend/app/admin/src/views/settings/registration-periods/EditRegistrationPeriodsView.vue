<template>
    <LoadingView v-if="loading" />
    <SaveView v-else :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="sortedPeriods.length && patchedPlatform.period.id !== sortedPeriods[0].id">
            <hr>
            <h2>Overschakelen naar {{ sortedPeriods[0].nameShort }}</h2>
            <p>Je kan het huidig werkjaar hier wijzigen. Zorg dat je voor dit werkjaar alle aansluitingen hebt ingesteld. Ga daarvoor naar 'aansluitingen en verzekeringen' en voeg het werkjaar toe en stel de nieuwe prijzen en periodes correct in. </p>

            <ul class="style-list">
                <li>Alle groepen worden overgezet op dit nieuwe werkjaar. Hoofdbeheerders kunnen het vorige werkjaar nog bekijken.</li>
                <li>De categorieën en leeftijdsgroepen van de groepen worden gedupliceerd naar het nieuwe werkjaar.</li>
                <li>De leden moeten zich opnieuw inschrijven voor het nieuwe werkjaar.</li>
                <li>Alle functies van leden (behalve die met hoofdbeheerder rechten en nationale functies) worden beëindigd</li>
                <li>Alle leeftijdsgroepen worden gesloten (tenzij de groep al eerder overschakelde naar dit werkjaar)</li>
            </ul>

            <p class="style-button-bar">
                <button class="button primary" type="button" @click="setCurrent(sortedPeriods[0])">
                    <span class="icon flag" />
                    <span>Overschakelen naar {{ sortedPeriods[0].nameShort }}</span>
                </button>
            </p>

            <hr>
            <h2>Werkjaren</h2>
        </template>

        <STList>
            <RegistrationPeriodRow v-for="period of sortedPeriods" :key="period.id" :period="period" :platform="patchedPlatform" @click="editPeriod(period)" />
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
import { CenteredMessage, ErrorBox, Toast, useContext, useErrors, usePatch, usePatchArray, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { RegistrationPeriod } from '@stamhoofd/structures';
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

const originalPeriods = ref([]) as Ref<RegistrationPeriod[]>;
const loading = ref(true);
const owner = useRequestOwner();

loadData().catch(console.error);

const {patched, patch, addArrayPatch, hasChanges: hasChangesPeriods} = usePatchArray(originalPeriods)
const {patched: patchedPlatform, patch: platformPatch, addPatch: addPlatformPatch, hasChanges: hasChangesPlatform} = usePatch(platform)
const hasChanges = computed(() => hasChangesPeriods.value || hasChangesPlatform.value)

const saving = ref(false);

const sortedPeriods = computed(() => {
    return patched.value.slice().sort((b, a) => a.startDate.getTime() - b.startDate.getTime())
})

const title = 'Werkjaren'

async function addPeriod() {
    const arr: PatchableArrayAutoEncoder<RegistrationPeriod> = new PatchableArray()
    const period = platform.value.period.clone()
    period.id = RegistrationPeriod.create({}).id

    period.startDate.setFullYear(period.startDate.getFullYear() + 1)
    period.endDate.setFullYear(period.endDate.getFullYear() + 1)
    
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
                shouldRetry: false
            })
        }

        const changedPeriod = hasChangesPlatform.value;

        if (changedPeriod) {
            await platformManager.value.patch(platformPatch.value, false)
        }

        new Toast('De wijzigingen zijn opgeslagen', "success green").show()

        if (changedPeriod) {
            new Toast('Alle groepen worden nu overgezet op het nieuw werkjaar. Dit kan even duren, mogelijks moet je de pagina nog even herladen om alle laatste wijzigingen correct te zien.', "info").setHide(20 * 1000).show()
        }

        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

    saving.value = false;

}

function setCurrent(period: RegistrationPeriod) {
    addPlatformPatch({period})
}

async function loadData() {
    loading.value = true;
    
    try {
        originalPeriods.value = await platformManager.value.loadPeriods(true, true, owner)
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
    return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), $t('Niet opslaan'))
}

defineExpose({
    shouldNavigateAway
})
</script>
