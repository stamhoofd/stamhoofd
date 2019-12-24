FROM golang:1.13-alpine as builder
ARG SERVICE_NAME
RUN apk add --update \
    # protobuf and *.proto imports.
    protobuf-dev \
    # used for `go get`.
    git \
    # go-sqlite3 requires gcc.
    build-base && \
    go get -u github.com/golang/protobuf/protoc-gen-go && \
    rm -rf /var/cache/apk/*

# Cache the dependencies.
WORKDIR /src/${SERVICE_NAME}
COPY ${SERVICE_NAME}/go.mod ${SERVICE_NAME}/go.sum /src/${SERVICE_NAME}/
RUN go mod download

# Build the service.
RUN mkdir -p /src/protos /src/${SERVICE_NAME}/service
COPY protos/stamhoofd /src/protos/stamhoofd
# TODO Only use the proto files necessary.
# But use protoc instead of go generate in case of errors in the Go file.
RUN protoc --proto_path=../protos/stamhoofd --go_out=plugins=grpc:service auth.proto email.proto
COPY ${SERVICE_NAME}/ /src/${SERVICE_NAME}/
RUN go build -o /app .

# Use a different image for running it.
FROM alpine:3.11
CMD ["./app"]
COPY --from=builder /app .
