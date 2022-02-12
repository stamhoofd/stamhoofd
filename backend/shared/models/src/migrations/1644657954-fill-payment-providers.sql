UPDATE payments set provider = "Mollie" where provider is null and method = "Bancontact";
UPDATE payments set provider = "Mollie" where provider is null and method = "CreditCard";
UPDATE payments set provider = "Mollie" where provider is null and method = "iDEAL";
UPDATE payments set provider = "Payconiq" where provider is null and method = "Payconiq";