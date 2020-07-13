<template>
    <div class="st-view group-edit-view">
        <STNavigationBar title="Nieuwe groep toevoegen">
            <button slot="right" class="button icon close" @click="pop" />
        </STNavigationBar>
        <STNavigationTitle>
            Nieuwe groep toevoegen
        </STNavigationTitle>

        <SegmentedControl v-model="tab" :items="tabs" :labels="tabLabels" />

        <main>
            todo
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { FemaleIcon, MaleIcon, SegmentedControl,STNavigationBar, STNavigationTitle } from "@stamhoofd/components";
import { Group } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        MaleIcon,
        FemaleIcon,
    },
})
export default class GroupEditView extends Mixins(NavigationMixin) {
    tabs = ["general", "payments", "permissions"];
    tab = this.tabs[0];
    tabLabels = ["Algemeen", "Betaling", "Toegang"];

    @Prop()
    group!: Group;


}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.group-edit-view {

}
</style>
