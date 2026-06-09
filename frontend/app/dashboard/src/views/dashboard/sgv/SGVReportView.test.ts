import { SimpleError } from "@simonbackx/simple-errors";
import { mount } from "@vue/test-utils";
import {
    MemberDetails,
    MemberWithRegistrationsBlob,
} from "@stamhoofd/structures";
import { Country } from "@stamhoofd/types/Country";
import {
    SGVMemberError,
    SGVSyncReport,
} from "../../../classes/SGVGroupAdministration";
import SGVReportView from "./SGVReportView.vue";

(globalThis as any).$t = (
    text: string,
    replacements?: Record<string, string>,
) => {
    if (!replacements) {
        return text;
    }
    return Object.entries(replacements).reduce(
        (result, [key, value]) => result.replace(`{${key}}`, value),
        text,
    );
};
(globalThis as any).$getCountry = () => Country.Belgium;

describe("SGVReportView", () => {
    const $t = (globalThis as any).$t;

    function createMember(name: string) {
        const [firstName, lastName] = name.split(" ");
        return MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName,
                lastName,
            }),
        });
    }

    function createSgvMember(firstName: string, lastName: string) {
        return {
            id: `${firstName}-${lastName}`,
            aangepast: "2025-01-01T00:00:00.000+01:00",
            persoonsgegevens: {},
            vgagegevens: {
                voornaam: firstName,
                achternaam: lastName,
                geboortedatum: "2010-01-01",
            },
            verbondsgegevens: { lidnummer: "123" },
            adressen: [],
            contacten: [],
            functies: [
                { groep: "O1234", functie: "leiding", omschrijving: "Leiding" },
            ],
        };
    }

    function mountView(report: SGVSyncReport) {
        return mount(SGVReportView, {
            props: { report },
            global: {
                mocks: { $t },
                stubs: {
                    STNavigationBar: true,
                    STToolbar: { template: '<div><slot name="right" /></div>' },
                    STList: { template: "<ul><slot /></ul>" },
                    STListItem: { template: "<li><slot /></li>" },
                },
            },
        });
    }

    test("renders report sections and member-specific errors", () => {
        const report = new SGVSyncReport();
        const created = createMember("Nieuw Lid");
        const synced = createMember("Aangepast Lid");
        const skipped = createMember("Overgeslagen Lid");
        report.markCreated(created, createSgvMember("Nieuw", "Lid") as any);
        report.markSynced(synced, createSgvMember("Aangepast", "Lid") as any);
        report.markSkipped(skipped);
        report.markDeleted({
            id: "deleted",
            firstName: "Geschrapt",
            lastName: "Lid",
            birthDay: new Date(2010, 0, 1),
            memberNumber: "456",
        });
        report.markUnmanaged(
            createMember("Leiding Stamhoofd"),
            createSgvMember("Leiding", "Stamhoofd") as any,
        );
        report.markUnmanagedMissing(createSgvMember("Leiding", "SGV") as any);
        report.warnings.push("Controleer deze waarschuwing");
        report.info.push("Functie toegekend Kapoen");
        report.addError(
            new SGVMemberError(
                created,
                new SimpleError({
                    code: "sgv_error",
                    message: "SGV error",
                    human: "Adres ontbreekt",
                }),
            ),
        );

        const wrapper = mountView(report);
        const text = wrapper.text();

        expect(text).toContain("De synchronisatie is niet volledig gelukt");
        expect(text).toContain("Fout bij Nieuw Lid");
        expect(text).toContain("Adres ontbreekt");
        expect(text).toContain("Controleer deze waarschuwing");
        expect(text).toContain("Functie toegekend Kapoen");
        expect(text).toContain(
            "Nieuwe leden toegevoegd in de groepsadministratie",
        );
        expect(text).toContain("Nieuw Lid");
        expect(text).toContain("Aangepaste leden in de groepsadministratie");
        expect(text).toContain("Aangepast Lid");
        expect(text).toContain("Geschrapt in de groepsadministratie");
        expect(text).toContain("Geschrapt Lid");
        expect(text).toContain("Overgeslagen");
        expect(text).toContain("Overgeslagen Lid");
        expect(text).toContain("Leiding in Stamhoofd");
        expect(text).toContain("Leiding Stamhoofd: Leiding");
        expect(text).toContain("Leiding niet in Stamhoofd");
        expect(text).toContain("Leiding SGV: Leiding");
    });

    test("renders success message without errors", () => {
        const wrapper = mountView(new SGVSyncReport());

        expect(wrapper.text()).toContain(
            "Kijk zelf ook nog snel alles na in de groepsadministratie.",
        );
    });
});
