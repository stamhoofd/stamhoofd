-- description: De GTP-index (Gezond Toekomst Perspectief) zoals ravot ze weegt: op de leeftijd van een lid in plaats van de leeftijdsgroep, met leiding als anderhalf. Idealiter scoort een eenheid 100 of meer.
--     leden < 10 / 3 + leden 10-13 + leden 14-15 * 2 + leden 16 * 3
--     + leiding * 1,5 - omkaderingscijfer * 2
ROUND(
          COUNT(DISTINCT CASE WHEN age_group_category = 'child' AND leeftijd < 10 THEN member_id END) / 3
        + COUNT(DISTINCT CASE WHEN age_group_category = 'child' AND leeftijd BETWEEN 10 AND 13 THEN member_id END)
        + 2 * COUNT(DISTINCT CASE WHEN age_group_category = 'child' AND leeftijd BETWEEN 14 AND 15 THEN member_id END)
        + 3 * COUNT(DISTINCT CASE WHEN age_group_category = 'child' AND leeftijd = 16 THEN member_id END)
        + 1.5 * COUNT(DISTINCT CASE WHEN age_group_category = 'leader' THEN member_id END)
        - 2 * COUNT(DISTINCT CASE WHEN age_group_category = 'child' AND leeftijd < 17 THEN member_id END)
            / NULLIF(COUNT(DISTINCT CASE WHEN age_group_category = 'leader' THEN member_id END), 0), 2)
