<template>
    <section class="st-view">
        <STNavigationBar :title="$t('c4cc8f8b-d490-4182-ba92-7fce435945e7')"/>
        <main class="center">
            <h1>
                {{ $t('c4cc8f8b-d490-4182-ba92-7fce435945e7') }}
            </h1>

            <p>{{ $t('369440db-a9e0-4530-a06b-3ea05cc6a2b0') }}</p>

            <p v-if="members.length === 0" class="style-button-bar">
                <button v-if="isAcceptingNewMembers" class="button primary" type="button" @click="registerMembers">
                    <span class="icon edit"/>
                    <span>{{ $t('88b3d37d-fa66-4a61-84d9-3229391ee3c6') }}</span>
                </button>

                <a :href="$domains.getDocs('mijn-account')" target="_blank" class="button text selected">
                    <span class="icon book"/>
                    <span>{{ $t('a618506b-3706-4abd-8c29-705306264c44') }}</span>
                </a>
            </p>
            <p v-else class="style-button-bar">
                <a :href="$domains.getDocs('mijn-account')" target="_blank" class="button text selected">
                    <span class="icon book"/>
                    <span>{{ $t('a618506b-3706-4abd-8c29-705306264c44') }}</span>
                </a>
            </p>

            <QuickActionsBox :quick-actions="quickActions"/>

            <div v-if="members.length > 0" class="container">
                <hr><h2>
                    {{ $t('bb834e1a-02ac-4db3-bbd7-8db8f5b0d981') }}
                </h2>

                <STList class="illustration-list">
                    <STListItem v-for="member of members" :key="member.id" class="right-stack" :selectable="true" @click="$navigate(Routes.ViewMember, {properties: {member}})">
                        <template #left>
                            <MemberIcon :member="member" :icon="getRegistrationsForMember(member).length === 0 ? 'canceled' : ''"/>
                        </template>

                        <h3 class="style-title-list">
                            {{ member.patchedMember.name }}
                        </h3>
                        <p v-if="member.patchedMember.details.birthDayFormatted" class="style-description-small">
                            {{ member.patchedMember.details.birthDayFormatted }}
                        </p>

                        <p v-if="getRegistrationsForMember(member).length" class="style-description-small">
                            {{ $t('8779075b-4955-468a-b2fc-7016d25304f9') }} {{ Formatter.joinLast(getRegistrationsForMember(member).map(r => r.group.settings.name), ', ', ' en ') }}.
                        </p>
                        <p v-else class="style-description-small">
                            {{ member.patchedMember.firstName }} {{ $t('07f33d8c-e550-4b2e-946e-9620d3170116') }}
                        </p>

                        <template #right>
                            <span v-if="user && member.id === user.memberId" v-color="member" class="style-tag">{{ $t('31841592-24ec-45c9-a720-4f86b9755edb') }}</span>
                            <span class="icon gray arrow-right-small"/>
                        </template>
                    </STListItem>
                </STList>

                <footer class="style-button-bar">
                    <button class="button text" type="button" @click="addNewMember">
                        <span class="icon add"/>
                        <span>{{ $t('9adfb914-aa65-4455-baaf-d9f2c47292d8') }}</span>
                    </button>
                </footer>
            </div>

            <div v-if="members.length > 0" class="container">
                <hr><h2>
                    {{ $t('8424a02d-2147-40d1-9db2-ddece074a650') }}
                </h2>

                <STList class="illustration-list">
                    <STListItem class="left-center" :selectable="true" @click="registerMembers">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/edit-data.svg" class="style-illustration-img"></template>

                        <h3 class="style-title-list">
                            {{ $t('f06ec2d8-73a9-4b6c-bc49-ab352b8737b9') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('29c93cee-d42f-4030-a072-5d72fbb7af5d') }}
                        </p>

                        <template #right>
                            <span class="icon gray arrow-right-small"/>
                        </template>
                    </STListItem>

                    <STListItem class="left-center" :selectable="true" @click="checkData">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/magnifier.svg" class="style-illustration-img"></template>

                        <h3 class="style-title-list">
                            {{ $t('680de5c5-9258-47a2-8514-f436252e563f') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('4f38b668-26ee-45e3-a3f1-fdcbcc3ca211') }}
                        </p>

                        <template #right>
                            <span class="icon gray arrow-right-small"/>
                        </template>
                    </STListItem>

                    <STListItem class="left-center" :selectable="true" @click="$navigate(Routes.Payments)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/creditcards.svg" class="style-illustration-img"></template>

                        <h3 class="style-title-list">
                            {{ $t('d2ed1534-aea9-4ad2-8073-b565abc80a3d') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('0d772d97-0ffe-4fff-ad49-5d9c94ec9a74') }}
                        </p>

                        <template #right>
                            <span class="icon gray arrow-right-small"/>
                        </template>
                    </STListItem>
                </STList>
            </div>

            <div v-if="documents.length > 0" class="container">
                <hr><h2>
                    {{ $t('eeb261d4-2a8d-46f3-ae06-f294fa1721a6') }}
                </h2>
                <STList>
                    <STListItem v-for="document of documents" :key="document.id" class="left-center hover-box member-registration-block" :selectable="true" @click="onDownloadDocument(document)">
                        <template #left>
                            <span class="icon file-pdf red"/>
                        </template>
                        <h3 class="style-title-list">
                            {{ document.data.name }}
                        </h3>
                        <p class="style-description-small">
                            {{ document.data.description }}
                        </p>
                        <span v-if="document.status === 'MissingData'" class="style-tag error">{{ $t('edfe0b87-4b2d-4b2d-a2cf-2df5699b52fa') }}</span>

                        <template #right>
                            <LoadingButton :loading="isDocumentDownloading(document)">
                                <span class="icon download gray"/>
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
import { useMemberManager, useRequestOwner } from '@stamhoofd/networking';
import { Document, DocumentStatus, GroupType, PlatformMember } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';

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
            Toast.error('Lid niet gevonden').show();
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

async function registerMembers() {
    await $navigate(Routes.RegisterMembers);
}

async function checkData() {
    await $navigate(Routes.CheckData);
}

function getRegistrationsForMember(member: PlatformMember) {
    return member.filterRegistrations({ currentPeriod: true, types: [GroupType.Membership, GroupType.WaitingList] }).sort((a, b) =>
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

const downloadingDocuments = ref([] as Document[]);

async function onDownloadDocument(document: Document) {
    if (isDocumentDownloading(document)) {
        return;
    }
    if (document.status === DocumentStatus.MissingData) {
        const member = members.value.find(m => m.id === document.memberId);
        new Toast('Dit document kan niet gedownload worden omdat er nog gegevens ontbreken of ongeldig zijn. Kijk alle gegevens van ' + (member?.member.firstName ?? 'dit lid') + ' na en contacteer ons indien het probleem nog niet is verholpen.', 'error red').setHide(20000).show();
        return;
    }
    downloadingDocuments.value.push(document);
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
