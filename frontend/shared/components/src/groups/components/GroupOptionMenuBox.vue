<template>
    <div class="container">
        <template v-if="level == 2">
            <h2 class="style-with-button">
                <div>{{ name }}</div>
                <div>
                    <button class="button icon edit" type="button" @click="editOptionMenu" />
                    <button class="button icon add" type="button" @click="addOption" />
                </div>
            </h2>
            <p v-if="description" class="style-description pre-wrap" v-text="description" />
        </template>

        <template v-if="level == 1">
            <STInputBox title="Naam" error-fields="name" :error-box="errors.errorBox">
                <input
                    v-model="name"
                    class="input"
                    type="text"
                    placeholder="Naam van dit menu"
                    autocomplete=""
                >
            </STInputBox>

            <STInputBox title="Beschrijving" error-fields="description" :error-box="errors.errorBox" class="max">
                <textarea
                    v-model="description"
                    class="input"
                    type="text"
                    placeholder="Optioneel. Meer info bij keuzes."
                    autocomplete=""
                    enterkeyhint="next"
                />
            </STInputBox>

            <STList>
                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Checkbox v-model="multipleChoice" />
                    </template>
                    <h3 class="style-title-list">
                        Meerkeuze
                    </h3>
                    <p class="style-description-small">
                        Bij meerkeuze is het mogelijk om verschillende opties aan te duiden. In het andere geval moet er exact één keuze gemaakt worden (wil je het optioneel maken, voeg dan een optie 'Geen' toe).
                    </p>
                </STListItem>
            </STList>

            
            <hr>
            <h2 class="style-with-button">
                <div>Keuzes</div>
                <div>
                    <button class="button text only-icon-smartphone" type="button" @click="addOption">
                        <span class="icon add" />
                        <span>Keuze</span>
                    </button>
                </div>
            </h2>
        </template>

        <STList v-model="draggableOptions" :draggable="true">
            <template #item="{item: option, index}">
                <STListItem :selectable="true" class="right-stack" @click="editOption(option)">
                    <template #left>
                        <Radio v-if="!optionMenu.multipleChoice" :model-value="index === 0" :value="true" :disabled="true" />
                        <Checkbox v-else :disabled="true" />
                    </template>

                    <h3 class="style-title-list">
                        {{ option.name }}
                    </h3>

                    <p class="style-description-small">
                        {{ formatPriceChange(option.price.price) }}
                    </p>

                    <p v-if="option.price.reducedPrice !== null" class="style-description-small">
                        {{ reducedPriceName }}: <span>{{ formatPriceChange(option.price.reducedPrice) }}</span>
                    </p>

                    <p v-if="option.isSoldOut" class="style-description-small">
                        Uitverkocht
                    </p>
                    <p v-else-if="option.stock" class="style-description-small">
                        Nog {{ pluralText(option.remainingStock, 'stuk', 'stuks') }} beschikbaar
                    </p>

                    <template #right>
                        <span v-if="option.hidden" v-tooltip="$t('Verborgen')" class="icon gray eye-off" />
                        <span class="button icon drag gray" @click.stop @contextmenu.stop />
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </template>
        </STList>
    </div>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Group, GroupOption, GroupOptionMenu } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useErrors } from '../../errors/useErrors';
import { useDraggableArray, useEmitPatch, usePatchableArray } from '../../hooks';
import { useFinancialSupportSettings } from '../hooks';
import GroupOptionMenuView from './GroupOptionMenuView.vue';
import GroupOptionView from './GroupOptionView.vue';

const props = withDefaults(
    defineProps<{
        optionMenu: GroupOptionMenu,
        group: Group,
        errors: ReturnType<typeof useErrors>,
        level: 1|2
    }>(),
    {
        level: 2
    }
);

const emit = defineEmits(['patch:optionMenu', 'delete'])
const {patched, addPatch} = useEmitPatch<GroupOptionMenu>(props, emit, 'optionMenu');
const present = usePresent();
const {priceName: reducedPriceName} = useFinancialSupportSettings()
const $t = useTranslate();

const patchOptionsArray = (options: PatchableArrayAutoEncoder<GroupOption>) => {
    addPatch({
        options
    })
}
const {addPatch: addOptionPatch, addPut: addOptionPut, addDelete: addOptionDelete} = usePatchableArray(patchOptionsArray)
const draggableOptions = useDraggableArray(() => patched.value.options, patchOptionsArray)

const name = computed({
    get: () => patched.value.name,
    set: (name) => addPatch({name})
})

const description = computed({
    get: () => patched.value.description,
    set: (description) => addPatch({description})
})

const multipleChoice = computed({
    get: () => patched.value.multipleChoice,
    set: (multipleChoice) => addPatch({multipleChoice})
})

function addOption() {
    const price = GroupOption.create({
        name: $t('Naamloos'),
        price: patched.value.options[0]?.price?.clone()
    })
    addOptionPut(price)
}

async function editOption(option: GroupOption) {
    await present({
        components: [
            new ComponentWithProperties(GroupOptionView, {
                option,
                optionMenu: patched.value,
                group: props.group,
                isNew: false,
                saveHandler: async (patch: AutoEncoderPatchType<GroupOption>) => {
                    addOptionPatch(patch)
                },
                deleteHandler: () => {
                    addOptionDelete(option.id)
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

async function editOptionMenu() {
    await present({
        components: [
            new ComponentWithProperties(GroupOptionMenuView, {
                optionMenu: patched.value,
                group: props.group,
                isNew: false,
                saveHandler: async (patch: AutoEncoderPatchType<GroupOptionMenu>) => {
                    addPatch(patch)
                },
                deleteHandler: () => {
                    emit('delete')
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

</script>
