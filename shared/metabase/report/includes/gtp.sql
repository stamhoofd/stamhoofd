ROUND(
          ( COUNT(DISTINCT CASE WHEN tak_id = 'f274a949-9318-4c2b-ae35-e50114efe686' THEN member_id END)  -- Bevers of Zeehonden, which an eenheid's Eekhoorns are registered in
          + COUNT(DISTINCT CASE WHEN tak_id = '316ea554-675a-493e-a152-365012851ae3' THEN member_id END) ) / 3  -- Welpen
        + COUNT(DISTINCT CASE WHEN tak_id = '01d62f7d-c3fa-4314-a33a-21da526a35ff' THEN member_id END)  -- Wolven
        + COUNT(DISTINCT CASE WHEN tak_id = '57143f32-e4d2-46a7-96e2-9bf82f121e1c' THEN member_id END)  -- Jongverkenners, Jonggidsen, JVG's of Aspiranten
        + 2 * COUNT(DISTINCT CASE WHEN tak_id = '0eacf56f-3a1d-4e15-bebc-2bc66fc74c7a' THEN member_id END)  -- Verkenners, Gidsen, VG's of Juniors
        + 3 * COUNT(DISTINCT CASE WHEN tak_id = 'b2275ec6-04ad-4232-bfe3-0eefed97f83b' THEN member_id END)  -- Seniors
        + COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END)
        - 2 * COUNT(DISTINCT CASE WHEN tak_category = 'child' THEN member_id END)
            / NULLIF(COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END), 0), 2)
