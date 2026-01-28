#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Cost tracking file location
const COST_FILE = path.join(os.homedir(), ".nano-banana-costs.json");

// Pricing per image (USD) - based on Google AI pricing
// https://ai.google.dev/pricing
const PRICING = {
	flash: 0.0315,       // Gemini 2.5 Flash Image
	pro: {
		"1K": 0.039,     // Gemini 3 Pro Image Preview - 1K
		"2K": 0.056,     // Gemini 3 Pro Image Preview - 2K
		"4K": 0.08       // Gemini 3 Pro Image Preview - 4K
	}
};

// Load current cost data
function loadCostData() {
	try {
		if (fs.existsSync(COST_FILE)) {
			return JSON.parse(fs.readFileSync(COST_FILE, "utf8"));
		}
	} catch {
		// If file is corrupted, start fresh
	}
	return {
		totalCost: 0,
		imageCount: 0,
		history: []
	};
}

// Save cost data
function saveCostData(data) {
	fs.writeFileSync(COST_FILE, JSON.stringify(data, null, 2));
}

// Get cost for current generation
function getGenerationCost(model, imageSize) {
	if (model === "flash") {
		return PRICING.flash;
	}
	return PRICING.pro[imageSize] || PRICING.pro["1K"];
}

// Format currency
function formatCost(amount) {
	return `$${amount.toFixed(4)}`;
}

// Show cost summary
function showCosts() {
	const data = loadCostData();
	console.log("\n📊 Nano Banana Cost Summary");
	console.log("═".repeat(40));
	console.log(`Total images generated: ${data.imageCount}`);
	console.log(`Total cost:             ${formatCost(data.totalCost)}`);
	
	if (data.history && data.history.length > 0) {
		console.log("\nRecent generations:");
		console.log("─".repeat(40));
		const recent = data.history.slice(-10);
		for (const entry of recent) {
			const date = new Date(entry.timestamp).toLocaleDateString();
			const promptPreview = entry.prompt.substring(0, 30) + (entry.prompt.length > 30 ? "..." : "");
			console.log(`  ${date} | ${entry.model}/${entry.size} | ${formatCost(entry.cost)} | "${promptPreview}"`);
		}
	}
	console.log("\n⚠️  Costs are estimates based on published pricing.");
	console.log("   Verify actual charges: https://ai.google.dev/pricing");
	console.log("");
}

// Reset cost tracking
function resetCosts() {
	const data = loadCostData();
	const oldTotal = data.totalCost;
	const oldCount = data.imageCount;
	
	saveCostData({
		totalCost: 0,
		imageCount: 0,
		history: []
	});
	
	console.log("✅ Cost tracking reset.");
	console.log(`   Previous total: ${formatCost(oldTotal)} (${oldCount} images)`);
}

const args = process.argv.slice(2);

// Parse arguments
let prompt = "";
let outputPath = "";
let inputPath = "";
let aspectRatio = "1:1";
let model = "flash";
let imageSize = "1K";

const validAspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"];
const validSizes = ["1K", "2K", "4K"];

for (let i = 0; i < args.length; i++) {
	const arg = args[i];
	if (arg === "-o" || arg === "--output") {
		outputPath = args[++i];
	} else if (arg === "-i" || arg === "--input") {
		inputPath = args[++i];
	} else if (arg === "--aspect") {
		aspectRatio = args[++i];
	} else if (arg === "--model") {
		model = args[++i];
	} else if (arg === "--size") {
		imageSize = args[++i];
	} else if (arg === "-h" || arg === "--help") {
		printHelp();
		process.exit(0);
	} else if (arg === "--costs") {
		showCosts();
		process.exit(0);
	} else if (arg === "--reset-costs") {
		resetCosts();
		process.exit(0);
	} else if (!arg.startsWith("-")) {
		prompt = arg;
	}
}

function printHelp() {
	console.log(`Usage: generate.js <prompt> [options]

Options:
  -o, --output <path>   Output file path (default: generated-{timestamp}.png)
  -i, --input <path>    Input image for editing
  --aspect <ratio>      Aspect ratio: ${validAspectRatios.join(", ")} (default: 1:1)
  --model <type>        Model: flash (fast) or pro (quality) (default: flash)
  --size <size>         Image size for pro model: ${validSizes.join(", ")} (default: 1K)

Cost Control:
  --costs               Show cost summary and recent generation history
  --reset-costs         Reset cost tracking to zero

Environment:
  GEMINI_API_KEY        Required. Your Google AI API key.

Examples:
  generate.js "a sunset over mountains"
  generate.js "cyberpunk city" --aspect 16:9 -o wallpaper.png
  generate.js "make it warmer" -i photo.png --model pro
  generate.js --costs`);
}

if (!prompt) {
	console.error("Error: Prompt is required.");
	printHelp();
	process.exit(1);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
	console.error("Error: GEMINI_API_KEY environment variable is required.");
	console.error("Get your API key at: https://aistudio.google.com/apikey");
	process.exit(1);
}

if (!validAspectRatios.includes(aspectRatio)) {
	console.error(`Error: Invalid aspect ratio. Valid options: ${validAspectRatios.join(", ")}`);
	process.exit(1);
}

if (model !== "flash" && model !== "pro") {
	console.error("Error: Invalid model. Use 'flash' or 'pro'.");
	process.exit(1);
}

if (!validSizes.includes(imageSize)) {
	console.error(`Error: Invalid size. Valid options: ${validSizes.join(", ")}`);
	process.exit(1);
}

// Set model name
const modelName = model === "pro" ? "gemini-3-pro-image-preview" : "gemini-2.5-flash-image";

// Generate default output path if not provided
if (!outputPath) {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	outputPath = `generated-${timestamp}.png`;
}

// Build request body
const parts = [];

// Add input image if provided (for editing)
if (inputPath) {
	if (!fs.existsSync(inputPath)) {
		console.error(`Error: Input file not found: ${inputPath}`);
		process.exit(1);
	}
	
	const imageData = fs.readFileSync(inputPath);
	const base64Image = imageData.toString("base64");
	const ext = path.extname(inputPath).toLowerCase();
	const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : 
	                 ext === ".webp" ? "image/webp" :
	                 ext === ".gif" ? "image/gif" : "image/png";
	
	parts.push({
		inline_data: {
			mime_type: mimeType,
			data: base64Image
		}
	});
}

// Add text prompt
parts.push({ text: prompt });

// Build generation config
const generationConfig = {
	responseModalities: ["IMAGE", "TEXT"],
	imageConfig: {
		aspectRatio: aspectRatio
	}
};

// Add image size for pro model
if (model === "pro") {
	generationConfig.imageConfig.imageSize = imageSize;
}

const requestBody = {
	contents: [{
		parts: parts
	}],
	generationConfig: generationConfig
};

// Make API request
const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

try {
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"x-goog-api-key": apiKey,
			"Content-Type": "application/json"
		},
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error(`Error: API request failed (HTTP ${response.status})`);
		try {
			const errorJson = JSON.parse(errorText);
			console.error(errorJson.error?.message || errorText);
		} catch {
			console.error(errorText);
		}
		process.exit(1);
	}

	const data = await response.json();

	// Check for candidates
	if (!data.candidates || data.candidates.length === 0) {
		console.error("Error: No response generated.");
		if (data.promptFeedback) {
			console.error("Feedback:", JSON.stringify(data.promptFeedback, null, 2));
		}
		process.exit(1);
	}

	// Extract image from response
	const candidate = data.candidates[0];
	const responseParts = candidate.content?.parts || [];
	
	let imageFound = false;
	let textResponse = "";

	for (const part of responseParts) {
		if (part.inlineData) {
			// Save image
			const imageBuffer = Buffer.from(part.inlineData.data, "base64");
			fs.writeFileSync(outputPath, imageBuffer);
			imageFound = true;
		} else if (part.text) {
			textResponse = part.text;
		}
	}

	if (!imageFound) {
		console.error("Error: No image in response.");
		if (textResponse) {
			console.error("Model response:", textResponse);
		}
		if (candidate.finishReason) {
			console.error("Finish reason:", candidate.finishReason);
		}
		process.exit(1);
	}

	// Calculate and track cost
	const generationCost = getGenerationCost(model, imageSize);
	const costData = loadCostData();
	
	costData.totalCost += generationCost;
	costData.imageCount += 1;
	costData.history.push({
		timestamp: new Date().toISOString(),
		prompt: prompt.substring(0, 100),
		model: model,
		size: model === "pro" ? imageSize : "1K",
		cost: generationCost
	});
	
	// Keep only last 100 entries in history
	if (costData.history.length > 100) {
		costData.history = costData.history.slice(-100);
	}
	
	saveCostData(costData);

	// Output the path to the generated image
	console.log(path.resolve(outputPath));
	
	// Display cost information
	console.error(`\n💰 Cost: ${formatCost(generationCost)} | Total bill: ${formatCost(costData.totalCost)} (${costData.imageCount} images) [estimate]`);
	
	// If there was accompanying text, show it on stderr
	if (textResponse) {
		console.error(`Note: ${textResponse}`);
	}

} catch (error) {
	console.error(`Error: ${error.message}`);
	process.exit(1);
}
