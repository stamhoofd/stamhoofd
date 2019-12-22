# Backend services

## Usage

Build, run, or test using the `go` command like you would usually. This automatically downloads all that is necessary.

## Communication

Communication between backend services happens via [Protocol Buffers](https://developers.google.com/protocol-buffers/).

> Protocol buffers are Google's language-neutral, platform-neutral, extensible mechanism for serializing structured data – think XML, but smaller, faster, and simpler. You define how you want your data to be structured once, then you can use special generated source code to easily write and read your structured data to and from a variety of data streams and using a variety of languages.

### Protobuf convention

Every protobuf service file can only expose one service. This service should contain all of the RPC calls. The signature of the call should consist of the name of the call, the requested variables being the name of the call with `Request` as the suffix, and the response should have `Response` as the suffix. See the example below.

```proto
service MyService {
    rpc Call(CallRequest) returns (CallResponse) {}
}
```

Every message should only include the arguments it needs and the field number should always start from 1 and be incrementing. The response message should always have `google.rpc.Status status` as the first field. This is to convey side information about the response like denied authorization, connection failures, and more. See the definition of [`google.rpc.Status`](TODO) for more info.

```
message CallRequest {
    string argument = 1;
}

message CallResponse {

}
```

## Structure

```bash
# One folder per (micro)service.
{service-name}/
    service/
        # Protobuf file describing the service gRPC.
        {service-name}.proto
        # Generated Go code from protobuf.
        {service-name}.pb.go
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
    # This assumed you are in service directory `backend/service_name`.
    go generate .
    ```
