INSERT INTO `email_templates` (`id`, `subject`, `groupId`, `webshopId`, `organizationId`, `type`, `text`, `html`, `json`, `updatedAt`, `createdAt`) VALUES
('1b26c047-94b8-4b7c-9124-292d38da5c06', '[{{organizationName}}] Verifieer jouw e-mailadres', NULL, NULL, NULL, 'VerifyEmailWithoutCode', '{{greeting}}Verifieer jouw e-mailadres om te kunnen inloggen bij {{organizationName}}. Klik op de onderstaande link om jouw e-mailadres te bevestigen.\n\n    \n        \n            \n                \n                Bevestig e-mailadres\n                \n            \n        \n    \n\nDit is een automatische e-mail. Gelieve niet op dit e-mailadres te reageren.{{organizationName}}', '<!DOCTYPE html>\n<html>\n\n<head>\n<meta charset=\"utf-8\" />\n<meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\" />\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\" />\n<title>[{{organizationName}}] Verifieer jouw e-mailadres</title>\n<style type=\"text/css\">body {\n  color: #000716;\n  color: var(--color-dark, #000716);\n  font-family: -apple-system-body, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\";\n  font-size: 12pt;\n  line-height: 1.4;\n}\n\np {\n  margin: 0;\n  padding: 0;\n  line-height: 1.4;\n}\n\np.description {\n  color: var(--color-gray-4, #5e5e5e);\n}\np.description a, p.description a:link, p.description a:visited, p.description a:active, p.description a:hover {\n  text-decoration: underline;\n  color: var(--color-gray-4, #5e5e5e);\n}\n\nstrong {\n  font-weight: bold;\n}\n\nem {\n  font-style: italic;\n}\n\nh1 {\n  font-size: 30px;\n  font-weight: bold;\n  line-height: 1.2;\n  margin: 0;\n  padding: 0;\n}\n@media (max-width: 350px) {\n  h1 {\n    font-size: 24px;\n  }\n}\n\nh2 {\n  font-size: 20px;\n  line-height: 1.2;\n  font-weight: bold;\n  margin: 0;\n  padding: 0;\n}\n\nh3 {\n  font-size: 16px;\n  line-height: 1.2;\n  font-weight: bold;\n  margin: 0;\n  padding: 0;\n}\n\nh4 {\n  line-height: 1.2;\n  font-weight: 500;\n  margin: 0;\n  padding: 0;\n}\n\nol, ul {\n  list-style-position: outside;\n  padding-left: 30px;\n}\n\nhr {\n  height: 1px;\n  background: var(--color-border, var(--color-gray-2, #dcdcdc));\n  border-radius: 1px;\n  padding: 0;\n  margin: 20px 0;\n  outline: none;\n  border: 0;\n}\n\n.button {\n  touch-action: inherit;\n  user-select: auto;\n  cursor: pointer;\n  display: inline-block !important;\n  line-height: 42px;\n  font-size: 16px;\n  font-weight: bold;\n}\n.button:active {\n  transform: none;\n}\n\nimg {\n  max-width: 100%;\n  height: auto;\n}\n\na, a:link, a:visited, a:active, a:hover {\n  text-decoration: underline;\n  color: blue;\n}\n\n.email-data-table {\n  width: 100%;\n  border-collapse: collapse;\n}\n.email-data-table th, .email-data-table td {\n  text-align: left;\n  padding: 10px 10px 10px 0;\n  border-bottom: 1px solid var(--color-border, var(--color-gray-2, #dcdcdc));\n  vertical-align: middle;\n}\n.email-data-table th:last-child, .email-data-table td:last-child {\n  text-align: right;\n  padding-right: 0;\n}\n.email-data-table thead {\n  font-weight: bold;\n}\n.email-data-table thead th {\n  font-size: 10pt;\n}\n.email-data-table h4 ~ p {\n  padding-top: 3px;\n  opacity: 0.8;\n  font-size: 11pt;\n} hr {height: 2px;background: #e7e7e7; border-radius: 1px; padding: 0; margin: 20px 0; outline: none; border: 0;} .button.primary { margin: 0; text-decoration: none; font-size: 16px; font-weight: bold; color: {{primaryColorContrast}}; padding: 0 27px; line-height: 42px; background: {{primaryColor}}; text-align: center; border-radius: 7px; touch-action: manipulation; display: inline-block; transition: 0.2s transform, 0.2s opacity; } .button.primary:active { transform: scale(0.95, 0.95); }  .inline-link, .inline-link:link, .inline-link:visited, .inline-link:active, .inline-link:hover { margin: 0; text-decoration: underline; font-size: inherit; font-weight: inherit; color: inherit; touch-action: manipulation; } .inline-link:active { opacity: 0.5; }  .description { color: #5e5e5e; } </style>\n</head>\n\n<body>\n<p style=\"margin: 0; padding: 0; line-height: 1.4;\">{{greeting}}</p><p style=\"margin: 0; padding: 0; line-height: 1.4;\"><br></p><p style=\"margin: 0; padding: 0; line-height: 1.4;\">Verifieer jouw e-mailadres om te kunnen inloggen bij {{organizationName}}. Klik op de onderstaande link om jouw e-mailadres te bevestigen.</p><p style=\"margin: 0; padding: 0; line-height: 1.4;\"><br></p><div data-type=\"smartButton\" data-id=\"confirmEmailUrl\"><table width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin: 5px 0;\">\n<tbody><tr>\n    <td>\n        <table cellspacing=\"0\" cellpadding=\"0\">\n            <tbody><tr>\n                <td style=\"border-radius: 7px;\" bgcolor=\"{{primaryColor}}\">\n                <a class=\"button primary\" href=\"{{confirmEmailUrl}}\" target=\"\" style=\"margin: 0; text-decoration: none; font-size: 16px; font-weight: bold; color: {{primaryColorContrast}}; padding: 0 27px; line-height: 42px; background: {{primaryColor}}; text-align: center; border-radius: 7px; touch-action: manipulation; display: inline-block; transition: 0.2s transform, 0.2s opacity;\">Bevestig e-mailadres</a>\n                </td>\n            </tr>\n        </tbody></table>\n    </td>\n</tr>\n</tbody></table></div><p style=\"margin: 0; padding: 0; line-height: 1.4;\"><br></p><p style=\"margin: 0; padding: 0; line-height: 1.4;\">Dit is een automatische e-mail. Gelieve niet op dit e-mailadres te reageren.</p><p style=\"margin: 0; padding: 0; line-height: 1.4;\"><br></p><p style=\"margin: 0; padding: 0; line-height: 1.4;\">{{organizationName}}</p>\n</body>\n\n</html>', '{\"value\": {\"type\": \"doc\", \"content\": [{\"type\": \"paragraph\", \"content\": [{\"type\": \"smartVariable\", \"attrs\": {\"id\": \"greeting\"}}]}, {\"type\": \"paragraph\"}, {\"type\": \"paragraph\", \"content\": [{\"text\": \"Verifieer jouw e-mailadres om te kunnen inloggen bij \", \"type\": \"text\"}, {\"type\": \"smartVariable\", \"attrs\": {\"id\": \"organizationName\"}}, {\"text\": \". Klik op de onderstaande link om jouw e-mailadres te bevestigen.\", \"type\": \"text\"}]}, {\"type\": \"paragraph\"}, {\"type\": \"smartButton\", \"attrs\": {\"id\": \"confirmEmailUrl\"}, \"content\": [{\"text\": \"Bevestig e-mailadres\", \"type\": \"text\"}]}, {\"type\": \"paragraph\"}, {\"type\": \"paragraph\", \"content\": [{\"text\": \"Dit is een automatische e-mail. Gelieve niet op dit e-mailadres te reageren.\", \"type\": \"text\"}]}, {\"type\": \"paragraph\"}, {\"type\": \"paragraph\", \"content\": [{\"type\": \"smartVariable\", \"attrs\": {\"id\": \"organizationName\"}}]}]}, \"version\": 328}', '2024-08-29 13:29:26', '2024-08-29 13:29:26');

INSERT INTO `email_templates` (`id`, `subject`, `groupId`, `webshopId`, `organizationId`, `type`, `text`, `html`, `json`, `updatedAt`, `createdAt`) VALUES
('6594a28e-a204-401c-9bca-6d88141b07dd', '[{{organizationName}}] Verifieer jouw e-mailadres', NULL, NULL, NULL, 'VerifyEmail', '{{greeting}}Verifieer jouw e-mailadres om te kunnen inloggen bij {{organizationName}}.Vul de onderstaande code in op de website:{{confirmEmailCode}}Of klik op onderstaande link:\n\n    \n        \n            \n                \n                bevestig e-mailadres\n                \n            \n        \n    \n\nDit is een automatische e-mail. Gelieve niet op dit e-mailadres te reageren.{{organizationName}}', '<!DOCTYPE html>\n<html>\n\n<head>\n<meta charset=\"utf-8\" />\n<meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\" />\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\" />\n<title>[{{organizationName}}] Verifieer jouw e-mailadres</title>\n<style type=\"text/css\">body {\n  color: #000716;\n  color: var(--color-dark, #000716);\n  font-family: -apple-system-body, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\";\n  font-size: 12pt;\n  line-height: 1.4;\n}\n\np {\n  margin: 0;\n  padding: 0;\n  line-height: 1.4;\n}\n\np.description {\n  color: var(--color-gray-4, #5e5e5e);\n}\np.description a, p.description a:link, p.description a:visited, p.description a:active, p.description a:hover {\n  text-decoration: underline;\n  color: var(--color-gray-4, #5e5e5e);\n}\n\nstrong {\n  font-weight: bold;\n}\n\nem {\n  font-style: italic;\n}\n\nh1 {\n  font-size: 30px;\n  font-weight: bold;\n  line-height: 1.2;\n  margin: 0;\n  padding: 0;\n}\n@media (max-width: 350px) {\n  h1 {\n    font-size: 24px;\n  }\n}\n\nh2 {\n  font-size: 20px;\n  line-height: 1.2;\n  font-weight: bold;\n  margin: 0;\n  padding: 0;\n}\n\nh3 {\n  font-size: 16px;\n  line-height: 1.2;\n  font-weight: bold;\n  margin: 0;\n  padding: 0;\n}\n\nh4 {\n  line-height: 1.2;\n  font-weight: 500;\n  margin: 0;\n  padding: 0;\n}\n\nol, ul {\n  list-style-position: outside;\n  padding-left: 30px;\n}\n\nhr {\n  height: 1px;\n  background: var(--color-border, var(--color-gray-2, #dcdcdc));\n  border-radius: 1px;\n  padding: 0;\n  margin: 20px 0;\n  outline: none;\n  border: 0;\n}\n\n.button {\n  touch-action: inherit;\n  user-select: auto;\n  cursor: pointer;\n  display: inline-block !important;\n  line-height: 42px;\n  font-size: 16px;\n  font-weight: bold;\n}\n.button:active {\n  transform: none;\n}\n\nimg {\n  max-width: 100%;\n  height: auto;\n}\n\na, a:link, a:visited, a:active, a:hover {\n  text-decoration: underline;\n  color: blue;\n}\n\n.email-data-table {\n  width: 100%;\n  border-collapse: collapse;\n}\n.email-data-table th, .email-data-table td {\n  text-align: left;\n  padding: 10px 10px 10px 0;\n  border-bottom: 1px solid var(--color-border, var(--color-gray-2, #dcdcdc));\n  vertical-align: middle;\n}\n.email-data-table th:last-child, .email-data-table td:last-child {\n  text-align: right;\n  padding-right: 0;\n}\n.email-data-table thead {\n  font-weight: bold;\n}\n.email-data-table thead th {\n  font-size: 10pt;\n}\n.email-data-table h4 ~ p {\n  padding-top: 3px;\n  opacity: 0.8;\n  font-size: 11pt;\n} hr {height: 2px;background: #e7e7e7; border-radius: 1px; padding: 0; margin: 20px 0; outline: none; border: 0;} .button.primary { margin: 0; text-decoration: none; font-size: 16px; font-weight: bold; color: {{primaryColorContrast}}; padding: 0 27px; line-height: 42px; background: {{primaryColor}}; text-align: center; border-radius: 7px; touch-action: manipulation; display: inline-block; transition: 0.2s transform, 0.2s opacity; } .button.primary:active { transform: scale(0.95, 0.95); }  .inline-link, .inline-link:link, .inline-link:visited, .inline-link:active, .inline-link:hover { margin: 0; text-decoration: underline; font-size: inherit; font-weight: inherit; color: inherit; touch-action: manipulation; } .inline-link:active { opacity: 0.5; }  .description { color: #5e5e5e; } </style>\n</head>\n\n<body>\n<p style=\"margin: 0; padding: 0; line-height: 1.4;\">{{greeting}}</p><p style=\"margin: 0; padding: 0; line-height: 1.4;\"><br></p><p style=\"margin: 0; padding: 0; line-height: 1.4;\">Verifieer jouw e-mailadres om te kunnen inloggen bij {{organizationName}}.</p><p style=\"margin: 0; padding: 0; line-height: 1.4;\"><br></p><p style=\"margin: 0; padding: 0; line-height: 1.4;\">Vul de onderstaande code in op de website:</p><h1 style=\"margin: 0; padding: 0;\">{{confirmEmailCode}}</h1><p style=\"margin: 0; padding: 0; line-height: 1.4;\"><br></p><p style=\"margin: 0; padding: 0; line-height: 1.4;\">Of klik op onderstaande link:</p><div data-type=\"smartButton\" data-id=\"confirmEmailUrl\"><table width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin: 5px 0;\">\n<tbody><tr>\n    <td>\n        <table cellspacing=\"0\" cellpadding=\"0\">\n            <tbody><tr>\n                <td style=\"border-radius: 7px;\" bgcolor=\"{{primaryColor}}\">\n                <a class=\"button primary\" href=\"{{confirmEmailUrl}}\" target=\"\" style=\"margin: 0; text-decoration: none; font-size: 16px; font-weight: bold; color: {{primaryColorContrast}}; padding: 0 27px; line-height: 42px; background: {{primaryColor}}; text-align: center; border-radius: 7px; touch-action: manipulation; display: inline-block; transition: 0.2s transform, 0.2s opacity;\">bevestig e-mailadres</a>\n                </td>\n            </tr>\n        </tbody></table>\n    </td>\n</tr>\n</tbody></table></div><p style=\"margin: 0; padding: 0; line-height: 1.4;\"><br></p><p style=\"margin: 0; padding: 0; line-height: 1.4;\">Dit is een automatische e-mail. Gelieve niet op dit e-mailadres te reageren.</p><p style=\"margin: 0; padding: 0; line-height: 1.4;\"><br></p><p style=\"margin: 0; padding: 0; line-height: 1.4;\">{{organizationName}}</p>\n</body>\n\n</html>', '{\"value\": {\"type\": \"doc\", \"content\": [{\"type\": \"paragraph\", \"content\": [{\"type\": \"smartVariable\", \"attrs\": {\"id\": \"greeting\"}}]}, {\"type\": \"paragraph\"}, {\"type\": \"paragraph\", \"content\": [{\"text\": \"Verifieer jouw e-mailadres om te kunnen inloggen bij \", \"type\": \"text\"}, {\"type\": \"smartVariable\", \"attrs\": {\"id\": \"organizationName\"}}, {\"text\": \".\", \"type\": \"text\"}]}, {\"type\": \"paragraph\"}, {\"type\": \"paragraph\", \"content\": [{\"text\": \"Vul de onderstaande code in op de website:\", \"type\": \"text\"}]}, {\"type\": \"heading\", \"attrs\": {\"level\": 1}, \"content\": [{\"type\": \"smartVariable\", \"attrs\": {\"id\": \"confirmEmailCode\"}}]}, {\"type\": \"paragraph\"}, {\"type\": \"paragraph\", \"content\": [{\"text\": \"Of klik op onderstaande link:\", \"type\": \"text\"}]}, {\"type\": \"smartButton\", \"attrs\": {\"id\": \"confirmEmailUrl\"}, \"content\": [{\"text\": \"bevestig e-mailadres\", \"type\": \"text\"}]}, {\"type\": \"paragraph\"}, {\"type\": \"paragraph\", \"content\": [{\"text\": \"Dit is een automatische e-mail. Gelieve niet op dit e-mailadres te reageren.\", \"type\": \"text\"}]}, {\"type\": \"paragraph\"}, {\"type\": \"paragraph\", \"content\": [{\"type\": \"smartVariable\", \"attrs\": {\"id\": \"organizationName\"}}]}]}, \"version\": 328}', '2024-08-29 13:28:44', '2024-08-29 13:28:44');
