<template>
    <LoadingView v-if="loading" />
    <SaveView v-else :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('shared.name') ">
                <input
                    v-model="name"
                    class="input"
                    type="text"
                    :placeholder="$t('shared.name') "
                >
            </STInputBox>
            <STInputBox title="Type" error-fields="behaviour" :error-box="errors.errorBox">
                <Dropdown v-model="behaviour">
                    <option :value="MembershipTypeBehaviour.Period">
                        Vaste periode
                    </option>
                    <option :value="MembershipTypeBehaviour.Days">
                        Per dag
                    </option>
                </Dropdown>
            </STInputBox>
        </div>

        <STInputBox :title="$t('shared.description')" error-fields="settings.description" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                :placeholder="$t('shared.optional')"
                autocomplete=""
            />
        </STInputBox>

        

        <hr>
        <h2>Instellingen per werkjaar</h2>
        <p>Per werkjaar kan je een prijs bepalen voor deze aansluiting, inclusief de start- en einddata.</p>

        <p v-if="sortedPeriods.length === 0" class="info-box">
            Je hebt nog geen instellingen toegevoegd.
        </p>
        <STList v-else>
            <MembershipTypeConfigRow v-for="{period, config} of sortedPeriods" :key="period.id" :config="config" :period="period" @click="editPeriod(config, period)" />
        </STList>

        <p>
            <button class="button text" type="button" @click="addConfig">
                <span class="icon add" />
                <span>{{ $t('admin.settings.membershipTypes.new.period') }}</span>
            </button>
        </p>

        <div v-if="!isNew && deleteHandler" class="container">
            <hr>
            <h2>
                {{ $t('shared.actions') }}
            </h2>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash" />
                <span>{{ $t('shared.delete') }}</span>
            </button>
        </div>
    </SaveView>
</template>


<script setup lang="ts">
import { AutoEncoderPatchType, PatchMap } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ContextMenu, ContextMenuItem, ErrorBox, SaveView, Toast, useErrors, usePatch, Dropdown } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { MembershipType, MembershipTypeBehaviour, MembershipTypeConfig, RegistrationPeriod } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { Ref, computed, ref } from 'vue';
import EditMembershipTypeConfigView from './EditMembershipTypeConfigView.vue';
import MembershipTypeConfigRow from './components/MembershipTypeConfigRow.vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();
const platformManager = usePlatformManager()
const owner = useRequestOwner()
const loading = ref(false);
const originalPeriods = ref([]) as Ref<RegistrationPeriod[]>;
const present = usePresent()

loadData().catch(console.error);

const props = defineProps<{
    type: MembershipType;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<MembershipType>) => Promise<void>,
    deleteHandler: (() => Promise<void>)|null
}>();
const title = computed(() => props.isNew ? $t('admin.settings.membershipTypes.new.title') : $t('admin.settings.membershipTypes.edit.title'));
const pop = usePop();

const {patched, addPatch, hasChanges, patch} = usePatch(props.type);

const sortedPeriods = computed(() => {
    const result: {period: RegistrationPeriod, config: MembershipTypeConfig}[] = Array.from(patched.value.periods.entries())
        .map(([periodId, config]) => ({ config, period: originalPeriods.value.find(p => p.id == periodId)! }))
        .filter(p => !!p.period);

    result.sort((a, b) => Sorter.byDateValue(a.period.startDate, b.period.startDate))
    return result
})

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

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
        if (name.value.length < 2) {
            throw new SimpleError({
                code: "invalid_field",
                message: $t('shared.errors.name.empty'),
                field: "name"
            })
        }

        await props.saveHandler(patch.value)
        await pop({ force: true }) 
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
    saving.value = false;
};

const doDelete = async () => {
    if (saving.value || deleting.value) {
        return;
    }

    if (!props.deleteHandler) {
        return;
    }

    if (!await CenteredMessage.confirm($t('admin.settings.membershipTypes.delete.confirmation.title'), $t('shared.delete'), $t('admin.settings.membershipTypes.delete.confirmation.description'))) {
        return
    }
        
    deleting.value = true;
    try {
        await props.deleteHandler()
        await pop({ force: true }) 
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

    deleting.value = false;
};

const name = computed({
    get: () => patched.value.name,
    set: (name) => addPatch({name}),
});

const description = computed({
    get: () => patched.value.description,
    set: (description) => addPatch({description}),
});

const behaviour = computed({
    get: () => patched.value.behaviour,
    set: (behaviour) => addPatch({behaviour}),
});

async function editPeriod(config: MembershipTypeConfig, period: RegistrationPeriod) {
    await present({
        components: [
            new ComponentWithProperties(EditMembershipTypeConfigView, {
                type: patched.value,
                period,
                config,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<MembershipTypeConfig>) => {
                    const periods = new PatchMap<string, AutoEncoderPatchType<MembershipTypeConfig>>()
                    periods.set(period.id, patch)
                    addPatch({
                        periods
                    })
                },
                deleteHandler: () => {
                    const periods = new PatchMap<string, AutoEncoderPatchType<MembershipTypeConfig>|null>()
                    periods.set(period.id, null)
                    addPatch({
                        periods
                    })
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

async function addConfig(event: MouseEvent) {
    const availablePeriods = originalPeriods.value.filter(p => !patched.value.periods.has(p.id))

    if (availablePeriods.length === 0) {
        Toast.info($t('admin.settings.membershipTypes.period.noPeriodsAvailable')).show()
        return
    }

    const menu = new ContextMenu([
        availablePeriods.map(period => {
            return new ContextMenuItem({
                name: period.name,
                icon: period.id === platformManager.value.$platform.period.id ? "dot" : undefined,
                action: () => addConfigForPeriod(period)
            })
        })
    ])

    await menu.show({
        button: event.currentTarget as HTMLElement
    })
}

async function addConfigForPeriod(period: RegistrationPeriod) {
    const {config: previousConfig, period: previousPeriod} = sortedPeriods.value[0] ?? {config: null, period: null}
    const config = previousConfig ? previousConfig.clone() : MembershipTypeConfig.create({})

    if (previousConfig && previousPeriod) {
        const yearDifference = period.startDate.getFullYear() - previousPeriod.startDate.getFullYear()

        // Change all dates
        config.startDate = new Date(config.startDate)
        config.startDate.setFullYear(config.startDate.getFullYear() + yearDifference)

        config.endDate = new Date(config.endDate)
        config.endDate.setFullYear(config.endDate.getFullYear() + yearDifference)

        if (config.expireDate) {
            config.expireDate = new Date(config.expireDate)
            config.expireDate.setFullYear(config.expireDate.getFullYear() + yearDifference)
        }

        for (const price of config.prices) {
            if (price.startDate) {
                price.startDate = new Date(price.startDate)
                price.startDate.setFullYear(price.startDate.getFullYear() + yearDifference)
            }
        }
    } else {
        config.startDate = period.startDate
        config.endDate = period.endDate
    }

    await present({
        components: [
            new ComponentWithProperties(EditMembershipTypeConfigView, {
                type: patched.value,
                period,
                config,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<MembershipTypeConfig>) => {
                    const periods = new PatchMap<string, MembershipTypeConfig>()
                    periods.set(period.id, config.patch(patch))
                    addPatch({
                        periods
                    })
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
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
