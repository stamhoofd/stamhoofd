# Backend services

## Usage

Build, run, or test using the `go` command like you would usually. This automatically downloads all that is necessary.

## Structure

```bash
# One folder per (micro)service.
{service-name}/
    service/
        # Protobuf file describing the service gRPC.
        service.proto
        # Generated Go code from protobuf.
        service.pb.go
    # Use the same name as the service as the location of your main function.
    {service-name}.go

# Git submodules of repositories containing protobuf public interface definitions
# that can be imported by the proto files used in the services.
protos/
```

### Generating `service.pb.go`
_How to generate the Go code from the protobuf interface definitions._

1. Install [protobuf](https://github.com/protocolbuffers/protobuf):

    MacOS:

    ```bash
    brew install protobuf
    ```

    Arch Linux:

    ```bash
    yay -S protobuf
    ```

2. Install protobuf's golang code generation tool:

    ```bash
    go get -u github.com/golang/protobuf/protoc-gen-go
    ```

3. Make sure `$GOPATH/bin` has been added to your `$PATH`. This should be done in `.zshenv`, `.profile`, or one of the other configuration files of your shell.

    ```bash
    export PATH=$PATH:$GOPATH/bin
    ```

4. Generate `service.pb.go` for the service of your choice:

    ```bash
    # This assumed you are in the root of the project.
    protoc --go_out=plugins=grpc:backend --proto_path=backend backend/${SERVICE}/service/service.proto
    ```
