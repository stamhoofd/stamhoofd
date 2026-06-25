<template>
    <SaveView :title="$t('Kortingscodes importeren')" :save-text="$t('Importeren')" :loading="saving" :disabled="!sheet" @save="save">
        <h1>{{ $t('Kortingscodes importeren') }}</h1>
        <p>{{ $t('Upload een Excel of CSV-bestand met kortingscodes. Kolommen voor e-mailadres en code zijn optioneel.') }}</p>

        <p>
            <label class="button secundary">
                <span class="icon upload" />
                <span>{{ fileName || $t('Bestand kiezen') }}</span>
                <input class="hidden-file-input" type="file" accept=".xlsx, .xls, .csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="changedFile">
            </label>
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="sheet">
            <hr><h2>{{ $t('Kolommen') }}</h2>
            <p>{{ $t('Koppel de kolommen uit je bestand aan de velden die je wilt importeren.') }}</p>

            <STList>
                <STListItem v-for="field of fields" :key="field.id">
                    <h3 class="style-title-list">
                        {{ field.name }}
                    </h3>
                    <p class="style-description-small">
                        {{ field.description }}
                    </p>

                    <template #right>
                        <select v-model="mapping[field.id]" class="input mapping-select">
                            <option value="">
                                {{ $t('Geen kolom') }}
                            </option>
                            <option v-for="column of columns" :key="column.key" :value="column.key">
                                {{ column.name }}
                            </option>
                        </select>
                    </template>
                </STListItem>
            </STList>

            <p class="style-description-small">
                {{ $t('Rijen zonder code krijgen automatisch een nieuwe code. Bestaande codes met hetzelfde e-mailadres worden bijgewerkt zonder hun code te wijzigen.') }}
            </p>

            <p v-if="previewText" class="info-box">
                {{ previewText }}
            </p>

            <template v-if="importErrors.length">
                <hr><h2>{{ $t('Fouten') }}</h2>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>{{ $t('Fout') }}</th>
                            <th>{{ $t('Cel') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(error, index) of importErrors" :key="index">
                            <td>{{ error.message }}</td>
                            <td class="nowrap">
                                {{ error.cellPath }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </template>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import type { Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import type { PrivateWebshop, StamhoofdFilter } from '@stamhoofd/structures';
import { DiscountCode, LimitedFilteredRequest, PaginatedResponseDecoder, SortItemDirection } from '@stamhoofd/structures';
import { DataValidator, Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import XLSX from 'xlsx';
import { ImportError } from '../../../../../classes/import/ImportError';
import { generateDiscountCode } from './discountCodeGenerator';

type MappingField = 'code' | 'email' | 'description' | 'maximumUsage';

type ImportColumn = {
    key: string;
    index: number;
    name: string;
};

type ParsedDiscountCodeRow = {
    row: number;
    code: string | null;
    email: string | null;
    description?: string;
    maximumUsage?: number | null;
};

const props = defineProps<{
    webshop: PrivateWebshop;
    afterImport: (discountCodes: DiscountCode[]) => void;
}>();

const fields: { id: MappingField; name: string; description: string }[] = [
    {
        id: 'email',
        name: $t('E-mailadres'),
        description: $t('Codes met hetzelfde e-mailadres worden bijgewerkt.'),
    },
    {
        id: 'code',
        name: $t('Kortingscode'),
        description: $t('Laat leeg om automatisch codes te genereren.'),
    },
    {
        id: 'description',
        name: $t('Omschrijving'),
        description: $t('Optionele interne omschrijving.'),
    },
    {
        id: 'maximumUsage',
        name: $t('Maximum aantal keer gebruikt'),
        description: $t('Laat leeg voor onbeperkt gebruik.'),
    },
];

const errors = useErrors();
const context = useContext();
const navigationActions = useNavigationActions();
const pop = usePop();
const saving = ref(false);
const fileName = ref<string | null>(null);
const sheet = ref<XLSX.WorkSheet | null>(null);
const columns = ref<ImportColumn[]>([]);
const importErrors = ref<ImportError[]>([]);
const mapping = ref<Record<MappingField, string>>({
    code: '',
    email: '',
    description: '',
    maximumUsage: '',
});

const previewText = computed(() => {
    if (!sheet.value) {
        return '';
    }

    const range = getRange(sheet.value);
    if (!range) {
        return '';
    }

    const count = Math.max(0, range.e.r - range.s.r);
    return $t('{count} rijen gevonden in dit bestand.', { count });
});

function changedFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const newFile = input.files?.[0];
    input.value = '';

    if (!newFile) {
        return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            message: 'Kon dit bestand niet lezen',
        }));
    };
    reader.onload = (e) => {
        try {
            const result = e.target?.result;
            if (!result) {
                throw new Error('Missing file contents');
            }

            const workbook = XLSX.read(new Uint8Array(result as ArrayBuffer), { type: 'array', raw: true });
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) {
                throw new Error('No sheets found');
            }

            const nextSheet = workbook.Sheets[firstSheetName];
            if (!nextSheet || !nextSheet['!ref']) {
                throw new Error('Empty sheet');
            }

            sheet.value = nextSheet;
            fileName.value = newFile.name;
            columns.value = readColumns(nextSheet);
            mapping.value = inferMapping(columns.value);
            importErrors.value = [];
            errors.errorBox = null;
        }
        catch (e) {
            console.error(e);
            sheet.value = null;
            columns.value = [];
            fileName.value = null;
            errors.errorBox = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: 'Kon dit bestand niet lezen',
            }));
        }
    };

    reader.readAsArrayBuffer(newFile);
}

function getRange(currentSheet: XLSX.WorkSheet): XLSX.Range | null {
    if (!currentSheet['!ref']) {
        return null;
    }
    return XLSX.utils.decode_range(currentSheet['!ref']);
}

function getCellString(currentSheet: XLSX.WorkSheet, row: number, column: number | null): string {
    if (column === null) {
        return '';
    }

    const cell = currentSheet[XLSX.utils.encode_cell({ r: row, c: column })] as XLSX.CellObject | undefined;
    if (!cell) {
        return '';
    }

    return (cell.w ?? cell.v ?? '').toString().trim();
}

function getMappedColumn(field: MappingField): number | null {
    const key = mapping.value[field];
    if (!key) {
        return null;
    }

    const column = columns.value.find(c => c.key === key);
    return column?.index ?? null;
}

function readColumns(currentSheet: XLSX.WorkSheet): ImportColumn[] {
    const range = getRange(currentSheet);
    if (!range) {
        return [];
    }

    const result: ImportColumn[] = [];
    for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
        const name = getCellString(currentSheet, range.s.r, colNum) || XLSX.utils.encode_col(colNum);
        result.push({
            key: String(colNum),
            index: colNum,
            name,
        });
    }

    return result;
}

function normalizeColumnName(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findColumn(columns: ImportColumn[], aliases: string[]) {
    const normalizedAliases = aliases.map(normalizeColumnName);
    return columns.find((column) => {
        const normalized = normalizeColumnName(column.name);
        return normalizedAliases.some(alias => normalized === alias || normalized.includes(alias));
    })?.key ?? '';
}

function inferMapping(columns: ImportColumn[]): Record<MappingField, string> {
    const next: Record<MappingField, string> = {
        email: findColumn(columns, ['email', 'e-mail', 'mail', 'e-mailadres']),
        code: findColumn(columns, ['code', 'kortingscode', 'discount code', 'coupon']),
        description: findColumn(columns, ['omschrijving', 'beschrijving', 'description']),
        maximumUsage: findColumn(columns, ['maximum', 'maximum gebruik', 'max gebruik', 'maximaal aantal']),
    };

    const used = new Set<string>();
    for (const field of fields) {
        const key = next[field.id];
        if (!key) {
            continue;
        }
        if (used.has(key)) {
            next[field.id] = '';
        }
        else {
            used.add(key);
        }
    }

    return next;
}

function cleanCode(code: string): string {
    return Formatter.slug(code).toUpperCase();
}

function parseMaximumUsage(value: string, row: number, column: number, errors: ImportError[]): number | null {
    if (!value) {
        return null;
    }

    const parsed = Number(value.replace(',', '.'));
    if (!Number.isInteger(parsed) || parsed < 1) {
        errors.push(new ImportError(row, column, $t('Vul een positief geheel getal in.')));
        return null;
    }

    return parsed;
}

function parseRows(): { rows: ParsedDiscountCodeRow[]; importErrors: ImportError[] } {
    const currentSheet = sheet.value;
    const range = currentSheet ? getRange(currentSheet) : null;
    if (!currentSheet || !range) {
        return { rows: [], importErrors: [] };
    }

    const mappedColumns = {
        code: getMappedColumn('code'),
        email: getMappedColumn('email'),
        description: getMappedColumn('description'),
        maximumUsage: getMappedColumn('maximumUsage'),
    };
    const selectedColumns = Object.values(mappedColumns).filter(column => column !== null);
    const nextErrors: ImportError[] = [];
    const rows: ParsedDiscountCodeRow[] = [];
    const seenEmails = new Set<string>();

    if (selectedColumns.length === 0) {
        throw new SimpleError({
            code: 'required_field',
            message: 'Kies minstens één kolom om te importeren',
        });
    }

    for (let row = range.s.r + 1; row <= range.e.r; row++) {
        const rawValues = selectedColumns.map(column => getCellString(currentSheet, row, column));
        if (rawValues.every(value => value.length === 0)) {
            continue;
        }

        const rawCode = getCellString(currentSheet, row, mappedColumns.code);
        const rawEmail = getCellString(currentSheet, row, mappedColumns.email).toLowerCase();
        const description = mappedColumns.description === null ? undefined : getCellString(currentSheet, row, mappedColumns.description);
        const maximumUsage = mappedColumns.maximumUsage === null ? undefined : parseMaximumUsage(
            getCellString(currentSheet, row, mappedColumns.maximumUsage),
            row,
            mappedColumns.maximumUsage,
            nextErrors,
        );

        const email = rawEmail.length > 0 ? rawEmail : null;
        if (email && !DataValidator.isEmailValid(email)) {
            nextErrors.push(new ImportError(row, mappedColumns.email ?? range.s.c, $t('Vul een geldig e-mailadres in.')));
        }

        if (email && seenEmails.has(email)) {
            nextErrors.push(new ImportError(row, mappedColumns.email ?? range.s.c, $t('Dit e-mailadres staat meerdere keren in het bestand.')));
        }
        if (email) {
            seenEmails.add(email);
        }

        rows.push({
            row,
            code: rawCode.length > 0 ? cleanCode(rawCode) : null,
            email,
            description,
            maximumUsage,
        });
    }

    if (rows.length === 0) {
        throw new SimpleError({
            code: 'empty_import',
            message: 'Er werden geen rijen gevonden om te importeren',
        });
    }

    return {
        rows,
        importErrors: nextErrors,
    };
}

function generateUniqueDiscountCode(usedCodes: Set<string>) {
    let code = generateDiscountCode();
    while (usedCodes.has(code)) {
        code = generateDiscountCode();
    }
    usedCodes.add(code);
    return code;
}

async function fetchExistingCodesByEmail(emails: string[]) {
    const result = new Map<string, DiscountCode>();
    const chunkSize = 100;

    for (let start = 0; start < emails.length; start += chunkSize) {
        const chunk = emails.slice(start, start + chunkSize);
        const filter: StamhoofdFilter = {
            email: {
                $in: chunk,
            },
        };

        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/webshop/${props.webshop.id}/discount-codes`,
            decoder: new PaginatedResponseDecoder(new ArrayDecoder(DiscountCode as Decoder<DiscountCode>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
            query: new LimitedFilteredRequest({
                filter,
                limit: chunkSize,
                sort: [{ key: 'id', order: SortItemDirection.ASC }],
            }),
            shouldRetry: false,
            owner: navigationActions,
            timeout: 30 * 1000,
        });

        for (const discountCode of response.data.results) {
            if (discountCode.email && !result.has(discountCode.email)) {
                result.set(discountCode.email, discountCode);
            }
        }
    }

    return result;
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;
    importErrors.value = [];
    errors.errorBox = null;

    try {
        const parsed = parseRows();
        if (parsed.importErrors.length > 0) {
            importErrors.value = parsed.importErrors;
            return;
        }

        const rows = parsed.rows;
        const emails = Formatter.uniqueArray(rows.flatMap(row => row.email ? [row.email] : []));
        const existingCodes = await fetchExistingCodesByEmail(emails);
        const usedCodes = new Set(rows.flatMap(row => row.code ? [row.code] : []));
        const patch: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray();

        for (const row of rows) {
            const existing = row.email ? existingCodes.get(row.email) : undefined;

            if (existing) {
                const patchData: Record<string, unknown> = {
                    id: existing.id,
                    email: row.email,
                };
                if (row.description !== undefined) {
                    patchData.description = row.description;
                }
                if (row.maximumUsage !== undefined) {
                    patchData.maximumUsage = row.maximumUsage;
                }
                patch.addPatch(DiscountCode.patch(patchData));
                continue;
            }

            const code = row.code ?? generateUniqueDiscountCode(usedCodes);
            patch.addPut(DiscountCode.create({
                code,
                email: row.email,
                description: row.description ?? '',
                maximumUsage: row.maximumUsage ?? null,
            }));
        }

        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: `/webshop/${props.webshop.id}/discount-codes`,
            body: patch,
            shouldRetry: false,
            owner: navigationActions,
            decoder: new ArrayDecoder(DiscountCode as Decoder<DiscountCode>),
        });

        props.afterImport(response.data);
        new Toast(emails.length > 0 ? $t('Kortingscodes geïmporteerd. Je kan ze nu per e-mail versturen.') : $t('Kortingscodes geïmporteerd.'), 'success green').show();
        pop({ force: true })?.catch(console.error);
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        saving.value = false;
    }
}
</script>

<style scoped>
.hidden-file-input {
    display: none;
}

.mapping-select {
    min-width: 220px;
}
</style>
