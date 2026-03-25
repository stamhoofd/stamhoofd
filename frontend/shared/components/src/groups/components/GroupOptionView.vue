<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" :deleting="deleting" @save="save" v-on="!isNew && deleteHandler ? {delete: deleteMe} : {}">
        <h1>
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`%Gq`)">
            <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`%Sk`)">
        </STInputBox>

        <ReduceablePriceInput v-model="price" :group="group" :error-box="errors.errorBox" :validator="errors.validator" :title="$t(`%TQ`)" />

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hidden" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%UC') }}
                </h3>
                <p v-if="hidden" class="style-description-small">
                    {{ $t('%dI') }}
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="allowAmount" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%dJ') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('%dK') }}
                </p>
            </STListItem>

            <STListItem v-if="allowAmount" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useMaximum" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%dL') }}
                </h3>

                <div v-if="useMaximum" class="split-inputs option" @click.stop.prevent>
                    <STInputBox error-fields="maximum" :error-box="errors.errorBox" :title="$t(`%dN`)">
                        <NumberInput v-model="maximum" suffix="stuks" suffix-singular="stuk" :required="false" :placeholder="$t('%6A')" :min="2" />
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useStock" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%dM', {stock: usedStock.toString()}) }}
                </h3>

                <div v-if="useStock" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="stock" :error-box="errors.errorBox">
                        <NumberInput v-model="stock" suffix="stuks" suffix-singular="stuk" />
                    </STInputBox>
                </div>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import NumberInput from '#inputs/NumberInput.vue';
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import type { Group, GroupOption, GroupOptionMenu } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { useErrors } from '../../errors/useErrors';
import { usePatch } from '../../hooks';
import { CenteredMessage } from '../../overlays/CenteredMessage';
import { Toast } from '../../overlays/Toast';
import ReduceablePriceInput from './ReduceablePriceInput.vue';

const props = withDefaults(
    defineProps<{
        option: GroupOption;
        optionMenu: GroupOptionMenu;
        group: Group;
        isNew: boolean;
        saveHandler: (price: AutoEncoderPatchType<GroupOption>) => Promise<void>;
        deleteHandler?: (() => Promise<void>) | null;
        showToasts?: boolean;
    }>(),
    {
        deleteHandler: null,
        showToasts: true,
    },
);

const { patched, hasChanges, addPatch, patch } = usePatch(props.option);
const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const pop = usePop();

const title = computed(() => {
    return props.isNew ? $t('%6B') : $t('%6C');
});

const name = computed({
    get: () => patched.value.name,
    set: name => addPatch({ name }),
});
const price = computed({
    get: () => patched.value.price,
    set: price => addPatch({ price }),
});

const hidden = computed({
    get: () => patched.value.hidden,
    set: hidden => addPatch({ hidden }),
});

const stock = computed({
    get: () => patched.value.stock,
    set: stock => addPatch({ stock }),
});

const usedStock = computed(() => patched.value.getUsedStock(props.group) || 0);

const useStock = computed({
    get: () => patched.value.stock !== null,
    set: useStock => addPatch({ stock: useStock ? (patched.value.getUsedStock(props.group) || 10) : null }),
});

const maximum = computed({
    get: () => patched.value.maximum,
    set: maximum => addPatch({ maximum }),
});

const useMaximum = computed({
    get: () => patched.value.maximum !== null,
    set: useMaximum => addPatch({ maximum: useMaximum ? 10 : null }),
});

const allowAmount = computed({
    get: () => patched.value.allowAmount,
    set: allowAmount => addPatch({ allowAmount }),
});

async function save() {
    if (deleting.value || saving.value) {
        return;
    }

    saving.value = true;
    try {
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    finally {
        saving.value = false;
    }
}

async function deleteMe() {
    if (!await CenteredMessage.confirm($t('%6D'), $t('%55'), $t('%6E'))) {
        return;
    }
    if (deleting.value || saving.value || !props.deleteHandler) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        if (props.showToasts) {
            Toast.success($t('%1FX')).show();
        }
        await pop({ force: true });
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    finally {
        deleting.value = false;
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
