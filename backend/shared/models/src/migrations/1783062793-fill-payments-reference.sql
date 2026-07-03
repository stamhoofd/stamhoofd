update payments
join invoices on payments.invoiceId = invoices.id
set payments.reference = invoices.reference
where payments.invoiceId is not null
and payments.reference is NULL
and invoices.reference is not null;
