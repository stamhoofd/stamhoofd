<template>
    <div class="st-view background">
        <STNavigationBar
            :title="$t('Groepsadministratie')"
            :dismiss="canDismiss"
            :pop="canPop"
        />

        <main>
            <h1>
                {{
                    isLoggedIn
                        ? $t("Start synchronisatie")
                        : $t("Groepsadministratie synchroniseren")
                }}
            </h1>
            <p>
                {{
                    $t(
                        "Via deze koppeling zet je gegevens van Stamhoofd automatisch over naar de groepsadministratie van Scouts en Gidsen Vlaanderen.",
                    )
                }}
            </p>
            <p class="warning-box">
                {{
                    $t(
                        "Deze koppeling is experimenteel. Controleer na het synchroniseren altijd de gegevens in de groepsadministratie.",
                    )
                }}
            </p>
            <p v-if="isLoggedIn" class="success-box">
                {{
                    $t(
                        "Je bent ingelogd in de groepsadministratie. Je kan nu beginnen met synchroniseren.",
                    )
                }}
            </p>
            <template v-else>
                <p
                    v-if="
                        organization.privateMeta?.externalSyncData
                            ?.lastExternalSync
                    "
                    :class="
                        isToday(
                            organization.privateMeta.externalSyncData
                                .lastExternalSync,
                        )
                            ? 'success-box'
                            : 'info-box'
                    "
                >
                    {{
                        $t("Laatst gesynchroniseerd op {date} door {name}", {
                            date: formatDate(
                                organization.privateMeta.externalSyncData
                                    .lastExternalSync,
                            ),
                            name:
                                organization.privateMeta.externalSyncData
                                    .lastSyncedBy || "?",
                        })
                    }}
                </p>
                <p v-else class="warning-box">
                    {{ $t("Nog nooit gesynchroniseerd") }}
                </p>
                <p
                    v-if="organization.privateMeta?.externalGroupNumber"
                    class="info-box"
                >
                    {{
                        $t("Groepsnummer: {groupNumber}", {
                            groupNumber:
                                organization.privateMeta.externalGroupNumber,
                        })
                    }}
                </p>
                <p class="info-box">
                    {{
                        $t(
                            "Log eerst in bij de groepsadministratie om te synchroniseren.",
                        )
                    }}
                </p>
            </template>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button
                        v-if="isLoggedIn"
                        class="button primary"
                        type="button"
                        @click="sync"
                    >
                        <span class="icon sync" />
                        <span>{{ $t("Starten") }}</span>
                    </button>
                    <button
                        v-else
                        class="button primary"
                        type="button"
                        @click="login"
                    >
                        {{ $t("Inloggen") }}
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script setup lang="ts">
import {
    ComponentWithProperties,
    useCanDismiss,
    useCanPop,
    usePresent,
} from '@simonbackx/vue-app-navigation';
import { useMembersObjectFetcher } from '@stamhoofd/components/fetchers/useMembersObjectFetcher.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import { fetchAll } from '@stamhoofd/components/tables/classes/ObjectFetcher.ts';
import { useMemberManager } from '@stamhoofd/networking/MemberManager';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import {
    LimitedFilteredRequest,
    Organization,
    OrganizationPrivateMetaData,
} from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
    SGVGroupAdministration,
} from '../SGVGroupAdministration';
import {
    SGVOAuth,
} from '../SGVOAuth';
import { SGVSyncReport } from '../SGVSyncReport.ts';
import SGVReportView from './SGVReportView.vue';

const props = defineProps<{
    code?: string;
    state?: string;
}>();
const context = useContext();
const organizationManager = useOrganizationManager();
const memberManager = useMemberManager();
const membersObjectFetcher = useMembersObjectFetcher();
const present = usePresent();
const canDismiss = useCanDismiss();
const canPop = useCanPop();
const loading = ref(false);
const oauth = ref<SGVOAuth | null>(null);
const isLoggedIn = computed(() => oauth.value?.hasToken ?? false);
const organization = computed(() => organizationManager.value.organization);
let leaveSet = false;

onMounted(async () => {
    loading.value = true;
    try {
        oauth.value = await SGVOAuth.fromParams({ code: props.code, state: props.state });
    } catch (error) {
        Toast.fromError(error).show();
    }
    loading.value = false;
});

async function login() {
    loading.value = true;
    try {
        await SGVOAuth.login();
    } catch (error) {
        Toast.fromError(error).show();
    }
    loading.value = false;
}

/** Runs the full SGV sync flow: download, match, confirm old members, sync, persist metadata, and show a report. */
async function sync() {
    if (loading.value) return;
    if (!oauth.value) return;

    const sgv = new SGVGroupAdministration(
        context.value,
        organizationManager.value,
        memberManager,
        oauth.value,
    );

    loading.value = true;
    setLeave();
    const toast = new Toast($t('Synchroniseren voorbereiden...'), 'spinner')
        .setHide(null)
        .show();
    try {
        const report = new SGVSyncReport();
        await sgv.downloadAll();
        const allMembers = await loadOrganizationMembers();
        const { matchedMembers, newMembers } = await sgv.matchAndSync(
            present,
            () => toast.hide(),
            allMembers,
        );
        toast.hide();
        const { oldMembers, action } = await sgv.prepareSync(
            present,
            report,
            matchedMembers,
        );
        const syncToast = new Toast($t('Synchroniseren...'), 'spinner')
            .setProgress(0)
            .setHide(null)
            .show();
        await sgv.sync(
            report,
            matchedMembers,
            newMembers,
            oldMembers,
            action,
            organization.value,
            (status: string, progress: number | null) => {
                syncToast.message = status;
                syncToast.setProgress(progress);
            },
        );
        syncToast.hide();
        await saveExternalSyncData(sgv, report);
        Toast.success($t('Synchronisatie voltooid')).show();
        await present({
            components: [
                new ComponentWithProperties(SGVReportView, { report }),
            ],
            modalDisplayStyle: 'popup',
        });
    } catch (error) {
        toast.hide();
        Toast.fromError(error).setHide(null).show();
    }
    removeLeave();
    loading.value = false;
}

async function loadOrganizationMembers() {
    const platformMembers = await fetchAll(
        new LimitedFilteredRequest({
            limit: 100,
            filter: {
                registrations: {
                    $elemMatch: {
                        organizationId: organization.value.id,
                        periodId: organization.value.period.period.id,
                    },
                },
            },
        }),
        membersObjectFetcher,
    );

    console.log(`platformMembers: ${platformMembers.length}`);
    return platformMembers.map(platformMember => platformMember.member);
}

/** Persists organization-level sync metadata only for successful runs so warnings are based on trusted data. */
async function saveExternalSyncData(sgv: SGVGroupAdministration, report: SGVSyncReport) {
    if (report.errors.length > 0) {
        return;
    }

    const externalSyncData = report.createExternalSyncData(
        organizationManager.value.organization, organizationManager.value.user,
    );
    if (!externalSyncData) {
        return;
    }

    await organizationManager.value.patch(
        Organization.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                externalSyncData,
                externalGroupNumber: sgv.groupNumber,
            }),
        }),
    );
}

function isToday(date: Date) {
    return Formatter.dateIso(date) === Formatter.dateIso(new Date());
}

function formatDate(date: Date) {
    return Formatter.date(date, true);
}

function preventLeave(event: BeforeUnloadEvent) {
    event.preventDefault();
    event.returnValue = $t('De synchronisatie is nog bezig.');
}

function setLeave() {
    if (leaveSet) return;
    leaveSet = true;
    window.addEventListener('beforeunload', preventLeave);
}

function removeLeave() {
    if (!leaveSet) return;
    window.removeEventListener('beforeunload', preventLeave);
    leaveSet = false;
}

onBeforeUnmount(removeLeave);
</script>
