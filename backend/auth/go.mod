module github.com/stamhoofd/stamhoofd/backend/auth

go 1.13

replace github.com/ory/fosite => ../../../fosite

require (
	github.com/99designs/gqlgen v0.11.2
	github.com/go-chi/chi v4.0.3+incompatible
	github.com/golang/protobuf v1.3.3
	github.com/google/martian v2.1.0+incompatible
	github.com/google/uuid v1.1.1
	github.com/jinzhu/gorm v1.9.12
	github.com/ory/fosite v0.30.2
	github.com/ory/fosite-example v0.0.0-20191125094722-21823512273f
	github.com/pkg/errors v0.9.1
	github.com/sirupsen/logrus v1.4.2
	github.com/vektah/gqlparser/v2 v2.0.1
	golang.org/x/crypto v0.0.0-20200221231518-2aa609cf4a9d
	golang.org/x/oauth2 v0.0.0-20191122200657-5d9234df094c
	google.golang.org/grpc v1.27.1
)
