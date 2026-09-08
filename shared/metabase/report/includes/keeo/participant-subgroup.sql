-- description: De aparte leeftijdsgroep die de koepel naast het type wil zien in de aanlevering, als nummer: 1 voor de stam, 2 voor de ondersteunende leden, 0 voor een gewone leeftijdsgroep. Hoe lager, hoe eerder ze wint, zodat een gewone leeftijdsgroep van allebei wint. Het type zegt waaronder ze geleverd worden: de stam bij de leden, de ondersteunende leden bij de leiding.
CASE all_registrations.age_group_id
    WHEN '6fc0775e-2851-4fe1-90cd-af9c74243ccd' THEN 1  -- Stam
    WHEN 'ac8848e9-9868-44a1-a057-2a189cce68ea' THEN 2  -- Ondersteunende leden, VZW, Steuncomité of Helpende handen
    ELSE 0
END
