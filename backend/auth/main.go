//go:generate protoc --proto_path=../protos/stamhoofd --go_out=plugins=grpc:pb auth.proto email.proto
package main

import (
	"log"
	"net"
	"net/http"
	"os"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/go-chi/chi"
	"github.com/jinzhu/gorm"
	_ "github.com/jinzhu/gorm/dialects/sqlite"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
	"github.com/stamhoofd/stamhoofd/backend/auth/graphql"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
	"github.com/stamhoofd/stamhoofd/backend/auth/pb"
	"google.golang.org/grpc"
)

func main() {
	db, err := gorm.Open("sqlite3", ":memory:")
	if err != nil {
		logrus.Fatal(err)
	}
	defer db.Close()

	db.AutoMigrate(&models.User{})

	go ServeGrpc(db)
	go ServeGraphQL(db)
	go ServeStatus()

	done := make(chan bool)
	<-done
}

func ServeGrpc(db *gorm.DB) {
	authServer := &server{
		DB: db,
	}

	// listener, err
	_, err := net.Listen("tcp", os.Getenv("GRPC_PORT"))
	if err != nil {
		log.Fatalf("failed to listen: %+v", errors.WithStack(err))
	}

	grpcServer := grpc.NewServer()
	pb.RegisterAuthServer(grpcServer, authServer)

	// log.Println("Starting auth service...")
	// if err = grpcServer.Serve(listener); err != nil {
	// 	log.Fatalf("failed to serve: %+v", errors.WithStack(err))
	// }
}

func ServeGraphQL(db *gorm.DB) {
	router := chi.NewRouter()
	router.Use(Authentication(db))

	server := handler.NewDefaultServer(
		graphql.NewExecutableSchema(
			graphql.Config{
				Resolvers: &graphql.Resolver{
					DB: db,
				},
			},
		),
	)
	router.Handle("/", server)

	log.Println("Starting GraphQL server...")
	log.Fatal(http.ListenAndServe(os.Getenv("GRAPHQL_PORT"), router))
}

func ServeStatus() {
	router := chi.NewRouter()
	router.Handle("/readiness", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	router.Handle("/liveness", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))

	log.Fatal(http.ListenAndServe(os.Getenv("STATUS_PORT"), router))
}
