<template>
    <STListItem v-long-press="editRegistration" v-color="registrationOrganization && (app !== 'dashboard' || !organization || registrationOrganization.id !== organization.id) ? registrationOrganization.meta.color : null" :selectable="isEditable" class="hover-box right-stack" :class="{'theme-secundary': !registration.deactivatedAt && registration.isTrial, 'theme-error': !!registration.deactivatedAt}" @contextmenu.prevent="editRegistration($event)" @click.prevent="editRegistration($event)">
        <template #left>
            <GroupIconWithWaitingList :group="group" :icon="registration.deactivatedAt ? 'disabled error' : (registration.isTrial? 'trial secundary' : '')" :organization="registrationOrganization && (app !== 'dashboard' || !organization || registrationOrganization.id !== organization.id) ? registrationOrganization : null" />
        </template>
        <p v-if="registrationOrganization && (app !== 'dashboard' || !organization || registrationOrganization.id !== organization.id)" class="style-title-prefix-list">
            {{ registrationOrganization.name }}
        </p>
        <p v-else-if="registration.deactivatedAt" class="style-title-prefix-list">
            {{ $t('%7y') }}
        </p>
        <p v-else-if="registration.isTrial" class="style-title-prefix-list">
            {{ $t('%1IH') }}
        </p>

        <h3 class="style-title-list">
            <span>{{ group.settings.name }}</span>
        </h3>
        <p v-if="defaultAgeGroup && group.settings.name.toString() !== defaultAgeGroup && app === 'admin'" class="style-description-small" v-text="defaultAgeGroup" />

        <template v-for="description of descriptions" :key="description.key">
            <p v-if="description.type === 'text'" class="style-description-small pre-wrap" v-text="description.text" />
            <p v-else class="style-description-small pre-wrap">
                <span>{{ description.label }}: </span>
                <button type="button" class="inline-link" @click.stop="download(description)">
                    <span :class="'icon text-size ' + description.icon" />
                    <span>{{ description.name }}</span>
                </button>
            </p>
        </template>

        <p v-if="registration.startDate" class="style-description-small">
            {{ $t('%fp') }} {{ formatDate(registration.startDate) }}
        </p>

        <p v-if="registration.registeredAt && !(registration.startDate && formatDate(registration.registeredAt) === formatDate(registration.startDate))" class="style-description-small">
            {{ $t('%fq') }} {{ formatDate(registration.registeredAt) }}
        </p>
        <p v-if="registration.deactivatedAt" class="style-description-small">
            {{ $t('%fr') }} {{ formatDate(registration.deactivatedAt) }}
        </p>
        <p v-if="registration.isTrial && registration.trialUntil" class="style-description-small">
            {{ $t('%1OU') }} {{ formatDate(registration.trialUntil) }}
        </p>
        <p v-else-if="registration.startDate && registration.trialUntil" class="style-description-small">
            {{ $t('%ft') }} {{ Formatter.dateNumber(registration.startDate) }} tot {{ Formatter.dateNumber(registration.trialUntil) }}
        </p>

        <p v-if="!registration.registeredAt && registration.canRegister" class="style-description-small">
            {{ $t('%fu') }}
        </p>

        <p v-if="registration.payingOrganizationId" class="style-description-small">
            {{ $t('%fv') }}
        </p>

        <p v-if="registration.deactivatedAt && registration.calculatedPrice" class="style-description-small">
            {{ $t('%16t') }}: {{ formatPrice(registration.calculatedPrice) }}
        </p>

        <template #right>
            <span v-if="!registration.deactivatedAt && registration.balances.length" class="style-price-base">{{ formatPrice(registration.calculatedPrice) }}</span>
            <span v-if="isEditable" class="icon arrow-down-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import type { PlatformMember, Registration } from '@stamhoofd/structures';
import { GroupType, RecordFileAnswer, RecordImageAnswer } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, getCurrentInstance } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { downloadFile } from '../../../helpers/downloadFile.ts';
import { Toast } from '../../../overlays/Toast';
import { useNow } from '#hooks/useNow.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import GroupIconWithWaitingList from '../group/GroupIconWithWaitingList.vue';

const props = defineProps<{
    registration: Registration;
    member: PlatformMember;
}>();
const emit = defineEmits(['edit']);
const now = useNow();

const instance = getCurrentInstance();
const organization = useOrganization();
const platform = usePlatform();
const app = useAppContext();
const isDeactivated = computed(() => props.registration.deactivatedAt !== null);
const isEditable = computed(() => {
    if (isDeactivated.value) {
        return false;
    }
    return !!instance?.vnode.props?.onEdit;
});
const group = computed(() => {
    return props.registration.group;
});
const registrationOrganization = computed(() => {
    return props.member.organizations.find(o => o.id === group.value.organizationId);
});

const defaultAgeGroup = computed(() => {
    if (group.value.type !== GroupType.Membership) {
        return null;
    }

    if (!group.value.defaultAgeGroupId) {
        return $t(`%10I`);
    }
    return platform.value.config.defaultAgeGroups.find(ag => ag.id === group.value.defaultAgeGroupId)?.name;
});

type Description = {
    type: 'text';
    key: string;
    text: string;
} | {
    type: 'link';
    key: string;
    label: string;
    url: string;
    icon: string;
    name: string;
};

const descriptions = computed<Description[]>(() => {
    const descriptions: Description[] = [];

    if (props.registration.group.settings.getFilteredPrices().length > 1) {
        const text = props.registration.groupPrice.name.toString();
        if (text) {
            descriptions.push({
                type: 'text',
                key: 'group-price',
                text,
            });
        }
    }

    for (const option of props.registration.options) {
        const text = option.optionMenu.name + ': ' + option.option.name + (option.option.allowAmount ? ` x ${option.amount}` : '');
        if (text) {
            descriptions.push({
                type: 'text',
                key: 'option-' + option.optionMenu.id + '-' + option.option.id,
                text,
            });
        }
    }

    for (const answer of props.registration.recordAnswers.values()) {
        if (answer instanceof RecordFileAnswer && answer.file) {
            descriptions.push({
                type: 'link',
                key: 'record-answer-' + answer.id,
                label: answer.settings.name.toString(),
                url: answer.file.getPublicPath(),
                icon: answer.file.icon,
                name: answer.file.name ?? answer.settings.name?.toString() ?? answer.file.getPublicPath(),
            });
            continue;
        }

        if (answer instanceof RecordImageAnswer && answer.image) {
            descriptions.push({
                type: 'link',
                key: 'record-answer-' + answer.id,
                label: answer.settings.name.toString(),
                url: answer.image.getPublicPath(),
                icon: answer.image.source.icon,
                name: answer.image.source.name ?? answer.settings.name?.toString() ?? answer.image.getPublicPath(),
            });
            continue;
        }

        const text = answer.descriptionValue;
        if (text) {
            descriptions.push({
                type: 'text',
                key: 'record-answer-' + answer.id,
                text,
            });
        }
    }

    return descriptions;
});

// These files are uploaded by a member, so we download them instead of sending anyone to their url
function download(description: Description & { type: 'link' }) {
    // A file without a name is shown with its url, which we don't want to use as a filename
    const filename = description.name === description.url ? $t('%yU') : description.name;

    downloadFile(description.url, filename).catch((e) => {
        Toast.fromError(e).show();
    });
}

function editRegistration(event: any) {
    if (isDeactivated.value) {
        return;
    }
    emit('edit', event);
}
</script>
