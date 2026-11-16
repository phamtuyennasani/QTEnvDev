package module

import (
	"bytes"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestWriteQTEnvDevAtomicallyWithPowerShell(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("PowerShell provider fallback is Windows-specific")
	}
	directory := t.TempDir()
	target := filepath.Join(directory, "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1")
	content := []byte("# 中文 Profile\r\n")
	if err := writeQTEnvDevAtomically(target, content); err != nil {
		t.Fatal(err)
	}
	actual, err := os.ReadFile(target)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(actual, content) {
		t.Fatalf("PowerShell provider write changed bytes: %q", actual)
	}
}

func TestPowerShellProfilesTrustTheDocumentsPathWithoutTargetOwnership(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("PowerShell profiles are Windows-specific")
	}
	documents := filepath.Join(t.TempDir(), "Redirected Documents")
	manager := &ToolManager{TargetUserSID: "S-1-5-21-100-200-300-500"}
	profiles, err := manager.validateQTEnvDevPowerShellProfiles([]QTEnvDevPowerShellProfileTarget{
		{
			Edition: "windows-powershell",
			Path: filepath.Join(
				documents,
				"WindowsPowerShell",
				"Microsoft.PowerShell_profile.ps1",
			),
		},
		{
			Edition: "pwsh",
			Path:    filepath.Join(documents, "PowerShell", "Profile.ps1"),
		},
	})
	if err != nil {
		t.Fatalf("Electron's Documents path must not depend on ancestor ownership: %v", err)
	}
	if len(profiles) != 2 {
		t.Fatalf("validated profile count = %d, want 2", len(profiles))
	}
}

func TestWriteQTEnvDevAtomicallyBatchWithPowerShell(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("PowerShell provider fallback is Windows-specific")
	}
	directory := t.TempDir()
	writes := []QTEnvDevAtomicWrite{
		{
			Path: filepath.Join(directory, "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1"),
			Data: []byte("# Windows PowerShell\r\n"),
		},
		{
			Path: filepath.Join(directory, "PowerShell", "Profile.ps1"),
			Data: []byte("# PowerShell Core\r\n"),
		},
	}
	if err := writeQTEnvDevAtomicallyBatchWithPowerShell(writes); err != nil {
		t.Fatal(err)
	}
	for _, write := range writes {
		actual, err := os.ReadFile(write.Path)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(actual, write.Data) {
			t.Fatalf("PowerShell batch write changed bytes for %s: %q", write.Path, actual)
		}
	}
}

func TestReconcileQTEnvDevProfileIsIdempotent(t *testing.T) {
	initial := "function prompt { 'custom' }\r\n"
	first, changed, err := reconcileQTEnvDevProfile(initial, `C:\QTEnvDev-Data\bin\qtenvdev.ps1`)
	if err != nil {
		t.Fatal(err)
	}
	if !changed {
		t.Fatal("first integration write must add the QTEnvDev marker block")
	}
	if !strings.Contains(first, QTEnvDevProfileMarkerBegin) || !strings.Contains(first, "\r\n") {
		t.Fatalf("profile block was not appended with its original line ending: %q", first)
	}
	second, changed, err := reconcileQTEnvDevProfile(first, `C:\QTEnvDev-Data\bin\qtenvdev.ps1`)
	if err != nil {
		t.Fatal(err)
	}
	if changed || second != first {
		t.Fatal("reapplying the same QTEnvDev profile integration must be a no-op")
	}

	updated, changed, err := reconcileQTEnvDevProfile(first, `D:\QTEnvDev-Data\bin\qtenvdev.ps1`)
	if err != nil {
		t.Fatal(err)
	}
	if !changed || strings.Count(updated, QTEnvDevProfileMarkerBegin) != 1 || !strings.Contains(updated, `D:\QTEnvDev-Data\bin\qtenvdev.ps1`) {
		t.Fatalf("profile marker block was not replaced safely: %q", updated)
	}
}

func TestQTEnvDevProfileEncodingRoundTrip(t *testing.T) {
	content := "# 中文 Profile\n"
	for _, encoding := range []QTEnvDevProfileEncoding{
		QTEnvDevProfileEncodingUTF8,
		QTEnvDevProfileEncodingUTF8BOM,
		QTEnvDevProfileEncodingUTF16LE,
		QTEnvDevProfileEncodingUTF16BE,
	} {
		encoded := encodeQTEnvDevProfile(content, encoding)
		decoded, actualEncoding, err := decodeQTEnvDevProfile(encoded)
		if err != nil {
			t.Fatalf("decodeQTEnvDevProfile(%d): %v", encoding, err)
		}
		if decoded != content || actualEncoding != encoding {
			t.Fatalf("profile encoding %d did not round-trip", encoding)
		}
	}
	if !bytes.Equal(encodeQTEnvDevProfile(content, QTEnvDevProfileEncodingUTF8BOM)[:3], []byte{0xef, 0xbb, 0xbf}) {
		t.Fatal("UTF-8 BOM was not preserved")
	}
}

func TestReconcileQTEnvDevProfileRejectsPartialMarker(t *testing.T) {
	_, _, err := reconcileQTEnvDevProfile(QTEnvDevProfileMarkerBegin+"\n", `C:\QTEnvDev-Data\bin\qtenvdev.ps1`)
	if err == nil {
		t.Fatal("a partial marker block must fail instead of overwriting a profile tail")
	}
}

func TestReconcileQTEnvDevProfileRejectsExtraMarkerAfterCompleteBlock(t *testing.T) {
	block := QTEnvDevProfileBlock(`C:\QTEnvDev-Data\bin\qtenvdev.ps1`, "\n")
	_, _, err := reconcileQTEnvDevProfile(block+"\n"+QTEnvDevProfileMarkerBegin+"\n", `C:\QTEnvDev-Data\bin\qtenvdev.ps1`)
	if err == nil {
		t.Fatal("a complete block followed by another incomplete marker must be rejected")
	}
}

func TestReconcileQTEnvDevProfileReplacesLegacyAutoLoadBlock(t *testing.T) {
	legacy := "# QTEnvDev Auto-Load\n. \"C:\\Old-QTEnvDev\\bin\\qtenvdev.ps1\"\n"
	updated, changed, err := reconcileQTEnvDevProfile(legacy, `C:\QTEnvDev-Data\bin\qtenvdev.ps1`)
	if err != nil {
		t.Fatal(err)
	}
	if !changed || strings.Contains(updated, "C:\\Old-QTEnvDev\\bin\\qtenvdev.ps1") || strings.Count(updated, QTEnvDevProfileMarkerBegin) != 1 {
		t.Fatalf("legacy QTEnvDev auto-load block was not replaced: %q", updated)
	}
}
