package models

type ContactType int

const (
	Mother      ContactType = 0
	Father      ContactType = 1
	Guardian    ContactType = 2
	Grandparent ContactType = 3
	Family      ContactType = 4
	Friend      ContactType = 5
	Partner     ContactType = 6
)
