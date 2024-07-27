<template>
    <LoadingView v-if="loadingOrganizer" :error-box="loadingEventOrganizerErrorBox" />
    <SaveView v-else :loading="saving" :title="title" :disabled="!hasChanges && !isNew" class="group-edit-view" :deleting="deleting" @save="save" v-on="!isNew && deleteHandler ? {delete: deleteMe} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="patched.type === GroupType.EventRegistration && !organization">
            <hr>
            <h2>Organisator</h2>
            <p>Voor nationale activiteiten moet je kiezen via welke groep alle betalingen verlopen. De betaalinstellingen van die groep worden dan gebruikt en alle inschrijvingen worden dan ingeboekt in de boekhouding van die groep.</p>
            <p class="style-description-block">
                Daarnaast bepaalt de organisator ook instellingen die invloed hebben op de dataverzameling en andere subtielere zaken.
            </p>

            <STList>
                <STListItem v-if="eventOrganizer" :selectable="true" @click="chooseOrganizer('Kies een organisator')">
                    <template #left>
                        <OrganizationAvatar :organization="eventOrganizer" />
                    </template>

                    <h3 class="style-title-list">
                        {{ eventOrganizer.name }}
                    </h3>
                    <p class="style-description">
                        {{ eventOrganizer.address.anonymousString(Country.Belgium) }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </template>

        <hr>
        <h2 class="style-with-button">
            <div>{{ $t('Tarieven') }}</div>
            <div>
                <button class="button text only-icon-smartphone" type="button" @click="addGroupPrice">
                    <span class="icon add" />
                    <span>{{ $t('Tarief') }}</span>
                </button>
            </div>
        </h2>
        <p>Je kan een meerdere tarieven instellen en elk tarief een eigen naam geven. Een lid kan bij het inschrijven zelf één van de beschikbare tarieven kiezen.</p>

        <STList v-if="patched.settings.prices.length !== 1" v-model="draggablePrices" :draggable="true">
            <template #item="{item: price}">
                <STListItem :selectable="true" class="right-stack" @click="editGroupPrice(price)">
                    <h3 class="style-title-list">
                        {{ price.name }}
                    </h3>

                    <p class="style-description-small">
                        Prijs: {{ formatPrice(price.price.price) }}
                    </p>

                    <p v-if="price.price.reducedPrice !== null" class="style-description-small">
                        {{ reducedPriceName }}: <span>{{ formatPrice(price.price.reducedPrice) }}</span>
                    </p>

                    <p v-if="price.isSoldOut" class="style-description-small">
                        Uitverkocht
                    </p>
                    <p v-else-if="price.stock" class="style-description-small">
                        Nog {{ pluralText(price.remainingStock, 'stuk', 'stuks') }} beschikbaar
                    </p>

                    <template #right>
                        <span v-if="price.hidden" v-tooltip="$t('Verborgen')" class="icon gray eye-off" />
                        <span class="button icon drag gray" @click.stop @contextmenu.stop />
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </template>
        </STList>
        <GroupPriceBox v-else :price="patched.settings.prices[0]" :group="patched" :errors="errors" @patch:price="addPricePatch" />

        <div v-for="optionMenu of patched.settings.optionMenus" :key="optionMenu.id" class="container">
            <hr>
            <GroupOptionMenuBox :option-menu="optionMenu" :group="patched" :errors="errors" :level="2" @patch:group="addPatch" @patch:option-menu="addOptionMenuPatch" @delete="addOptionMenuDelete(optionMenu.id)" />
        </div>

        <hr>

        <STList>
            <STListItem :selectable="true" element-name="button" @click="addGroupOptionMenu()">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    Keuzemenu toevoegen
                </h3>
            </STListItem>
        </STList>

        <hr>
        <h2>Beschikbaarheid</h2>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useRegistrationStartDate" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('Start inschrijvingen pas na een bepaalde datum') }}
                </h3>

                <div v-if="useRegistrationStartDate" class="split-inputs option" @click.stop.prevent>
                    <STInputBox :title="$t('Inschrijven start op')" error-fields="settings.registrationStartDate" :error-box="errors.errorBox">
                        <DateSelection v-model="registrationStartDate" />
                    </STInputBox>
                    <TimeInput v-if="registrationStartDate" v-model="registrationStartDate" :title="$t('Vanaf')" :validator="errors.validator" /> 
                </div>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useRegistrationEndDate" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('Sluit inschrijvingen automatisch na een bepaalde datum') }}
                </h3>

                <div v-if="useRegistrationEndDate" class="split-inputs option" @click.stop.prevent>
                    <STInputBox :title="$t('Inschrijven sluit op')" error-fields="settings.registrationEndDate" :error-box="errors.errorBox">
                        <DateSelection v-model="registrationEndDate" />
                    </STInputBox>
                    <TimeInput v-if="registrationEndDate" v-model="registrationEndDate" :title="$t('Tot welk tijdstip')" :validator="errors.validator" />
                </div>
            </STListItem>
        </STList>

        <hr>
        <h2>Gegevensverzameling</h2>
        <p>Deze gegevens worden verzameld en gekoppeld aan leden die inschrijven. Let erop dat deze gegevens gedeeld zijn met andere inschrijvingen. Als dezelfde gegevens dus voor meerdere inschrijvingen verzameld worden, dan worden ze maar één keer gevraagd (anders kunnen leden de gegevens wel nog nakijken als het al even geleden werd ingevuld) en kan je niet per inschrijving andere gegevens invullen. Gebruik ze dus niet voor tijdelijke vragen.</p>

        <InheritedRecordsConfigurationBox :overrideOrganization="eventOrganizer" :inherited-records-configuration="inheritedRecordsConfiguration" :records-configuration="recordsConfiguration" @patch:records-configuration="patchRecordsConfiguration" />
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { DateSelection, InheritedRecordsConfigurationBox, NavigationActions, OrganizationAvatar, SearchOrganizationView, TimeInput } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Country, Group, GroupOption, GroupOptionMenu, GroupPrice, GroupSettings, GroupType, Organization, OrganizationRecordsConfiguration } from '@stamhoofd/structures';
import { computed, Ref, ref } from 'vue';
import { useErrors } from '../errors/useErrors';
import { useDraggableArray, useOrganization, usePatch, usePatchableArray, usePlatform } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { Toast } from '../overlays/Toast';
import GroupOptionMenuBox from './components/GroupOptionMenuBox.vue';
import GroupOptionMenuView from './components/GroupOptionMenuView.vue';
import GroupPriceBox from './components/GroupPriceBox.vue';
import GroupPriceView from './components/GroupPriceView.vue';
import { useFinancialSupportSettings, useExternalOrganization } from './hooks';

const props = withDefaults(
    defineProps<{
        group: Group;
        isNew: boolean;
        saveHandler: (group: AutoEncoderPatchType<Group>) => Promise<void>;
        deleteHandler?: (() => Promise<void>)|null;
        showToasts?: boolean;
    }>(),
    {
        deleteHandler: null,
        showToasts: true
    }
);

const platform = usePlatform();
const organization = useOrganization();
const {patched, hasChanges, addPatch, patch} = usePatch(props.group);

const {externalOrganization: eventOrganizer, choose: chooseOrganizer, loading: loadingOrganizer, errorBox: loadingEventOrganizerErrorBox} = useExternalOrganization(
    computed({
        get: () => patched.value.organizationId,
        set: (organizationId: string) => addPatch({
            organizationId
        })
    })
)

const patchPricesArray = (prices: PatchableArrayAutoEncoder<GroupPrice>) => {
    addPatch({
        settings: GroupSettings.patch({
            prices
        })
    })
}
const {addPatch: addPricePatch, addPut: addPricePut, addDelete: addPriceDelete} = usePatchableArray(patchPricesArray)
const draggablePrices = useDraggableArray(() => patched.value.settings.prices, patchPricesArray)

const {addPatch: addOptionMenuPatch, addPut: addOptionMenuPut, addDelete: addOptionMenuDelete} = usePatchableArray((optionMenus: PatchableArrayAutoEncoder<GroupOptionMenu>) => {
    addPatch({
        settings: GroupSettings.patch({
            optionMenus
        })
    })
})

const recordsConfiguration = computed(() => patched.value.settings.recordsConfiguration);
const patchRecordsConfiguration = (recordsConfiguration: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
    addPatch({
        settings: GroupSettings.patch({
            recordsConfiguration
        })
    })
}
const inheritedRecordsConfiguration = computed(() => {
    if (eventOrganizer.value) {
        return OrganizationRecordsConfiguration.mergeChild(platform.value.config.recordsConfiguration, eventOrganizer.value.meta.recordsConfiguration)
    }
    return platform.value.config.recordsConfiguration

});

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();
const pop = usePop();
const {priceName: reducedPriceName} = useFinancialSupportSettings()
const present = usePresent();

const registrationStartDate = computed({
    get: () => patched.value.settings.registrationStartDate,
    set: (registrationStartDate) => addPatch({
        settings: GroupSettings.patch({
            registrationStartDate
        })
    })
})

const registrationEndDate = computed({
    get: () => patched.value.settings.registrationEndDate,
    set: (registrationEndDate) => addPatch({
        settings: GroupSettings.patch({
            registrationEndDate
        })
    })
})

const useRegistrationStartDate = computed({
    get: () => !!patched.value.settings.registrationStartDate,
    set: (useRegistrationStartDate) => {
        if (!useRegistrationStartDate) {
            addPatch({
                settings: GroupSettings.patch({
                    registrationStartDate: null
                })
            })
        } else {
            addPatch({
                settings: GroupSettings.patch({
                    registrationStartDate: props.group.settings.registrationStartDate ?? new Date()
                })
            })
        }
    }
})

const useRegistrationEndDate = computed({
    get: () => !!patched.value.settings.registrationEndDate,
    set: (useRegistrationEndDate) => {
        if (!useRegistrationEndDate) {
            addPatch({
                settings: GroupSettings.patch({
                    registrationEndDate: null
                })
            })
        } else {
            addPatch({
                settings: GroupSettings.patch({
                    registrationEndDate: props.group.settings.registrationEndDate ?? new Date()
                })
            })
        }
    }
})

const title = computed(() => {
    if (props.group.type === GroupType.EventRegistration) {
        return props.isNew ? $t('groups.title.new.eventRegistration') :$t('groups.title.edit.eventRegistration');
    }
    return props.isNew ? $t('groups.title.new.membership') : $t('groups.title.edit.membership');
});

async function save() {
    if (deleting.value || saving.value) {
        return;
    }

    saving.value = true;
    try {
        await props.saveHandler(patch.value);
        if (props.showToasts) {
            await Toast.success($t('shared.confirmation.saved')).show();
        }
        await pop({force: true})
    } catch (e) {
        Toast.fromError(e).show();
    } finally {
        saving.value = false;
    }
}

async function deleteMe() {
    if (!await CenteredMessage.confirm(props.group.type === GroupType.EventRegistration ? $t('groups.confirm.delete.eventRegistration') : $t('groups.confirm.delete.membership'), $t('shared.confirmDelete'))) {
        return;
    }
    if (deleting.value || saving.value || !props.deleteHandler) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        if (props.showToasts) {
            await Toast.success($t('shared.confirmation.deleted')).show();
        }
        await pop({force: true})
    } catch (e) {
        Toast.fromError(e).show();
    } finally {
        deleting.value = false;
    }
}

function addGroupPrice() {
    const price = GroupPrice.create({
        name: $t('Naamloos'),
        price: patched.value.settings.prices[0]?.price?.clone()
    })
    addPricePut(price)
}

async function editGroupPrice(price: GroupPrice) {
    await present({
        components: [
            new ComponentWithProperties(GroupPriceView, {
                price,
                group: patched,
                isNew: false,
                saveHandler: async (patch: AutoEncoderPatchType<GroupPrice>) => {
                    addPricePatch(patch)
                },
                deleteHandler: async () => {
                    addPriceDelete(price.id)
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

async function addGroupOptionMenu() {
    const optionMenu = GroupOptionMenu.create({
        name: $t('Naamloos'),
        options: [
            GroupOption.create({
                name: $t('Optie 1')
            })
        ]
    })
    
    await present({
        components: [
            new ComponentWithProperties(GroupOptionMenuView, {
                optionMenu,
                group: patched,
                isNew: true,
                saveHandler: async (patch: AutoEncoderPatchType<GroupOptionMenu>) => {
                    addOptionMenuPut(optionMenu.patch(patch))
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
    return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), $t('Niet opslaan'))
}

defineExpose({
    shouldNavigateAway
})


</script>
