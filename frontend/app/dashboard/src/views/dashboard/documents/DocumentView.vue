<template>
    <div class="st-view document-view">
        <STNavigationBar :title="'Document'" :pop="canPop" :dismiss="canDismiss">
            <template #right>
                <button v-if="hasPrevious || hasNext" v-tooltip="'Ga naar vorig document'" type="button" class="button navigation icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                <button v-if="hasNext || hasPrevious" v-tooltip="'Ga naar volgende document'" type="button" class="button navigation icon arrow-down" :disabled="!hasNext" @click="goNext" />
                <button v-long-press="(e) => showContextMenu(e)" class="button icon navigation more" type="button" @click.prevent="showContextMenu" @contextmenu.prevent="showContextMenu" />
            </template>
        </STNavigationBar>
        <main>
            <h1>
                Document
            </h1>           

            <p v-if="unlinkedAnswers.length" class="info-box">
                De velden {{ unlinkedAnswersText }} werden manueel aangepast en zijn niet meer automatisch gelinkt met de waarden in Stamhoofd.
                <button class="button text" type="button" @click="resetDocument">
                    Reset
                </button>
            </p>

            <div v-if="hasWarnings" class="hover-box container">
                <ul class="member-records">
                    <li
                        v-for="warning in sortedWarnings"
                        :key="warning.id"
                        :class="{ [warning.type]: true }"
                    >
                        <span :class="'icon '+warning.icon" />
                        <span class="text">{{ warning.text }}</span>
                    </li>
                </ul>
                <hr>
            </div>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        Naam
                    </h3>
                    <p class="style-definition-text">
                        {{ document.data.name }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Beschrijving
                    </h3>
                    <p class="style-definition-text">
                        {{ document.data.description }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Volgnummer
                    </h3>
                    <p class="style-definition-text">
                        {{ document.id }} ({{ document.number || 'Zonder nummer' }})
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Aangemaakt op
                    </h3>
                    <p class="style-definition-text">
                        {{ document.createdAt | dateTime | capitalizeFirstLetter }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 :class="'style-definition-label '+statusColor">
                        Status
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ statusName }}</span>
                    </p>
                </STListItem>
            </STList>

            <div v-for="category in recordCategories" :key="'category-'+category.id" class="container">
                <hr>
                <h2>
                    {{ category.name }}
                </h2>
                <RecordCategoryAnswersBox :category="category" :answers="fieldAnswers" :data-permission="true" />
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, LongPressDirective,RecordCategoryAnswersBox, STErrorsDefault, STList, STListItem, STNavigationBar, TableActionsContextMenu, TooltipDirective } from "@stamhoofd/components";
import { Document, DocumentStatusHelper, DocumentTemplatePrivate, RecordCategory, RecordWarning } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { DocumentActionBuilder } from "./DocumentActionBuilder";

@Component({
    components: {
        STNavigationBar,
        STList,
        STListItem,
        STErrorsDefault,
        RecordCategoryAnswersBox
    },
    filters: {
        dateTime: Formatter.dateTimeWithDay.bind(Formatter),
        capitalizeFirstLetter: Formatter.capitalizeFirstLetter.bind(Formatter)
    },
    directives: {
        tooltip: TooltipDirective,
        LongPress: LongPressDirective
    }
})
export default class DocumentView extends Mixins(NavigationMixin){
    loading = false
    errorBox: ErrorBox | null = null

    @Prop({ required: true })
        document!: Document

    @Prop({ required: true })
        template!: DocumentTemplatePrivate
    
    @Prop({ default: null })
        getNext!: (document: Document) => Document | null;

    @Prop({ default: null })
        getPrevious!: (document: Document) => Document | null;

    get hasWarnings() {
        return this.warnings.length > 0
    }

    get warnings(): RecordWarning[] {
        const warnings: RecordWarning[] = []

        for (const answer of this.usedAnswers) {
            warnings.push(...answer.getWarnings())
        }

        return warnings
    }

    get sortedWarnings() {
        return this.warnings.slice().sort(RecordWarning.sort)
    }

    get usedAnswers() {
        return this.document.data.fieldAnswers.filter(a => {
            return !!this.recordCategories.find(c => {
                return !!c.getAllRecords().find(r => {
                    return r.id === a.settings.id
                });
            })
        })
    }

    get unlinkedAnswers() {
        return this.usedAnswers.filter(a => !!a.reviewedAt)
    }

    get unlinkedAnswersText() {
        return Formatter.joinLast(this.unlinkedAnswers.map(a => a.settings.name), ", ", " en ")
    }

    get hasNext(): boolean {
        if (!this.getNext || !this.document) {
            return false
        }
        return !!this.getNext(this.document);
    }

    get hasPrevious(): boolean {
        if (!this.getPrevious || !this.document) {
            return false
        }
        return !!this.getPrevious(this.document);
    }

    get actionBuilder() {
        return new DocumentActionBuilder({
            template: this.template,
            component: this,
        })
    }

    get statusName() {
        return this.document ? DocumentStatusHelper.getName(this.document.status) : ""
    }

    get statusColor() {
        return this.document ? DocumentStatusHelper.getColor(this.document.status) : ""
    }

    showContextMenu(event) {
        const el = event.currentTarget;
        const bounds = el.getBoundingClientRect()

        const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
            x: bounds.left,
            y: bounds.bottom,
            xPlacement: "right",
            yPlacement: "bottom",
            actions: this.actionBuilder.getActions(),
            focused: [this.document]
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    editDocument() {
        //this.actionBuilder.editOrder(this.document).catch(console.error)
    }

    resetDocument() {
        this.actionBuilder.resetDocuments([this.document]).catch(console.error)
    }

    goBack() {
        const document = this.getPrevious(this.document);
        if (!document) {
            return;
        }
        const component = new ComponentWithProperties(DocumentView, {
            document: document,
            template: this.template,
            getNext: this.getNext,
            getPrevious: this.getPrevious,
        });
        
        this.show({
            components: [component],
            replace: 1,
            reverse: true,
            animated: false
        })
    }

    goNext() {
        const document = this.getNext(this.document);
        if (!document) {
            return;
        }
        const component = new ComponentWithProperties(DocumentView, {
            document: document,
            template: this.template,
            getNext: this.getNext,
            getPrevious: this.getPrevious,
        });
        this.show({
            components: [component],
            replace: 1,
            animated: false
        })
    }

    activated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.addEventListener("keydown", this.onKey);
    }

    deactivated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.removeEventListener("keydown", this.onKey);
    }

    onKey(event) {
        if (event.defaultPrevented || event.repeat) {
            return;
        }

        if (!this.isFocused()) {
            return
        }

        const key = event.key || event.keyCode;

        if (key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp") {
            this.goBack();
            event.preventDefault();
        } else if (key === "ArrowRight" || key === "ArrowDown" || key === "PageDown") {
            this.goNext();
            event.preventDefault();
        }
    }
   
    get recordCategories(): RecordCategory[] {
        return RecordCategory.flattenCategoriesForAnswers(
            [...this.template.privateSettings.templateDefinition.documentFieldCategories, ...this.template.privateSettings.templateDefinition.groupFieldCategories],
            this.document.data.fieldAnswers
        )
    }

    get fieldAnswers() {
        return this.document.data.fieldAnswers
    }
}
</script>