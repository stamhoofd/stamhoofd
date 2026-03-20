<template>
    <div v-if="isAdmin" class="container">
        <Title v-bind="$attrs" :title="title" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />

        <Checkbox v-model="dataPermissions" :indeterminate="!dataPermissionsChangeDate">
            {{ $t('%fB') }}
        </Checkbox>

        <p v-if="!willMarkReviewed && dataPermissionsChangeDate" class="style-description-small">
            {{ $t('%fC') }} {{ formatDate(dataPermissionsChangeDate) }}. <button type="button" class="inline-link" :v-tooltip="$t('%fD')" @click="clear">
                {{ $t('%fE') }}
            </button>.
        </p>
        <p v-if="!dataPermissionsChangeDate" class="style-description-small">
            {{ $t('%Bn') }}
        </p>

        <p v-if="checkboxWarning" v-show="!dataPermissions" class="warning-box">
            {{ checkboxWarning }}
        </p>
    </div>
    <div v-else class="container">
        <Title v-bind="$attrs" :title="title" />
        <p class="style-description pre-wrap" v-text="description" />
        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />

        <Checkbox v-model="dataPermissions">
            {{ checkboxLabel }}
        </Checkbox>

        <p v-if="checkboxWarning" v-show="!dataPermissions" class="warning-box">
            {{ checkboxWarning }}
        </p>
    </div>
</template>

<script setup lang="ts">
import type { PlatformMember } from '@stamhoofd/structures';
import { BooleanStatus } from '@stamhoofd/structures';

import { computed, nextTick } from 'vue';
import { useAppContext } from '../../../context/appContext';
import type { ErrorBox } from '../../../errors/ErrorBox';
import type { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';
import { useValidation } from '../../../errors/useValidation';
import { useDataPermissionSettings } from '../../../groups';
import { usePlatform } from '../../../hooks';
import Title from './Title.vue';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<{
    member: PlatformMember;
    validator: Validator;
    parentErrorBox?: ErrorBox | null;
    willMarkReviewed?: boolean;
}>();

const platform = usePlatform();
const errors = useErrors({ validator: props.validator });
const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';

const checkboxWarning = computed(() => platform.value.config.dataPermission?.checkboxWarning ?? null);

useValidation(props.validator, async () => {
    if (props.willMarkReviewed) {
        // Force saving: increase saved date + make sure it is not null
        dataPermissions.value = dataPermissions.value as any;
        await nextTick();
    }
    return true;
});

const dataPermissions = computed({
    get: () => props.member.patchedMember.details.dataPermissions?.value ?? false,
    set: (dataPermissions) => {
        if (dataPermissions === (props.member.member.details.dataPermissions?.value ?? false) && !props.willMarkReviewed) {
            return props.member.addDetailsPatch({
                dataPermissions: props.member.member.details.dataPermissions ?? BooleanStatus.create({
                    value: dataPermissions,
                }),
            });
        }
        return props.member.addDetailsPatch({
            dataPermissions: BooleanStatus.create({
                value: dataPermissions,
            }),
        });
    },
});
const dataPermissionsChangeDate = computed(() => props.member.patchedMember.details.dataPermissions?.date ?? null);

const { dataPermissionSettings } = useDataPermissionSettings();

const title = computed(() => dataPermissionSettings.value.title);
const description = computed(() => dataPermissionSettings.value.description);
const checkboxLabel = computed(() => dataPermissionSettings.value.checkboxLabel);

function clear() {
    props.member.addDetailsPatch({
        dataPermissions: null,
    });
}

</script>
