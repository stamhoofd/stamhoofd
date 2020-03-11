package models

type User struct {
	Model

	Email             string `gorm:"unique_index;not null"`
	Password          string
	RegistrationToken string
}
