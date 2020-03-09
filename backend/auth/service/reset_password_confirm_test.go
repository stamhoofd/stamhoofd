package service

import (
	"testing"

	"encoding/base64"

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

	pr, err := ResetPassword(db, email)
	if err != nil {
		t.Fatal(err)
	}

	newPassword := "newPassword"
	response, err := ResetPasswordConfirm(db, email, pr.User.AuthenticationToken, newPassword)
	if err != nil {
		t.Fatal(err)
	}

	var passwordResets []models.PasswordReset
	db.Find(&passwordResets)

	if len(passwordResets) != 0 {
		t.Fatal("password reset was not deleted")
	}

	if response.User.Email != registeredUser.Email {
		t.Fatalf("Email %v was returned, expected %v", response.User.Email, registeredUser.Email)
	}

	_, err = base64.URLEncoding.DecodeString(response.Token)
	if err != nil {
		t.Fatalf("no valid token generated: %v", err)
	}

	_, err = Login(db, email, newPassword)
	if err != nil {
		t.Fatal("could not login with new password")
	}
}
