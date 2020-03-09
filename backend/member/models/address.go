package models

type Address struct {
	Model

	Street string
	// Street number.
	Number string
	// Box, apartment, or flat number.
	Premise string

	City     string
	Postcode string
	Country  string

	// Home phone number.
	Phone *string
}
