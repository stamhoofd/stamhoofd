-- description: Het omkaderingscijfer zoals ravot het telt: voor hoeveel leden jonger dan 17 jaar een leider gemiddeld dient te zorgen.
ROUND(
        COUNT(DISTINCT CASE WHEN age_group_category = 'child' AND leeftijd < 17 THEN member_id END)
        / NULLIF(COUNT(DISTINCT CASE WHEN age_group_category = 'leader' THEN member_id END), 0), 2)
