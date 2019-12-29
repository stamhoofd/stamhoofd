package watch

import (
	"path/filepath"

	"github.com/BurntSushi/toml"
)

const (
	ConfigFileName = ".config.toml"
)

type Config struct {
	Protos []string
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
