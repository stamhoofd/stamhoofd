<template>
    <div class="container">
        <Title v-bind="$attrs" :title="$t(`7f3af27c-f057-4ce3-8385-36dfb99745e8`)" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox title="" error-fields="notes" :error-box="errors.errorBox" class="max">
            <textarea v-model="notes" class="input" type="text" autocomplete="off" enterkeyhint="next" :maxlength="maxLength" :placeholder="$t(`4b023560-3014-4a4f-8034-9aaaf9819b36`)" />
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
    inheritAttrs: false,
});

const props = defineProps<{
    member: PlatformMember;
    validator: Validator;
    parentErrorBox?: ErrorBox | null;
}>();

const maxLength = 1000;
const errors = useErrors({ validator: props.validator });
const appContext = useAppContext();

const notes = computed({
    get: () => props.member.patchedMember.details.notes,
    set: (notes) => {
        if (notes !== null) {
            // cut long notes
            if (notes.length > maxLength) {
                notes = notes.substring(0, maxLength);
            }

            // remove empty notes
            if (/^\s*$/.test(notes)) {
                notes = null;
            }
        }

        props.member.addDetailsPatch({ notes });
    },
});

</script>
