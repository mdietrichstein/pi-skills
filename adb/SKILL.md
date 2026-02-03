---
name: adb
description: Android Debug Bridge (ADB) commands for Android app development. Install/uninstall apps, view logcat, take screenshots, record screen, manage device, and build+run projects.
---

# ADB Skill

Android Debug Bridge commands for developing and debugging Android apps.

## Setup

Requires ADB to be installed and in PATH. Typically comes with Android Studio or can be installed separately.

```bash
# Verify ADB is available
adb version
```

## Package Detection

The skill auto-detects the app package name by searching for `build.gradle.kts` or `build.gradle` files and extracting `applicationId` or `namespace`.

To override, set in your project's `AGENTS.md`:
```markdown
## ADB Configuration
Package: com.example.myapp
```

Or set environment variable:
```bash
export ADB_PACKAGE="com.example.myapp"
```

## Commands

All commands use `{baseDir}/adb.sh` as the entry point.

### Device Management

```bash
# List connected devices
{baseDir}/adb.sh devices

# Get device info (model, Android version, API level, screen)
{baseDir}/adb.sh info
```

### App Management

```bash
# Install APK (auto-grants permissions)
{baseDir}/adb.sh install path/to/app.apk

# Uninstall app (uses detected package if not specified)
{baseDir}/adb.sh uninstall [package]

# Clear app data
{baseDir}/adb.sh clear [package]

# Force stop app
{baseDir}/adb.sh stop [package]

# List installed packages (third-party only by default)
{baseDir}/adb.sh packages [--all] [--system]
```

### Logging

```bash
# Dump current logcat buffer
{baseDir}/adb.sh logcat

# Capture logcat for N seconds
{baseDir}/adb.sh logcat --seconds 5

# Filter by current project package
{baseDir}/adb.sh logcat --package

# Filter by tag
{baseDir}/adb.sh logcat --tag MyTag

# Filter by level (V/D/I/W/E)
{baseDir}/adb.sh logcat --level E

# Clear logcat buffer
{baseDir}/adb.sh logcat --clear
```

### Screen Capture

```bash
# Take screenshot (saves to current directory)
{baseDir}/adb.sh screenshot [output.png]

# Record screen for N seconds (default: 10)
{baseDir}/adb.sh screenrecord [output.mp4] [--seconds N]
```

### Activity & UI

```bash
# Show current foreground activity
{baseDir}/adb.sh activity

# Dump UI hierarchy (for debugging layouts)
{baseDir}/adb.sh uidump [output.xml]
```

### File Operations

```bash
# Push file to device
{baseDir}/adb.sh push local/file.txt /sdcard/file.txt

# Pull file from device
{baseDir}/adb.sh pull /sdcard/file.txt [local/path]

# List files on device
{baseDir}/adb.sh ls /sdcard/
```

### Build & Run

```bash
# Build debug APK, install, and launch main activity
{baseDir}/adb.sh build-run [module]

# Just build and install (no launch)
{baseDir}/adb.sh build-install [module]
```

### Shell Access

```bash
# Run arbitrary shell command on device
{baseDir}/adb.sh shell "ls -la /data/local/tmp"
```

### Input Simulation

```bash
# Tap at coordinates
{baseDir}/adb.sh tap 500 800

# Swipe from (x1,y1) to (x2,y2)
{baseDir}/adb.sh swipe 500 1000 500 200

# Input text (into focused field)
{baseDir}/adb.sh text "Hello World"

# Press key (back, home, menu, enter, etc.)
{baseDir}/adb.sh key back
{baseDir}/adb.sh key home
```

## Error Handling

- If no device connected: shows helpful error
- If multiple devices connected: lists them and asks to specify
- If package not found: shows detection attempts and asks for manual input

## Examples

```bash
# Typical development workflow
{baseDir}/adb.sh build-run                    # Build and launch app
{baseDir}/adb.sh logcat --package --level E   # Watch for errors
{baseDir}/adb.sh screenshot bug.png           # Capture bug state
{baseDir}/adb.sh clear                        # Reset app state
{baseDir}/adb.sh build-run                    # Test again
```
