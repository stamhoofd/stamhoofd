<template>
    <div class="st-view sms-view">
        <STNavigationBar :title="$t(`SMS'en`)"/>

        <main>
            <h1>
                {{ $t("68c36512-27ac-4f2d-b71c-029d5d45ffd2") }}
            </h1>

            <div v-if="!isSupported" class="error-box">
                {{ $t('928dd27f-e108-4097-be07-0a1804e89c04') }}
            </div>
            <STInputBox v-if="customers.length === 0 && parentsEnabled" :title="$t(`f40db38c-ea48-4a43-80da-fbc5d50e78a6`)">
                <Dropdown id="sms-who" v-model="smsFilter">
                    <option value="parents">
                        {{ $t('ae436301-c9a4-4280-b0d4-f7143d11aa77') }}
                    </option>
                    <option value="members">
                        {{ $t('37a7828b-0ba1-4e41-a203-e37ccd658885') }}
                    </option>
                    <option value="all">
                        {{ $t('b6ba3a89-db58-4e73-9d89-171cddfdb426') }}
                    </option>
                </Dropdown>
            </STInputBox>

            <STInputBox v-if="canUseBody" id="message-title" :title="$t(`37a80cbe-8d17-4392-a568-b6c05c8ab6cc`)"/>
            <textarea v-if="canUseBody" id="sms-text" v-model="message" class="input" :placeholder="$t(`be796726-39b1-4de9-9da9-a4be6652ab75`)"/>
        </main>

        <STToolbar>
            <template #left>
                {{
                    phones.length
                        ? phones.length > 1
                            ? phones.length + " ontvangers"
                            : "Eén ontvanger"
                        : "Geen ontvangers"
                }}
            </template>
            <template #right>
                <button class="button primary" :disabled="!isSupported || phones.length === 0" type="button" @click="send">
                    {{ $t('1ae3cae8-4fdc-410e-af1e-e29717ab7374') }}
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { CenteredMessage, Dropdown, STInputBox, STNavigationBar, STToolbar, useOrganization } from '@stamhoofd/components';
import { Customer, Member } from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';

const props = withDefaults(defineProps<{
    members?: Member[];
    customers?: Customer[];
}>(), {
    members: () => [],
    customers: () => [],
});

const organization = useOrganization();
const smsFilter = ref('all');
const message = ref('');

const os = getOS();
const isSupported = ['unknown', 'windows'].every(item => item !== os);
const canUseBody = ['unknown', 'windows', 'macOS-old'].every(item => item !== os);

const parentsEnabled = computed(() => {
    const enabled = organization.value!.meta.recordsConfiguration.parents !== null;
    return enabled && props.members.some(member => member.details.parents.length > 0);
});

onMounted(() => {
    if (parentsEnabled.value) {
        const hasMinor = props.members.some(member => member.details.parents.length > 0 && (member.details.age ?? 99) < 18);
        const hasGrownUp = props.members.some(member => (member.details.age ?? 99) >= 18);

        if (hasMinor && !hasGrownUp) {
            smsFilter.value = 'parents';
        }
    }
});

function getOS(): 'android' | 'macOS-old' | 'iOS' | 'macOS' | 'windows' | 'unknown' {
    var userAgent = navigator.userAgent || navigator.vendor;

    if (/android/i.test(userAgent)) {
        return 'android';
    }

    if (/Mac OS X 10_14|Mac OS X 10_13|Mac OS X 10_12|Mac OS X 10_11|Mac OS X 10_10|Mac OS X 10_9/.test(userAgent)) {
        // Different sms protocol
        return 'macOS-old';
    }

    // iOS detection from: http://stackoverflow.com/a/9039885/177710
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
        return 'iOS';
    }

    // iPad on iOS 13 detection
    if (navigator.userAgent.includes('Mac') && 'ontouchend' in document) {
        return 'iOS';
    }

    if (navigator.platform.toUpperCase().indexOf('MAC') >= 0) {
        return 'macOS';
    }

    if (navigator.platform.toUpperCase().indexOf('WIN') >= 0) {
        return 'windows';
    }

    if (navigator.platform.toUpperCase().indexOf('IPHONE') >= 0) {
        return 'iOS';
    }

    if (navigator.platform.toUpperCase().indexOf('ANDROID') >= 0) {
        return 'android';
    }

    return 'unknown';
}

const phones = computed(() => {
    const recipients: Set<string> = new Set();

    for (const customer of props.customers) {
        if (customer.phone.length > 0) {
            recipients.add(customer.phone);
        }
    }

    for (const member of props.members) {
        if (!member.details) {
            continue;
        }

        if (smsFilter.value === 'parents' || smsFilter.value === 'all') {
            for (const parent of member.details.parents) {
                if (parent.phone) {
                    recipients.add(parent.phone);
                }
            }
        }

        if (member.details.phone && (smsFilter.value === 'members' || smsFilter.value === 'all')) {
            recipients.add(member.details.phone);
        }
    }

    return Array.from(recipients.values());
});

function send() {
    if (phones.value.length === 0) {
        return;
    }
    let url = '';
    switch (os) {
        case 'macOS-old':
            url = 'imessage:';
            break;
        case 'android':
            url = 'sms:';
            break;
            /* case "whatsapp":
                url = "https://wa.me/";
                break; */
        case 'macOS':
        case 'iOS':
            url = 'sms:/open?addresses=';
            break;
    }

    url += phones.value.map(phone => phone.replace(/(\s)+/g, '')).join(',');

    switch (os) {
        case 'macOS-old':
            // werkt niet
            break;
        case 'android':
            url += '?body=' + encodeURIComponent(message.value);
            break;
        case 'macOS':
        case 'iOS':
            url += '&body=' + encodeURIComponent(message.value);
            break;
    }

    window.location.href = url;
}

async function shouldNavigateAway() {
    if (message.value.length === 0) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je dit scherm wilt sluiten?', 'Sluiten');
}

defineExpose({
    shouldNavigateAway,
});
</script>

<style lang="scss">

.sms-view {
    > main {
        display: flex;
        flex-grow: 1;
        flex-direction: column;

        #message-title {
            padding-bottom: 0;
        }

        & > textarea {
            flex-grow: 1;
            min-height: 200px;
        }
    }
}
</style>
