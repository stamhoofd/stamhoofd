-- description: Het omkaderingscijfer: voor hoeveel leden een leider gemiddeld dient te zorgen. Aantal kinderen / aantal leiding.
ROUND(
        COUNT(DISTINCT CASE WHEN age_group_category = 'child' THEN member_id END)
        / NULLIF(COUNT(DISTINCT CASE WHEN age_group_category = 'leader' THEN member_id END), 0), 2)
