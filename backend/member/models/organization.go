package models

type Organization struct {
	Model

	Name    string
	Memberships []Memberships
	Address Address
}
