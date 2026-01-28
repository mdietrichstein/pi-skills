---
name: openai-image
description: Image generation using OpenAI's GPT Image and DALL-E models. Generate images from text prompts or edit existing images.
---

# OpenAI Image Generation

Image generation using OpenAI's GPT Image (gpt-image-1.5, gpt-image-1) and DALL-E models.

## Setup

Requires an OpenAI API key.

1. Get an API key at https://platform.openai.com/api-keys
2. Add to your shell profile (`~/.profile`, `~/.zprofile`, or `~/.bashrc`):
   ```bash
   export OPENAI_API_KEY="your-api-key-here"
   ```
3. Install dependencies (run once):
   ```bash
   cd {baseDir}
   npm install
   ```

## Generate Image

```bash
{baseDir}/generate.js "prompt"                              # Basic generation
{baseDir}/generate.js "prompt" -o output.png                # Custom output path
{baseDir}/generate.js "prompt" --size 1536x1024             # Landscape
{baseDir}/generate.js "prompt" --model dall-e-3             # Use DALL-E 3
{baseDir}/generate.js "prompt" --quality high               # High quality
{baseDir}/generate.js "prompt" --transparent                # Transparent background
```

### Options

- `-o, --output <path>` - Output file path (default: generated-{timestamp}.png)
- `--size <size>` - Image size: 1024x1024, 1536x1024, 1024x1536, auto (default: auto)
- `--model <model>` - Model: gpt-image-1.5, gpt-image-1, gpt-image-1-mini, dall-e-3, dall-e-2 (default: gpt-image-1)
- `--quality <quality>` - Quality: low, medium, high, auto (default: auto)
- `--format <format>` - Output format: png, jpeg, webp (default: png)
- `--transparent` - Enable transparent background (png/webp only)
- `-n <count>` - Number of images to generate (default: 1)

## Edit Image

```bash
{baseDir}/generate.js "add a hat" -i person.png
{baseDir}/generate.js "replace background with beach" -i photo.png --mask mask.png
```

### Edit Options

- `-i, --input <path>` - Input image to edit
- `--mask <path>` - Mask image for inpainting (white = edit, black = keep)

## Output

Returns the path(s) to the generated image file(s), one per line.

## Models

| Model | Best For | Notes |
|-------|----------|-------|
| gpt-image-1.5 | Best quality, text rendering | State of the art |
| gpt-image-1 | High quality, balanced | Recommended default |
| gpt-image-1-mini | Cost-effective | Lower quality |
| dall-e-3 | High quality generations | No editing support |
| dall-e-2 | Lower cost, variations | Legacy model |

## Examples

```bash
# Generate a simple image
{baseDir}/generate.js "a cat astronaut on the moon, digital art"

# Generate landscape wallpaper
{baseDir}/generate.js "mountain landscape at sunset" --size 1536x1024 -o wallpaper.png

# High quality with best model
{baseDir}/generate.js "professional product photo of headphones" --model gpt-image-1.5 --quality high

# Transparent background for sprites/logos
{baseDir}/generate.js "pixel art character sprite" --transparent --format png

# Edit an existing image
{baseDir}/generate.js "add sunglasses" -i portrait.png

# Inpainting with mask
{baseDir}/generate.js "replace with a lake" -i landscape.png --mask water-area.png

# Generate multiple variations
{baseDir}/generate.js "abstract art" -n 4
```

## When to Use

- Generating images from text descriptions
- Creating illustrations, concept art, product mockups
- Editing or modifying existing images (inpainting)
- Generating sprites with transparent backgrounds
- When you need excellent text rendering in images
