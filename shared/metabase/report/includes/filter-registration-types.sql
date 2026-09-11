-- description: Welke inschrijvingen meetellen voor de ledenstatistieken: die in een leeftijdsgroep, en die voor een activiteit enkel bij wie dat werkjaar in geen enkele leeftijdsgroep zit. Wachtlijsten tellen nergens mee.
`groups`.type = 'Membership'
-- Een activiteit maakt iemand lid van de eenheid die ze organiseert, maar alleen als niets anders dat
-- al doet: wie ergens in een leeftijdsgroep zit, is daar lid en komt op de activiteit van een andere
-- eenheid enkel op bezoek -- meegeteld bij allebei zou hij twee keer in de cijfers staan. Wie enkel
-- voor een activiteit ingeschreven is, wordt nergens anders geteld en hier dus wel.
OR (
    `groups`.type = 'EventRegistration'
    AND NOT EXISTS (
        SELECT 1
        FROM registrations AS lidmaatschap
        JOIN `groups` AS leeftijdsgroep
            ON leeftijdsgroep.id = lidmaatschap.groupId
           AND leeftijdsgroep.deletedAt IS NULL
           AND leeftijdsgroep.type = 'Membership'
        WHERE lidmaatschap.memberId = registrations.memberId
          AND lidmaatschap.periodId = registrations.periodId
          AND lidmaatschap.registeredAt IS NOT NULL
    )
)
