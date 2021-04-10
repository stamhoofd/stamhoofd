<template>
    <div id="missing-first-name-view" class="st-view background">
        <STNavigationBar :title="title">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else class="button icon close gray" @click="pop" slot="right" />
        </STNavigationBar>

        <main>
            <h1>{{ title }}</h1>
            <p>{{ description }}</p>

            <table class="data-table">
                <thead>
                    <tr>
                        <th>
                            E-mailadres
                        </th>
                        <th>Leden</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(email, index) in emails" :key="index">
                        <td>
                            {{ email.email }}
                        </td>
                        <td>
                            {{ email.members }}
                        </td>
                    </tr>
                </tbody>

            </table>

        </main>

        <STToolbar>
            <template slot="right">
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
import { Component, Mixins, Prop } from "vue-property-decorator";

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

}
</script>