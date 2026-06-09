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
import { SimpleError } from "@simonbackx/simple-errors";
import {
    ComponentWithProperties,
    useCanDismiss,
    useCanPop,
} from "@simonbackx/vue-app-navigation";
import { useNavigationActions } from "@stamhoofd/components/types/NavigationActions";
import { useContext } from "@stamhoofd/components/hooks/useContext";
import LoadingButton from "@stamhoofd/components/navigation/LoadingButton.vue";
import STNavigationBar from "@stamhoofd/components/navigation/STNavigationBar.vue";
import STToolbar from "@stamhoofd/components/navigation/STToolbar.vue";
import { Toast } from "@stamhoofd/components/overlays/Toast";
import { useMemberManager } from "@stamhoofd/networking/MemberManager";
import { useOrganizationManager } from "@stamhoofd/networking/OrganizationManager";
import { Storage } from "@stamhoofd/networking/Storage";
import {
    Organization,
    OrganizationPrivateMetaData,
} from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import {
    SGV_OAUTH_CALLBACK_CODE_STORAGE_KEY,
    SGV_OAUTH_CALLBACK_STATE_STORAGE_KEY,
    SGV_OAUTH_SAVED_REDIRECT_URL_STORAGE_KEY,
    SGV_OAUTH_SAVED_STATE_STORAGE_KEY,
} from "../../../classes/SGVOAuthStorage";
import {
    SGVGroupAdministration,
    SGVSyncReport,
} from "../../../classes/SGVGroupAdministration";
import SGVReportView from "./SGVReportView.vue";

const props = defineProps<{
    code?: string;
    state?: string;
}>();

const context = useContext();
const organizationManager = useOrganizationManager();
const memberManager = useMemberManager();
const navigationActions = useNavigationActions();
const canDismiss = useCanDismiss();
const canPop = useCanPop();
const loading = ref(false);
const sgv = reactive(
    new SGVGroupAdministration(
        context.value,
        organizationManager.value,
        memberManager,
    ),
);
const isLoggedIn = computed(() => sgv.hasToken);
const organization = computed(() => organizationManager.value.organization);
let leaveSet = false;

async function login() {
    loading.value = true;
    try {
        await sgv.login();
        if (sgv.hasToken) {
            Toast.success($t("Ingelogd bij de groepsadministratie")).show();
        }
    } catch (error) {
        Toast.fromError(error).show();
    }
    loading.value = false;
}

/** Validates the OAuth state before exchanging the callback code so another page cannot bind an SGV account. */
async function handleOAuthCallback() {
    if (!props.code || !props.state) {
        return;
    }

    loading.value = true;
    try {
        const savedState = await Storage.keyValue.getItem(
            SGV_OAUTH_SAVED_STATE_STORAGE_KEY,
        );
        if (savedState !== props.state) {
            throw new SimpleError({
                code: "state_verification_failed",
                message: "State is not the same",
                human: $t(
                    "Er ging iets mis bij het inloggen. Een onbekende pagina probeerde de groepsadministratie te koppelen. Probeer opnieuw.",
                ),
            });
        }

        await sgv.getToken(props.code);
        await clearOAuthStorage();
        Toast.success($t("Ingelogd bij de groepsadministratie")).show();
    } catch (error) {
        await Storage.keyValue.removeItem(SGV_OAUTH_CALLBACK_CODE_STORAGE_KEY);
        await Storage.keyValue.removeItem(SGV_OAUTH_CALLBACK_STATE_STORAGE_KEY);
        Toast.fromError(error).show();
    }
    loading.value = false;
}

async function clearOAuthStorage() {
    await Storage.keyValue.removeItem(SGV_OAUTH_SAVED_STATE_STORAGE_KEY);
    await Storage.keyValue.removeItem(SGV_OAUTH_SAVED_REDIRECT_URL_STORAGE_KEY);
    await Storage.keyValue.removeItem(SGV_OAUTH_CALLBACK_CODE_STORAGE_KEY);
    await Storage.keyValue.removeItem(SGV_OAUTH_CALLBACK_STATE_STORAGE_KEY);
}

/** Runs the full SGV sync flow: download, match, confirm old members, sync, persist metadata, and show a report. */
async function sync() {
    if (loading.value) return;
    loading.value = true;
    setLeave();
    const toast = new Toast($t("Synchroniseren voorbereiden..."), "spinner")
        .setHide(null)
        .show();
    try {
        const report = new SGVSyncReport();
        await sgv.downloadAll();
        const { matchedMembers, newMembers } = await sgv.matchAndSync(
            navigationActions,
            () => toast.hide(),
        );
        toast.hide();
        const { oldMembers, action } = await sgv.prepareSync(
            navigationActions,
            report,
            matchedMembers,
        );
        const syncToast = new Toast($t("Synchroniseren..."), "spinner")
            .setProgress(0)
            .setHide(null)
            .show();
        await sgv.sync(
            report,
            matchedMembers,
            newMembers,
            oldMembers,
            action,
            (status, progress) => {
                syncToast.message = status;
                syncToast.setProgress(progress);
            },
        );
        syncToast.hide();
        await saveExternalSyncData(report);
        Toast.success($t("Synchronisatie voltooid")).show();
        await navigationActions.present({
            components: [
                new ComponentWithProperties(SGVReportView, { report }),
            ],
            modalDisplayStyle: "popup",
        });
    } catch (error) {
        toast.hide();
        Toast.fromError(error).setHide(null).show();
    }
    removeLeave();
    loading.value = false;
}

/** Persists organization-level sync metadata only for successful runs so warnings are based on trusted data. */
async function saveExternalSyncData(report: SGVSyncReport) {
    if (report.errors.length > 0) {
        return;
    }

    const externalSyncData = sgv.createExternalSyncData(
        report,
        organization.value.privateMeta?.externalSyncData ?? null,
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
    event.returnValue = $t("De synchronisatie is nog bezig.");
}

function setLeave() {
    if (leaveSet) return;
    leaveSet = true;
    window.addEventListener("beforeunload", preventLeave);
}

function removeLeave() {
    if (!leaveSet) return;
    window.removeEventListener("beforeunload", preventLeave);
    leaveSet = false;
}

onBeforeUnmount(removeLeave);
onMounted(() => {
    handleOAuthCallback().catch(console.error);
});
</script>
