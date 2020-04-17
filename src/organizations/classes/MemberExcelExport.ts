import XLSX from "xlsx";
import { Member } from "@/shared/models/Member";

export class MemberExcelExport {
    static export(members: Member[]) {
        const wsName = "Leden";
        const wb = XLSX.utils.book_new();

        /* make worksheet */
        const wsData = [
            [
                "Voornaam",
                "Achternaam",
                "Geslacht",
                "Geboortedatum",
                "GSM",
                "Naam ouder",
                "GSM ouder",
                "E-mailadres ouder",
            ],
        ];

        members.forEach((member: Member) => {
            const firstParent = member.parents[0];
            wsData.push([
                member.firstName,
                member.lastName,
                member.gender,
                member.birthDay.getDate() +
                    "/" +
                    (member.birthDay.getMonth() + 1) +
                    "/" +
                    member.birthDay.getFullYear(),
                member.phone ? member.phone : "",
                firstParent ? firstParent.name : "/",
                firstParent && firstParent.phone ? firstParent.phone : "/",
                firstParent && firstParent.mail ? firstParent.mail : "/",
            ]);

            for (let index = 1; index < member.parents.length; index++) {
                const parent = member.parents[index];
                wsData.push([
                    "",
                    "",
                    "",
                    "",
                    "",
                    parent.name,
                    parent.phone ? parent.phone : "/",
                    parent.mail ? parent.mail : "/",
                ]);
            }
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, ws, wsName);

        XLSX.writeFile(wb, "leden.xlsx");
    }
}
