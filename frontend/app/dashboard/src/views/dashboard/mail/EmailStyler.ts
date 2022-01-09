import { Organization } from "@stamhoofd/structures";
 
export class EmailStyler {
    static async format(html: string, subject: string, organization: Organization): Promise<{ text: string; html: string }> {
        const primaryColor = organization.meta.color ?? "#0053ff"

        const imported = ((await import(/* webpackChunkName: "email-css" */ "./email.url.scss")).default)
        const scss = imported[0][1].replaceAll("#0053ff", primaryColor)

        let styles = scss;
        const hrCSS = "height: 2px;background: #e7e7e7; border-radius: 1px; padding: 0; margin: 20px 0; outline: none; border: 0;";
        styles += " hr {"+hrCSS+"}";
            
        const buttonCSS = "margin: 0; text-decoration: none; font-size: 16px; font-weight: bold; color: white; padding: 12px 27px; background: "+primaryColor+"; text-align: center; border-radius: 5px; touch-action: manipulation; display: inline-block; transition: 0.2s transform, 0.2s opacity;";
        styles += " .button.primary { "+buttonCSS+" } .button.primary:active { transform: scale(0.95, 0.95); } ";

        const buttonDescriptionCSS = "margin: 10px 0; font-size: 14px; line-height: 1.4; font-weight: 500; color: #868686;"
        styles += " .button-description { "+buttonDescriptionCSS+" } "

        // Transform HTML into text + do replacements
        const element = document.createElement("div.email-style-apply-here")
        element.innerHTML = html

        const elements = element.querySelectorAll("span[data-type=\"smartVariable\"]")
        for (const el of elements) {
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            el.parentElement!.replaceChild(document.createTextNode("{{"+el.getAttribute("data-id")+"}}"), el)
        }


        // add force add padding and margin inline
        const blocks = element.querySelectorAll("h1,h2,h3,p")
        for (const el of blocks) {
            (el as any).style.cssText = "margin: 0; padding: 0;"
        }

        // Force HR
        const hrElements = element.querySelectorAll("hr")
        for (const el of hrElements) {
            (el as any).style.cssText = hrCSS
        }

        // Replace all buttons with tables
        const buttons = element.querySelectorAll(".button.primary")
        for (const el of buttons) {
            (el as any).style.cssText = buttonCSS
            // Old e-mail client fix for buttons
            el.insertAdjacentHTML("beforebegin", `<table width="100%" cellspacing="0" cellpadding="0">
<tr>
    <td>
        <table cellspacing="0" cellpadding="0">
            <tr>
                <td style="border-radius: 5px;" bgcolor="${primaryColor};">
                ${el.outerHTML}
                </td>
            </tr>
        </table>
    </td>
</tr>
</table>`);
            el.parentElement!.removeChild(el)
            
        }

        // Force button
        const buttonDescriptionElements = element.querySelectorAll(".button-description")
        for (const el of buttonDescriptionElements) {
            (el as any).style.cssText = buttonDescriptionCSS
        }
        

        // add empty paragraph <br>'s
        const emptyP = element.querySelectorAll("p:empty")
        for (const el of emptyP) {
            el.appendChild(document.createElement("br"))
        }


        const escapeSubject = document.createElement("div")
        escapeSubject.innerText = subject;

        html = `<!DOCTYPE html>
<html>

<head>
<meta charset="utf-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${escapeSubject.innerHTML}</title>
<style type="text/css">${styles}</style>
</head>

<body>
${element.innerHTML}
</body>

</html>`;

        return {
            html,
            text: element.innerText
        }
    }
}