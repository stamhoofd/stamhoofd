<template>
    <div id="import-members-auto-assigned-view" class="st-view background">
        <STNavigationBar :title="title" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>{{ title }}</h1>
            <p>{{ description }}</p>

            <STList>
                <STListItem v-for="(member, index) in members" :key="index">
                    <h3 class="style-list-title">
                        {{ member.name }}
                    </h3>
                    <p v-if="member.description" class="style-description-small pre-wrap" v-text="member.description" />
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button secundary" type="button" @click="pop">
                    Sluiten
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import {  NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, LoadingButton, Radio, RadioGroup, STErrorsDefault,STInputBox, STList,STListItem,STNavigationBar, STToolbar } from "@stamhoofd/components";
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
        LoadingButton,
        STList,
        STListItem
    },
})
export default class ImportAutoAssignedView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        title: string

    @Prop({ required: true })
        description: string
    
    @Prop({ required: true })
        members: { name: string; description?: string}[]

}
</script>