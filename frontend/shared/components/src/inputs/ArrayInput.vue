<template>
    <STInputBox>
        <div v-if="model.length > 0" class="array-list-items">
            <div v-for="n in model.length" :key="virtualId + '-' + n" class="array-list-item">
                <div class="left">
                    <slot name="item" v-bind="{index: n - 1}" :model-value="getValue(n - 1)" :update-model-value="(event: T) => setValue(n - 1, event)" />
                </div>

                <div class="right">
                    <button class="button icon trash gray small" type="button" @click="removeValue(n - 1)" />
                </div>
            </div>
        </div>

        <slot v-else name="empty">
            <p class="style-description-small">
                {{ $t('7c114d86-2858-47e2-bd5c-4d59f9fa2c39') }}
            </p>
        </slot>

        <template #right>
            <button class="button icon add gray small" type="button" @click="addValue" />
        </template>
    </STInputBox>
</template>

<script setup lang="ts" generic="T">
import { ref } from 'vue';

const props = defineProps<{
    defaultValue: () => T;
}>();

const model = defineModel<T[]>({ required: true });

const virtualId = ref(0);

function getValue(index: number) {
    return model.value[index];
}

function setValue(index: number, value: T) {
    const values = model.value.slice();
    values[index] = value;
    model.value = values;
}

function addValue() {
    model.value = [...model.value, props.defaultValue()];

    // Force ID update because the inputs will have changed order and we don't have a proper id
    virtualId.value++;
}

function removeValue(index: number) {
    const values = model.value.slice();
    values.splice(index, 1);
    model.value = values;

    // Force ID update because the inputs will have changed order and we don't have a proper id
    virtualId.value++;
}

</script>

<style lang="scss">
.array-list-item {
    display: flex;
    flex-direction: row;
    gap: 7px;
    width: 100%;
    align-items: center;

    > .left {
        flex-grow: 1;
    }

    > .right {
        flex-shrink: 0;
    }
}

.array-list-items {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
}
</style>
