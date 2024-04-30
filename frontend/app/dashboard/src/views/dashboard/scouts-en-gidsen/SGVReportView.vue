<template>
    <div id="sgv-report-view" class="st-view">
        <STNavigationBar title="Synchronisatie-rapport" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Synchronisatie-rapport
            </h1>

            <div class="info-box">
                Kijk zelf ook nog snel eens alles na in de groepsadministratie als het de eerste keer is dat je synchroniseert.
            </div>

            <div v-for="(error, index) in report.errors" :key="index" class="error-box-parent">
                <div class="error-box" :class="{ selectable: canClickError(error)}" @click="handleError(error)">
                    <h2 v-if="error.member" class="style-title-list">
                        {{ error.member.firstName }} {{ error.member.lastName || error.member.details.lastName }}<span v-if="canClickError(error)" class="icon arrow-right-small" />
                    </h2>
                    {{ getErrorMessage(error) }}
                </div>
            </div>

            <div v-for="(warning, index) in report.warnings" :key="index" class="warning-box">
                {{ warning }}
            </div>

            <STList v-if="report.info.length">
                <STListItem v-for="(info, index) in report.info" :key="index">
                    {{ info }}
                </STListItem>
            </STList>

            <template v-if="report.deleted.length > 0">
                <hr>
                <h2>Geschrapt in de groepsadministratie</h2>
                <STList>
                    <STListItem v-for="member in report.deleted" :key="member.id">
                        <div>
                            <h2 class="style-title-list">
                                {{ member.firstName }} {{ member.lastName }}
                            </h2>
                            <p class="style-description-small">
                                {{ formatDate(member.birthDay) }}
                            </p>
                        </div>
                    </STListItem>
                </STList>
            </template>
        
            <template v-if="report.created.length > 0">
                <hr>
                <h2>Nieuwe leden toegevoegd in de groepsadministratie</h2>
                <STList>
                    <STListItem v-for="member in report.created" :key="member.id">
                        <div>
                            <h2 class="style-title-list">
                                {{ member.details.firstName }} {{ member.details.lastName }}
                            </h2>
                            <p class="style-description-small">
                                {{ formatDate(member.details.birthDay) }}
                            </p>
                        </div>
                    </STListItem>
                </STList>
            </template>

            <template v-if="report.synced.length > 0">
                <hr>
                <h2>Aangepaste leden in de groepsadministratie</h2>
                <STList>
                    <STListItem v-for="member in report.synced" :key="member.id">
                        <div>
                            <h2 class="style-title-list">
                                {{ member.details.firstName }} {{ member.details.lastName }}
                            </h2>
                            <p class="style-description-small">
                                {{ formatDate(member.details.birthDay) }}
                            </p>
                        </div>
                    </STListItem>
                </STList>
            </template>

            <template v-if="report.imported.length > 0">
                <hr>
                <h2>Geïmporteerd in Stamhoofd</h2>
                <STList>
                    <STListItem v-for="member in report.imported" :key="member.id">
                        <div>
                            <h2 class="style-title-list">
                                {{ member.details.firstName }} {{ member.details.lastName }}
                            </h2>
                            <p class="style-description-small">
                                {{ formatDate(member.details.birthDay) }}
                            </p>
                        </div>
                    </STListItem>
                </STList>
            </template>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="goNext">
                        Sluiten
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors } from "@simonbackx/simple-errors";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, LoadingButton, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "@simonbackx/vue-app-navigation/classes";

import { SGVSyncReport } from '../../../classes/SGVGroepsadministratieSync';
import { SGVMemberError } from "../../../classes/SGVStructures";
import MemberView from '../member/MemberView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STList,
        STListItem,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton
    },
    filters: {
        date: Formatter.date.bind(Formatter)
    }
})
export default class SGVReportView extends Mixins(NavigationMixin) {
    loading = false

    @Prop({ required: true })
        report: SGVSyncReport

    goNext() {
        if (this.loading) {
            return;
        }

        this.dismiss({ force: true })
    }

    getErrorMessage(error: Error) {
        if (error instanceof SGVMemberError) {
            return this.getErrorMessage(error.error)
        }
        
        if (Request.isNetworkError(error)) {
            return 'Er was een internetprobleem of de groepsadministratie was tijdelijk onbereikbaar, gaf een interne foutmelding of reageerde niet.'
        }
        if (!isSimpleError(error) || !isSimpleErrors(error)) {
            return error.message
        }
        return error.getHuman()
    }

    canClickError(error) {
        return (error.member && error.member.details)
    }

    handleError(error) {
        if (error.member && error.member.details) {
            this.present(new ComponentWithProperties(MemberView, { member: error.member }).setDisplayStyle("popup"))
        }
    } 
}
</script>