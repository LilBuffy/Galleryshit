const fs = require("fs");
const path = require("path");

const MEDIA_DIR = path.join(__dirname, "..", "media");
const MANIFEST_PATH = path.join(MEDIA_DIR, "manifest.json");

const EXTENSIONS = {
  image: [".jpg", ".jpeg", ".png", ".webp", ".avif", ".bmp", ".svg"],
  gif: [".gif"],
  video: [".mp4", ".webm", ".mov", ".ogv"],
  audio: [".mp3", ".wav", ".m4a", ".flac", ".ogg"]
};

function categoryFor(ext) {
  for (const [category, list] of Object.entries(EXTENSIONS)) {
    if (list.includes(ext)) return category;
  }
  return null;
}

function generateManifest() {
  if (!fs.existsSync(MEDIA_DIR)) {
    console.error("media/ folder not found");
    process.exit(1);
  }

  const files = fs.readdirSync(MEDIA_DIR).filter((name) => {
    if (name.startsWith(".") || name === "manifest.json" || name === "README.md") return false;
    return categoryFor(path.extname(name).toLowerCase()) !== null;
  });

  const manifest = files.map((name) => {
    const stat = fs.statSync(path.join(MEDIA_DIR, name));
    return {
      file: name,
      category: categoryFor(path.extname(name).toLowerCase()),
      size: stat.size,
      dateAdded: stat.mtimeMs
    };
  });

  manifest.sort((a, b) => b.dateAdded - a.dateAdded);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Generated manifest.json with ${manifest.length} file(s)`);
}

generateManifest();
