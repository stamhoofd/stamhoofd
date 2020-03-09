package models

type MemberContact struct {
	Model

	Member  Member
	Contact Contact

	// Whether the contact can manage the member and its contacts.
	CanManageMember bool
}
