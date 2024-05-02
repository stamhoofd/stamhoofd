<template>
    <div id="missing-first-name-view" class="st-view background">
        <STNavigationBar :title="title" />

        <main>
            <h1>{{ title }}</h1>
            <p>{{ description }}</p>

            <table class="data-table">
                <thead>
                    <tr>
                        <th>
                            E-mailadres
                        </th>
                        <th v-if="hasMembers">
                            Leden
                        </th>
                        <th v-else />
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(email, index) in emails" :key="index">
                        <td>
                            {{ email.email }}
                        </td>
                        <td v-if="hasMembers">
                            {{ email.members }}
                        </td>
                        <td v-else />
                    </tr>
                </tbody>
            </table>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" @click="pop">
                    Sluiten
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        BackButton,
    },
})
export default class MissingFirstNameView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    title: string

    @Prop({ required: true })
    description: string
    
    @Prop({ required: true })
    emails: { email: string; members: string}[]

    get hasMembers() {
        return !!this.emails.find(e => e.members)
    }

}
</script>