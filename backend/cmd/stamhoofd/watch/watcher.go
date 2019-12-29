package watch

import (
	"path/filepath"
	"strings"

	"github.com/fsnotify/fsnotify"
)

var ignoredFiles []string = []string{
	"go.mod",
	"go.sum",
	".tmp",
}

type OnChange func(event fsnotify.Event)
type OnError func(err error)

// Watch watches the service's files and automatically restarts the service
// when a file changes.
func watchPaths(onChange OnChange, onError OnError, paths ...string) error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}

	for _, path := range paths {
		if err = watcher.Add(path); err != nil {
			watcher.Close()
			return err
		}
	}

	go func(onChange OnChange, onError OnError, watcher *fsnotify.Watcher) {
		defer watcher.Close()
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}

				// Ignore chmod changes.
				if event.Op&fsnotify.Chmod != 0 {
					continue
				}

				base := filepath.Base(event.Name)
				ignored := false
				for _, ignoredFile := range ignoredFiles {
					if strings.HasSuffix(base, ignoredFile) {
						ignored = true
						break
					}
				}

				if ignored {
					continue
				}

				onChange(event)

			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}

				onError(err)
			}
		}
	}(onChange, onError, watcher)

	return nil
}
