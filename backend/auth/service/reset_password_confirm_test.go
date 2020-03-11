package service

import (
	"testing"

	"github.com/stamhoofd/stamhoofd/backend/auth/models"
)

func TestResetPasswordConfirm(t *testing.T) {
	db := database()
	defer db.Close()

	email := "name@example.com"
	password := "password"
	registeredUser, err := Register(db, email, password)
	if err != nil {
		t.Fatal(err)
	}

	_, err = RegisterConfirm(db, email, registeredUser.RegistrationToken)
	if err != nil {
		t.Fatal(err)
	}

	pr, err := ResetPassword(db, email)
	if err != nil {
		t.Fatal(err)
	}

	newPassword := "newPassword"
	user, err := ResetPasswordConfirm(db, email, pr.Token, newPassword)
	if err != nil {
		t.Fatal(err)
	}

	var passwordResets []models.PasswordReset
	db.Find(&passwordResets)

	if len(passwordResets) != 0 {
		t.Fatal("password reset was not deleted")
	}

	if user.Email != registeredUser.Email {
		t.Fatalf("Email %v was returned, expected %v", user.Email, registeredUser.Email)
	}

	_, err = Login(db, email, newPassword)
	if err != nil {
		t.Fatal("could not login with new password")
	}
}
