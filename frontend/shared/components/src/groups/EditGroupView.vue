<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" class="group-edit-view" @save="save">
        <h1>
            {{ title }}
        </h1>

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
            <GroupOptionMenuBox :option-menu="optionMenu" :group="patched" :errors="errors" :level="2" @patch:option-menu="addOptionMenuPatch" @delete="addOptionMenuDelete(optionMenu.id)" />
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

        <Checkbox v-model="useRegistrationStartDate">
            {{ $t('Start inschrijvingen pas na een bepaalde datum') }}
        </Checkbox>

        <div v-if="useRegistrationStartDate" class="split-inputs">
            <STInputBox :title="$t('Inschrijven start op')" error-fields="settings.registrationStartDate" :error-box="errors.errorBox">
                <DateSelection v-model="registrationStartDate" />
            </STInputBox>
            <TimeInput v-if="registrationStartDate" v-model="registrationStartDate" :title="$t('Vanaf')" :validator="errors.validator" /> 
        </div>

        <Checkbox v-model="useRegistrationEndDate">
            {{ $t('Sluit inschrijvingen automatisch na een bepaalde datum') }}
        </Checkbox>
                
        <div v-if="useRegistrationEndDate" class="split-inputs">
            <STInputBox :title="$t('Inschrijven sluit op')" error-fields="settings.registrationEndDate" :error-box="errors.errorBox">
                <DateSelection v-model="registrationEndDate" />
            </STInputBox>
            <TimeInput v-if="registrationEndDate" v-model="registrationEndDate" :title="$t('Tot welk tijdstip')" :validator="errors.validator" />
        </div>

        <div v-if="!isNew && deleteHandler" class="container">
            <hr>
            <h2>
                {{ $t('Acties') }}
            </h2>

            <LoadingButton :loading="deleting">
                <button class="button secundary danger" type="button" @click="deleteMe">
                    <span class="icon trash" />
                    <span>{{ $t('Verwijderen') }}</span>
                </button>
            </LoadingButton>
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { DateSelection, TimeInput } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Group, GroupOptionMenu, GroupPrice, GroupSettings, GroupType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { useErrors } from '../errors/useErrors';
import { useDraggableArray, usePatch, usePatchableArray } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { Toast } from '../overlays/Toast';
import GroupOptionMenuBox from './components/GroupOptionMenuBox.vue';
import GroupPriceBox from './components/GroupPriceBox.vue';
import GroupPriceView from './components/GroupPriceView.vue';
import { useFinancialSupportSettings } from './hooks';
import GroupOptionMenuView from './components/GroupOptionMenuView.vue';

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

const {patched, hasChanges, addPatch, patch} = usePatch(props.group);

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
        name: $t('Onbekend'),
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
        name: $t('Onbekend')
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
