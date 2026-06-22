<template>
    <div class="st-view">
        <STNavigationBar
            :title="$t('%1ZS')"
            :dismiss="canDismiss"
            :pop="canPop"
        />

        <main>
            <h1>{{ $t("%1ZS") }}</h1>
            <p :class="report.errors.length === 0 ? 'info-box' : 'error-box'">
                {{
                    report.errors.length === 0
                        ? $t(
                            "Kijk zelf ook nog snel alles na in de groepsadministratie.",
                        )
                        : $t(
                            "De synchronisatie is niet volledig gelukt. Kijk de foutmeldingen hieronder na.",
                        )
                }}
            </p>

            <div
                v-for="(error, index) in report.errors"
                :key="'e' + index"
                class="error-box"
            >
                <strong v-if="getErrorMemberName(error)">{{
                    $t("%1XU", {
                        member: getErrorMemberName(error) ?? "",
                    })
                }}<br></strong>
                {{ getErrorMessage(error) }}
            </div>
            <p
                v-for="(warning, index) in report.warnings"
                :key="'w' + index"
                class="warning-box"
            >
                {{ warning }}
            </p>
            <STList v-if="report.info.length">
                <STListItem
                    v-for="(info, index) in report.info"
                    :key="'i' + index"
                >
                    {{ info }}
                </STListItem>
            </STList>

            <ReportList
                :title="$t('%1VP')"
                :items="report.created.map((x) => x.member.details.name)"
            />
            <ReportList
                :title="$t('%1Xr')"
                :items="report.synced.map((x) => x.member.details.name)"
            />
            <ReportList
                :title="$t('%1XT')"
                :items="
                    report.deleted.map((x) => `${x.firstName} ${x.lastName}`)
                "
            />
            <ReportList
                :title="$t('%1cB')"
                :items="report.skipped.map((x) => x.details.name)"
            />

            <template v-if="report.unmanagedInStamhoofd.length > 0">
                <hr>
                <h2>{{ $t("%1W6") }}</h2>
                <p>
                    {{
                        $t(
                            "Deze leiding schreef ook in via Stamhoofd. Stamhoofd zet hun gegevens over naar de groepsadministratie, maar je moet zelf nog de juiste functies toekennen in de groepsadministratie.",
                        )
                    }}
                </p>
                <ReportList
                    :title="$t('%1YN')"
                    :items="
                        report.unmanagedInStamhoofd.map(
                            (unmanaged) =>
                                unmanaged.member.details.name +
                                ': ' +
                                (getLidFuncties(unmanaged.lid) ||
                                    $t('%1Wi')),
                        )
                    "
                />
            </template>

            <template v-if="report.unmanagedMissingInStamhoofd.length > 0">
                <hr>
                <h2>{{ $t("%1YV") }}</h2>
                <p>
                    {{
                        $t(
                            "Deze leiding staat in de groepsadministratie, maar niet in Stamhoofd. Hun gegevens worden niet aangepast door Stamhoofd. Kijk de gegevens en functies na in de groepsadministratie zelf.",
                        )
                    }}
                </p>
                <ReportList
                    :title="$t('%1YN')"
                    :items="
                        report.unmanagedMissingInStamhoofd.map(
                            (x) =>
                                getLidName(x) +
                                ': ' +
                                (getLidFuncties(x) || $t('%1Wi')),
                        )
                    "
                />
            </template>
        </main>

        <STToolbar>
            <template #right>
                <button
                    class="button primary"
                    type="button"
                    @click="dismiss({ force: true })"
                >
                    {{ $t("%9b") }}
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script setup lang="ts">
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import {
    useCanDismiss,
    useCanPop,
    useDismiss,
} from '@simonbackx/vue-app-navigation';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import { SGVMemberError } from '@stamhoofd/sgv';
import { defineComponent, h } from 'vue';
import type { SGVSyncReport } from '../SGVSyncReport';
import { getLidFuncties, getLidName } from '../SGVSyncReport';

defineProps<{ report: SGVSyncReport }>();

const dismiss = useDismiss();
const canDismiss = useCanDismiss();
const canPop = useCanPop();

/** Unwraps member-specific errors while preserving human-readable SimpleError messages for the report. */
function getErrorMessage(error: Error): string {
    if (error instanceof SGVMemberError) return getErrorMessage(error.error);
    if (!isSimpleError(error) && !isSimpleErrors(error)) return error.message;
    return error.getHuman();
}

function getErrorMemberName(error: Error): string | null {
    if (!(error instanceof SGVMemberError)) {
        return null;
    }
    if ('details' in error.member) {
        return error.member.details.name;
    }
    return `${error.member.firstName} ${error.member.lastName}`;
}

const ReportList = defineComponent({
    props: {
        title: { type: String, required: true },
        items: { type: Array<string>, required: true },
    },
    setup(props) {
        return () =>
            props.items.length === 0
                ? null
                : h('div', [
                        h('hr'),
                        h('h2', props.title),
                        h(STList, {}, () =>
                            props.items.map((item, index) =>
                                h(STListItem, { key: index }, () => item),
                            ),
                        ),
                    ]);
    },
});
</script>
