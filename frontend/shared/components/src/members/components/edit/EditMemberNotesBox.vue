<template>
    <div v-if="appContext !== 'registration'" class="container">
        <Title v-bind="$attrs" title="Notities" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox title="" error-fields="notes" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="notes"
                class="input"
                type="text"
                placeholder="Bijkomende informatie over dit lid (onzichtbaar voor het lid)."
                autocomplete=""
                enterkeyhint="next"
            />
        </STInputBox>
    </div>
</template>

<script lang="ts" setup>
import { PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { ErrorBox } from '../../../errors/ErrorBox';
import { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';
import Title from './Title.vue';

defineOptions({
    inheritAttrs: false
});

const props = defineProps<{
    member: PlatformMember,
    validator: Validator,
    parentErrorBox?: ErrorBox | null
}>();

const errors = useErrors({validator: props.validator});
const appContext = useAppContext();

const notes = computed({
    get: () => props.member.patchedMember.details.notes,
    set: (notes) => props.member.addDetailsPatch({notes})});

</script>
