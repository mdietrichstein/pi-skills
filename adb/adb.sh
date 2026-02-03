#!/bin/bash
#
# ADB Skill - Android Debug Bridge wrapper for pi coding agent
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

#
# Helper Functions
#

error() {
    echo -e "${RED}Error: $1${NC}" >&2
    exit 1
}

warn() {
    echo -e "${YELLOW}Warning: $1${NC}" >&2
}

success() {
    echo -e "${GREEN}$1${NC}"
}

# Check if ADB is available
check_adb() {
    if ! command -v adb &> /dev/null; then
        error "ADB not found. Please install Android SDK platform-tools and add to PATH."
    fi
}

# Get single device or error if none/multiple
get_device() {
    local devices
    devices=$(adb devices | grep -v "^List" | grep -v "^$" | awk '{print $1}')
    local count
    count=$(echo "$devices" | grep -c . || true)
    
    if [ "$count" -eq 0 ]; then
        error "No Android devices connected. Connect a device or start an emulator."
    elif [ "$count" -gt 1 ]; then
        echo "Multiple devices connected:" >&2
        adb devices >&2
        error "Please disconnect extra devices or specify device with ADB_SERIAL env var."
    fi
    
    echo "$devices"
}

# Get device serial (from env or auto-detect)
get_serial() {
    if [ -n "$ADB_SERIAL" ]; then
        echo "$ADB_SERIAL"
    else
        get_device
    fi
}

# Run ADB command with proper device selection
adb_cmd() {
    local serial
    serial=$(get_serial)
    adb -s "$serial" "$@"
}

# Detect package name from Gradle files
detect_package() {
    # Check environment variable first
    if [ -n "$ADB_PACKAGE" ]; then
        echo "$ADB_PACKAGE"
        return 0
    fi
    
    # Search for build.gradle.kts or build.gradle
    local gradle_files
    gradle_files=$(find . -maxdepth 4 -name "build.gradle.kts" -o -name "build.gradle" 2>/dev/null | head -20)
    
    for file in $gradle_files; do
        # Try applicationId first (app modules)
        local app_id
        app_id=$(grep -E "applicationId\s*[=:]?\s*[\"']" "$file" 2>/dev/null | head -1 | sed -E "s/.*[\"']([^\"']+)[\"'].*/\1/")
        if [ -n "$app_id" ]; then
            echo "$app_id"
            return 0
        fi
        
        # Try namespace (library modules or newer style)
        local namespace
        namespace=$(grep -E "namespace\s*[=:]?\s*[\"']" "$file" 2>/dev/null | head -1 | sed -E "s/.*[\"']([^\"']+)[\"'].*/\1/")
        if [ -n "$namespace" ]; then
            echo "$namespace"
            return 0
        fi
    done
    
    return 1
}

# Get package, with fallback to argument or error
get_package() {
    local explicit_package="$1"
    
    if [ -n "$explicit_package" ]; then
        echo "$explicit_package"
        return 0
    fi
    
    local detected
    if detected=$(detect_package); then
        echo "$detected"
        return 0
    fi
    
    error "Could not detect package name. Specify it explicitly or set ADB_PACKAGE env var."
}

# Find Gradle wrapper
find_gradlew() {
    if [ -f "./gradlew" ]; then
        echo "./gradlew"
    elif [ -f "../gradlew" ]; then
        echo "../gradlew"
    else
        error "Could not find gradlew. Are you in an Android project directory?"
    fi
}

# Detect main activity from APK or manifest
detect_main_activity() {
    local package="$1"
    
    # Try to get it from the installed app
    local activity
    activity=$(adb_cmd shell "cmd package resolve-activity --brief $package" 2>/dev/null | tail -1)
    
    if [ -n "$activity" ] && [[ "$activity" == *"/"* ]]; then
        echo "$activity"
        return 0
    fi
    
    # Fallback: try common patterns
    echo "${package}/.MainActivity"
}

#
# Commands
#

cmd_devices() {
    check_adb
    adb devices -l
}

cmd_info() {
    check_adb
    local serial
    serial=$(get_serial)
    
    echo "Device: $(adb -s "$serial" shell getprop ro.product.model)"
    echo "Manufacturer: $(adb -s "$serial" shell getprop ro.product.manufacturer)"
    echo "Android Version: $(adb -s "$serial" shell getprop ro.build.version.release)"
    echo "API Level: $(adb -s "$serial" shell getprop ro.build.version.sdk)"
    echo "Build: $(adb -s "$serial" shell getprop ro.build.display.id)"
    
    # Screen info
    local wm_size
    wm_size=$(adb -s "$serial" shell wm size 2>/dev/null | head -1)
    local wm_density
    wm_density=$(adb -s "$serial" shell wm density 2>/dev/null | head -1)
    echo "Screen: $wm_size"
    echo "Density: $wm_density"
}

cmd_install() {
    check_adb
    local apk="$1"
    
    if [ -z "$apk" ]; then
        error "Usage: adb.sh install <apk-file>"
    fi
    
    if [ ! -f "$apk" ]; then
        error "APK file not found: $apk"
    fi
    
    echo "Installing $apk..."
    adb_cmd install -r -g "$apk"
    success "Installed successfully"
}

cmd_uninstall() {
    check_adb
    local package
    package=$(get_package "$1")
    
    echo "Uninstalling $package..."
    adb_cmd uninstall "$package"
    success "Uninstalled successfully"
}

cmd_clear() {
    check_adb
    local package
    package=$(get_package "$1")
    
    echo "Clearing data for $package..."
    adb_cmd shell pm clear "$package"
    success "Data cleared"
}

cmd_stop() {
    check_adb
    local package
    package=$(get_package "$1")
    
    echo "Force stopping $package..."
    adb_cmd shell am force-stop "$package"
    success "App stopped"
}

cmd_packages() {
    check_adb
    local filter="-3"  # Third-party by default
    
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --all) filter="" ;;
            --system) filter="-s" ;;
            *) ;;
        esac
        shift
    done
    
    adb_cmd shell pm list packages $filter | sed 's/package://' | sort
}

cmd_logcat() {
    check_adb
    local seconds=""
    local do_clear=false
    local tag_filter=""
    local level_filter=""
    local package_filter=false
    
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --seconds)
                seconds="$2"
                shift 2
                ;;
            --clear)
                do_clear=true
                shift
                ;;
            --tag)
                tag_filter="$2"
                shift 2
                ;;
            --level)
                level_filter="$2"
                shift 2
                ;;
            --package)
                package_filter=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    if [ "$do_clear" = true ]; then
        adb_cmd logcat -c
        success "Logcat buffer cleared"
        return 0
    fi
    
    # Build filter spec
    local filter_spec=""
    
    if [ -n "$tag_filter" ]; then
        local level="${level_filter:-V}"
        filter_spec="${tag_filter}:${level} *:S"
    elif [ -n "$level_filter" ]; then
        filter_spec="*:${level_filter}"
    fi
    
    # Package filtering uses --pid
    local pid_filter=""
    if [ "$package_filter" = true ]; then
        local package
        package=$(get_package "")
        local pid
        pid=$(adb_cmd shell pidof "$package" 2>/dev/null || true)
        if [ -n "$pid" ]; then
            pid_filter="--pid=$pid"
        else
            warn "App not running, showing all logs"
        fi
    fi
    
    if [ -n "$seconds" ]; then
        # Timed capture
        echo "Capturing logcat for $seconds seconds..."
        timeout "$seconds" adb_cmd logcat $pid_filter $filter_spec 2>/dev/null || true
    else
        # Dump current buffer
        adb_cmd logcat -d $pid_filter $filter_spec
    fi
}

cmd_screenshot() {
    check_adb
    local output="${1:-screenshot_$(date +%Y%m%d_%H%M%S).png}"
    local remote_path="/sdcard/screenshot_tmp.png"
    
    echo "Taking screenshot..."
    adb_cmd shell screencap -p "$remote_path"
    adb_cmd pull "$remote_path" "$output"
    adb_cmd shell rm "$remote_path"
    success "Screenshot saved to $output"
}

cmd_screenrecord() {
    check_adb
    local output="${1:-screenrecord_$(date +%Y%m%d_%H%M%S).mp4}"
    local seconds=10
    
    # Parse arguments
    shift || true
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --seconds)
                seconds="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    local remote_path="/sdcard/screenrecord_tmp.mp4"
    
    echo "Recording screen for $seconds seconds..."
    adb_cmd shell "screenrecord --time-limit $seconds $remote_path"
    adb_cmd pull "$remote_path" "$output"
    adb_cmd shell rm "$remote_path"
    success "Recording saved to $output"
}

cmd_activity() {
    check_adb
    # Get current focused activity
    adb_cmd shell "dumpsys activity activities | grep -E 'mResumedActivity|mCurrentFocus' | head -2"
}

cmd_uidump() {
    check_adb
    local output="${1:-ui_hierarchy.xml}"
    local remote_path="/sdcard/ui_dump.xml"
    
    echo "Dumping UI hierarchy..."
    adb_cmd shell uiautomator dump "$remote_path"
    adb_cmd pull "$remote_path" "$output"
    adb_cmd shell rm "$remote_path"
    success "UI hierarchy saved to $output"
}

cmd_push() {
    check_adb
    local local_path="$1"
    local remote_path="$2"
    
    if [ -z "$local_path" ] || [ -z "$remote_path" ]; then
        error "Usage: adb.sh push <local-path> <remote-path>"
    fi
    
    adb_cmd push "$local_path" "$remote_path"
}

cmd_pull() {
    check_adb
    local remote_path="$1"
    local local_path="${2:-.}"
    
    if [ -z "$remote_path" ]; then
        error "Usage: adb.sh pull <remote-path> [local-path]"
    fi
    
    adb_cmd pull "$remote_path" "$local_path"
}

cmd_ls() {
    check_adb
    local path="${1:-/sdcard/}"
    adb_cmd shell "ls -la $path"
}

cmd_shell() {
    check_adb
    local command="$*"
    
    if [ -z "$command" ]; then
        error "Usage: adb.sh shell <command>"
    fi
    
    adb_cmd shell "$command"
}

cmd_build_run() {
    check_adb
    local module="${1:-app}"
    
    local gradlew
    gradlew=$(find_gradlew)
    
    local package
    package=$(get_package "")
    
    echo "Building ${module}..."
    $gradlew ":${module}:assembleDebug"
    
    # Find the APK
    local apk
    apk=$(find . -path "*/${module}/build/outputs/apk/debug/*.apk" -type f | head -1)
    
    if [ -z "$apk" ]; then
        error "Could not find built APK for module $module"
    fi
    
    echo "Installing $apk..."
    adb_cmd install -r -g "$apk"
    
    echo "Launching app..."
    local activity
    activity=$(detect_main_activity "$package")
    adb_cmd shell am start -n "$activity"
    
    success "Build, install, and launch complete"
}

cmd_build_install() {
    check_adb
    local module="${1:-app}"
    
    local gradlew
    gradlew=$(find_gradlew)
    
    echo "Building ${module}..."
    $gradlew ":${module}:assembleDebug"
    
    # Find the APK
    local apk
    apk=$(find . -path "*/${module}/build/outputs/apk/debug/*.apk" -type f | head -1)
    
    if [ -z "$apk" ]; then
        error "Could not find built APK for module $module"
    fi
    
    echo "Installing $apk..."
    adb_cmd install -r -g "$apk"
    
    success "Build and install complete"
}

cmd_tap() {
    check_adb
    local x="$1"
    local y="$2"
    
    if [ -z "$x" ] || [ -z "$y" ]; then
        error "Usage: adb.sh tap <x> <y>"
    fi
    
    adb_cmd shell input tap "$x" "$y"
}

cmd_swipe() {
    check_adb
    local x1="$1"
    local y1="$2"
    local x2="$3"
    local y2="$4"
    local duration="${5:-300}"
    
    if [ -z "$x1" ] || [ -z "$y1" ] || [ -z "$x2" ] || [ -z "$y2" ]; then
        error "Usage: adb.sh swipe <x1> <y1> <x2> <y2> [duration_ms]"
    fi
    
    adb_cmd shell input swipe "$x1" "$y1" "$x2" "$y2" "$duration"
}

cmd_text() {
    check_adb
    local text="$*"
    
    if [ -z "$text" ]; then
        error "Usage: adb.sh text <text>"
    fi
    
    # Escape special characters for shell
    local escaped
    escaped=$(echo "$text" | sed 's/ /%s/g')
    adb_cmd shell input text "$escaped"
}

cmd_key() {
    check_adb
    local key="$1"
    
    if [ -z "$key" ]; then
        error "Usage: adb.sh key <keyname>"
        echo "Common keys: back, home, menu, enter, tab, space, del"
    fi
    
    # Map friendly names to keycodes
    case "$key" in
        back)   key="KEYCODE_BACK" ;;
        home)   key="KEYCODE_HOME" ;;
        menu)   key="KEYCODE_MENU" ;;
        enter)  key="KEYCODE_ENTER" ;;
        tab)    key="KEYCODE_TAB" ;;
        space)  key="KEYCODE_SPACE" ;;
        del)    key="KEYCODE_DEL" ;;
        up)     key="KEYCODE_DPAD_UP" ;;
        down)   key="KEYCODE_DPAD_DOWN" ;;
        left)   key="KEYCODE_DPAD_LEFT" ;;
        right)  key="KEYCODE_DPAD_RIGHT" ;;
        power)  key="KEYCODE_POWER" ;;
        volup)  key="KEYCODE_VOLUME_UP" ;;
        voldown) key="KEYCODE_VOLUME_DOWN" ;;
    esac
    
    adb_cmd shell input keyevent "$key"
}

cmd_help() {
    cat << 'EOF'
ADB Skill - Android Debug Bridge wrapper

Usage: adb.sh <command> [args...]

Device Commands:
  devices                     List connected devices
  info                        Show device information

App Commands:
  install <apk>               Install APK
  uninstall [package]         Uninstall app
  clear [package]             Clear app data
  stop [package]              Force stop app
  packages [--all|--system]   List packages

Logging:
  logcat                      Dump logcat buffer
  logcat --seconds N          Capture for N seconds
  logcat --package            Filter by project package
  logcat --tag TAG            Filter by tag
  logcat --level LEVEL        Filter by level (V/D/I/W/E)
  logcat --clear              Clear logcat buffer

Screen:
  screenshot [output.png]     Take screenshot
  screenrecord [out.mp4]      Record screen (--seconds N)
  activity                    Show current activity
  uidump [output.xml]         Dump UI hierarchy

Files:
  push <local> <remote>       Push file to device
  pull <remote> [local]       Pull file from device
  ls [path]                   List files on device

Build:
  build-run [module]          Build, install, and launch
  build-install [module]      Build and install only

Input:
  tap <x> <y>                 Tap at coordinates
  swipe <x1> <y1> <x2> <y2>   Swipe gesture
  text <text>                 Input text
  key <keyname>               Send key event

Shell:
  shell <command>             Run shell command

Environment Variables:
  ADB_PACKAGE    Override auto-detected package name
  ADB_SERIAL     Target specific device serial

EOF
}

#
# Main
#

main() {
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        devices)      cmd_devices "$@" ;;
        info)         cmd_info "$@" ;;
        install)      cmd_install "$@" ;;
        uninstall)    cmd_uninstall "$@" ;;
        clear)        cmd_clear "$@" ;;
        stop)         cmd_stop "$@" ;;
        packages)     cmd_packages "$@" ;;
        logcat)       cmd_logcat "$@" ;;
        screenshot)   cmd_screenshot "$@" ;;
        screenrecord) cmd_screenrecord "$@" ;;
        activity)     cmd_activity "$@" ;;
        uidump)       cmd_uidump "$@" ;;
        push)         cmd_push "$@" ;;
        pull)         cmd_pull "$@" ;;
        ls)           cmd_ls "$@" ;;
        shell)        cmd_shell "$@" ;;
        build-run)    cmd_build_run "$@" ;;
        build-install) cmd_build_install "$@" ;;
        tap)          cmd_tap "$@" ;;
        swipe)        cmd_swipe "$@" ;;
        text)         cmd_text "$@" ;;
        key)          cmd_key "$@" ;;
        help|--help|-h) cmd_help ;;
        *)
            error "Unknown command: $command. Run 'adb.sh help' for usage."
            ;;
    esac
}

main "$@"
