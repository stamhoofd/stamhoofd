import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { ReportCard, ReportTab } from './report.js';
import { getReportDirectory, loadReport, loadSnippets, parseTab, parameterNames, resolveSql } from './report.js';
import { buildVisualizationSettings, columnPalettes, layoutCards } from './sync-report.js';

/**
 * A card's sql as one line. The comments go first: a term of an expression carries the name of the
 * tak it weighs behind `--`, and collapsing the newlines would otherwise run that name into the term
 * below it -- commenting the rest of the expression out of the string being asserted on.
 */
function expressionOf(sql: string): string {
    return sql.replaceAll(/--[^\n]*/g, '').replaceAll(/\s+/g, ' ').trim();
}

function cardOf(tabs: ReportTab[], tab: string, card: string): ReportCard {
    const found = tabs.find(entry => entry.key === tab)?.cards.find(entry => entry.key === card);
    if (!found) {
        throw new Error(`No card ${tab}/${card}`);
    }
    return found;
}

/**
 * The cards of a tab as the rows they end up on, in order, with the width they take up together and
 * the heights they are drawn at.
 */
function rowsOf(cards: ReportCard[]): { keys: string[]; width: number; heights: number[] }[] {
    const rows = new Map<number, { keys: string[]; width: number; heights: number[] }>();

    for (const placed of layoutCards(cards)) {
        const row = rows.get(placed.row) ?? { keys: [], width: 0, heights: [] };
        rows.set(placed.row, { keys: [...row.keys, placed.card.key], width: row.width + placed.sizeX, heights: [...new Set([...row.heights, placed.sizeY])] });
    }

    return [...rows.values()];
}

describe('report', () => {
    /** The report as keeo counts it. What ravot counts differently is `ravotDashboards`. */
    let dashboards: ReportTab[];
    let ravotDashboards: ReportTab[];

    beforeAll(async () => {
        dashboards = await loadReport('keeo');
        ravotDashboards = await loadReport('ravot');
    });

    describe('definition', () => {
        it('has the four pages of the report as tabs, plus the aanlevering and the filter values', () => {
            expect(dashboards.map(dashboard => dashboard.key)).toEqual(['nationaal', 'eenheden', 'netwerk', 'varia', 'jeugdbewegingen', 'filters']);
            expect(dashboards.find(tab => tab.key === 'filters')!.hidden).toBe(true);
        });

        it('reads a card with its metadata and expands the shared fragments', () => {
            const card = cardOf(dashboards, 'nationaal', 'totaal-leden');

            expect(card.title).toEqual('Totaal leden');
            expect(card.display).toEqual('scalar');
            expect(card.sql).toContain('all_registrations AS (');
            // A fragment the fragment above it includes, so this also says the nesting was resolved.
            expect(card.sql).toContain('takken AS (');
            expect(card.sql).not.toContain('@include');
        });

        /**
         * A dashboard only connects the filters it shows, so a card offering one it does not have is
         * harmless. A card missing one it needs is not, and neither is a trend card that the year
         * filter can reach: it would collapse to the single year the filter selected.
         */
        it('takes the parameters a card uses from its sql, so the two cannot drift', () => {
            expect(cardOf(dashboards, 'nationaal', 'totaal-leden').parameters).toContain('scoutsjaar');
            expect(cardOf(dashboards, 'eenheden', 'eenheid-totaal-leden').parameters).toEqual(['scoutsjaar', 'eenheid', 'aansluiting', 'ingeschreven_voor']);

            for (const key of ['leden-per-scoutsjaar', 'percentage-blijvers-per-eenheid']) {
                expect(`${key}: ${cardOf(dashboards, 'nationaal', key).sql.includes('p.name = {{scoutsjaar}}')}`).toEqual(`${key}: false`);
            }
        });

        /**
         * MySQL builds a CTE again for every place that reads it and hash-joins the copies against
         * each other, on a row estimate taken before any of them was built. Both lidgeld cards read
         * `leden` twice, through an IN-subquery per column, and stopped loading at all once the
         * statistics held a few years: 165k registrations timed out past two minutes where reading it
         * once, as a join on the pair, answers in three seconds.
         */
        it('reads a shared fragment once per card, which is what keeps it answerable', () => {
            for (const dashboard of dashboards) {
                for (const card of dashboard.cards) {
                    // The card's own query: what the fragments themselves read is their business.
                    const body = card.snippetSql.split('\n').filter(line => !line.startsWith('{{snippet:')).join('\n');

                    for (const fragment of card.snippets) {
                        const reads = body.match(new RegExp(`\\b(?:FROM|JOIN)\\s+${fragment}\\b`, 'g')) ?? [];
                        expect(`${card.key} reads ${fragment} ${reads.length} times`).toEqual(`${card.key} reads ${fragment} ${Math.min(reads.length, 1)} times`);
                    }
                }
            }
        });

        it('names every column a chart plots', () => {
            for (const dashboard of dashboards) {
                for (const card of dashboard.cards.filter(card => ['bar', 'line', 'combo', 'pie', 'map'].includes(card.display))) {
                    expect(`${card.key}: ${card.dimensions.length}`).not.toEqual(`${card.key}: 0`);
                    expect(`${card.key}: ${card.metrics.length}`).not.toEqual(`${card.key}: 0`);

                    for (const column of [...card.dimensions, ...card.metrics]) {
                        expect(`${card.key} selects ${column}`).toEqual(card.sql.includes(`\`${column}\``) ? `${card.key} selects ${column}` : `${card.key} does not select ${column}`);
                    }
                }
            }
        });

        /**
         * The aanlevering is opened on its own terms rather than as a page of the ledenstatistieken:
         * it mirrors none of them, and is read once a year by whoever files it.
         */
        it('gives the aanlevering a dashboard of its own and leaves every other tab on the report', () => {
            expect(dashboards.find(tab => tab.key === 'jeugdbewegingen')!.dashboard).toEqual('Groepen en Deelnemers - Departement Jeugd');

            for (const key of ['nationaal', 'eenheden', 'netwerk', 'varia']) {
                expect(`${key}: ${dashboards.find(tab => tab.key === key)!.dashboard}`).toEqual(`${key}: undefined`);
            }
        });

        /**
         * The koepel's own organization is not an eenheid and its structuurvrijwilligers are nobody's
         * leden, so the ledenstatistieken leave it out wherever they count: every card of that
         * dashboard drops `platform.membershipOrganizationId`, and so does the eenheid filter, which
         * would otherwise offer a unit that empties every card on the page.
         *
         * Kept here because a card that forgets it reads as a plausible figure: the koepel is one
         * organization among dozens, and the import writes it under that same id, so it would go
         * unnoticed in the years the client checks against their own pdf as well.
         */
        it('leaves the koepel out of every card of the ledenstatistieken', () => {
            const drops = (sql: string) => /NOT EXISTS \(SELECT 1 FROM platform pf WHERE pf\.membershipOrganizationId = /.test(sql);
            const pages = dashboards.filter(dashboard => dashboard.dashboard === undefined && !dashboard.hidden);

            expect(pages.map(dashboard => dashboard.key)).toEqual(['nationaal', 'eenheden', 'netwerk', 'varia']);

            for (const dashboard of pages) {
                for (const card of dashboard.cards) {
                    expect(`${dashboard.key}/${card.key}: ${drops(card.sql)}`).toEqual(`${dashboard.key}/${card.key}: true`);
                }
            }

            expect(drops(cardOf(dashboards, 'filters', 'eenheid').sql)).toBe(true);
        });

        /**
         * The one card that is about that organization. It reads the rows before the koepel is
         * dropped -- filtered like the rest, it would deliver an empty sheet.
         */
        it('delivers the koepel itself in the aanlevering', () => {
            const sql = cardOf(dashboards, 'jeugdbewegingen', 'deelnemers-bovenlokaal').sql;

            expect(sql).toContain('FROM all_registrations f\nJOIN platform pf ON pf.membershipOrganizationId = f.organization_id');
            expect(/FROM facts\b/.test(sql)).toBe(false);
        });

        /**
         * The sheets of Bijlage B of the aanleveringsovereenkomst, under the names the tabs of that
         * template carry: a sheet is pasted into one of them and read by its headers. Werkjaar,
         * Type_organisatie and NIS-code are not among them -- the department fills those in itself.
         */
        it('delivers every sheet as the aanleversjabloon defines it', () => {
            const sheets = [
                ['organisatie-bovenlokaal', 'Organisatie_Bovenlokaal', ['ID_Organisatie', 'Naam_Organisatie']],
                ['deelnemers-bovenlokaal', 'Deelnemers_Bovenlokaal', ['ID_Organisatie', 'Geboortejaar_deelnemers', 'Gender_deelnemers', 'Aantal_deelnemers']],
                ['organisatie-lokale-groep', 'Organisatie_Lokale_groep', ['ID_Organisatie', 'Naam_Organisatie', 'Postcode']],
                ['deelnemers-lokale-groep', 'Deelnemers_Lokale_groep', ['ID_Organisatie', 'Type_deelnemers', 'Geboortejaar_deelnemers', 'Gender_deelnemers', 'Aantal_deelnemers']],
            ] as const;

            for (const [key, title, columns] of sheets) {
                const card = cardOf(dashboards, 'jeugdbewegingen', key);

                expect(`${key}: ${card.title}`).toEqual(`${key}: ${title}`);
                expect(card.columns).toEqual([...columns]);
                expect(`${key}: ${card.display}`).toEqual(`${key}: table`);
                expect(`${key} takes the werkjaar: ${card.parameters.includes('scoutsjaar')}`).toEqual(`${key} takes the werkjaar: true`);
            }

            expect(dashboards.find(tab => tab.key === 'jeugdbewegingen')!.cards.map(card => card.key)).toEqual(sheets.map(([key]) => key));
        });

        /**
         * The three letters the template allows for a geslacht, and no fourth: a member who never
         * answered leaves the cell empty, which the metadatafiche asks for rather than a value of its
         * own. Kept here because nothing else notices -- an unmapped value reads as a plausible row.
         */
        it('says a geslacht in the letters the metadatafiche allows, and nothing where there is no answer', () => {
            const cards = dashboards.flatMap(dashboard => dashboard.cards.filter(card => card.columns.includes('Gender_deelnemers')));
            expect(cards.map(card => card.key)).toEqual(['deelnemers-bovenlokaal', 'deelnemers-lokale-groep']);

            for (const card of cards) {
                const letters = /CASE \w+\.`Geslacht` WHEN 'Man' THEN 'M' WHEN 'Vrouw' THEN 'V' ELSE NULL END/;

                expect(`${card.key}: ${letters.test(card.sql.replaceAll(/\s+/g, ' '))}`).toEqual(`${card.key}: true`);
            }
        });

        /**
         * Someone can be a lid in one tak of a unit and leiding in another. The metadatafiche is
         * explicit that they are leiding there and not a lid, so the two are decided per member per
         * group before anything is counted -- off the registrations they would be one person
         * delivered in both rows, and the group would report more deelnemers than it has.
         *
         * The same grain answers what a deelnemer is: inschrijvingen rather than unique inschrijvers
         * means someone registered at two groups counts at both, not that two takken count twice.
         */
        it('counts a member of a group once, as leiding when they are leiding anywhere in it', () => {
            const sql = cardOf(dashboards, 'jeugdbewegingen', 'deelnemers-lokale-groep').sql.replaceAll(/\s+/g, ' ');

            expect(sql).toContain("CASE WHEN f.tak_category = 'leader' THEN 2 WHEN f.tak_category = 'child' THEN 1 ELSE 0 END AS type_number");
            expect(sql).toContain('GROUP BY i.organization_id, i.member_id )');
            expect(sql).toContain("CASE WHEN d.type_number = 2 THEN 'leiding' ELSE 'leden' END");
        });

        /**
         * The metadatafiche has no third word for the volwassenen who carry a group, and counts them
         * as leiding. Ravot holds them in a tak of its own that the categories may not say this of --
         * categorised as leiding it would land in the omkaderingscijfer and the GTP index, which
         * weigh the leiding an eenheid looks after its kinderen with -- so the aanlevering names the
         * tak, there and nowhere else.
         */
        it('delivers the ondersteunende leden of ravot as leiding, and names that tak in no other environment', () => {
            // The condition rather than the prose: the fragments mention the tak in their comments too.
            const namesTheTak = (tabs: ReportTab[]) => tabs.flatMap(tab => tab.cards)
                .filter(card => expressionOf(card.sql).includes("f.tak_id = 'a28d290c-af71-4282-92cc-2224a18d3091'"))
                .map(card => card.key);
            const sql = expressionOf(cardOf(ravotDashboards, 'jeugdbewegingen', 'deelnemers-lokale-groep').sql);

            // By the id of the tak rather than by its name, which the years need not agree on.
            expect(sql).toContain("CASE WHEN f.tak_category = 'leader' THEN 2 WHEN f.tak_id = 'a28d290c-af71-4282-92cc-2224a18d3091' THEN 2 WHEN f.tak_category = 'child' THEN 1 ELSE 0 END AS type_number");
            expect(sql).not.toContain("`Tak` = 'Ondersteunende leden'");
            expect(namesTheTak(ravotDashboards)).toEqual(['deelnemers-lokale-groep']);
            expect(namesTheTak(dashboards)).toEqual([]);
        });

        /**
         * A cancelled registration says someone was there, not what they were. An administrator who
         * puts a lid in the Leiding tak by mistake and undoes it would otherwise leave them leiding
         * for the rest of the werkjaar, while the registration they really hold says what they are.
         *
         * Only a member whose registrations at the group were all cancelled -- someone who left
         * during the year -- has nothing else to be read from, which is what the fallback is for.
         */
        it('lets the registrations that still stand decide what someone is', () => {
            const sql = cardOf(dashboards, 'jeugdbewegingen', 'deelnemers-lokale-groep').sql.replaceAll(/\s+/g, ' ');

            expect(sql).toContain('COALESCE( MAX(CASE WHEN i.deactivated_at IS NULL THEN i.type_number END), MAX(i.type_number) ) AS type_number');
        });

        /**
         * Someone who stopped in november was a deelnemer of that werkjaar: the metadatafiche counts
         * everyone who was registered at some point between september and august. The
         * ledenstatistieken count what is still standing, so the two read a different set of rows --
         * which is the whole reason `all_facts` is a step of its own.
         */
        it('delivers the deelnemers who left during the werkjaar, which the ledenstatistieken drop', () => {
            // Every card carries the line the fragment reads it by; what counts is the card's own FROM.
            const own = (sql: string) => sql.replace('SELECT f.* FROM all_registrations f WHERE f.deactivated_at IS NULL', '');
            const cards = dashboards.flatMap(dashboard => dashboard.cards.filter(card => own(card.sql).includes('FROM all_registrations f')));

            expect(cards.map(card => card.key)).toEqual(['deelnemers-bovenlokaal', 'deelnemers-lokale-groep']);
            expect(cards[0].sql.replaceAll(/\s+/g, ' ')).toContain('all_facts AS ( SELECT f.* FROM all_registrations f WHERE f.deactivated_at IS NULL )');
        });

        /**
         * The two categories answer different questions, and the sheet may only read one of them.
         * `effective_category` falls back to the ages so that nobody drops out of a total, which is
         * what the ledenstatistieken want; the ages cannot tell leiding from anything, so reading it
         * here would deliver a leider of seventeen as a lid. A tak nobody has categorised delivers
         * nobody instead, which is missing rather than wrong.
         */
        it('splits the sheet by what the takken were recorded as, never by what the ages suggest', () => {
            const sql = cardOf(dashboards, 'jeugdbewegingen', 'deelnemers-lokale-groep').sql;
            // The card's own query: `effective_category` is a column of the fragment it includes, and
            // being selected there says nothing about what the sheet splits by.
            const query = sql.slice(sql.indexOf('\n, inschrijvingen AS ('));

            expect(query).toContain('f.tak_category');
            expect(`reads the fallback: ${query.includes('effective_category')}`).toEqual('reads the fallback: false');
        });

        /**
         * A registration is not an aansluiting: a group can register someone it never aansluit, and
         * the dataset is about the deelnemers a koepel is aangesloten for. Both deelnemers sheets ask
         * for one, the aanlevering being the only thing here that does -- the ledenstatistieken count
         * every active registration.
         */
        it('delivers only the deelnemers with an aansluiting in that werkjaar', () => {
            // Every card reads the aansluiting filter through `facts`, which asks about the
            // registration as `r`; the condition of the sheets themselves asks about a fact as `f`.
            const asked = /EXISTS \( SELECT 1 FROM member_platform_memberships mpm WHERE mpm\.memberId = f\.member_id AND mpm\.periodId = f\.period_id AND mpm\.deletedAt IS NULL \)/;
            const cards = dashboards.flatMap(dashboard => dashboard.cards.filter(card => asked.test(card.sql.replaceAll(/\s+/g, ' '))));

            expect(cards.map(card => card.key)).toEqual(['deelnemers-bovenlokaal', 'deelnemers-lokale-groep']);
        });

        /**
         * The koepel's own organization belongs to the bovenlokale sheet and to no other: the
         * department reads one organization per row across the two, so a unit on both is a unit
         * counted twice, and one on neither is a unit the dataset never hears about.
         */
        it('delivers the koepel and the local groups to one sheet each, and to no other', () => {
            const [bovenlokaal, lokaal] = ['organisatie-bovenlokaal', 'organisatie-lokale-groep']
                .map(key => cardOf(dashboards, 'jeugdbewegingen', key).sql.replaceAll(/\s+/g, ' '));

            expect(bovenlokaal).toContain('JOIN platform pf ON pf.membershipOrganizationId = o.id');
            expect(lokaal).toContain('WHERE NOT EXISTS (SELECT 1 FROM platform pf WHERE pf.membershipOrganizationId = o.id)');
        });

        /**
         * The template asks for a postcode as a four digit number, and the administration holds free
         * text: a foreign postcode, or a whole address typed into the box. Kept here because the
         * conversion is what decides between an empty cell the koepel can fix and a wrong number.
         */
        it('delivers a postcode as the number the template asks for, and nothing when it is not one', () => {
            const sql = cardOf(dashboards, 'jeugdbewegingen', 'organisatie-lokale-groep').sql.replaceAll(/\s+/g, ' ');

            expect(sql).toContain("CASE WHEN o.postalCode REGEXP '^[0-9]{4}$' THEN CAST(o.postalCode AS UNSIGNED) END");
        });

        /**
         * A sheet is read by the position of its columns as much as by their names, so a card that is
         * delivered rather than read on screen selects exactly the columns it declares, in that
         * order, and each of them under an alias -- an unaliased column would land in the sheet under
         * whatever the database calls it.
         */
        it('selects the columns of a sheet in the order the sheet has them', () => {
            const exported = dashboards.flatMap(dashboard => dashboard.cards.filter(card => card.columns.length > 0));
            expect(exported.length).toBeGreaterThan(0);

            for (const card of exported) {
                // The card's own SELECT, which is the last one that starts a line: the query fragments
                // it includes name columns of their own, and those do not reach the sheet.
                const query = card.sql.slice(card.sql.lastIndexOf('\nSELECT'));
                const selected = [...query.matchAll(/AS `([^`]+)`/g)].map(match => match[1]);

                expect(`${card.key}: ${selected.join(', ')}`).toEqual(`${card.key}: ${card.columns.join(', ')}`);
            }
        });

        /**
         * What a member paid for their lidgeld, which is the split the two lidgeld cards draw: the
         * standaardtarief against the lower one. The aansluiting they hold says what they are
         * aangesloten for and nothing about the price, so a card that groups on its name reads as a
         * plausible pie of the wrong thing -- which is what these two used to be.
         *
         * The name of the lower tarief is the koepel's own and comes from the platform row. A
         * platform that gives it none, or a statistics database with nothing synced into it yet,
         * still has to name the slice rather than leave it empty.
         */
        it('splits the lidgelden by the tarief they were charged at, named as the koepel names it', () => {
            const cards = [cardOf(dashboards, 'nationaal', 'leden-per-type-lidgeld'), cardOf(dashboards, 'eenheden', 'eenheid-leden-per-type-lidgeld')];

            for (const card of cards) {
                const sql = card.sql.replaceAll(/\s+/g, ' ');

                expect(`${card.key}: ${sql.includes('CASE WHEN mpm.reducedPrice = 1')}`).toEqual(`${card.key}: true`);
                expect(`${card.key}: ${sql.includes("ELSE 'Standaardtarief' END AS `Type lidgeld`")}`).toEqual(`${card.key}: true`);
                expect(`${card.key}: ${sql.includes('SELECT pf.reducedPriceName FROM platform pf')}`).toEqual(`${card.key}: true`);
                expect(`${card.key}: ${sql.includes("COALESCE((SELECT pf.reducedPriceName FROM platform pf WHERE pf.reducedPriceName IS NOT NULL LIMIT 1), 'Verlaagd tarief')")}`).toEqual(`${card.key}: true`);
                expect(`${card.key}: ${sql.includes('mt.name AS `Type lidgeld`')}`).toEqual(`${card.key}: false`);
            }

            // One expression, so the two cards cannot start naming the same tarief differently.
            expect(new Set(cards.map(card => card.sql.replaceAll(/\s+/g, ' ').match(/CASE WHEN mpm\.reducedPrice.*?END/)?.[0])).size).toBe(1);
        });

        /**
         * The weights of the index, kept here because nothing else checks them: a wrong weight, or a
         * tak weighed under an id that is not the one the platform holds it under, is a plausible
         * number rather than a failure.
         *
         * The ids rather than the names, which is what the takken were matched on until a name turned
         * out to say different things in different years: the import writes `Bevers of Zeehonden`
         * where the sync writes what the platform configuration spells today, and the client's own
         * formula spells them a third way again. Every one of these is a tak of
         * `keeo/tak-categorie.sql`, so the two lists have to keep saying the same ids.
         */
        it('weighs each tak of the GTP index as the formula does', () => {
            const sql = expressionOf(cardOf(dashboards, 'eenheden', 'eenheid-gtp').sql);
            const categories = cardOf(dashboards, 'eenheden', 'eenheid-gtp').sql;

            for (const [tak, term] of [
                ['Bevers, Zeehonden, Eekhoorns en Welpen', "( COUNT(DISTINCT CASE WHEN tak_id = 'f274a949-9318-4c2b-ae35-e50114efe686' THEN member_id END) + COUNT(DISTINCT CASE WHEN tak_id = '316ea554-675a-493e-a152-365012851ae3' THEN member_id END) ) / 3"],
                ['Wolven', "+ COUNT(DISTINCT CASE WHEN tak_id = '01d62f7d-c3fa-4314-a33a-21da526a35ff' THEN member_id END)"],
                ['JVG/JG-A', "+ COUNT(DISTINCT CASE WHEN tak_id = '57143f32-e4d2-46a7-96e2-9bf82f121e1c' THEN member_id END)"],
                ['VG/G-J', "+ 2 * COUNT(DISTINCT CASE WHEN tak_id = '0eacf56f-3a1d-4e15-bebc-2bc66fc74c7a' THEN member_id END)"],
                ['Seniors', "+ 3 * COUNT(DISTINCT CASE WHEN tak_id = 'b2275ec6-04ad-4232-bfe3-0eefed97f83b' THEN member_id END)"],
                ['Leiding', "+ COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END)"],
                ['omkaderingscijfer', "- 2 * COUNT(DISTINCT CASE WHEN tak_category = 'child' THEN member_id END) / NULLIF(COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END), 0)"],
            ]) {
                expect(`${tak}: ${sql.includes(term)}`).toEqual(`${tak}: true`);
            }

            // No tak is weighed by a name any more, and every id it weighs is one the categories name
            // as kinderen -- the index has no term for anything else.
            expect(sql).not.toContain('`Tak` =');
            for (const [, term] of [...sql.matchAll(/tak_id = '([0-9a-f-]{36})'/g)].map(match => [match[0], match[1]])) {
                expect(`${term} is kinderen: ${new RegExp(`WHEN '${term}' THEN 'child'`).test(categories)}`).toEqual(`${term} is kinderen: true`);
            }
        });

        /**
         * Ravot weighs the same index by the age a lid reaches in the werkjaar rather than by their
         * tak, counts a leider as one and a half, and subtracts an omkaderingscijfer over the
         * kinderen under seventeen alone. Kept here for the same reason as the weights above: a
         * wrong one is a plausible number rather than a failure.
         */
        it('weighs each leeftijd of the GTP index as the ravot formula does', () => {
            const sql = cardOf(ravotDashboards, 'eenheden', 'eenheid-gtp').sql.replaceAll(/\s+/g, ' ');

            for (const [bucket, term] of [
                ['jonger dan 10', "ROUND( COUNT(DISTINCT CASE WHEN tak_category = 'child' AND leeftijd < 10 THEN member_id END) / 3"],
                ['10 tot 13', "+ COUNT(DISTINCT CASE WHEN tak_category = 'child' AND leeftijd BETWEEN 10 AND 13 THEN member_id END)"],
                ['14 tot 15', "+ 2 * COUNT(DISTINCT CASE WHEN tak_category = 'child' AND leeftijd BETWEEN 14 AND 15 THEN member_id END)"],
                ['16', "+ 3 * COUNT(DISTINCT CASE WHEN tak_category = 'child' AND leeftijd = 16 THEN member_id END)"],
                ['Leiding', "+ 1.5 * COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END)"],
                ['omkaderingscijfer', "- 2 * COUNT(DISTINCT CASE WHEN tak_category = 'child' AND leeftijd < 17 THEN member_id END) / NULLIF(COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END), 0)"],
            ]) {
                expect(`${bucket}: ${sql.includes(term)}`).toEqual(`${bucket}: true`);
            }

            // The age says which bucket a kind falls in, never whether they are one: a leider of
            // sixteen is leiding here, and the tak weighs nothing at all.
            expect(sql).not.toContain('`Tak` =');
        });

        /**
         * What a tak counts as is the one thing about it that nothing in the administration knows,
         * and nothing in the statistics database holds either: this list is the whole answer.
         *
         * Kept here for the same reason as the weights above. A tak that falls out of the list is a
         * plausible number rather than a failure: it is still counted in the totals, and in none of
         * the three categories, so the report goes on adding up while quietly saying less.
         */
        it('names every tak of keeo in the query, which is the whole answer', () => {
            const sql = cardOf(dashboards, 'nationaal', 'totaal-leden').sql;

            for (const [tak, term] of [
                ['Bevers en Zeehonden', "WHEN 'f274a949-9318-4c2b-ae35-e50114efe686' THEN 'child'"],
                ['Welpen', "WHEN '316ea554-675a-493e-a152-365012851ae3' THEN 'child'"],
                ['Wolven', "WHEN '01d62f7d-c3fa-4314-a33a-21da526a35ff' THEN 'child'"],
                ['JVG/JG-A', "WHEN '57143f32-e4d2-46a7-96e2-9bf82f121e1c' THEN 'child'"],
                ['VG/G-J', "WHEN '0eacf56f-3a1d-4e15-bebc-2bc66fc74c7a' THEN 'child'"],
                ['Seniors', "WHEN 'b2275ec6-04ad-4232-bfe3-0eefed97f83b' THEN 'child'"],
                ['Leiding', "WHEN 'b90e0833-7047-4283-8e25-cd65c5f09129' THEN 'leader'"],
                ['Stam', "WHEN '6fc0775e-2851-4fe1-90cd-af9c74243ccd' THEN 'adult'"],
                ['Nationaal vrijwilligers', "WHEN '77c2530c-2834-4da3-83c5-1cff9cf05c7e' THEN 'adult'"],
                ['Nationaal vrijwilligers, rechtstreeks aan FOS', "WHEN 'd4bb14bf-4a52-44e4-a014-3333c5ebb36a' THEN 'adult'"],
                ['Ereleden', "WHEN '8d42d2df-7787-4959-995d-c5a85d0e48c9' THEN 'adult'"],
                ['Ondersteunende leden', "WHEN 'ac8848e9-9868-44a1-a057-2a189cce68ea' THEN 'adult'"],
            ]) {
                expect(`${tak}: ${sql.includes(term)}`).toEqual(`${tak}: true`);
            }

            // Every tak of the platform and no more: a second row for one of them would sit under the
            // first and say nothing, which reads as a correction that was never applied.
            expect(sql.match(/WHEN '[0-9a-f-]{36}' THEN/g)!.length).toBe(12);
            // Nothing behind the list: the statistics database holds no category of its own, so a tak
            // missing here is counted as nothing rather than falling back to something.
            expect(sql).not.toContain('ELSE dag.category');
        });

        /**
         * The same for ravot, whose takken divide differently: the ondersteunende leden are
         * volwassenen and may not be categorised as leiding, since the omkaderingscijfer and the GTP
         * index would then read them as leiding the kinderen of an eenheid are looked after by. The
         * aanlevering delivers them among the leiding all the same, by naming the tak itself in
         * `ravot/type-deelnemers.sql`, which only works while the category does not say it.
         */
        it('names every tak of ravot in the query, with the ondersteunende leden apart from the leiding', () => {
            const sql = cardOf(ravotDashboards, 'nationaal', 'totaal-leden').sql;

            for (const [tak, term] of [
                ['Leeuwkes, Kabouters en Sloebers', "WHEN 'bd63a6ef-d4a1-497d-87a5-d7c36b4ad220' THEN 'child'"],
                ['Springers en Pagadders', "WHEN '23607074-624b-472f-926f-c719bb44e314' THEN 'child'"],
                ['Jongknapen, Roodkapjes en Joro\'s', "WHEN '5730f613-fb72-465b-b902-45b281a0e8b8' THEN 'child'"],
                ['Knapen, Jimmers en Knimmers', "WHEN '3d56a0b2-9f4b-46ac-998b-d45a9b64cab2' THEN 'child'"],
                ['Sjo\'ers, Simmers en Jonghernieuwers', "WHEN '03680919-689c-4df1-8976-bb71758cc025' THEN 'child'"],
                ['+16', "WHEN 'bed9b513-e0ff-4cc3-a0f3-1c021fc880a9' THEN 'child'"],
                ['Hernieuwers', "WHEN '1ad6b686-d5fa-4168-8fa2-064d49f8c0e8' THEN 'child'"],
                ['Leiding', "WHEN 'e3ec8d48-0d10-4f5d-9e50-dd3151c6666b' THEN 'leader'"],
                ['Ondersteunende leden', "WHEN 'a28d290c-af71-4282-92cc-2224a18d3091' THEN 'adult'"],
            ]) {
                expect(`${tak}: ${sql.includes(term)}`).toEqual(`${tak}: true`);
            }

            expect(sql.match(/WHEN '[0-9a-f-]{36}' THEN/g)!.length).toBe(9);
            expect(sql).not.toContain('ELSE dag.category');
        });

        /**
         * A platform that names none of its takken has no answer at all -- nothing else in the
         * statistics database holds one. The report still runs and still counts its members; every
         * figure that divides leiding from kinderen is simply empty until the list is written. Both
         * platforms with a report of their own name theirs, so this reads an environment that
         * overrides nothing.
         */
        it('has no category at all in an environment that names no takken', async () => {
            const sql = cardOf(await loadReport('development'), 'nationaal', 'totaal-leden').sql;

            expect(sql).toContain('CAST(NULL AS CHAR(16)) AS category');
            expect(`names takken by id: ${/WHEN '[0-9a-f-]{36}' THEN/.test(sql)}`).toEqual('names takken by id: false');
        });

        /**
         * Both grains of `facts` read the takken through the fragment that decides the category, and
         * a card reaching for `default_age_groups` beside it would count an uncategorised tak while
         * the rest of the report has it categorised. Nothing about a card says which it does.
         */
        it('reads every tak through the fragment that decides its category', () => {
            for (const [env, tabs] of [['keeo', dashboards], ['ravot', ravotDashboards]] as const) {
                for (const card of tabs.flatMap(tab => tab.cards)) {
                    const reads = [...card.sql.matchAll(/\b(?:FROM|JOIN) default_age_groups\b/g)].map(match => match[0]);
                    const expected = card.sql.includes('takken AS (') ? ['FROM default_age_groups'] : [];

                    expect(`${env}/${card.key}: ${reads.join(' + ')}`).toEqual(`${env}/${card.key}: ${expected.join(' + ')}`);
                }
            }
        });

        /**
         * Both formulas weigh members rather than registrations, and only the fragment below them
         * makes that true: a member in two takken stands in `facts` twice, and every term of the
         * index would weigh them twice over -- as leiding and as a lid, or in two takken at once.
         * Nothing about a card says which of the two it reads, so it is checked here.
         */
        it('counts every card of the ledenstatistieken over members rather than over their registrations', () => {
            for (const [env, tabs] of [['keeo', dashboards], ['ravot', ravotDashboards]] as const) {
                for (const tab of tabs.filter(tab => tab.dashboard === undefined)) {
                    for (const card of tab.cards) {
                        const sql = card.sql.replaceAll(/\s+/g, ' ');
                        if (!sql.includes('facts AS (')) {
                            continue;
                        }

                        // What the card itself selects, past the fragments it opens with. The last of
                        // them reads `facts` to build `leden` out of it, which the card may not.
                        const query = sql.slice(sql.indexOf('WHERE g.rang = 1 )'));
                        const where = `${env} ${tab.key}/${card.key}`;

                        expect(`${where}: ${sql.includes(', leden AS (')}`).toEqual(`${where}: true`);
                        expect(`${where}: ${/\b(?:FROM|JOIN) facts\b/.test(query)}`).toEqual(`${where}: false`);
                    }
                }
            }
        });

        /**
         * The aanlevering counts inschrijvingen where the ledenstatistieken count members -- someone
         * registered at two groups is two deelnemers to the department and one lid here -- and it
         * decides what a member is from the cancelled registrations as well. It keeps its own rows.
         */
        it('leaves the aanlevering on the grain the department asks for', () => {
            const tabs = dashboards.filter(tab => tab.dashboard !== undefined);
            expect(tabs.map(tab => tab.key)).toEqual(['jeugdbewegingen']);

            for (const card of tabs[0].cards) {
                expect(`${card.key}: ${card.sql.includes(', leden AS (')}`).toEqual(`${card.key}: false`);
            }
        });

        /**
         * Which registration of a member speaks for them. Leiding beats lid, so someone leiding in one
         * tak and lid in another is leiding and nothing else; between two takken the oldest wins; and
         * the name of the tak settles what neither can, so two runs of the same query cannot pick
         * differently and report two different numbers.
         */
        it('lets the strongest registration of a member say what they are', () => {
            const sql = cardOf(dashboards, 'eenheden', 'eenheid-gtp').sql.replaceAll(/\s+/g, ' ');

            expect(sql).toContain('ROW_NUMBER() OVER ( PARTITION BY f.organization_id, f.`Scoutsjaar`, f.member_id ORDER BY '
                + "CASE f.tak_category WHEN 'leader' THEN 3 WHEN 'child' THEN 2 WHEN 'adult' THEN 1 ELSE 0 END DESC, "
                + "CASE f.effective_category WHEN 'leader' THEN 3 WHEN 'child' THEN 2 WHEN 'adult' THEN 1 ELSE 0 END DESC, "
                + 'f.tak_min_age DESC, f.`Tak` ) AS rang');
            expect(sql).toContain('WHERE g.rang = 1');
        });

        /**
         * The index subtracts the omkaderingscijfer, so the two have to count the same kinderen and
         * the same leiding: one of them falling back to the ages again would leave the figure on the
         * screen and the one inside the index quietly disagreeing. Ravot has a fragment of each to
         * keep in step, over the kinderen under seventeen its buckets weigh.
         */
        it('subtracts the same omkaderingscijfer it puts on the screen', () => {
            for (const [env, tabs, pattern, divisie] of [
                ['keeo', dashboards, /ROUND\( \( COUNT\(DISTINCT CASE WHEN tak_id.*?, 2\)/,
                    "COUNT(DISTINCT CASE WHEN tak_category = 'child' THEN member_id END) / NULLIF(COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END), 0)"],
                ['ravot', ravotDashboards, /ROUND\( COUNT\(DISTINCT CASE WHEN tak_category.*?, 2\)/,
                    "COUNT(DISTINCT CASE WHEN tak_category = 'child' AND leeftijd < 17 THEN member_id END) / NULLIF(COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END), 0)"],
            ] as const) {
                const index = cardOf(tabs, 'eenheden', 'eenheid-gtp').sql.replaceAll(/\s+/g, ' ').match(pattern)?.[0];
                const cijfer = cardOf(tabs, 'eenheden', 'eenheid-omkaderingscijfer').sql.replaceAll(/\s+/g, ' ');

                expect(`${env}: ${index?.includes(`- 2 * ${divisie}`)}`).toEqual(`${env}: true`);
                expect(`${env}: ${index?.includes('effective_category')}`).toEqual(`${env}: false`);
                expect(`${env}: ${cijfer.includes(`ROUND( ${divisie}, 2)`)}`).toEqual(`${env}: true`);
            }
        });

        /**
         * Four cards draw a GTP index, at three different grains. They only agree because they share
         * one fragment, and nothing but this notices when one grows a copy of its own -- in either
         * environment, since each has a fragment of its own to drift from.
         */
        it('computes the GTP index from one expression wherever it is shown', () => {
            for (const [env, tabs, pattern] of [
                ['keeo', dashboards, /ROUND\( \( COUNT\(DISTINCT CASE WHEN tak_id = 'f274a949-9318-4c2b-ae35-e50114efe686'.*?, 2\)/],
                ['ravot', ravotDashboards, /ROUND\( COUNT\(DISTINCT CASE WHEN tak_category = 'child' AND leeftijd < 10.*?, 2\)/],
            ] as const) {
                const expressions = [['nationaal', 'leden-per-eenheid'], ['eenheden', 'eenheid-gtp'], ['eenheden', 'eenheid-gtp-meter'], ['eenheden', 'eenheid-gtp-per-scoutsjaar']]
                    .map(([tab, key]) => cardOf(tabs, tab, key).sql.replaceAll(/\s+/g, ' ').match(pattern)?.[0]);

                expect(`${env}: ${expressions.filter(expression => expression !== undefined).length}`).toEqual(`${env}: 4`);
                expect(`${env}: ${new Set(expressions).size}`).toEqual(`${env}: 1`);
            }
        });

        /**
         * The meter says whether a GTP index is a good one, which the number beside it cannot: the
         * ranges are the ones of the report it mirrors, and they are read the same way in both
         * environments since each weighs its own figure towards the same 100.
         */
        it('divides the GTP meter into the ranges the report reads the index in', () => {
            for (const tabs of [dashboards, ravotDashboards]) {
                expect(cardOf(tabs, 'eenheden', 'eenheid-gtp-meter').segments).toEqual([0, 35, 55, 75, 95, 115, 135]);
            }
        });

        /**
         * The three ratio charts of the page are read per scoutsjaar rather than as a trend, which
         * is what a row chart draws: one bar per year, the year beside it. Metabase draws the first
         * row it is given at the top, so the sql of each of them has to come back the other way
         * round from every other card over the years -- the most recent scoutsjaar first.
         */
        it('gives the ratio charts their most recent scoutsjaar on top', () => {
            for (const key of ['eenheid-jong-versus-oud', 'eenheid-geslacht-kinderen-per-jaar', 'eenheid-geslacht-leiding-per-jaar']) {
                const card = cardOf(dashboards, 'eenheden', key);

                expect(`${key}: ${card.display}, ${/ORDER BY MIN\(period_start\)(?: DESC)?$/.exec(card.sql)?.[0]}`)
                    .toEqual(`${key}: row, ORDER BY MIN(period_start) DESC`);
            }
        });

        /**
         * Seven cards over two pages split on the geslachten, as pies and as bars. They are read
         * side by side -- the kinderen next to the leiding, this year next to the ones before -- so
         * a geslacht that changed color between two of them would be two different readings of the
         * same page.
         */
        it('draws the geslachten in one set of colors, on every card that splits on them', () => {
            const cards = dashboards.flatMap(tab => tab.cards.filter(card => card.dimensions.includes('Geslacht')));
            const expected = columnPalettes.get('Geslacht')!;

            expect(cards.map(card => card.key).length).toEqual(7);

            for (const card of cards) {
                const settings = buildVisualizationSettings(card);
                const series = settings['series_settings'] as Record<string, { color: string }> | undefined;
                const colors = settings['pie.colors'] ?? Object.fromEntries(Object.entries(series ?? {}).map(([value, setting]) => [value, setting.color]));

                expect(`${card.key}: ${JSON.stringify(colors)}`).toEqual(`${card.key}: ${JSON.stringify(expected)}`);
            }
        });

        /**
         * The colors are kept per value, and the values are written in `facts`: renaming one there
         * would leave its color on a slice that no longer exists, while the new name took whatever
         * color Metabase had left over. Both grains write them, so both are read here.
         */
        it('colors every geslacht the facts can hold', () => {
            for (const key of ['eenheid-leden-per-geslacht', 'eenheid-geslacht-kinderen-per-jaar']) {
                const written = /CASE m\.gender([\s\S]*?)END AS `Geslacht`/.exec(cardOf(dashboards, 'eenheden', key).sql);
                const values = [...(written?.[1] ?? '').matchAll(/(?:THEN|ELSE) '([^']+)'/g)].map(match => match[1]);

                expect(`${key}: ${values.sort().join(',')}`).toEqual(`${key}: ${Object.keys(columnPalettes.get('Geslacht')!).sort().join(',')}`);
            }
        });

        /**
         * A figure stands twice on the page: as a number at the top and as a meter further down. The
         * two are read side by side, so a number colored against ranges of its own would be the same
         * eenheid scoring differently depending on which of the two you looked at.
         */
        it('reads a number in the same ranges as the meter of the same figure', () => {
            for (const [number, meter] of [['eenheid-gtp', 'eenheid-gtp-meter'], ['eenheid-omkaderingscijfer', 'eenheid-omkaderingscijfer-meter']]) {
                for (const tabs of [dashboards, ravotDashboards]) {
                    const ranges = (key: string) => `${cardOf(tabs, 'eenheden', key).segments.join(',')} best ${cardOf(tabs, 'eenheden', key).best}`;

                    expect(`${number}: ${ranges(number)}`).toEqual(`${number}: ${ranges(meter)}`);
                }
            }
        });

        /**
         * The two meters of the page are read in opposite directions: a high GTP index is an eenheid
         * doing well, a high omkaderingscijfer is one leider looking after too many leden. Green
         * stands at the end each of them is doing well at, which is the whole of what `best` says.
         */
        it('reads the omkaderingscijfer meter from the end its ranges are good at', () => {
            const meter = cardOf(dashboards, 'eenheden', 'eenheid-omkaderingscijfer-meter');

            expect(meter.segments).toEqual([0, 4, 6, 8, 10, 12]);
            expect(meter.best).toEqual('low');
            expect(cardOf(dashboards, 'eenheden', 'eenheid-gtp-meter').best).toEqual('high');
        });

        /** The gauge is the one card that explains the formula, so it explains the one it draws. */
        it('describes the GTP index in the terms the environment weighs it in', () => {
            expect(cardOf(dashboards, 'eenheden', 'eenheid-gtp-meter').description).toContain("(VG's & Seniors)");
            expect(cardOf(ravotDashboards, 'eenheden', 'eenheid-gtp-meter').description).toContain('(14- tot 16-jarigen)');
        });

        /**
         * Ravot divides by the kinderen under seventeen alone, so a reader told it counts every lid
         * is reading the figure against leden it leaves out.
         */
        it('says which leden the omkaderingscijfer counts where that is not all of them', () => {
            for (const key of ['eenheid-omkaderingscijfer', 'eenheid-omkaderingscijfer-meter']) {
                expect(`${key}: ${cardOf(dashboards, 'eenheden', key).description}`).toContain('voor hoeveel leden een leider');
                expect(`${key}: ${cardOf(ravotDashboards, 'eenheden', key).description}`).toContain('voor hoeveel leden jonger dan 17 jaar een leider');
            }
        });

        /**
         * An environment says a figure in words of its own; it does not get a report of its own. Two
         * platforms reading pages that no longer hold the same cards is a report that has quietly
         * forked, which is what the shared definition exists to prevent.
         */
        it('varies what a card counts, never which cards the report holds', () => {
            const shapeOf = (tabs: ReportTab[]) => tabs.map(tab => ({
                key: tab.key,
                filters: tab.filters,
                dashboard: tab.dashboard,
                cards: tab.cards.map(card => ({ key: card.key, title: card.title, display: card.display, size: card.size, parameters: card.parameters })),
            }));

            expect(shapeOf(ravotDashboards)).toEqual(shapeOf(dashboards));
        });

        /**
         * Which environments the report is written differently for, read from the report itself. An
         * override directory or a `@` qualifier naming an environment nobody loads is read by
         * nothing and changes nothing, which a misspelling looks exactly like. Extend this when a
         * third platform starts counting something its own way.
         */
        it('varies for the environments it names and no others', async () => {
            const directory = getReportDirectory();
            const entries = await fs.readdir(path.join(directory, 'includes'), { withFileTypes: true });
            const qualifiers = new Set<string>();

            for (const file of (await fs.readdir(directory)).filter(entry => entry.endsWith('.sql'))) {
                const contents = await fs.readFile(path.join(directory, file), 'utf-8');

                for (const match of contents.matchAll(/^--[ \t]*[a-z]+@([a-z0-9-]+):/gm)) {
                    qualifiers.add(match[1]);
                }
            }

            expect(entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()).toEqual(['keeo', 'ravot']);
            expect([...qualifiers].sort()).toEqual(['ravot']);
        });

        /**
         * Three cards draw the omkaderingscijfer, and they only agree because they share one
         * fragment -- in either environment, since each has one of its own to drift from.
         */
        it('counts the omkaderingscijfer the same way wherever it is shown', () => {
            for (const [env, tabs, expression] of [
                ['keeo', dashboards, "ROUND( COUNT(DISTINCT CASE WHEN tak_category = 'child' THEN member_id END) / NULLIF(COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END), 0), 2)"],
                ['ravot', ravotDashboards, "ROUND( COUNT(DISTINCT CASE WHEN tak_category = 'child' AND leeftijd < 17 THEN member_id END) / NULLIF(COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END), 0), 2)"],
            ] as const) {
                for (const key of ['eenheid-omkaderingscijfer', 'eenheid-omkaderingscijfer-meter', 'eenheid-omkaderingscijfer-per-scoutsjaar']) {
                    const sql = cardOf(tabs, 'eenheden', key).sql.replaceAll(/\s+/g, ' ');

                    expect(`${env} ${key}: ${sql.includes(expression)}`).toEqual(`${env} ${key}: true`);
                }
            }
        });

        /**
         * Ledenbehoud counts forward: next to scoutsjaar N stands the share of N's own members that
         * was still registered in N+1, the way the client's report reads it. Turned around it is the
         * same figure shifted a year -- a plausible number rather than a failure -- so every card
         * that measures it is checked here. The last year has no year after it and drops out; left
         * in, it would read as 0% ledenbehoud instead of as missing.
         */
        it('measures ledenbehoud from the scoutsjaar it labels into the year after it', () => {
            const cards = dashboards.flatMap(dashboard => dashboard.cards
                .filter(card => card.sql.includes('LEAD(name)'))
                .map(card => [dashboard.key, card] as const));

            expect(cards.map(([dashboard, card]) => `${dashboard}/${card.key}`)).toEqual([
                'nationaal/percentage-blijvers-per-eenheid',
                'eenheden/eenheid-ledenbehoud',
                'eenheden/eenheid-ledenbehoud-per-tak',
                'eenheden/eenheid-evolutie-ledenbehoud',
                'eenheden/eenheid-evolutie-blijvers-per-tak',
            ]);

            for (const [, card] of cards) {
                const sql = card.sql.replaceAll(/\s+/g, ' ');
                const cohort = /JOIN leden huidig ON huidig\.`Scoutsjaar` = \w+\.name/.test(sql);
                const blijvers = /gebleven\.`Scoutsjaar` = \w+\.volgend/.test(sql);

                expect(`${card.key}: cohort ${cohort}, blijvers ${blijvers}, laatste jaar weg ${sql.includes('volgend IS NOT NULL')}`)
                    .toEqual(`${card.key}: cohort true, blijvers true, laatste jaar weg true`);
            }
        });

        /**
         * The page is laid out like the one it mirrors: six figures across the top, each gauge next
         * to the chart of the same figure over the years, and a pie next to each geslacht chart.
         * That pairing only holds while every row is full, since a card that no longer fits pushes
         * the one after it onto a row of its own.
         */
        it('lays the eenheden page out in the rows of the report it mirrors', () => {
            const rows = rowsOf(dashboards.find(dashboard => dashboard.key === 'eenheden')!.cards);
            const rowWith = (key: string) => rows.find(row => row.keys.includes(key))!.keys;

            expect(rows[0].keys).toEqual([
                'eenheid-totaal-leden', 'eenheid-aantal-kinderen', 'eenheid-aantal-leiding',
                'eenheid-aantal-volwassenen', 'eenheid-gtp', 'eenheid-omkaderingscijfer',
            ]);
            expect(rowWith('eenheid-gtp-meter')).toEqual(['eenheid-gtp-meter', 'eenheid-gtp-per-scoutsjaar']);
            expect(rowWith('eenheid-omkaderingscijfer-meter')).toEqual(['eenheid-omkaderingscijfer-meter', 'eenheid-omkaderingscijfer-per-scoutsjaar']);
            expect(rowWith('eenheid-kinderen-per-geslacht')).toEqual(['eenheid-geslacht-kinderen-per-jaar', 'eenheid-kinderen-per-geslacht']);
            expect(rowWith('eenheid-leiding-per-geslacht')).toEqual(['eenheid-geslacht-leiding-per-jaar', 'eenheid-leiding-per-geslacht']);
            expect(rows.filter(row => row.heights.length !== 1)).toEqual([]);
            expect(rows.filter(row => row.width !== 24)).toEqual([]);
        });

        /**
         * A Metabase table can only pin rows at its top, so a total as the last row of the ULDK table
         * would only be reached after scrolling past every eenheid. It stands under the table as a
         * card of its own instead, which stays where it is however far the table is scrolled.
         */
        it('stands the ULDK totals under the table, in the same columns', () => {
            const placed = layoutCards(dashboards.find(dashboard => dashboard.key === 'varia')!.cards);
            const [table, totals] = placed;

            expect(placed.map(entry => entry.card.key)).toEqual(['uldk', 'uldk-totaal']);
            expect(totals.row).toEqual(table.row + table.sizeY);
            expect(`${totals.sizeX} wide, ${table.sizeX} wide`).toEqual('24 wide, 24 wide');
        });

        /**
         * The totals are the columns of the table added up rather than counted again, so both cards
         * read one fragment. What is left to drift is the adding up itself: a column added to the
         * table and not to the totals leaves the row under it one short, and reads as a table that
         * does not add up.
         */
        it('adds up every column the ULDK table holds', async () => {
            const fragment = await fs.readFile(path.join(getReportDirectory(), 'includes', 'uldk.sql'), 'utf-8');
            const columns = [...fragment.matchAll(/AS `([^`]+)`/g)].map(match => match[1]).filter(column => !['Name', 'City'].includes(column));
            const summed = [...cardOf(dashboards, 'varia', 'uldk-totaal').sql.matchAll(/SUM\(`([^`]+)`\)/g)].map(match => match[1]);

            expect(summed).toEqual(columns);
            expect(`${columns.length} columns`).toEqual('8 columns');
        });

        /**
         * The netwerk page is read as two columns: the leden and the eenheden of every netwerk
         * stacked on the left, the map of where those eenheden sit beside them. The map is the one
         * card of the report that stands across two rows, and it ends exactly where the pie does.
         */
        it('stands the netwerk map beside the chart and the pie stacked next to it', () => {
            const placed = layoutCards(dashboards.find(dashboard => dashboard.key === 'netwerk')!.cards);
            const at = (key: string) => placed.find(entry => entry.card.key === key)!;

            expect(placed.map(entry => entry.card.key)).toEqual(['leden-per-netwerk', 'locatie-eenheden', 'eenheden-per-netwerk']);
            expect(at('leden-per-netwerk')).toMatchObject({ row: 0, col: 0, sizeX: 12, sizeY: 10 });
            expect(at('eenheden-per-netwerk')).toMatchObject({ row: 10, col: 0, sizeX: 12, sizeY: 6 });
            expect(at('locatie-eenheden')).toMatchObject({ row: 0, col: 12, sizeX: 12 });

            const map = at('locatie-eenheden');
            const pie = at('eenheden-per-netwerk');
            expect(map.row + map.sizeY).toEqual(pie.row + pie.sizeY);
        });

        it('gives the unit filter to the eenheden tab only, as the report does', () => {
            expect(dashboards.find(dashboard => dashboard.key === 'eenheden')!.filters).toEqual(['scoutsjaar', 'eenheid', 'aansluiting', 'ingeschreven_voor']);

            for (const key of ['nationaal', 'netwerk', 'varia']) {
                expect(`${key}: ${dashboards.find(dashboard => dashboard.key === key)!.filters.join(',')}`).toEqual(`${key}: scoutsjaar,aansluiting,ingeschreven_voor`);
            }
        });

        /**
         * The aansluiting filter stands above every dashboard, so two pages read side by side always
         * count the same members. It reaches every card that counts them, which the shared fragments
         * see to; what is left are the two sheets of the aanlevering that list which groups existed
         * in the werkjaar, a question about organizations rather than about members.
         */
        it('offers the aansluiting filter on every dashboard and to every card that counts members', () => {
            const pages = dashboards.filter(dashboard => !dashboard.hidden);

            for (const dashboard of pages) {
                expect(`${dashboard.key}: ${dashboard.filters.includes('aansluiting')}`).toEqual(`${dashboard.key}: true`);
            }

            const without = pages.flatMap(dashboard => dashboard.cards
                .filter(card => !card.parameters.includes('aansluiting'))
                .map(card => `${dashboard.key}/${card.key}`));

            expect(without).toEqual(['jeugdbewegingen/organisatie-bovenlokaal', 'jeugdbewegingen/organisatie-lokale-groep']);
        });

        /**
         * Several types at once, which is why every card takes the filter in an `IN`: Metabase writes
         * a multi-value filter out as its values, comma separated, and beside an `=` the second one
         * is a syntax error rather than a wrong figure.
         *
         * Choosing none counts every member, including everyone holding no aansluiting at all, which
         * what the dashboards open on -- so the clause is optional and disappears with the filter.
         */
        it('takes several aansluitingen at once and counts every member while none is chosen', () => {
            const cards = dashboards.flatMap(dashboard => dashboard.cards.filter(card => card.parameters.includes('aansluiting')));
            expect(cards.length).toBeGreaterThan(0);

            for (const card of cards) {
                const chosen = resolveSql(card.sql, { aansluiting: 'Volledig scoutsjaar' }).replaceAll(/\s+/g, ' ');

                expect(`${card.key}: ${resolveSql(card.sql, {}).includes('mt.name IN')}`).toEqual(`${card.key}: false`);
                expect(`${card.key}: ${chosen.includes("mt.name IN ('Volledig scoutsjaar')")}`).toEqual(`${card.key}: true`);
            }
        });

        /**
         * A registration at an eenheid is not the same thing as being a lid of it: someone can be
         * waiting for a place, or have come to a single activiteit. Which of the three the figures
         * count is the reader's, on every page of the ledenstatistieken so that two read side by side
         * count the same people.
         */
        it('offers the ingeschreven voor filter on the ledenstatistieken and to every card that counts members', () => {
            const pages = dashboards.filter(dashboard => dashboard.dashboard === undefined && !dashboard.hidden);

            for (const dashboard of pages) {
                expect(`${dashboard.key}: ${dashboard.filters.includes('ingeschreven_voor')}`).toEqual(`${dashboard.key}: true`);

                for (const card of dashboard.cards) {
                    expect(`${dashboard.key}/${card.key}: ${card.parameters.includes('ingeschreven_voor')}`).toEqual(`${dashboard.key}/${card.key}: true`);
                }
            }
        });

        /**
         * The three options, each counting the group type it names and no other. Written out here
         * because the filter offers words a reader picks from while the column holds the names the
         * administration uses, and nothing else in the report puts the two beside each other.
         *
         * Choosing none counts every registration, the way the aansluiting filter does. No dashboard
         * opens on that -- the filter starts on the leeftijdsgroepen -- so it is what a reader who
         * empties the filter asked for.
         */
        it('counts each kind of group under the name the filter offers it', () => {
            const options = { Leeftijdsgroepen: 'Membership', Activiteiten: 'EventRegistration', Wachtlijsten: 'WaitingList' };
            const offered = cardOf(dashboards, 'filters', 'ingeschreven-voor').sql;
            const card = cardOf(dashboards, 'eenheden', 'eenheid-totaal-leden');

            for (const [option, type] of Object.entries(options)) {
                expect(`${option}: ${offered.includes(`'${option}'`)}`).toEqual(`${option}: true`);
                expect(`${option}: ${card.sql.includes(`WHEN '${type}' THEN '${option}'`)}`).toEqual(`${option}: true`);
            }

            const chosen = resolveSql(card.sql, { ingeschreven_voor: 'Leeftijdsgroepen' }).replaceAll(/\s+/g, ' ');

            expect(chosen).toContain("END IN ('Leeftijdsgroepen')");
            expect(resolveSql(card.sql, {})).not.toContain('CASE g.type');
        });

        /**
         * The department counts the deelnemers of a jeugdbeweging, so the aanlevering is not asked
         * which registrations to count: someone waiting for a place has joined nothing, and someone
         * at a single activiteit is a deelnemer of that activiteit. Its dashboard shows the filter
         * nowhere, and an unconnected filter counts every registration -- so both sheets say it.
         */
        it('delivers the leeftijdsgroepen to the department and never asks which to count', () => {
            expect(dashboards.find(dashboard => dashboard.key === 'jeugdbewegingen')!.filters).not.toContain('ingeschreven_voor');

            for (const key of ['deelnemers-bovenlokaal', 'deelnemers-lokale-groep']) {
                const sql = cardOf(dashboards, 'jeugdbewegingen', key).sql;

                for (const chosen of [{}, { ingeschreven_voor: 'Wachtlijsten' }] as Record<string, string>[]) {
                    expect(`${key}: ${resolveSql(sql, chosen).includes("f.group_type = 'Membership'")}`).toEqual(`${key}: true`);
                }
            }
        });

        /**
         * A chart with a bar per eenheid has more labels than fit, and Metabase drops them all
         * rather than rotate on its own. The charts that need them say so.
         */
        it('reads how a card wants its x-axis labels drawn', () => {
            // A bar per eenheid leaves too little room to read a label at an angle: Metabase drops
            // the ones that touch, so those two stand upright.
            expect(cardOf(dashboards, 'nationaal', 'leden-per-eenheid').xLabels).toEqual('rotate-90');
            expect(cardOf(dashboards, 'nationaal', 'percentage-blijvers-per-eenheid').xLabels).toEqual('rotate-90');
            expect(cardOf(dashboards, 'nationaal', 'leden-per-tak-vergelijking').xLabels).toEqual('rotate-45');
            expect(cardOf(dashboards, 'nationaal', 'leden-per-geboortejaar').xLabels).toBeUndefined();
        });

        /**
         * A setting only counts above the query. One comment written above it pushes the whole
         * block below the line, and every setting under it would be dropped without a word.
         */
        it('rejects a setting that slipped below the query', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- A note.\n-- display: bar\nSELECT 1', 'x.sql', new Map()))
                .toThrow('has "display:" below the query');

            // Naming an environment does not make it a comment either: it is the same setting.
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: bar\n-- A note.\n-- description@ravot: Zo telt ravot\nSELECT 1', 'x.sql', new Map(), 'ravot'))
                .toThrow('has "description:" below the query');
        });

        it('ignores a setting written for an environment other than the one being loaded', () => {
            const tab = parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: table\n-- description@keeo: Alleen daar\nSELECT 1', 'x.sql', new Map(), 'ravot');

            expect(tab.cards[0].description).toBeUndefined();
        });

        it('leaves a comment that merely looks like a setting alone', () => {
            const tab = parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: table\n-- A note.\n-- see: the note above\nSELECT 1', 'x.sql', new Map());

            expect(tab.cards[0].sql).toContain('-- see: the note above');
        });

        it('rejects an x-axis setting it cannot pass on', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: bar\n-- xlabels: sideways\nSELECT 1', 'x.sql', new Map()))
                .toThrow('has xlabels "sideways"');
        });

        it('reads the boundaries a gauge is divided at', () => {
            expect(parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: gauge\n-- segments: 0, 35, 55, 75\nSELECT 1', 'x.sql', new Map()).cards[0].segments)
                .toEqual([0, 35, 55, 75]);
        });

        it('reads the boundaries a number is colored against', () => {
            expect(parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: scalar\n-- segments: 0, 4, 6, 8\n-- best: low\nSELECT 1', 'x.sql', new Map()).cards[0])
                .toMatchObject({ segments: [0, 4, 6, 8], best: 'low' });
        });

        /** Every other display drops the setting without a word, leaving a chart that looks right. */
        it('rejects ranges on a card that reads none', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: bar\n-- segments: 0, 35, 55, 75\nSELECT 1', 'x.sql', new Map()))
                .toThrow('names segments, which only a gauge or a number reads');
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: bar\n-- best: low\nSELECT 1', 'x.sql', new Map()))
                .toThrow('names best, which only a gauge or a number reads');
        });

        /** A range that ends before it starts is drawn nowhere, so the arc loses it silently. */
        it('rejects gauge ranges that do not rise', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: gauge\n-- segments: 0, 55, 35, 75\nSELECT 1', 'x.sql', new Map()))
                .toThrow('expected rising numbers');
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: gauge\n-- segments: 0, veel, 75\nSELECT 1', 'x.sql', new Map()))
                .toThrow('expected rising numbers');
        });

        it('rejects a gauge divided at fewer boundaries than it takes to draw two ranges', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: gauge\n-- segments: 0, 100\nSELECT 1', 'x.sql', new Map()))
                .toThrow('at least three boundaries');
        });

        it('rejects a gauge read from an end it cannot have', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: gauge\n-- segments: 0, 6, 12\n-- best: laag\nSELECT 1', 'x.sql', new Map()))
                .toThrow('has best "laag"');
        });

        /** Metabase draws the ranges it falls back to in its own colors, so this one colors nothing. */
        it('rejects an end to read from without ranges to color', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: gauge\n-- best: low\nSELECT 1', 'x.sql', new Map()))
                .toThrow('no segments to color');
        });

        it('rejects a height that is no height', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: bar\n-- height: hoog\nSELECT 1', 'x.sql', new Map()))
                .toThrow('has height "hoog"');
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: bar\n-- span: 0\nSELECT 1', 'x.sql', new Map()))
                .toThrow('has span "0"');
        });

        /** The rows it spans decide, so a height of its own would be read by neither. */
        it('rejects a card that spans rows and names a height as well', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: map\n-- latitude: A\n-- longitude: B\n-- span: 2\n-- height: 12\nSELECT 1', 'x.sql', new Map()))
                .toThrow('spans 2 rows and names a height');
        });

        it('rejects a filter no card can be driven by', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n-- filters: eenheid\n\n-- @card c\n-- title: C\n-- display: table\nSELECT 1', 'x.sql', new Map()))
                .toThrow('no card uses {{eenheid}}');
        });

        /**
         * The same figure is shown twice on the eenheden page, as a number and as a gauge. Under one
         * title both would be stored as the same question, and the one written last would decide what
         * both of them show.
         */
        it('rejects two cards of a tab under the same title', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card a\n-- title: C\n-- display: scalar\nSELECT 1\n\n-- @card b\n-- title: C\n-- display: gauge\nSELECT 1', 'x.sql', new Map()))
                .toThrow('two cards are titled "C"');
        });

        it('rejects a card without a title', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- display: table\nSELECT 1', 'x.sql', new Map()))
                .toThrow('"c" has no title');
        });

        /** A fragment that includes another would otherwise expand until it runs out of memory. */
        it('rejects a fragment that includes itself', () => {
            const includes = new Map([['facts', '-- @include aansluiting'], ['aansluiting', '-- @include facts']]);

            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: table\n-- @include facts\nSELECT 1', 'x.sql', includes))
                .toThrow('includes "facts" from within itself');
        });

        it('rejects an include that does not exist', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: table\n-- @include nope\nSELECT 1', 'x.sql', new Map()))
                .toThrow('report/includes/nope.sql');
        });
    });

    /**
     * The mechanism itself, on a report written for the test: the real one only varies the GTP index,
     * and what breaks here is the resolving rather than the formula.
     */
    /**
     * What a card is written as rather than what it counts: the fragments stay where they are, as the
     * references Metabase resolves against its snippets, so the definition of a lid stands in one
     * place there too and an edit to it reaches every question that reads one.
     */
    describe('snippets', () => {
        let snippets: Map<string, string>;

        beforeAll(async () => {
            snippets = new Map((await loadSnippets('keeo')).map(snippet => [snippet.name, snippet.sql]));
        });

        it('offers every shared fragment as a snippet of its own', () => {
            expect([...snippets.keys()]).toContain('facts');
            expect([...snippets.keys()]).toContain('leden');

            for (const [name, sql] of snippets) {
                expect(`${name}: ${/^[ \t]*--[ \t]*@include\b/m.test(sql)}`).toEqual(`${name}: false`);
            }
        });

        /** A fragment refers to the fragments it reads the way a card does, so neither holds a copy. */
        it('leaves a fragment inside a fragment as a reference', () => {
            expect(snippets.get('facts')).toContain('{{snippet: takken}}');
            expect(snippets.get('facts')).not.toContain('takken AS (');
        });

        it('gives a fragment the variant of the environment it was loaded for', async () => {
            const ravot = new Map((await loadSnippets('ravot')).map(snippet => [snippet.name, snippet.sql]));

            expect(ravot.get('gtp')).toContain('as ravot weighs it');
            expect(snippets.get('gtp')).not.toContain('as ravot weighs it');
        });

        it('writes a card as the fragments it reads rather than a copy of them', () => {
            const card = cardOf(dashboards, 'nationaal', 'totaal-leden');

            expect(card.snippetSql).toContain('{{snippet: facts}}');
            expect(card.snippetSql).toContain('{{snippet: leden}}');
            expect(card.snippetSql).not.toContain('all_registrations AS (');
        });

        /**
         * Metabase looks a nested reference up among the tags of the question it is running, so a
         * fragment the card only reaches through another one has to be named by the card as well.
         */
        it('names the fragments a card only reaches through another one', () => {
            const card = cardOf(dashboards, 'nationaal', 'totaal-leden');

            expect(card.snippets[0]).toEqual('facts');
            expect(card.snippets).toEqual(expect.arrayContaining(['facts', 'leden', 'takken', 'tak-categorie']));
        });

        /** The tags of a question are read off the expanded query, so a filter inside a fragment counts. */
        it('keeps a filter that only a fragment uses on the card that reads it', () => {
            const card = cardOf(dashboards, 'nationaal', 'totaal-leden');

            expect(card.snippetSql).not.toContain('{{scoutsjaar}}');
            expect(card.parameters).toContain('scoutsjaar');
        });
    });

    describe('environment variants', () => {
        const fixtures: string[] = [];

        async function writeReport(files: Record<string, string>): Promise<string> {
            const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stamhoofd-report-'));
            fixtures.push(directory);

            for (const [name, contents] of Object.entries(files)) {
                await fs.mkdir(path.join(directory, path.dirname(name)), { recursive: true });
                await fs.writeFile(path.join(directory, name), contents);
            }
            return directory;
        }

        const tab = [
            '-- @tab nationaal',
            '-- title: Nationaal',
            '',
            '-- @card leden',
            '-- title: Leden',
            '-- display: scalar',
            // Written above the unqualified one, which it still beats: the order they stand in says
            // nothing about which of the two holds.
            '-- description@ravot: Zoals ravot telt',
            '-- description: Zoals de rest telt',
            'SELECT',
            '    -- @include telling',
            '        AS `Leden`',
        ].join('\n');

        afterAll(async () => {
            await Promise.all(fixtures.map(async directory => await fs.rm(directory, { recursive: true, force: true })));
        });

        it('expands the fragment an environment overrides, and the shared one everywhere else', async () => {
            const directory = await writeReport({
                'nationaal.sql': tab,
                'includes/telling.sql': 'COUNT(*)',
                'includes/ravot/telling.sql': 'COUNT(DISTINCT member_id)',
            });

            expect(cardOf(await loadReport('ravot', directory), 'nationaal', 'leden').sql).toContain('COUNT(DISTINCT member_id)');
            expect(cardOf(await loadReport('keeo', directory), 'nationaal', 'leden').sql).toContain('COUNT(*)');
        });

        it('gives a setting to the environment it names and the plain one to the rest', async () => {
            const directory = await writeReport({ 'nationaal.sql': tab, 'includes/telling.sql': 'COUNT(*)' });

            expect(cardOf(await loadReport('ravot', directory), 'nationaal', 'leden').description).toEqual('Zoals ravot telt');
            expect(cardOf(await loadReport('keeo', directory), 'nationaal', 'leden').description).toEqual('Zoals de rest telt');
        });

        /** Nothing includes it, so a misspelled override would change nothing and say nothing. */
        it('rejects an override of a fragment no card can include', async () => {
            const directory = await writeReport({
                'nationaal.sql': tab,
                'includes/telling.sql': 'COUNT(*)',
                'includes/ravot/teling.sql': 'COUNT(DISTINCT member_id)',
            });

            await expect(loadReport('ravot', directory)).rejects.toThrow('includes/ravot/teling.sql overrides "teling"');
        });
    });

    describe('resolveSql', () => {
        it('keeps an optional clause when its parameter has a value', () => {
            expect(resolveSql('SELECT 1 [[AND name = {{scoutsjaar}}]]', { scoutsjaar: '2024 - 2025' })).toEqual("SELECT 1 AND name = '2024 - 2025'");
        });

        it('drops an optional clause when it has none, which is what Metabase does', () => {
            expect(resolveSql('SELECT 1 [[AND name = {{scoutsjaar}}]]', {})).toEqual('SELECT 1 ');
        });

        it('escapes a quote rather than ending the string', () => {
            expect(resolveSql('{{eenheid}}', { eenheid: "'t Vloedgat" })).toEqual("'''t Vloedgat'");
        });

        it('finds each parameter once, in the order it appears', () => {
            expect(parameterNames('{{b}} {{a}} {{b}}')).toEqual(['b', 'a']);
        });
    });
});
