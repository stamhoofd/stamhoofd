<template>
    <SaveView :loading="saving" title="Financiële ondersteuning" :disabled="!hasChanges" @save="save">
        <h1>
            Financiële ondersteuning
        </h1>
        <p>Net voor het betalen van inschrijvingen is het in Stamhoofd mogelijk om te vragen of een gezin wenst gebruik te maken van financiële ondersteuning. Dit kunnen ze kenbaar maken door heel laagdrempelig een aankruisvakje aan te vinken. Als je deze functie aanzet kan je per inschrijvingsgroep een verminderd tarief instellen dat automatisch wordt toegepast, of je kan deze informatie zelf gebruiken voor andere zaken (bv. uitdelen tweedehands materiaal).</p>

        <p class="info-box">
            Wil je dat leden een kaart of bewijs voorleggen, dan raden we aan om dit achteraf manueel (en discreet) te controleren. Leg dit dan uit in de beschrijving (kan je hieronder zelf intypen als je het aanzet). Dat houdt de drempel voldoende laag voor kansarme gezinnen (er is al genoeg administratie en regelgeving). Je kan dit later altijd corrigeren wanneer een lid foutief het aankruisvakje heeft aangeduid, het omgekeerde is veel moeilijker.
        </p>

        <p class="info-box icon privacy">
            Om in orde te zijn met de GDPR-wetgeving moet je altijd toestemming gekregen hebben voor je deze informatie kan opslaan. Je kan deze toestemming aanzetten via de instellingen.
        </p>
            
        <STErrorsDefault :error-box="errorBox" />          

        <Checkbox v-model="enableFinancialSupport">
            Vraag of het gezin financiële ondersteuning nodig heeft (kansarm gezin)
        </Checkbox>

        <template v-if="enableFinancialSupport">
            <hr>
            <h2>Wijzig uitleg voor leden</h2>
            <p>Kies zelf de uitleg en titels die zichtbaar zijn voor leden op de pagina (net voor het afrekenen).</p>

            <STInputBox title="Titel" class="max">
                <input v-model="title" class="input" :placeholder="defaultTitle">
            </STInputBox>
            <p class="style-description-small">
                De titel bovenaan de pagina. Normaal neem je hier gewoon '{{ defaultTitle }}', maar als je bijvoorbeeld met een UiTPAS werkt, kan je dat wat wijzigen naar bijvoorbeeld 'UiTPAS kansentarief'.
            </p>

            <STInputBox title="Beschrijving" class="max">
                <textarea v-model="description" class="input" :placeholder="defaultDescription" />
            </STInputBox>
            <p class="style-description-small">
                Tekst onder de titel. Leg hier uit wat voor financiële ondersteuning je geeft en wie er gebruik van kan maken. Leg uit dat ze discreet kunnen aanvinken dat ze gebruik willen maken van de ondersteuning.
            </p>

            <STInputBox title="Tekst naast aankruisvakje" class="max">
                <input v-model="checkboxLabel" class="input" :placeholder="defaultCheckbox">
            </STInputBox>
            <p class="style-description-small">
                Deze tekst is zichtbaar naast het aankruisvakje (dat ze moeten aanvinken als ze de ondersteuning willen gebruiken). Zorg dat je duidelijk bent, bv. "{{ defaultCheckbox }}"
            </p>

            <hr>
            <h2>Waarschuwing bij leden</h2>
            <p>Als een lid gebruik wil maken van de financiële ondersteuning, dan tonen we dit als waarschuwing als je dat lid bekijkt in Stamhoofd. Je kan zelf de tekst in deze waarschuwing wijzigen. Dit is niet zichtbaar voor de leden zelf.</p>
            
            <STInputBox title="Waarschuwingstekst" class="max">
                <input v-model="warningText" class="input" :placeholder="defaultWarningText">
            </STInputBox>
        </template>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { CenteredMessage, Checkbox, ErrorBox, Radio, SaveView, STErrorsDefault, STInputBox, Toast, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { FinancialSupportSettings, Organization, OrganizationMetaData, OrganizationPatch, OrganizationRecordsConfiguration, Version } from '@stamhoofd/structures';



@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        Radio
    },
})
export default class FinancialSupportSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = this.$organization

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({})
    
    created() {
        this.organizationPatch.id = this.$organization.id
    }

    get organization() {
        return this.$organization.patch(this.organizationPatch)
    }

    get enableFinancialSupport() {
        return this.organization.meta.recordsConfiguration.financialSupport !== null
    }

    set enableFinancialSupport(enabled: boolean) {
        const hasReduced = !!this.organization.groups.find(g => {
            return !!g.settings.prices.find(p => !!p.prices.find(gg => gg.reducedPrice !== null))
        })
        if (hasReduced && !enabled) {
            new Toast("Eén of meerdere inschrijvingsgroepen maken gebruik van verminderd lidgeld. Schakel dat eerst overal uit.", "error red").show()
            return
        }
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    financialSupport: enabled ? (this.organization.meta.recordsConfiguration.financialSupport ?? FinancialSupportSettings.create({})) : null
                })
            })
        })
    }

    get description() {
        return this.organization.meta.recordsConfiguration.financialSupport?.description ?? ""
    }

    set description(description: string) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    financialSupport: FinancialSupportSettings.patch({
                        description
                    })
                })
            })
        })
    }

    get checkboxLabel() {
        return this.organization.meta.recordsConfiguration.financialSupport?.checkboxLabel ?? ""
    }

    set checkboxLabel(checkboxLabel: string) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    financialSupport: FinancialSupportSettings.patch({
                        checkboxLabel
                    })
                })
            })
        })
    }

    get title() {
        return this.organization.meta.recordsConfiguration.financialSupport?.title ?? ""
    }

    set title(title: string) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    financialSupport: FinancialSupportSettings.patch({
                        title
                    })
                })
            })
        })
    }

    get warningText() {
        return this.organization.meta.recordsConfiguration.financialSupport?.warningText ?? ""
    }

    set warningText(warningText: string) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    financialSupport: FinancialSupportSettings.patch({
                        warningText
                    })
                })
            })
        })
    }

    get defaultDescription() {
        return FinancialSupportSettings.defaultDescription
    }

    get defaultTitle() {
        return FinancialSupportSettings.defaultTitle
    }

    get defaultCheckbox() {
        return FinancialSupportSettings.defaultCheckboxLabel
    }

    get defaultWarningText() {
        return FinancialSupportSettings.defaultWarningText
    }

    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors()
      
        let valid = false

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
        } else {
            this.errorBox = null
            valid = true
        }
        valid = valid && await this.validator.validate()

        if (!valid) {
            return;
        }

        this.saving = true

        try {
            await this.$organizationManager.patch(this.organizationPatch)
            this.organizationPatch = OrganizationPatch.create({ id: this.$organization.id })
            new Toast('De wijzigingen zijn opgeslagen', "success green").show()
            this.dismiss({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    get hasChanges() {
        return patchContainsChanges(this.organizationPatch, this.$organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    mounted() {
        this.setUrl("/financial-support");
    }
}
</script>
