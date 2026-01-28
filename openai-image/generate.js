#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

// Parse arguments
let prompt = "";
let outputPath = "";
let inputPath = "";
let maskPath = "";
let size = "auto";
let model = "gpt-image-1";
let quality = "auto";
let format = "png";
let transparent = false;
let numImages = 1;

const validSizes = ["1024x1024", "1536x1024", "1024x1536", "auto"];
const validModels = ["gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini", "dall-e-3", "dall-e-2"];
const validQualities = ["low", "medium", "high", "auto"];
const validFormats = ["png", "jpeg", "webp"];

for (let i = 0; i < args.length; i++) {
	const arg = args[i];
	if (arg === "-o" || arg === "--output") {
		outputPath = args[++i];
	} else if (arg === "-i" || arg === "--input") {
		inputPath = args[++i];
	} else if (arg === "--mask") {
		maskPath = args[++i];
	} else if (arg === "--size") {
		size = args[++i];
	} else if (arg === "--model") {
		model = args[++i];
	} else if (arg === "--quality") {
		quality = args[++i];
	} else if (arg === "--format") {
		format = args[++i];
	} else if (arg === "--transparent") {
		transparent = true;
	} else if (arg === "-n") {
		numImages = parseInt(args[++i], 10);
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
  --mask <path>         Mask image for inpainting
  --size <size>         Size: ${validSizes.join(", ")} (default: auto)
  --model <model>       Model: ${validModels.join(", ")} (default: gpt-image-1)
  --quality <quality>   Quality: ${validQualities.join(", ")} (default: auto)
  --format <format>     Format: ${validFormats.join(", ")} (default: png)
  --transparent         Enable transparent background (png/webp only)
  -n <count>            Number of images (default: 1)

Environment:
  OPENAI_API_KEY        Required. Your OpenAI API key.

Examples:
  generate.js "a sunset over mountains"
  generate.js "cyberpunk city" --size 1536x1024 -o wallpaper.png
  generate.js "add a hat" -i portrait.png --model gpt-image-1.5`);
}

if (!prompt) {
	console.error("Error: Prompt is required.");
	printHelp();
	process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
	console.error("Error: OPENAI_API_KEY environment variable is required.");
	console.error("Get your API key at: https://platform.openai.com/api-keys");
	process.exit(1);
}

if (!validSizes.includes(size)) {
	console.error(`Error: Invalid size. Valid options: ${validSizes.join(", ")}`);
	process.exit(1);
}

if (!validModels.includes(model)) {
	console.error(`Error: Invalid model. Valid options: ${validModels.join(", ")}`);
	process.exit(1);
}

if (!validQualities.includes(quality)) {
	console.error(`Error: Invalid quality. Valid options: ${validQualities.join(", ")}`);
	process.exit(1);
}

if (!validFormats.includes(format)) {
	console.error(`Error: Invalid format. Valid options: ${validFormats.join(", ")}`);
	process.exit(1);
}

if (transparent && format === "jpeg") {
	console.error("Error: Transparent background not supported with JPEG format.");
	process.exit(1);
}

// Generate default output path if not provided
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
if (!outputPath) {
	outputPath = `generated-${timestamp}.${format}`;
}

// Determine if this is an edit or generation
const isEdit = !!inputPath;

// DALL-E 3 doesn't support editing
if (isEdit && model === "dall-e-3") {
	console.error("Error: DALL-E 3 does not support image editing. Use gpt-image-1 or gpt-image-1.5.");
	process.exit(1);
}

async function generateImage() {
	const url = "https://api.openai.com/v1/images/generations";
	
	const body = {
		model: model,
		prompt: prompt,
		n: numImages,
		response_format: "b64_json",
		output_format: format,
	};

	// Add size if not auto
	if (size !== "auto") {
		body.size = size;
	}

	// Add quality for GPT Image models
	if (model.startsWith("gpt-image") && quality !== "auto") {
		body.quality = quality;
	}

	// Add background for GPT Image models
	if (model.startsWith("gpt-image") && transparent) {
		body.background = "transparent";
	}

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${apiKey}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`API request failed (HTTP ${response.status}): ${errorText}`);
	}

	return await response.json();
}

async function editImage() {
	const url = "https://api.openai.com/v1/images/edits";
	
	// Read input image
	if (!fs.existsSync(inputPath)) {
		throw new Error(`Input file not found: ${inputPath}`);
	}

	const formData = new FormData();
	
	// Add image file
	const imageBuffer = fs.readFileSync(inputPath);
	const imageBlob = new Blob([imageBuffer], { type: getMimeType(inputPath) });
	formData.append("image", imageBlob, path.basename(inputPath));
	
	// Add mask if provided
	if (maskPath) {
		if (!fs.existsSync(maskPath)) {
			throw new Error(`Mask file not found: ${maskPath}`);
		}
		const maskBuffer = fs.readFileSync(maskPath);
		const maskBlob = new Blob([maskBuffer], { type: getMimeType(maskPath) });
		formData.append("mask", maskBlob, path.basename(maskPath));
	}

	formData.append("prompt", prompt);
	formData.append("model", model);
	formData.append("n", numImages.toString());
	formData.append("response_format", "b64_json");

	if (size !== "auto") {
		formData.append("size", size);
	}

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${apiKey}`
		},
		body: formData
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`API request failed (HTTP ${response.status}): ${errorText}`);
	}

	return await response.json();
}

function getMimeType(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	switch (ext) {
		case ".jpg":
		case ".jpeg":
			return "image/jpeg";
		case ".webp":
			return "image/webp";
		case ".gif":
			return "image/gif";
		default:
			return "image/png";
	}
}

function getOutputPath(index) {
	if (numImages === 1) {
		return outputPath;
	}
	// For multiple images, insert index before extension
	const ext = path.extname(outputPath);
	const base = outputPath.slice(0, -ext.length);
	return `${base}-${index + 1}${ext}`;
}

// Main
try {
	const data = isEdit ? await editImage() : await generateImage();

	if (!data.data || data.data.length === 0) {
		console.error("Error: No images generated.");
		process.exit(1);
	}

	const outputPaths = [];

	for (let i = 0; i < data.data.length; i++) {
		const imageData = data.data[i];
		const outPath = getOutputPath(i);
		
		if (imageData.b64_json) {
			const imageBuffer = Buffer.from(imageData.b64_json, "base64");
			fs.writeFileSync(outPath, imageBuffer);
			outputPaths.push(path.resolve(outPath));
		} else if (imageData.url) {
			// Download from URL if provided
			const imgResponse = await fetch(imageData.url);
			const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
			fs.writeFileSync(outPath, imgBuffer);
			outputPaths.push(path.resolve(outPath));
		}

		// Print revised prompt if available (DALL-E 3)
		if (imageData.revised_prompt && i === 0) {
			console.error(`Revised prompt: ${imageData.revised_prompt}`);
		}
	}

	// Output paths to stdout
	for (const p of outputPaths) {
		console.log(p);
	}

} catch (error) {
	console.error(`Error: ${error.message}`);
	process.exit(1);
}
