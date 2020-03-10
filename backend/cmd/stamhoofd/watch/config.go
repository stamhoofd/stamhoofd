package watch

import (
	"path/filepath"

	"github.com/BurntSushi/toml"
)

const (
	ConfigFileName = ".config.toml"
	GRPCPort       = "GRPC_PORT"
	GraphQLPort    = "GRAPHQL_PORT"
	HTTPPort       = "HTTP_PORT"
)

type Config struct {
	Protos                  []string
	Dependencies            []string
	RunCommand              []string `toml:"run_command"`
	Env                     map[string]string
	RestartWithDependencies bool `toml:"restart_with_dependencies"`
}

// NewConfig returns the config from a folder, not the direct path.
func NewConfig(folderPath string) (*Config, error) {
	config := &Config{}
	_, err := toml.DecodeFile(filepath.Join(folderPath, ConfigFileName), config)
	if err != nil {
		return nil, err
	}
	return config, nil
}

func (config *Config) GRPCPort() string {
	return config.Env[GRPCPort]
}

func (config *Config) GraphQLPort() string {
	return config.Env[GraphQLPort]
}

func (config *Config) HTTPPort() string {
	return config.Env[HTTPPort]
}
