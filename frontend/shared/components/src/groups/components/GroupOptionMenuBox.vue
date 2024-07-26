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

        <STInputBox v-if="level == 1" title="Naam" error-fields="name" :error-box="errors.errorBox">
            <input
                v-model="name"
                class="input"
                type="text"
                placeholder="Naam van dit menu"
                autocomplete=""
            >
        </STInputBox>

        <STInputBox v-if="level == 1" title="Beschrijving" error-fields="description" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                placeholder="Optioneel. Meer info bij keuzes."
                autocomplete=""
                enterkeyhint="next"
            />
        </STInputBox>

        <template v-if="level == 1">
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
    </div>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { Group, GroupOptionMenu, GroupPrice } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useErrors } from '../../errors/useErrors';
import { useEmitPatch } from '../../hooks';
import GroupOptionMenuView from './GroupOptionMenuView.vue';

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
const {patched, addPatch} = useEmitPatch<GroupPrice>(props, emit, 'optionMenu');
const present = usePresent();

const name = computed({
    get: () => patched.value.name,
    set: (name) => addPatch({name})
})

const description = computed({
    get: () => patched.value.description,
    set: (description) => addPatch({description})
})

function addOption() {
    // todo
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
