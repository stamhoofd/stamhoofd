<template>
    <div class="container">
        <template v-if="level === 2">
            <h2 class="style-with-button">
                <div @contextmenu.prevent="showContextMenu">
                    {{ name }}
                </div>
                <div>
                    <button class="button icon more" type="button" @click="showContextMenu"/>
                    <button class="button icon add" type="button" @click="addOption"/>
                </div>
            </h2>
            <p v-if="description" class="style-description pre-wrap" v-text="description"/>
        </template>

        <template v-if="level === 1">
            <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
                <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`7940da81-72ce-4c31-82bd-73f46ea9a57f`)"></STInputBox>

            <STInputBox error-fields="description" :error-box="errors.errorBox" class="max" :title="$t(`f72f5546-ed6c-4c93-9b0d-9718f0cc9626`)">
                <textarea v-model="description" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t(`ead484a5-94fd-4180-a96b-2afb404de8ed`)"/>
            </STInputBox>

            <STList>
                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Checkbox v-model="multipleChoice"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('14902f38-96a6-48b1-85ea-65992b8dcd3f') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t("54c7df4d-a1b9-4ef4-9ccd-eabd8624c78f") }}
                    </p>
                </STListItem>
            </STList>

            
            <hr><h2 class="style-with-button">
                <div>{{ $t('24dec8c3-16e8-4dc9-b71a-d0a4adce2c8d') }}</div>
                <div>
                    <button class="button text only-icon-smartphone" type="button" @click="addOption">
                        <span class="icon add"/>
                        <span>{{ $t('7eb44f10-ac07-4174-adc0-ae3ffb1e4f6e') }}</span>
                    </button>
                </div>
            </h2>
        </template>

        <STList v-model="draggableOptions" :draggable="true">
            <template #item="{item: option, index}">
                <STListItem :selectable="true" class="right-stack" @click="editOption(option)">
                    <template #left>
                        <Radio v-if="!optionMenu.multipleChoice" :model-value="index === 0" :value="true" :disabled="true"/>
                        <Checkbox v-else :disabled="true"/>
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

                    <p v-if="option.stock !== null" class="style-description-small">
                        {{ $t('6878be1d-f7ca-4c4c-b6fa-de59c8028cd7') }} {{ pluralText(option.getRemainingStock(group), 'stuk', 'stuks') }} {{ $t('79828b21-b66f-4e18-bb1e-bb46ee12a8af') }}
                    </p>

                    <p v-if="option.maximum !== null && option.allowAmount" class="style-description-small">
                        {{ $t('9b5ab8db-e5ff-4a62-8d48-d126447432b7') }} {{ pluralText(option.maximum, 'stuk', 'stuks') }} {{ $t('35b58221-09c1-4f62-846e-4dedb505bf73') }}
                    </p>

                    <template #right>
                        <StepperInput v-if="option.allowAmount"/>
                        <span v-if="option.hidden" v-tooltip="$t('aff982ed-0f1a-4838-af79-9e00cd53131b')" class="icon gray eye-off"/>
                        <span class="button icon drag gray" @click.stop @contextmenu.stop/>
                        <span class="icon arrow-right-small gray"/>
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
import { Group, GroupOption, GroupOptionMenu, GroupSettings } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useErrors } from '../../errors/useErrors';
import { useDraggableArray, useEmitPatch, usePatchableArray, usePatchMoveUpDownSingle } from '../../hooks';
import StepperInput from '../../inputs/StepperInput.vue';
import { CenteredMessage } from '../../overlays/CenteredMessage';
import { ContextMenu, ContextMenuItem } from '../../overlays/ContextMenu';
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

const emit = defineEmits(['patch:optionMenu', 'delete', 'patch:group'])
const {patched, addPatch} = useEmitPatch<GroupOptionMenu>(props, emit, 'optionMenu');
const present = usePresent();
const {priceName: reducedPriceName} = useFinancialSupportSettings({
    group: computed(() => props.group)
})
const {up, canMoveUp, canMoveDown, down} = usePatchMoveUpDownSingle(props.optionMenu.id, computed(() => props.group.settings.optionMenus), (patch) => {
    emit('patch:group', Group.patch({
        settings: GroupSettings.patch({
            optionMenus: patch
        })
    }))
})

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
        name: $t('9b0aebaf-d119-49df-955b-eb57654529e5'),
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

async function  showContextMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: "Instellingen",
                icon: "settings",
                action: async () => {
                    await editOptionMenu()
                    return true;
                }
            }),

            new ContextMenuItem({
                name: "Verwijderen",
                icon: "trash",
                action: async () => {
                    if (!await CenteredMessage.confirm($t('f58412a9-9db9-4aa3-ad68-fa089d4f345b'), $t('201437e3-f779-47b6-b4de-a0fa00f3863e'), $t('9f8c1ed0-371b-4c22-940c-57d624734c18'))) {
                        return;
                    }
                    emit('delete')
                    return true;
                }
            }),
        ],
        [
            new ContextMenuItem({
                name: "Omhoog verplaatsen",
                icon: "arrow-up",
                disabled: !canMoveUp.value,
                action: async () => {
                    up()
                    return true;
                }
            }),
            new ContextMenuItem({
                name: "Omlaag verplaatsen",
                icon: "arrow-down",
                disabled: !canMoveDown.value,
                action: async () => {
                    down()
                    return true;
                }
            }),
        ]
    ])
    menu.show({ clickEvent: event }).catch(console.error)
}
</script>
