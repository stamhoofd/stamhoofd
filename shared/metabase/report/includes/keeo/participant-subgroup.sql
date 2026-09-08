-- description: De leeftijdsgroep die de koepel apart wil zien in de aanlevering, naast het type waaronder ze meetelt: de stam telt mee bij de leden, de ondersteunende leden bij de leiding. Niets voor een gewone leeftijdsgroep.
CASE all_registrations.age_group_id
    WHEN '6fc0775e-2851-4fe1-90cd-af9c74243ccd' THEN 'stam'                  -- Stam
    WHEN 'ac8848e9-9868-44a1-a057-2a189cce68ea' THEN 'ondersteunende leden'  -- Ondersteunende leden, VZW, Steuncomité of Helpende handen
END
