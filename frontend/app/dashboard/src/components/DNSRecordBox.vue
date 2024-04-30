<template>
    <div>
        <dl class="details-grid dns-records" :class="{ success: record.status == 'Valid' }">
            <dt>Type</dt>
            <dd>{{ record.type }}</dd>

            <dt>Naam</dt>
            <dd v-tooltip="'Klik om te kopiëren'" class="selectable" v-copyable>
                {{ record.name }}
            </dd>

            <dt>Waarde</dt>
            <dd v-tooltip="'Klik om te kopiëren'" class="selectable" v-copyable>
                {{ record.value }}
            </dd>

            <dt>TTL</dt>
            <dd class="selectable" v-copyable>
                3600
            </dd>

            <span v-if="record.status == 'Valid'" class="icon green success" />
            <span v-if="record.status == 'Failed'" class="icon error" />
        </dl>
        <template v-if="record.errors">
            <div v-for="error in record.errors.errors" :key="error.id" class="error-box" style="word-wrap: break-word">
                {{ error.human || error.message }}
            </div>
        </template>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Tooltip, TooltipDirective } from "@stamhoofd/components";
import { DNSRecord } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class DNSRecordBox extends Mixins(NavigationMixin) {
    @Prop({})
    record: DNSRecord

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.dns-records {
    padding: 20px 20px;
    margin: 15px 0;
    border-radius: $border-radius;
    background: $color-background-shade;

    &.success {
        background: $color-success-background;
        color: $color-success-dark;
    }

    display: grid;
    grid-template-columns: 20% 80%;
    gap: 8px 0;
    position: relative;

    @media (max-width: 450px) {
        margin: 15px calc(-1 * var(--st-horizontal-padding, 40px));
        padding: 20px var(--st-horizontal-padding, 40px);
    }

    dt {
        @extend .style-definition-term;
    }

    dd {
        @extend .style-definition-description;
        font-family: monospace;
        word-wrap: break-word;
        outline: 0;

        &.selectable {
            cursor: pointer;
        }
    }

    > .icon {
        position: absolute;
        right: 10px;
        top: 10px;
    }
}

</style>
