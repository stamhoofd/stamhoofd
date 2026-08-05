-- Which registrations are counted, as the filter above the dashboards asks it: a registration stands
-- in a group, and the reader picks which kinds of group say someone is a lid.
--
-- Three names for the three kinds a group can be. A leeftijdsgroep is a tak of the eenheid and is
-- what the ledenstatistieken are read as; an activiteit is a single event someone registered for, and
-- a wachtlijst is a place they are waiting for. The last two are registrations at an eenheid without
-- being a lid of it, which is why the filter opens on leeftijdsgroepen alone and the other two are
-- something a reader asks for.
--
-- Said in those words rather than on `g.type` itself, because the filter is a list a reader picks
-- from and 'EventRegistration' is not a word this report uses anywhere else. A type the CASE does not
-- name falls under no option and drops out until the report says what to call it: a new kind of group
-- is nobody's lid until someone has decided that it is.
--
-- Nothing chosen drops the whole clause and counts every registration, the way the aansluiting filter
-- does. No dashboard opens that way -- the filter starts on Leeftijdsgroepen -- so it is what a
-- reader who empties the filter asked for rather than a state they can land in.
--
-- The years imported from the client's own statistics carry the default of the column, which is what
-- those years are: an export of takken and nothing else.
--
-- Belongs in a WHERE clause that has the group as `g`.
[[AND CASE g.type
        WHEN 'Membership' THEN 'Leeftijdsgroepen'
        WHEN 'EventRegistration' THEN 'Activiteiten'
        WHEN 'WaitingList' THEN 'Wachtlijsten'
    END IN ({{ingeschreven_voor}})]]
