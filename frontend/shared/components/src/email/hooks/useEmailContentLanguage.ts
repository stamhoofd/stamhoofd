import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { encodeObject, PatchMap } from '@simonbackx/simple-encoding';
import { EmailContent } from '@stamhoofd/structures';
import type { Language } from '@stamhoofd/types/Language';
import type { Editor, JSONContent } from '@tiptap/core';
import type { Ref } from 'vue';
import { computed, ref } from 'vue';
import { EmailStyler } from '../../editor/EmailStyler';
import { CenteredMessage } from '../../overlays/CenteredMessage';

/**
 * The fields shared by the Email and EmailTemplate structures that make up the translatable content.
 * The root subject/html/text/json is the default (untranslated) content, translations contains
 * full content overrides per language.
 */
export type EmailContentHolder = {
    subject: string | null;
    html: string | null;
    text: string | null;
    json: any;
    translations: Map<Language, EmailContent>;
};

export type EmailContentPatch = {
    subject?: string;
    html?: string;
    text?: string;
    json?: any;
    translations?: PatchMap<Language, EmailContent | AutoEncoderPatchType<EmailContent> | null>;
};

/**
 * Manages which language of an email (template) is being edited: keeps the subject input and the
 * TipTap editor in sync with either the default content (root fields) or a translation, and writes
 * all edits back into the patch of the view.
 */
export function useEmailContentLanguage(options: {
    editor: () => Editor | null | undefined;
    patched: () => EmailContentHolder;
    addPatch: (patch: EmailContentPatch) => void;
}) {
    /**
     * null = editing the default (untranslated) content
     */
    const currentLanguage: Ref<Language | null> = ref(null);

    /**
     * Guards against interleaving language switches: deriving html/text from the editor is async
     */
    const switching = ref(false);

    const languages = computed(() => [...options.patched().translations.keys()]);

    function contentFor(language: Language | null): EmailContent {
        const patched = options.patched();
        if (language !== null) {
            return patched.translations.get(language) ?? EmailContent.create({});
        }
        return EmailContent.create({
            subject: patched.subject ?? '',
            html: patched.html ?? '',
            text: patched.text ?? '',
            json: patched.json ?? {},
        });
    }

    function mergeContent(base: EmailContent, content: Partial<{ subject: string; html: string; text: string; json: any }>): EmailContent {
        return EmailContent.create({
            subject: content.subject ?? base.subject,
            html: content.html ?? base.html,
            text: content.text ?? base.text,
            json: content.json ?? base.json,
        });
    }

    function applyContentPatch(language: Language | null, content: Partial<{ subject: string; html: string; text: string; json: any }>) {
        if (language === null) {
            options.addPatch(content);
            return;
        }
        // Always store the full content of a translation, so it stays a consistent set
        options.addPatch({ translations: new PatchMap([[language, mergeContent(contentFor(language), content)]]) });
    }

    const subject = computed({
        get: () => contentFor(currentLanguage.value).subject,
        set: (subject: string) => applyContentPatch(currentLanguage.value, { subject }),
    });

    /**
     * Read the current editor content and derive the html/text from it. The language is captured
     * before the (async) derivation: the user could switch to a different language in the meantime.
     */
    async function getDerivedContent(): Promise<{ language: Language | null; html: string; text: string; json: any } | null> {
        const editor = options.editor();
        if (!editor) {
            return null;
        }
        const language = currentLanguage.value;
        const json = editor.getJSON();
        return {
            language,
            ...await EmailStyler.format(editor.getHTML(), contentFor(language).subject),
            json,
        };
    }

    /**
     * Store the current editor content (json + derived html/text) in the patch,
     * for the language that is currently being edited.
     */
    async function flush() {
        const derived = await getDerivedContent();
        if (!derived) {
            return;
        }
        const { language, ...content } = derived;
        applyContentPatch(language, content);
    }

    function loadEditor(language: Language | null) {
        const editor = options.editor();
        if (!editor) {
            return;
        }
        const content = contentFor(language);
        if (content.json && (content.json as { type?: string }).type) {
            editor.commands.setContent(content.json as JSONContent);
        }
        else {
            editor.commands.clearContent();
        }
    }

    async function switchTo(language: Language | null) {
        if (switching.value || language === currentLanguage.value) {
            return;
        }
        switching.value = true;
        try {
            await flush();
            currentLanguage.value = language;
            loadEditor(language);
        }
        finally {
            switching.value = false;
        }
    }

    async function addLanguage(language: Language) {
        if (switching.value || languages.value.includes(language)) {
            return;
        }
        switching.value = true;
        try {
            await flush();

            // Seed the new translation with the content that is currently displayed
            options.addPatch({ translations: new PatchMap([[language, contentFor(currentLanguage.value).clone()]]) });
            currentLanguage.value = language;
        }
        finally {
            switching.value = false;
        }
    }

    async function removeLanguage(language: Language) {
        if (switching.value) {
            return;
        }
        if (!await CenteredMessage.confirm($t('Ben je zeker dat je deze vertaling wilt verwijderen?'), $t('Verwijderen'), $t('De inhoud van deze taal gaat verloren. Ontvangers in deze taal ontvangen daarna de standaardtekst.'))) {
            return;
        }
        // The switching guard stops onEditorUpdate from writing a patch while the editor content is replaced
        switching.value = true;
        try {
            options.addPatch({ translations: new PatchMap([[language, null]]) });
            if (currentLanguage.value === language) {
                currentLanguage.value = null;
                loadEditor(null);
            }
        }
        finally {
            switching.value = false;
        }
    }

    /**
     * Call on TipTap 'update' events to keep the json in the patch up to date (used for auto-saving).
     * The html/text are not derived here because that is async and expensive: use flush() or
     * patchDerivedContent() before actually using them.
     */
    function onEditorUpdate() {
        const editor = options.editor();
        if (!editor || switching.value) {
            return;
        }
        applyContentPatch(currentLanguage.value, { json: editor.getJSON() });
    }

    /**
     * Merge derived html/text (+ json) into a detached patch (one that is about to be sent to the server),
     * targeting the language the content was derived from.
     */
    function patchDerivedContent<P extends { patch: (p: any) => P }>(base: P, derived: { language: Language | null; html: string; text: string; json?: any }): P {
        const { language, ...content } = derived;
        if (language === null) {
            return base.patch(content);
        }
        const patch: EmailContentPatch = { translations: new PatchMap([[language, mergeContent(contentFor(language), content)]]) };
        return base.patch(patch);
    }

    return {
        currentLanguage,
        switching,
        languages,
        subject,
        contentFor,
        getDerivedContent,
        flush,
        loadEditor,
        switchTo,
        addLanguage,
        removeLanguage,
        onEditorUpdate,
        patchDerivedContent,
    };
}

/**
 * Ask the user to review translations that might have become stale (see getStaleEmailContentLanguages).
 * Returns true when saving/sending can continue; on 'review' the editor is switched to the first
 * stale language and false is returned.
 */
export async function confirmStaleEmailContentLanguages(original: EmailContentHolder, patched: EmailContentHolder, options: { ignoreText: string; switchTo: (language: Language | null) => Promise<void> }): Promise<boolean> {
    const staleLanguages = getStaleEmailContentLanguages(original, patched);
    if (staleLanguages.length === 0) {
        return true;
    }

    const option = await CenteredMessage.show({
        title: $t('Andere talen nakijken?'),
        description: $t('Je hebt niet alle talen van deze e-mail aangepast. Kijk de andere vertalingen na zodat de inhoud in elke taal hetzelfde blijft.'),
        buttons: [
            {
                text: $t('Vertalingen nakijken'),
                type: 'primary',
                value: 'review',
            },
            {
                text: options.ignoreText,
                type: 'secundary',
                value: 'ignore',
            },
        ],
    });

    if (option === 'review') {
        // Jump to the first language that was not updated
        await options.switchTo(staleLanguages[0]);
        return false;
    }
    return true;
}

/**
 * Languages that might have become stale: the user changed some languages that already existed,
 * but did not touch these. Newly added or removed translations never make other languages stale.
 * Returns an empty array when nothing was changed, or when every existing language was updated.
 */
export function getStaleEmailContentLanguages(original: EmailContentHolder, patched: EmailContentHolder): (Language | null)[] {
    const changed = getChangedEmailContentLanguages(original, patched);
    const preexisting: (Language | null)[] = [null, ...[...original.translations.keys()].filter(language => patched.translations.has(language))];
    const changedPreexisting = preexisting.filter(language => changed.includes(language));

    if (changedPreexisting.length === 0 || changedPreexisting.length === preexisting.length) {
        return [];
    }
    return preexisting.filter(language => !changed.includes(language));
}

/**
 * Which languages (null = the default content) differ between the original and the patched version?
 */
export function getChangedEmailContentLanguages(original: EmailContentHolder, patched: EmailContentHolder): (Language | null)[] {
    const changed: (Language | null)[] = [];

    if (!emailContentIsEqual(
        { subject: original.subject ?? '', html: original.html ?? '', text: original.text ?? '', json: original.json ?? {} },
        { subject: patched.subject ?? '', html: patched.html ?? '', text: patched.text ?? '', json: patched.json ?? {} },
    )) {
        changed.push(null);
    }

    const allLanguages = new Set([...original.translations.keys(), ...patched.translations.keys()]);
    for (const language of allLanguages) {
        const originalContent = original.translations.get(language);
        const patchedContent = patched.translations.get(language);
        if (!originalContent || !patchedContent) {
            // Added or removed
            changed.push(language);
            continue;
        }
        if (!emailContentIsEqual(originalContent, patchedContent)) {
            changed.push(language);
        }
    }

    return changed;
}

function emailContentIsEqual(a: { subject: string; html: string; text: string; json: any }, b: { subject: string; html: string; text: string; json: any }) {
    // Note: html is derived from json (styling can differ between builds), and text is derived from html
    // so it is enough (and more stable) to compare subject + json.
    // encodeObject is added for reliable sorting of the keys before comparing
    return a.subject === b.subject && JSON.stringify(encodeObject(a.json ?? {}, { version: 0 })) === JSON.stringify(encodeObject(b.json ?? {}, { version: 0 }));
}
