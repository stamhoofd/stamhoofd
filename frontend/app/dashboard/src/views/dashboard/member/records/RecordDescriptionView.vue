<template>
    <div class="st-view record-description-view">
        <STNavigationBar>
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>
        <main>
            <h1>{{ title }}</h1>
            <p v-if="info">
                {{ info }}
            </p>

            <template v-if="description">
                <hr v-if="info">
                <h2 v-if="info">
                    Opmerking
                </h2>
                <p>{{ description }}</p>
            </template>

            <template v-if="links.length > 0">
                <hr>
                <h2>Handige links</h2>
                <ul class="links">
                    <li v-for="link in links" :key="link.url">
                        <a :href="link.url" target="_blank">{{ link.name }}</a>
                    </li>
                </ul>
            </template>
        </main>

        <STToolbar v-if="false">
            <button slot="right" class="button secundary">
                <span class="icon trash" />
                <span>Verwijder van de steekkaart</span>
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { MemberWithRegistrations, Record, RecordTypeHelper } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        BackButton
    },
})
export default class RecordDescriptionView extends Mixins(NavigationMixin) {
    @Prop()
    member!: MemberWithRegistrations;

    @Prop()
    record!: Record;

    get title() {
        return RecordTypeHelper.getName(this.record.type)
    }

    get info() {
        return RecordTypeHelper.getInternalDescription(this.record.type)
    }

    get links() {
        return RecordTypeHelper.getInternalLinks(this.record.type)
    }

    get description() {
        return this.record.description
    }
}
</script>


<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.record-description-view .links {
    list-style: none;

    li {
        padding: 10px 0;
        
        > a {
            &, &:link, &:visited, &:active, &:hover {
                @extend .style-title-small;
                color: $color-primary;
                text-decoration: none;
            }
            &:hover {
                opacity: 0.4;
            }
            
        }
    }
}

</style>