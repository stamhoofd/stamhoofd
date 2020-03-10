import XLSX from "xlsx";
import { Member } from "shared/models/Member";

export class MemberExcelExport {
    static export(members: Member[]) {
        var ws_name = "Leden";
        var wb = XLSX.utils.book_new();

        /* make worksheet */
        var ws_data = [
            [
                "Voornaam",
                "Achternaam",
                "Geslacht",
                "Geboortedatum",
                "GSM",
                "Naam ouder",
                "GSM ouder",
                "E-mailadres ouder"
            ]
        ];

        members.forEach((member: Member) => {
            var firstParent = member.parents[0];
            ws_data.push([
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
                firstParent && firstParent.mail ? firstParent.mail : "/"
            ]);

            for (let index = 1; index < member.parents.length; index++) {
                const parent = member.parents[index];
                ws_data.push([
                    "",
                    "",
                    "",
                    "",
                    "",
                    parent.name,
                    parent.phone ? parent.phone : "/",
                    parent.mail ? parent.mail : "/"
                ]);
            }
        });

        var ws = XLSX.utils.aoa_to_sheet(ws_data);

        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, ws, ws_name);

        XLSX.writeFile(wb, "leden.xlsx");
    }
}
