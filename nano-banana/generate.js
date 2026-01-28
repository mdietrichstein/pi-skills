#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

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

Environment:
  GEMINI_API_KEY        Required. Your Google AI API key.

Examples:
  generate.js "a sunset over mountains"
  generate.js "cyberpunk city" --aspect 16:9 -o wallpaper.png
  generate.js "make it warmer" -i photo.png --model pro`);
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

	// Output the path to the generated image
	console.log(path.resolve(outputPath));
	
	// If there was accompanying text, show it on stderr
	if (textResponse) {
		console.error(`Note: ${textResponse}`);
	}

} catch (error) {
	console.error(`Error: ${error.message}`);
	process.exit(1);
}
