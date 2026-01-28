#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import { platform } from "node:os";
import puppeteer from "puppeteer-core";

const useProfile = process.argv[2] === "--profile";

if (process.argv[2] && process.argv[2] !== "--profile") {
	console.log("Usage: browser-start.js [--profile]");
	console.log("\nOptions:");
	console.log("  --profile  Copy your default Chrome profile (cookies, logins)");
	process.exit(1);
}

// Platform-specific paths
function getChromePath() {
	if (platform() === "darwin") {
		return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
	}
	// Linux: try common Chrome/Chromium paths
	const candidates = [
		"/usr/bin/google-chrome",
		"/usr/bin/google-chrome-stable",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
		"/snap/bin/chromium",
	];
	for (const path of candidates) {
		try {
			execSync(`test -x "${path}"`, { stdio: "ignore" });
			return path;
		} catch {}
	}
	throw new Error("Chrome/Chromium not found. Install google-chrome or chromium.");
}

function getProfilePath() {
	if (platform() === "darwin") {
		return `${process.env.HOME}/Library/Application Support/Google/Chrome/`;
	}
	// Linux: try common profile locations
	const candidates = [
		`${process.env.HOME}/.config/google-chrome/`,
		`${process.env.HOME}/.config/chromium/`,
		`${process.env.HOME}/snap/chromium/common/chromium/`,
	];
	for (const path of candidates) {
		try {
			execSync(`test -d "${path}"`, { stdio: "ignore" });
			return path;
		} catch {}
	}
	return `${process.env.HOME}/.config/google-chrome/`;
}

const SCRAPING_DIR = `${process.env.HOME}/.cache/browser-tools`;

// Check if already running on :9222
try {
	const browser = await puppeteer.connect({
		browserURL: "http://localhost:9222",
		defaultViewport: null,
	});
	await browser.disconnect();
	console.log("✓ Chrome already running on :9222");
	process.exit(0);
} catch {}

// Setup profile directory
execSync(`mkdir -p "${SCRAPING_DIR}"`, { stdio: "ignore" });

// Remove SingletonLock to allow new instance
try {
	execSync(`rm -f "${SCRAPING_DIR}/SingletonLock" "${SCRAPING_DIR}/SingletonSocket" "${SCRAPING_DIR}/SingletonCookie"`, { stdio: "ignore" });
} catch {}

if (useProfile) {
	console.log("Syncing profile...");
	execSync(
		`rsync -a --delete \
			--exclude='SingletonLock' \
			--exclude='SingletonSocket' \
			--exclude='SingletonCookie' \
			--exclude='*/Sessions/*' \
			--exclude='*/Current Session' \
			--exclude='*/Current Tabs' \
			--exclude='*/Last Session' \
			--exclude='*/Last Tabs' \
			"${getProfilePath()}" "${SCRAPING_DIR}/"`,
		{ stdio: "pipe" },
	);
}

const chromePath = getChromePath();

// Start Chrome with flags to force new instance
spawn(
	chromePath,
	[
		"--remote-debugging-port=9222",
		`--user-data-dir=${SCRAPING_DIR}`,
		"--no-first-run",
		"--no-default-browser-check",
	],
	{ detached: true, stdio: "ignore" },
).unref();

// Wait for Chrome to be ready
let connected = false;
for (let i = 0; i < 30; i++) {
	try {
		const browser = await puppeteer.connect({
			browserURL: "http://localhost:9222",
			defaultViewport: null,
		});
		await browser.disconnect();
		connected = true;
		break;
	} catch {
		await new Promise((r) => setTimeout(r, 500));
	}
}

if (!connected) {
	console.error("✗ Failed to connect to Chrome");
	process.exit(1);
}

console.log(`✓ Chrome started on :9222${useProfile ? " with your profile" : ""}`);
