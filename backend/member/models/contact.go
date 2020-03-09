package models

import "github.com/google/uuid"

type Contact struct {
	Model

	// Optional. The ID of the user that is linked to this contact
	UserId *uuid.UUID

	Type ContactType

	FirstName string
	LastName  string

	// Required for at least one contact when the member is a minor.
	Phone *string
	// Either the Email or the UserId is set.
	Email *string

	AdditionalInfo string

	// Required for at least one contact when the member is a minor.
	Address *Address
}
