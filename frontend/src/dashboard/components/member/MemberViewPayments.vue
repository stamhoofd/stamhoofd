<template>
    <div class="view-payments">
        <h2>Betaling</h2>
        <main>
            <dl class="details-grid">
                <dt>Bedrag</dt>
                <dd>€ 40</dd>

                <dt>Bankrekening</dt>
                <dd>BE31 9789 7578 4155</dd>

                <dt>BIC</dt>
                <dd>KREDBEBB</dd>

                <dt>Mededeling</dt>
                <dd>Lidgeld 123</dd>

                <dt>Status</dt>
                <dd v-if="member.paid">Betaald</dd>
                <dd v-else>Nog niet betaald</dd>
            </dl>
        </main>

        <STToolbar v-if="!member.paid">
            <template v-slot:left></template>
            <template v-slot:right>
                <button class="button primary">
                    Markeer als betaald
                    <div class="dropdown" @click.stop=""></div>
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";
import { Member } from "shared/models/Member";
import STToolbar from "shared/components/navigation/STToolbar.vue";

@Component({ components: { STToolbar } })
export default class MemberViewPayments extends Vue {
    @Prop()
    member!: Member;
}
</script>

<style lang="scss">
@use '~scss/base/text-styles.scss';
@use '~scss/layout/view.scss';

.view-payments {
    padding: 10px 0;
    flex-grow: 1;
    display: flex;
    flex-direction: column;

    > h2 {
        @extend .style-title-2;
        margin: 20px 0;
    }
}
</style>
