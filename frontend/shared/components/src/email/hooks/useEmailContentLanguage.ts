import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { encodeObject, PatchMap } from '@simonbackx/simple-encoding';
import { EmailContent, LanguageHelper } from '@stamhoofd/structures';
import type { Language } from '@stamhoofd/types/Language';
import type { Editor, JSONContent } from '@tiptap/core';
import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';
import { EmailStyler } from '../../editor/EmailStyler';
import { CenteredMessage } from '../../overlays/CenteredMessage';
import { Toast } from '#overlays/Toast.ts';

/**
 * The fields shared by the Email and EmailTemplate structures that make up the translatable content.
 * The root subject/html/text/json holds the default content: the content of `language` when one is
 * set, or untranslated content when `language` is null. `translations` contains full content
 * overrides for every other language and never contains `language` itself.
 */
export type EmailContentHolder = {
    subject: string | null;
    html: string | null;
    text: string | null;
    json: any;
    language: Language | null;
    translations: Map<Language, EmailContent>;
};

export type EmailContentPatch = {
    subject?: string;
    html?: string;
    text?: string;
    json?: any;
    language?: Language | null;
    translations?: PatchMap<Language, EmailContent | AutoEncoderPatchType<EmailContent> | null>;
};

/**
 * The content of a single language of the holder. The default language (or null when no language
 * is set) reads from the root fields, every other language from the translations map.
 */
export function getEmailContentFor(holder: EmailContentHolder, language: Language | null): EmailContent {
    if (language !== null && language !== holder.language) {
        return holder.translations.get(language) ?? EmailContent.create({});
    }
    return EmailContent.create({
        subject: holder.subject ?? '',
        html: holder.html ?? '',
        text: holder.text ?? '',
        json: holder.json ?? {},
    });
}

/**
 * The patch that adds a language:
 * - The first language only marks the existing content as that language (no translation is created)
 * - Every next language becomes a translation, seeded with the content that is currently displayed
 */
export function createAddLanguagePatch(holder: EmailContentHolder, displayedContent: EmailContent, language: Language): EmailContentPatch {
    if (holder.language === null) {
        return { language };
    }
    return { translations: new PatchMap([[language, displayedContent.clone()]]) };
}

/**
 * The patch that removes a language:
 * - A translation is simply removed from the map
 * - Removing the default language moves the first remaining translation into the default content
 *   and makes it the new default language
 * - Removing the last language keeps the content, it only stops being marked as that language
 */
export function createRemoveLanguagePatch(holder: EmailContentHolder, language: Language): EmailContentPatch {
    if (language !== holder.language) {
        return { translations: new PatchMap([[language, null]]) };
    }

    const remaining = [...holder.translations.keys()].filter(l => l !== language);
    if (remaining.length === 0) {
        return { language: null };
    }

    const newDefault = remaining[0];
    const content = getEmailContentFor(holder, newDefault);
    return {
        language: newDefault,
        subject: content.subject,
        html: content.html,
        text: content.text,
        json: content.json,
        translations: new PatchMap([[newDefault, null]]),
    };
}

/**
 * Manages which language of an email (template) is being edited: keeps the subject input and the
 * TipTap editor in sync with the language that is being edited, and writes all edits back into the
 * patch of the view — into the root fields for the default language, into the translations map for
 * every other language.
 */
export function useEmailContentLanguage(options: {
    editor: () => Editor | null | undefined;
    patched: () => EmailContentHolder;
    addPatch: (patch: EmailContentPatch) => void;
}) {
    /**
     * The language that is being edited. null when no language is set on the content (untranslated).
     */
    const currentLanguage: Ref<Language | null> = ref(options.patched().language);

    /**
     * Guards against interleaving language switches: deriving html/text from the editor is async
     */
    const switching = ref(false);

    /**
     * True while we programmatically replace the editor content, so the resulting 'update' event
     * (TipTap emits one on setContent) is not written back to the patch.
     */
    let suppressUpdate = false;

    /**
     * The translation that was last seeded as a copy of another language. When the user leaves it
     * without changing anything, it is removed again so an untouched duplicate language never lingers.
     */
    let seeded: { language: Language; content: EmailContent } | null = null;

    const defaultLanguage = computed(() => options.patched().language);

    const languages = computed(() => {
        const patched = options.patched();
        const list: Language[] = patched.language !== null ? [patched.language] : [];
        for (const language of patched.translations.keys()) {
            if (!list.includes(language)) {
                list.push(language);
            }
        }
        return list;
    });

    // The holder can receive its default language after the hook was created (e.g. the email is
    // loaded asynchronously): move the edited language along, null is only valid without a language
    watch(defaultLanguage, (language) => {
        if (currentLanguage.value === null && language !== null) {
            currentLanguage.value = language;
        }
    });

    function contentFor(language: Language | null): EmailContent {
        return getEmailContentFor(options.patched(), language);
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
        if (language === null || language === options.patched().language) {
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
        suppressUpdate = true;
        try {
            if (content.json && (content.json as { type?: string }).type) {
                editor.commands.setContent(content.json as JSONContent);
            } else {
                editor.commands.clearContent();
            }
        } finally {
            suppressUpdate = false;
        }
    }

    /**
     * If the language we are about to leave was seeded as a copy and never changed, remove it
     * again: an untouched copy should not survive as a separate language. Call after flush(), while
     * currentLanguage still points to the language that is being left.
     */
    function cleanupSeededLanguage() {
        const tracked = seeded;
        seeded = null;
        if (!tracked || tracked.language !== currentLanguage.value) {
            return;
        }
        const patched = options.patched();
        if (tracked.language === patched.language || !patched.translations.has(tracked.language)) {
            return;
        }
        if (emailContentIsEqual(contentFor(tracked.language), tracked.content)) {
            options.addPatch({ translations: new PatchMap([[tracked.language, null]]) });
        }
    }

    async function switchTo(language: Language | null) {
        // null represents the default content: that is the default language when one is set
        const target = language ?? defaultLanguage.value;
        if (switching.value || target === currentLanguage.value) {
            return;
        }
        switching.value = true;
        try {
            await flush();
            cleanupSeededLanguage();
            currentLanguage.value = target;
            loadEditor(target);
        } finally {
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

            // Capture the displayed content before the cleanup possibly removes it
            const displayed = contentFor(currentLanguage.value).clone();
            cleanupSeededLanguage();

            const patch = createAddLanguagePatch(options.patched(), displayed, language);
            options.addPatch(patch);
            if (patch.translations) {
                seeded = { language, content: displayed.clone() };
                Toast.success($t('%Zdt', { language: LanguageHelper.getName(language) })).show();
            }
            currentLanguage.value = language;
        } finally {
            switching.value = false;
        }
    }

    async function removeLanguage(language: Language) {
        if (switching.value) {
            return;
        }
        const patched = options.patched();
        const isDefault = language === patched.language;
        const remaining = [...patched.translations.keys()].filter(l => l !== language);

        let description: string;
        if (isDefault && remaining.length === 0) {
            description = $t('%ZeA');
        } else if (isDefault) {
            description = $t('%ZeH');
        } else {
            description = $t('%Zdz');
        }

        if (!await CenteredMessage.confirm($t('%ZeD'), $t('%CJ'), description)) {
            return;
        }
        // The switching guard stops onEditorUpdate from writing a patch while the editor content is replaced
        switching.value = true;
        try {
            if (seeded?.language === language) {
                seeded = null;
            }
            options.addPatch(createRemoveLanguagePatch(patched, language));
            if (currentLanguage.value === language) {
                const newCurrent = options.patched().language;
                currentLanguage.value = newCurrent;
                loadEditor(newCurrent);
            }
        } finally {
            switching.value = false;
        }
    }

    /**
     * Keep the json of the currently edited language in the patch on every editor change (used for
     * auto-saving). The html/text are not derived here because that is async and expensive: use
     * flush() or patchDerivedContent() before actually using them.
     */
    function onEditorUpdate() {
        const editor = options.editor();
        if (!editor || switching.value || suppressUpdate) {
            return;
        }
        applyContentPatch(currentLanguage.value, { json: editor.getJSON() });
    }

    // This composable owns the editor <-> patch synchronisation: when the editor becomes available it
    // loads the current language's content and then stores every change back into the patch, so views
    // don't have to wire this up (and can't forget to).
    watch(options.editor, (editor, _oldEditor, onCleanup) => {
        if (!editor) {
            return;
        }
        loadEditor(currentLanguage.value);
        const handler = () => onEditorUpdate();
        editor.on('update', handler);
        onCleanup(() => editor.off('update', handler));
    }, { immediate: true });

    /**
     * Merge derived html/text (+ json) into a detached patch (one that is about to be sent to the server),
     * targeting the language the content was derived from.
     */
    function patchDerivedContent<P extends { patch: (p: any) => P }>(base: P, derived: { language: Language | null; html: string; text: string; json?: any }): P {
        const { language, ...content } = derived;
        if (language === null || language === options.patched().language) {
            return base.patch(content);
        }
        const patch: EmailContentPatch = { translations: new PatchMap([[language, mergeContent(contentFor(language), content)]]) };
        return base.patch(patch);
    }

    return {
        currentLanguage,
        defaultLanguage,
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
        title: $t('%Ze1'),
        description: $t('%ZeC'),
        buttons: [
            {
                text: $t('%Ze6'),
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
