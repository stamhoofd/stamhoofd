package service

import (
	"testing"

	"github.com/stamhoofd/stamhoofd/backend/auth/models"
)

func TestResetPassword(t *testing.T) {
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

	if registeredUser.ID != pr.UserID {
		t.Fatalf("PasswordReset.UserID does not match.")
	}

	var passwordResets []models.PasswordReset
	db.Find(&passwordResets)

	if len(passwordResets) != 1 {
		t.Fatal("No password reset was created.")
	}

	passwordReset := passwordResets[0]

	if passwordReset.ID != pr.ID {
		t.Fatalf("ID %v saved in database, but %v returned", passwordReset.ID, pr.ID)
	}
}
