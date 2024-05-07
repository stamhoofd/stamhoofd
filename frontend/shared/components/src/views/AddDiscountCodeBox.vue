<template>
    <div class="container">
        <p v-if="!isEnteringDiscountCode">
            <button type="button" class="button text" @click="addDiscountCode">
                <span class="icon label" />
                <span>Kortingscode inwisselen</span>
            </button>
        </p>
        <hr v-if="isEnteringDiscountCode">
        <form v-if="isEnteringDiscountCode" @submit.prevent="addEnteredCode" data-submit-last-field>
            <STInputBox title="Kortingscode" error-fields="code" :error-box="errorBox" class="max">
                <div class="split-inputs">
                    <input
                        v-model="code"
                        autofocus
                        enterkeyhint="go"
                        class="input"
                        type="text"
                        placeholder="Vul hier je kortingscode in"
                        autocomplete=""
                        @blur="cleanCode"
                    >
                    <LoadingButton :loading="loading">
                        <button class="button primary" type="submit">
                            Inwisselen
                        </button>
                    </LoadingButton>
                </div>
            </STInputBox>
        </form>
    </div>
</template>


<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { ErrorBox, LoadingButton, STInputBox, STList, STListItem } from '@stamhoofd/components';
import { Formatter } from '@stamhoofd/utility';
import { Component, Prop, Vue } from '@simonbackx/vue-app-navigation/classes';

@Component({
    components: {
        STList,
        STListItem,
        LoadingButton,
        STInputBox
    }
})
export default class AddDiscountCodeBox extends Vue {
    @Prop({required: true })
    applyCode: (code: string) => Promise<boolean>

    isEnteringDiscountCode = false;
    code = ''
    errorBox: ErrorBox | null = null
    loading = false

    addDiscountCode() {
        this.isEnteringDiscountCode = true
    }

    cleanCode() {
        this.code = Formatter.slug(this.code.trim()).toUpperCase()
    }


    async addEnteredCode() {
        if (this.loading) {
            return;
        }
        this.loading = true;
        try {
            this.cleanCode()
            if (await this.applyCode(this.code)) {
                this.isEnteringDiscountCode = false
                this.code = ""
            } else {
                this.errorBox = new ErrorBox(new SimpleError({
                    code: 'invalid_code',
                    field: 'code',
                    message: 'Deze kortingscode is ongeldig'
                }))
            }
        } catch (e) {
            console.error(e)
            if (isSimpleError(e) || isSimpleErrors(e)) {
                e.addNamespace('code')
            }
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

}
</script>