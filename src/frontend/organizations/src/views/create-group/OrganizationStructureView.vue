<template>
    <div id="structure-view" class="st-view">
        <STNavigationBar title="Inschrijven & groepen">
            <template #left>
                <button class="button icon gray arrow-left" @click="pop">
                    Terug
                </button>
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            Inschrijven & groepen
        </STNavigationTitle>
        
        <main>
            <h2>Samenstelling</h2>
            <div class="split-inputs">
                <div>
                    <label class="style-label" for="organization-name">Soort vereniging</label>
                    <select ref="firstInput" class="input">
                        <option>Scoutsgroep</option>
                        <option>Chirogroep</option>
                    </select>
                </div>

                <div>
                    <label class="style-label" for="organization-name">Koepelorganisatie</label>
                    <select class="input">
                        <option>Scouts & Gidsen Vlaanderen</option>
                        <option>FOS</option>
                    </select>
                </div>
            </div>

            <label class="style-label">Jongens en meisjes</label>
            <RadioGroup>
                <Radio>Gemengd</Radio>
                <Radio>Gescheiden</Radio>
                <Radio>Enkel jongens</Radio>
                <Radio>Enkel meisjes</Radio>
            </RadioGroup>

            <label class="style-label">Extra onderverdelingen</label>
            <Checkbox>Woutlopers</Checkbox>

            <hr>
            <h2>Werkjaar</h2>

            <div class="split-inputs">
                <div>
                    <label class="style-label" for="organization-name">Start werkjaar</label>
                    <select class="input">
                        <option v-for="(month, index) in months" :key="index" :value="index">
                            {{ month }}
                        </option>
                    </select>
                </div>

                <div>
                    <label class="style-label" for="organization-name">Inschrijvingsperiode</label>
                    <div class="mixed-input">
                        <select>
                            <option v-for="(month, index) in months" :key="index" :value="index">
                                {{ month }}
                            </option>
                        </select>
                        <span>tot</span>
                        <select>
                            <option v-for="(month, index) in months" :key="index" :value="index">
                                {{ month }}
                            </option>
                        </select>
                    </div>
                </div>
            </div>

            <hr>
            <h2>Prijzen</h2>
            <p>
                Je kan uitzonderingen voor bepaalde groepen toevoegen in de volgende stap.
            </p>

            <div class="split-inputs">
                <div>
                    <label class="style-label">Lidgeld</label>
                    <PriceInput />
                </div>

                <div>
                    <label class="style-label">Lidgeld voor beheerders</label>
                    <PriceInput />
                </div>
            </div>

            <Checkbox>Verminder het lidgeld voor leden met financiële moeilijkheden</Checkbox>

            <label class="style-label">Verminderd lidgeld</label>
            <PriceInput />
        </main>

        <STToolbar>
            <template #left>
                Wijzigingen zijn later nog mogelijk
            </template>
            <template #right>
                <button class="button primary">
                    Volgende
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from "vue-property-decorator";
import { NavigationMixin } from "@stamhoofd/shared/classes/NavigationMixin";
import STToolbar from "@stamhoofd/shared/components/navigation/STToolbar.vue"
import STNavigationBar from "@stamhoofd/shared/components/navigation/STNavigationBar.vue"
import STNavigationTitle from "@stamhoofd/shared/components/navigation/STNavigationTitle.vue"
import PriceInput from "@stamhoofd/shared/components/inputs/PriceInput.vue"
import Checkbox from "@stamhoofd/shared/components/inputs/Checkbox.vue"
import Radio from "@stamhoofd/shared/components/inputs/Radio.vue"
import RadioGroup from "@stamhoofd/shared/components/inputs/RadioGroup.vue"

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STNavigationTitle,
        PriceInput,
        Checkbox,
        Radio,
        RadioGroup
    }
})
export default class OrganizationStructureView extends Mixins(NavigationMixin) {
    months: string[] = [
        "Januari",
        "Februari",
        "Maart",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Augustus",
        "September",
        "Oktober",
        "November",
        "December",
    ];

    mounted() {
        // Focus first input automatically
        setTimeout(() => {
            this.focus();
        }, 400);
    }

    focus() {
        // Carefull about focussing, can cause transition bugs
        const input = this.$refs.firstInput as HTMLElement;
        input.focus();
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/layout/split-inputs.scss';
@use '@stamhoofd/scss/base/text-styles.scss';
@use '@stamhoofd/scss/components/inputs.scss';
@use '@stamhoofd/scss/components/buttons.scss';
@use '@stamhoofd/scss/layout/view.scss';
@use '@stamhoofd/scss/elements/hr.scss';
@use '@stamhoofd/scss/components/mixed-input.scss';


#structure-view {
    > main {
        h1 {
            @extend .style-title-1;
            margin-bottom: 20px;
        }

        p {
            @extend .style-description;
            margin: 10px 0;
        }

        h2 {
            @extend .style-title-2;
            margin-bottom: 20px;
        }

        hr {
            @extend .hr;
            margin-top: 40px;
        }
    }
}
</style>
