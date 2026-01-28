# Nano Banana

Image generation skill for [pi](https://github.com/mariozechner/pi) using Google Gemini's native image generation models.

## What is Nano Banana?

Nano Banana is Google's codename for Gemini's built-in image generation capabilities. It comes in two flavors:

- **Gemini 2.5 Flash Image** (Nano Banana) - Fast, efficient, 1024px resolution
- **Gemini 3 Pro Image Preview** (Nano Banana Pro) - Higher quality, up to 4K resolution

## Features

- **Text-to-image generation** - Generate images from text prompts
- **Image editing** - Modify existing images with natural language
- **Aspect ratio control** - 1:1, 16:9, 9:16, 4:3, 3:4, and more
- **Model selection** - Choose between fast (flash) and quality (pro) models
- **Resolution control** - Up to 4K with the pro model

## Setup

### 1. Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a new API key
3. Add it to your shell profile:

```bash
# Add to ~/.bashrc, ~/.zshrc, or ~/.profile
export GEMINI_API_KEY="your-api-key-here"
```

### 2. Install Dependencies

```bash
cd /path/to/nano-banana
npm install
```

## Usage

### Basic Generation

```bash
./generate.js "a cat astronaut floating in space"
```

### Custom Output Path

```bash
./generate.js "mountain landscape" -o mountains.png
```

### Aspect Ratios

```bash
./generate.js "cinematic scene" --aspect 16:9
./generate.js "phone wallpaper" --aspect 9:16
./generate.js "square portrait" --aspect 1:1
```

Available ratios: `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `4:5`, `5:4`, `21:9`

### Model Selection

```bash
# Fast generation (default)
./generate.js "quick sketch" --model flash

# High quality
./generate.js "professional photo" --model pro
```

### High Resolution (Pro Model)

```bash
./generate.js "detailed artwork" --model pro --size 2K
./generate.js "print-ready image" --model pro --size 4K
```

Available sizes: `1K`, `2K`, `4K`

### Image Editing

```bash
# Edit an existing image
./generate.js "make the sky more dramatic" -i landscape.png

# Save to specific output
./generate.js "change the car color to red" -i car.png -o car-red.png
```

## Examples

```bash
# Digital art
./generate.js "cyberpunk street scene with neon lights, rain, reflections" --aspect 16:9

# Product mockup
./generate.js "minimalist coffee mug on marble surface, soft lighting" --model pro

# Style transfer
./generate.js "transform this into a watercolor painting" -i photo.jpg

# Character design
./generate.js "friendly robot mascot, cartoon style, blue and white" -o mascot.png
```

## Output

The script outputs the absolute path to the generated image file on stdout. Any notes or warnings from the model are printed to stderr.

```bash
# Capture the output path
IMAGE_PATH=$(./generate.js "sunset" 2>/dev/null)
echo "Generated: $IMAGE_PATH"
```

## Limitations

- Maximum ~25MB for input images
- Some content restrictions apply (safety filters)
- Pro model may have longer generation times
- API rate limits apply based on your plan

## Pricing

Check [Google AI pricing](https://ai.google.dev/pricing) for current rates. Image generation is billed per image generated.

## License

MIT
