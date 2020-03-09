package models

// How do you join a group?
type JoinType int

const (
	// Everyone can join the group themselves via the sign up page.
	Allowed JoinType = 0

	// You can only join via invitation.
	Invitation JoinType = 1

	// E.g. future types:
	// Administrators needs to accept your membership request.
	// Accept JoinType = 1
)
