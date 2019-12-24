# Backend services

## Usage

Build, run, or test using the `go` command like you would usually. This automatically downloads all that is necessary.

## Communication

Communication between backend services happens via [Protocol Buffers](https://developers.google.com/protocol-buffers/).

> Protocol buffers are Google's language-neutral, platform-neutral, extensible mechanism for serializing structured data – think XML, but smaller, faster, and simpler. You define how you want your data to be structured once, then you can use special generated source code to easily write and read your structured data to and from a variety of data streams and using a variety of languages.

### Protobuf Convention

Every protobuf service file can only expose one service. This service should contain all of the RPC calls. The signature of the call should consist of the name of the call, the requested variables being the name of the call with `Request` as the suffix, and the response should have `Response` as the suffix. See the example below.

```protobuf
service MyService {
    rpc Call(CallRequest) returns (CallResponse) {}
}
```

Every message should only include the arguments it needs and the field number should always start from 1 and be incrementing.

```protobuf
message CallRequest {
    string argument = 1;
}

message CallResponse {}
```

## Structure

```bash
# One folder per (micro)service.
{service-name}/
    service/
        # Empty file to indicate this file needs to be added to Git.
        .gitkeep
        # Generated Go code from protobuf.
        {service-name}.pb.go
    # Use the same name as the service as the location of your main function.
    {service-name}.go
    # Entrypoint of the service containing the main function.
    main.go

# Importable protobug definitions.
protos/
    # All of the stamhoofd definitions.
    stamhoofd/
        # Protobuf file describing the service gRPC.
        {service-name}.proto
    # Other folders can be Git submodules containing public definitions.
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

    _Make sure you have the latest version, Ubuntu for example does not have the latest version in its repos._

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
    # This assumed you are in service's directory `backend/service_name`.
    go generate .
    ```

    In case this reports some Go error, run the command that is after `//go:generate` in the service's `main.go` file.

## Local Development

### Realize

_Run it natively and faster without a container._

Even though [Realize](https://github.com/oxequa/realize) is no longer being maintained. It is currently used to easily run all of the (micro)services. You can also opt for Skaffold, see below. The benefit of Realize is that it doesn't require Docker and can take advantage of the Go build cache. This is important when you don't have a lot of processing power. Starting it can be done like so:

```bash
➜ go get github.com/oxequa/realize
# Assumes you are inside of /backend.
➜ realize start
```

This still requires you to manually run `go generate` or the `protoc` command directly when making changes to the protobuf files of a service.


### Skaffold

_Run it in a local Kubernetes instance, comparable to production, but slower._

The other option is [Skaffold](https://skaffold.dev/), which can be used together with [minikube](https://minikube.sigs.k8s.io/). Minikube spins up a developer-friendly Kubernetes instance and skaffold handles the workflow for building, pushing, and deploying Stamhoofd.

First install [docker](https://www.docker.com/), [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/), minikube, and skaffold according to their documentation. Then start your local Kubernetes instance with minikube:

```bash
➜ minikube start
😄  minikube v1.6.2 on Arch
✨  Selecting 'virtualbox' driver from user configuration (alternates: [none])
🔥  Creating virtualbox VM (CPUs=2, Memory=2000MB, Disk=20000MB) ...
🐳  Preparing Kubernetes v1.17.0 on Docker '19.03.5' ...
💾  Downloading kubeadm v1.17.0
💾  Downloading kubelet v1.17.0
🚜  Pulling images ...
🚀  Launching Kubernetes ...
⌛  Waiting for cluster to come online ...
🏄  Done! kubectl is now configured to use "minikube"
```

Finally start Skaffold in the development mode, which allows for automatically reloading when a change is made:

```bash
# Assumes you are inside of /backend.
➜ skaffold dev
```
