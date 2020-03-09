package models

import (
	"github.com/google/uuid"
)

type Member struct {
	Model

	UserId uuid.UUID
	Groups []Group

	FirstName string
	LastName  string
	Phone     *string

	Gender    Gender
	// TODO: Change to a custom Date struct and make that struct implement the
	// Scan interface so gorm can use it: https://golang.org/pkg/database/sql/#Scanner
	Birthdate string

	AdditionalInfo string
	Address        *Address

	// Contacts do not inherit the permissions of a member
	// They can, optionally, modify a member
	Contacts []Contact
}
