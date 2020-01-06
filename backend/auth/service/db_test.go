package service

import (
	"github.com/jinzhu/gorm"
	_ "github.com/jinzhu/gorm/dialects/sqlite"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
)

func database() *gorm.DB {
	db, err := gorm.Open("sqlite3", ":memory:")
	if err != nil {
		panic(err)
	}

	db.AutoMigrate(&models.User{})
	db.AutoMigrate(&models.PasswordReset{})

	return db
}
