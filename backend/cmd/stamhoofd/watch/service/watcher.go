package service

import (
	"path/filepath"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/sirupsen/logrus"
)

var ignoredFiles []string = []string{
	"go.mod",
	"go.sum",
	".tmp",
	"_test.go",
}

type OnChange func(event fsnotify.Event)
type OnError func(err error)
type watcher struct {
	// A debouncer is used to group together rapid saves caused by editors.
	// Editors save a new file and do a rename to make it atomic.
	debouncer *debouncer
}

func Watcher(logger *logrus.Entry) *watcher {
	return &watcher{
		debouncer: Debouncer(logger, time.Millisecond*5),
	}
}

// Watch watches the service's files and automatically restarts the service
// when a file changes.
func (w *watcher) watchPaths(onChange OnChange, onError OnError, paths ...string) error {
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

				w.debouncer.Debounce(event.Name, func() {
					onChange(event)
				})

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
