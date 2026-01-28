# OpenAI Image Generation

Image generation skill for [pi](https://github.com/mariozechner/pi) using OpenAI's GPT Image and DALL-E models.

## Models

OpenAI offers several image generation models:

| Model | Description | Editing | Best For |
|-------|-------------|---------|----------|
| **gpt-image-1.5** | Latest and most advanced | ✅ | Best quality, text rendering |
| **gpt-image-1** | High quality, balanced | ✅ | Recommended default |
| **gpt-image-1-mini** | Cost-effective | ✅ | Budget-conscious usage |
| **dall-e-3** | High quality | ❌ | Simple generations |
| **dall-e-2** | Legacy model | ✅ | Lower cost |

## Features

- **Text-to-image generation** - Generate images from text prompts
- **Image editing** - Modify existing images with natural language
- **Inpainting** - Edit specific areas using masks
- **Transparent backgrounds** - Generate sprites, logos, PNGs with alpha
- **Multiple outputs** - Generate several variations at once
- **Quality control** - Low, medium, high quality settings

## Setup

### 1. Get an OpenAI API Key

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add it to your shell profile:

```bash
# Add to ~/.bashrc, ~/.zshrc, or ~/.profile
export OPENAI_API_KEY="your-api-key-here"
```

### 2. Reload Your Shell

```bash
source ~/.bashrc  # or ~/.zshrc
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

### Image Sizes

```bash
./generate.js "portrait photo" --size 1024x1536      # Portrait
./generate.js "landscape photo" --size 1536x1024     # Landscape
./generate.js "profile picture" --size 1024x1024     # Square
./generate.js "let the model decide" --size auto     # Auto (default)
```

### Model Selection

```bash
# Best quality (recommended for important work)
./generate.js "detailed artwork" --model gpt-image-1.5

# Balanced (default)
./generate.js "quick concept" --model gpt-image-1

# Budget-friendly
./generate.js "simple icon" --model gpt-image-1-mini

# DALL-E 3 (no editing support)
./generate.js "creative art" --model dall-e-3
```

### Quality Settings

```bash
./generate.js "draft sketch" --quality low
./generate.js "social media post" --quality medium
./generate.js "print-ready artwork" --quality high
```

### Transparent Backgrounds

```bash
# Great for sprites, logos, icons
./generate.js "pixel art character" --transparent --format png
./generate.js "company logo" --transparent --format webp
```

### Image Editing

```bash
# Edit an existing image
./generate.js "add sunglasses to the person" -i portrait.png

# Save to specific output
./generate.js "make the sky dramatic" -i landscape.png -o dramatic.png
```

### Inpainting with Masks

```bash
# Replace specific areas using a mask
# White areas in mask = areas to edit
# Black areas in mask = areas to keep
./generate.js "add a swimming pool" -i backyard.png --mask pool-area.png
```

### Multiple Images

```bash
# Generate 4 variations
./generate.js "abstract art" -n 4

# Files will be named: generated-{timestamp}-1.png, -2.png, etc.
```

### Output Formats

```bash
./generate.js "photo" --format png      # Lossless, supports transparency
./generate.js "photo" --format jpeg     # Smaller file, faster
./generate.js "photo" --format webp     # Best compression, supports transparency
```

## Examples

```bash
# Product photography
./generate.js "minimalist white headphones on marble surface, soft studio lighting" \
  --model gpt-image-1.5 --quality high

# Game asset with transparency
./generate.js "2D pixel art sword, fantasy RPG style" \
  --transparent --format png

# Social media banner
./generate.js "abstract gradient background, purple and blue" \
  --size 1536x1024 --quality medium

# Edit a photo
./generate.js "change the wall color to warm terracotta" \
  -i living-room.jpg --model gpt-image-1

# Logo design
./generate.js "minimalist owl logo, single color, vector style" \
  --transparent --model gpt-image-1.5

# Multiple concepts
./generate.js "futuristic car concept" -n 4 --quality low
```

## Output

The script outputs the absolute path(s) to generated image file(s) on stdout, one per line. Any notes (like revised prompts) are printed to stderr.

```bash
# Capture the output path
IMAGE_PATH=$(./generate.js "sunset" 2>/dev/null)
echo "Generated: $IMAGE_PATH"

# Process multiple images
./generate.js "concept art" -n 3 | while read path; do
  echo "Created: $path"
done
```

## Limitations

- **Latency**: Complex prompts may take up to 2 minutes
- **Text rendering**: Improved but not perfect for precise text
- **DALL-E 3**: Does not support editing, only generation
- **Masks**: Must have alpha channel, same size as input image
- **File size**: Input images must be under 50MB

## Pricing

Check [OpenAI pricing](https://openai.com/pricing) for current rates. Costs depend on:
- Model used (gpt-image-1.5 > gpt-image-1 > gpt-image-1-mini)
- Image size
- Quality setting

## License

MIT
