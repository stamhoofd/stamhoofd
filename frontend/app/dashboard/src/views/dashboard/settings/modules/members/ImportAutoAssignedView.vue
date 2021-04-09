<template>
    <div id="import-members-auto-assigned-view" class="st-view background">
        <STNavigationBar :title="title">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>{{ title }}</h1>
            <p>{{ description }}</p>

            <table class="data-table">
                <thead>
                    <tr>
                        <th>
                            Lid
                        </th>
                        <th>Groep</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(member, index) in members" :key="index">
                        <td>
                            {{ member.name }}
                        </td>
                        <td>
                            {{ member.group }}
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
import {  NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, LoadingButton, Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        RadioGroup,
        Radio,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton
    },
})
export default class ImportAutoAssignedViewView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    title: string

    @Prop({ required: true })
    description: string
    
    @Prop({ required: true })
    members: { name: string; group: string}[]

}
</script>