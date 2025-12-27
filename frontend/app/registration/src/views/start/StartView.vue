<template>
    <section class="st-view">
        <STNavigationBar :title="$t('c4cc8f8b-d490-4182-ba92-7fce435945e7')" />
        <main class="center">
            <h1>
                {{ $t('c4cc8f8b-d490-4182-ba92-7fce435945e7') }}
            </h1>

            <p>{{ $t('369440db-a9e0-4530-a06b-3ea05cc6a2b0') }}</p>

            <p v-if="members.length === 0 && !isAcceptingNewMembers" class="info-box icon lock">
                {{ $t('dd5ee237-2ae7-475c-b58d-3c5a2159f4c5') }}
            </p>

            <p v-if="members.length === 0 && isAcceptingNewMembers" class="style-button-bar">
                <button class="button primary" type="button" data-testid="register-member-button" @click="registerMembers">
                    <span class="icon edit" />
                    <span>{{ $t('d55c9b50-2f86-4e7a-b6a5-2f03c0fad4fa') }}</span>
                </button>

                <a v-if="documentationUrl" :href="documentationUrl.toString()" target="_blank" class="button text selected">
                    <span class="icon book" />
                    <span>{{ $t('b6994143-5a0c-424d-97b3-8b3cf96a3443') }}</span>
                </a>
            </p>
            <p v-else-if="documentationUrl" class="style-button-bar">
                <a :href="documentationUrl.toString()" target="_blank" class="button text selected">
                    <span class="icon book" />
                    <span>{{ $t('b6994143-5a0c-424d-97b3-8b3cf96a3443') }}</span>
                </a>
            </p>

            <QuickActionsBox :quick-actions="quickActions" />

            <div v-if="members.length > 0" class="container">
                <hr><h2>
                    {{ $t('97dc1e85-339a-4153-9413-cca69959d731') }}
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
                            {{ $t('f87072d0-0c87-4b31-9068-1471a5f5b3ca', {groups: Formatter.joinLast(getRegistrationsForMember(member).map(r => r.group.settings.name.toString()), ', ', ' ' + $t('6a156458-b396-4d0f-b562-adb3e38fc51b') + ' ')}) }}
                        </p>
                        <p v-else class="style-description-small">
                            {{ $t('eb39138f-46b9-4005-b70f-dc1e0f3938f9', {member: member.patchedMember.firstName}) }}
                        </p>

                        <template #right>
                            <span v-if="user && member.id === user.memberId" v-color="member" class="style-tag">{{ $t('c0736ebd-de06-4d78-a009-7fc4ba5096a8') }}</span>
                            <span class="icon gray arrow-right-small" />
                        </template>
                    </STListItem>
                </STList>

                <footer class="style-button-bar">
                    <button class="button text" type="button" @click="addNewMember">
                        <span class="icon add" />
                        <span>{{ $t('22025c96-3f15-41c6-ab2c-0c5fcb3c5aa2') }}</span>
                    </button>
                </footer>
            </div>

            <div v-if="members.length > 0" class="container">
                <hr><h2>
                    {{ $t('dc052084-eea5-407e-8775-237bf550895a') }}
                </h2>

                <STList class="illustration-list">
                    <STListItem class="left-center" :selectable="true" data-testid="register-member-button" @click="registerMembers">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/edit-data.svg" class="style-illustration-img">
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('21a07c40-5565-4ad3-bf7a-ca3237c6bcb0') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('98edeedc-0a99-4fc0-904e-06dcba42f7e1') }}
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
                            {{ $t('d14e4e63-c77d-44d9-b8d0-adf05e299303') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('60823584-6df5-4c99-9eca-c5e64d83a730') }}
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
                            {{ $t('6b83343a-5d29-4f59-8b44-db03eb0b3b13') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('e1ba3253-f0a0-41b0-95a0-3fc0abb44264') }}
                        </p>

                        <template #right>
                            <span class="icon gray arrow-right-small" />
                        </template>
                    </STListItem>
                </STList>
            </div>

            <div v-if="documents.length > 0" class="container">
                <hr><h2>
                    {{ $t('a01ee6b1-f27f-4ad2-a87c-28bce4dedfbd') }}
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
                        <span v-if="document.status === 'MissingData'" class="style-tag error">{{ $t('21b3891d-7c0e-49ca-ae35-d77d54e9f0c3') }}</span>

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
            Toast.error($t(`9cfa48c7-980c-4cd5-85ed-2656db040b4c`)).show();
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
        new Toast($t(`78a4c6c3-c0d0-457c-adfb-44122307161a`, { name: member?.member.firstName ?? $t(`9e5a8bc1-91db-44e5-9059-3312f4145525`) }), 'error red').setHide(20000).show();
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
