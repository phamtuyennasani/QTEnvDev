package utils

import (
	"os"
	"path/filepath"
)

// WindowsHelperKeyPath uses a stable per-user location rather than TEMP so a
// UAC approval account cannot change the helper's authentication key.
func WindowsHelperKeyPath() string {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		localAppData = filepath.Join(os.TempDir(), "QTEnvDev")
		return filepath.Join(localAppData, "qtenvdev-helper.key")
	}
	return filepath.Join(localAppData, "QTEnvDev", "qtenvdev-helper.key")
}
