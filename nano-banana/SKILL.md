---
name: nano-banana
description: Image generation using Google Gemini's Nano Banana API. Generate images from text prompts or edit existing images.
---

# Nano Banana

Image generation using Google Gemini's native image generation models (Nano Banana).

## Setup

Requires a Google AI API key with Gemini access.

1. Get an API key at https://aistudio.google.com/apikey
2. Add to your shell profile (`~/.profile`, `~/.zprofile`, or `~/.bashrc`):
   ```bash
   export GEMINI_API_KEY="your-api-key-here"
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
{baseDir}/generate.js "prompt" --aspect 16:9                # Aspect ratio
{baseDir}/generate.js "prompt" --model pro                  # Use Nano Banana Pro (4K)
{baseDir}/generate.js "prompt" --size 2K                    # Image size (pro model only)
```

### Options

- `-o, --output <path>` - Output file path (default: generated-{timestamp}.png)
- `--aspect <ratio>` - Aspect ratio: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 4:5, 5:4, 21:9 (default: 1:1)
- `--model <type>` - Model: `flash` (fast, 1024px) or `pro` (quality, up to 4K) (default: flash)
- `--size <size>` - Image size for pro model: 1K, 2K, 4K (default: 1K)

## Edit Image

```bash
{baseDir}/generate.js "make the sky sunset orange" -i input.png
{baseDir}/generate.js "change sofa to leather" -i room.png -o edited.png
```

### Edit Options

- `-i, --input <path>` - Input image to edit (enables edit mode)

## Output

Returns the path to the generated image file on stdout. Images are saved as PNG.

## Displaying Generated Images

After generating an image, use the `view_image` tool with the output path to display it inline in the terminal. The `generate.js` script outputs the absolute path to the generated image on stdout.

Always offer to show the generated image to the user using `view_image` with the generated image path.

## Models

| Model | Flag | Resolution | Best For |
|-------|------|------------|----------|
| gemini-2.5-flash-image | `--model flash` | 1024px | Fast generation, high volume |
| gemini-3-pro-image-preview | `--model pro` | Up to 4K | Professional quality, complex prompts |

## Examples

```bash
# Generate a simple image
{baseDir}/generate.js "a cat astronaut on the moon, digital art"

# Generate widescreen wallpaper
{baseDir}/generate.js "mountain landscape at sunset" --aspect 16:9 -o wallpaper.png

# High quality with pro model
{baseDir}/generate.js "professional headshot photo" --model pro --size 2K

# Edit an existing image
{baseDir}/generate.js "add a rainbow in the sky" -i landscape.png -o with-rainbow.png
```

## When to Use

- Generating images from text descriptions
- Creating illustrations, concept art, mockups
- Editing or modifying existing images
- Style transfer and image manipulation
- Product visualization
