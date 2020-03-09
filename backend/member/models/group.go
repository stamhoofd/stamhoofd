package models

type Group struct {
	Model

	// The organization this group belongs to.
	Organization Organization
	Name         string
	Description  string

	// How do you join this group
	JoinType JoinType

	// Eligible age group.
	AgeRange *AgeRange

	// Optional maximum amount of members.
	MaxMembers  *int
	Permissions []Permission

	// Price to join in cents.
	Price int
}
