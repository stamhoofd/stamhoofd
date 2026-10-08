<template>
    <SaveView :title="$t('Kortingscodes importeren')" :save-text="$t('Importeren')" :loading="saving" :disabled="!sheet" @save="save">
        <h1>{{ $t('Kortingscodes importeren') }}</h1>
        <p>{{ $t('Upload een Excel- of CSV-bestand met één rij per kortingscode. Rijen zonder code krijgen automatisch een nieuwe code. Rijen met een bestaande code of een bestaand e-mailadres werken die kortingscode bij.') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList class="illustration-list">
            <STListItem :selectable="true" class="left-center" element-name="label">
                <input type="file" style="display: none;" accept=".xlsx, .xls, .csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="changedFile">
                <template #left>
                    <img src="@stamhoofd/assets/images/illustrations/box-upload.svg">
                </template>

                <h2 class="style-title-list">
                    {{ fileName || $t('Bestand kiezen') }}
                </h2>
                <p class="style-description">
                    {{ sheet ? $t('{count} rijen gevonden in dit bestand.', { count: rowCount }) : $t('Excel- of CSV-bestand') }}
                </p>

                <template #right>
                    <span class="icon upload gray" />
                </template>
            </STListItem>
        </STList>

        <template v-if="sheet">
            <hr><h2>{{ $t('Kolommen') }}</h2>
            <p>{{ $t('Kies per veld welke kolom uit je bestand je wilt gebruiken.') }}</p>

            <STList>
                <STListItem v-for="field of fields" :key="field.id">
                    <h3 class="style-title-list">
                        {{ field.name }}
                    </h3>
                    <p class="style-description-small">
                        {{ field.description }}
                    </p>

                    <template #right>
                        <Dropdown v-model="mapping[field.id]">
                            <option value="">
                                {{ $t('Geen kolom') }}
                            </option>
                            <option v-for="column of columns" :key="column.key" :value="column.key">
                                {{ column.name }}
                            </option>
                        </Dropdown>
                    </template>
                </STListItem>
            </STList>

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
import { useDiscountCodesObjectFetcher } from '@stamhoofd/components/fetchers/useDiscountCodesObjectFetcher.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import Dropdown from '@stamhoofd/components/inputs/Dropdown.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { fetchAll } from '@stamhoofd/components/tables/classes/ObjectFetcher.ts';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import type { PrivateWebshop } from '@stamhoofd/structures';
import { LimitedFilteredRequest, PrivateDiscountCode, SortItemDirection } from '@stamhoofd/structures';
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
    afterImport: (discountCodes: PrivateDiscountCode[]) => void;
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
        name: $t('%6o'),
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
const objectFetcher = useDiscountCodesObjectFetcher(props.webshop.id);
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

const rowCount = computed(() => {
    const range = sheet.value ? getRange(sheet.value) : null;
    return range ? Math.max(0, range.e.r - range.s.r) : 0;
});

function changedFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const newFile = input.files?.[0];
    input.value = '';

    if (!newFile) {
        return;
    }

    const unreadableError = new SimpleError({
        code: 'invalid_file',
        message: 'Could not read the file',
        human: $t('We konden dit bestand niet lezen. Kies een Excel- of CSV-bestand.'),
    });

    const reader = new FileReader();
    reader.onerror = () => {
        errors.errorBox = new ErrorBox(unreadableError);
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
            errors.errorBox = new ErrorBox(unreadableError);
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

    // A column can only feed one field
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

function parseMaximumUsage(value: string, row: number, column: number, rowErrors: ImportError[]): number | null {
    if (!value) {
        return null;
    }

    const parsed = Number(value.replace(',', '.'));
    if (!Number.isInteger(parsed) || parsed < 1) {
        rowErrors.push(new ImportError(row, column, $t('Vul een positief geheel getal in.')));
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
    const seenCodes = new Set<string>();

    if (selectedColumns.length === 0) {
        throw new SimpleError({
            code: 'required_field',
            message: 'No columns selected',
            human: $t('Kies minstens één kolom om te importeren.'),
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

        const code = rawCode.length > 0 ? cleanCode(rawCode) : null;
        if (code && seenCodes.has(code)) {
            nextErrors.push(new ImportError(row, mappedColumns.code ?? range.s.c, $t('Deze code staat meerdere keren in het bestand.')));
        }
        if (code) {
            seenCodes.add(code);
        }

        rows.push({
            row,
            code,
            email,
            description,
            maximumUsage,
        });
    }

    if (rows.length === 0) {
        throw new SimpleError({
            code: 'empty_import',
            message: 'No rows to import',
            human: $t('Er werden geen rijen gevonden om te importeren.'),
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

async function fetchExistingCodes(field: 'code' | 'email', values: string[]) {
    const result = new Map<string, PrivateDiscountCode>();
    const chunkSize = 100;

    for (let start = 0; start < values.length; start += chunkSize) {
        const discountCodes = await fetchAll(new LimitedFilteredRequest({
            filter: {
                [field]: {
                    $in: values.slice(start, start + chunkSize),
                },
            },
            limit: chunkSize,
            sort: [{ key: 'id', order: SortItemDirection.ASC }],
        }), objectFetcher);

        for (const discountCode of discountCodes) {
            // The database matches case-insensitively, the file values are normalized
            const value = discountCode[field]?.toLowerCase();
            if (value && !result.has(value)) {
                result.set(value, discountCode);
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
        const codes = rows.flatMap(row => row.code ? [row.code] : []);
        const existingByEmail = await fetchExistingCodes('email', emails);
        const existingByCode = await fetchExistingCodes('code', codes);
        const usedCodes = new Set(codes);
        const patch: PatchableArrayAutoEncoder<PrivateDiscountCode> = new PatchableArray();

        for (const row of rows) {
            // Matching on code first keeps a re-import of a partially imported file idempotent
            const existing = (row.code ? existingByCode.get(row.code.toLowerCase()) : undefined)
                ?? (row.email ? existingByEmail.get(row.email) : undefined);

            if (existing) {
                patch.addPatch(PrivateDiscountCode.patch({
                    id: existing.id,
                    code: row.code ?? existing.code,
                    email: row.email ?? existing.email,
                    description: row.description,
                    maximumUsage: row.maximumUsage,
                }));
                continue;
            }

            const code = row.code ?? generateUniqueDiscountCode(usedCodes);
            patch.addPut(PrivateDiscountCode.create({
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
            decoder: new ArrayDecoder(PrivateDiscountCode as Decoder<PrivateDiscountCode>),
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
