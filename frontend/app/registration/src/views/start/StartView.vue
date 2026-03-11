<template>
    <section class="st-view">
        <STNavigationBar :title="$t('%7k')" />
        <main class="center">
            <h1>
                {{ $t('%7k') }}
            </h1>

            <p>{{ $t('%7') }}</p>

            <p v-if="members.length === 0 && !isAcceptingNewMembers" class="info-box icon lock">
                {{ $t('%1Hb') }}
            </p>

            <p v-if="members.length === 0 && isAcceptingNewMembers" class="style-button-bar">
                <button class="button primary" type="button" data-testid="register-member-button" @click="registerMembers">
                    <span class="icon edit" />
                    <span>{{ $t('%XS') }}</span>
                </button>

                <a v-if="documentationUrl" :href="documentationUrl.toString()" target="_blank" class="button text selected">
                    <span class="icon book" />
                    <span>{{ $t('%XT') }}</span>
                </a>
            </p>
            <p v-else-if="documentationUrl" class="style-button-bar">
                <a :href="documentationUrl.toString()" target="_blank" class="button text selected">
                    <span class="icon book" />
                    <span>{{ $t('%XT') }}</span>
                </a>
            </p>

            <QuickActionsBox :quick-actions="quickActions" />

            <div v-if="members.length > 0" class="container">
                <hr><h2>
                    {{ $t('%1EH') }}
                </h2>

                <STList class="illustration-list">
                    <STListItem v-for="member of members" :key="member.id" class="right-stack" :selectable="true" data-testid="open-member-button" @click="$navigate(Routes.ViewMember, {properties: {member}})">
                        <template #left>
                            <MemberIcon :member="member" :icon="getRegistrationsForMember(member).length === 0 ? 'canceled' : ''" />
                        </template>

                        <h3 class="style-title-list">
                            {{ member.patchedMember.name }}
                        </h3>
                        <p v-if="member.patchedMember.details.birthDayFormatted" class="style-description-small">
                            {{ member.patchedMember.details.birthDayFormatted }}
                        </p>

                        <p v-if="getRegistrationsForMember(member).length" class="style-description-small">
                            {{ $t('%XU', {groups: Formatter.joinLast(getRegistrationsForMember(member).map(r => r.group.settings.name.toString()), ', ', ' ' + $t('%M1') + ' ')}) }}
                        </p>
                        <p v-else class="style-description-small">
                            {{ $t('%XV', {member: member.patchedMember.firstName}) }}
                        </p>

                        <template #right>
                            <span v-if="user && member.id === user.memberId" v-color="member" class="style-tag">{{ $t('%XP') }}</span>
                            <span class="icon gray arrow-right-small" />
                        </template>
                    </STListItem>
                </STList>

                <footer class="style-button-bar">
                    <button class="button text" type="button" @click="addNewMember">
                        <span class="icon add" />
                        <span>{{ $t('%XW') }}</span>
                    </button>
                </footer>
            </div>

            <div v-if="members.length > 0" class="container">
                <hr><h2>
                    {{ $t('%16X') }}
                </h2>

                <STList class="illustration-list">
                    <STListItem class="left-center" :selectable="true" data-testid="register-member-button" @click="registerMembers">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/edit-data.svg" class="style-illustration-img">
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%XX') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('%XY') }}
                        </p>

                        <template #right>
                            <span class="icon gray arrow-right-small" />
                        </template>
                    </STListItem>

                    <STListItem class="left-center" :selectable="true" @click="checkData">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/magnifier.svg" class="style-illustration-img">
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%uC') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('%XZ') }}
                        </p>

                        <template #right>
                            <span class="icon gray arrow-right-small" />
                        </template>
                    </STListItem>

                    <STListItem class="left-center" :selectable="true" @click="$navigate(Routes.Payments)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/creditcards.svg" class="style-illustration-img">
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%Xa') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('%Xb') }}
                        </p>

                        <template #right>
                            <span class="icon gray arrow-right-small" />
                        </template>
                    </STListItem>
                </STList>
            </div>

            <div v-if="documents.length > 0" class="container">
                <hr><h2>
                    {{ $t('%tw') }}
                </h2>
                <STList>
                    <STListItem v-for="document of documents" :key="document.id" class="left-center hover-box member-registration-block" :selectable="true" @click="onDownloadDocument(document)">
                        <template #left>
                            <span class="icon file-pdf red" />
                        </template>
                        <h3 class="style-title-list">
                            {{ document.data.name }}
                        </h3>
                        <p class="style-description-small">
                            {{ document.data.description }}
                        </p>
                        <span v-if="document.status === 'MissingData'" class="style-tag error">{{ $t('%Ni') }}</span>

                        <template #right>
                            <LoadingButton :loading="isDocumentDownloading(document)">
                                <span class="icon download gray" />
                            </LoadingButton>
                        </template>
                    </STListItem>
                </STList>
            </div>
        </main>
    </section>
</template>

<script setup lang="ts">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { MemberIcon, QuickActionsBox, Toast, useAddMember, useChooseGroupForMember, useContext, useRegistrationQuickActions, useUser } from '@stamhoofd/components';
import { downloadDocument } from '@stamhoofd/document-helper';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n';
import { useMemberManager, useRequestOwner } from '@stamhoofd/networking';
import { Document, DocumentStatus, GroupType, PlatformMember, TranslatedString } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed, Ref, ref } from 'vue';

enum Routes {
    RegisterMembers = 'registerMembers',
    CheckData = 'checkData',
    ViewMember = 'viewMember',
    Payments = 'payments',
}
defineRoutes([
    {
        name: Routes.RegisterMembers,
        url: 'registreren',
        component: async () => (await import('../members/RegisterMembersView.vue')).default as any,
        present: 'popup',
    },
    {
        name: Routes.CheckData,
        url: 'gegevens',
        component: async () => (await import('../members/CheckDataView.vue')).default as any,
        present: 'popup',
    },
    {
        name: Routes.Payments,
        url: 'betalingen',
        component: async () => (await import('./payments/MemberPayableBalanceView.vue')).default as any,
        present: 'popup',
    },
    {
        name: Routes.ViewMember,
        url: 'leden/@id',
        component: async () => (await import('../members/MemberView.vue')).default as any,
        present: 'popup',
        params: {
            id: String,
        },
        paramsToProps: async (params: { id: string }) => {
            const member = members.value.find(m => m.id === params.id);
            if (member) {
                return {
                    member,
                };
            }
            Toast.error($t(`%EO`)).show();
            throw new Error('member not found');
        },

        propsToParams(props) {
            if (!('member' in props) || typeof props.member !== 'object' || props.member === null || !('id' in props.member)) {
                throw new Error('Missing member');
            }
            return {
                params: {
                    id: props.member.id,
                },
            };
        },
    },
]);
const $navigate = useNavigate();
const memberManager = useMemberManager();
const user = useUser();
const quickActions = useRegistrationQuickActions();
const context = useContext();
const requestOwner = useRequestOwner();

const documents = computed(() => memberManager.family.documents);
const members = computed(() => memberManager.family.members);
const isAcceptingNewMembers = computed(() => memberManager.isAcceptingNewMembers);
const chooseGroupForMember = useChooseGroupForMember();
const addMember = useAddMember();
const documentationUrl = STAMHOOFD.userMode === 'platform' ? TranslatedString.create(STAMHOOFD.memberDocumentationPage ?? LocalizedDomains.getDocs('mijn-account')) : undefined;

async function registerMembers() {
    await $navigate(Routes.RegisterMembers);
}

async function checkData() {
    await $navigate(Routes.CheckData);
}

function getRegistrationsForMember(member: PlatformMember) {
    return member.filterRegistrations({ currentPeriod: true, includeFuture: false, types: [GroupType.Membership, GroupType.WaitingList] }).sort((a, b) =>
        Sorter.stack(
            Sorter.byDateValue(b.registeredAt ?? b.createdAt, a.registeredAt ?? a.createdAt),
        ),
    );
}

async function addNewMember() {
    await addMember(memberManager.family, {
        displayOptions: { action: 'present', modalDisplayStyle: 'popup' },
        async finishHandler(member, navigate) {
            await chooseGroupForMember({
                member,
                displayOptions: { action: 'show', replace: 100, force: true },
                customNavigate: navigate,
            });
        },
    });
}

const downloadingDocuments = ref([] as Document[]) as Ref<Document[]>;

async function onDownloadDocument(document: Document) {
    if (isDocumentDownloading(document)) {
        return;
    }
    if (document.status === DocumentStatus.MissingData) {
        const member = members.value.find(m => m.id === document.memberId);
        new Toast($t(`%Xc`, { name: member?.member.firstName ?? $t(`%15V`) }), 'error red').setHide(20000).show();
        return;
    }
    downloadingDocuments.value.push(document as any); // fix for Type instantiation is excessively deep and possibly infinite
    try {
        await downloadDocument(context.value, document, requestOwner);
    }
    catch (e) {
        console.error(e);
    }
    downloadingDocuments.value = downloadingDocuments.value.filter(d => d.id !== document.id);
}

function isDocumentDownloading(document: Document) {
    return !!downloadingDocuments.value.find(d => d.id === document.id);
}
</script>
