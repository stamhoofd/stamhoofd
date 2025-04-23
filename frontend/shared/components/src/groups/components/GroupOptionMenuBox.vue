<template>
    <div class="container">
        <template v-if="level === 2">
            <h2 class="style-with-button">
                <div @contextmenu.prevent="showContextMenu">
                    {{ name }}
                </div>
                <div>
                    <button class="button icon more" type="button" @click="showContextMenu" />
                    <button class="button icon add" type="button" @click="addOption" />
                </div>
            </h2>
            <p v-if="description" class="style-description pre-wrap" v-text="description" />
        </template>

        <template v-if="level === 1">
            <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
                <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`722de8c9-feea-4169-8c9d-3d945fc8c9f5`)">
            </STInputBox>

            <STInputBox error-fields="description" :error-box="errors.errorBox" class="max" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)">
                <textarea v-model="description" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t(`3a12fa06-088d-413d-a36d-b5a2afdfc504`)" />
            </STInputBox>

            <STList>
                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Checkbox v-model="multipleChoice" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('d95331fe-56b0-4423-b485-5f600b6ab49c') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t("f726843e-f724-4ea4-b783-bddbf0667148") }}
                    </p>
                </STListItem>
            </STList>

            <hr><h2 class="style-with-button">
                <div>{{ $t('6c90965a-8334-43e6-8494-031e2932bc45') }}</div>
                <div>
                    <button class="button text only-icon-smartphone" type="button" @click="addOption">
                        <span class="icon add" />
                        <span>{{ $t('6c80efa8-5658-4728-ba95-d0536fdd25bd') }}</span>
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

                    <p v-if="option.stock !== null" class="style-description-small">
                        {{ $t('dceceb1c-6d55-4a93-bf8f-85ba041786f4', {stock: pluralText(option.getRemainingStock(group), 'stuk', 'stuks')}) }}
                    </p>

                    <p v-if="option.maximum !== null && option.allowAmount" class="style-description-small">
                        {{ $t('b86dbc2f-9ec8-468c-9571-ca384f118c79', {max: pluralText(option.maximum, 'stuk', 'stuks')}) }}
                    </p>

                    <template #right>
                        <StepperInput v-if="option.allowAmount" />
                        <span v-if="option.hidden" v-tooltip="$t('aff982ed-0f1a-4838-af79-9e00cd53131b')" class="icon gray eye-off" />
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
        optionMenu: GroupOptionMenu;
        group: Group;
        errors: ReturnType<typeof useErrors>;
        level: 1 | 2;
    }>(),
    {
        level: 2,
    },
);

const emit = defineEmits(['patch:optionMenu', 'delete', 'patch:group']);
const { patched, addPatch } = useEmitPatch<GroupOptionMenu>(props, emit, 'optionMenu');
const present = usePresent();
const { priceName: reducedPriceName } = useFinancialSupportSettings({
    group: computed(() => props.group),
});
const { up, canMoveUp, canMoveDown, down } = usePatchMoveUpDownSingle(props.optionMenu.id, computed(() => props.group.settings.optionMenus), (patch) => {
    emit('patch:group', Group.patch({
        settings: GroupSettings.patch({
            optionMenus: patch,
        }),
    }));
});



const patchOptionsArray = (options: PatchableArrayAutoEncoder<GroupOption>) => {
    addPatch({
        options,
    });
};
const { addPatch: addOptionPatch, addPut: addOptionPut, addDelete: addOptionDelete } = usePatchableArray(patchOptionsArray);
const draggableOptions = useDraggableArray(() => patched.value.options, patchOptionsArray);

const name = computed({
    get: () => patched.value.name,
    set: name => addPatch({ name }),
});

const description = computed({
    get: () => patched.value.description,
    set: description => addPatch({ description }),
});

const multipleChoice = computed({
    get: () => patched.value.multipleChoice,
    set: multipleChoice => addPatch({ multipleChoice }),
});

function addOption() {
    const price = GroupOption.create({
        name: $t('9b0aebaf-d119-49df-955b-eb57654529e5'),
        price: patched.value.options[0]?.price?.clone(),
    });
    addOptionPut(price);
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
                    addOptionPatch(patch);
                },
                deleteHandler: () => {
                    addOptionDelete(option.id);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function editOptionMenu() {
    await present({
        components: [
            new ComponentWithProperties(GroupOptionMenuView, {
                optionMenu: patched.value,
                group: props.group,
                isNew: false,
                saveHandler: async (patch: AutoEncoderPatchType<GroupOptionMenu>) => {
                    addPatch(patch);
                },
                deleteHandler: () => {
                    emit('delete');
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function showContextMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t(`5ca94078-d742-4e17-abf7-957c4721a559`),
                icon: 'settings',
                action: async () => {
                    await editOptionMenu();
                    return true;
                },
            }),

            new ContextMenuItem({
                name: $t(`faae9011-c50d-4ada-aed0-c1b578782b2a`),
                icon: 'trash',
                action: async () => {
                    if (!await CenteredMessage.confirm($t('f58412a9-9db9-4aa3-ad68-fa089d4f345b'), $t('201437e3-f779-47b6-b4de-a0fa00f3863e'), $t('9f8c1ed0-371b-4c22-940c-57d624734c18'))) {
                        return;
                    }
                    emit('delete');
                    return true;
                },
            }),
        ],
        [
            new ContextMenuItem({
                name: $t(`c8b8fb4b-3a2b-4de7-85a1-f1b963a739e7`),
                icon: 'arrow-up',
                disabled: !canMoveUp.value,
                action: async () => {
                    up();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`31eb1b5d-b3d7-4a76-a5d8-f102dbeb757c`),
                icon: 'arrow-down',
                disabled: !canMoveDown.value,
                action: async () => {
                    down();
                    return true;
                },
            }),
        ],
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}
</script>
