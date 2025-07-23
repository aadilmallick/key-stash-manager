import sharp from "sharp";
import fs from "fs";
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
sizes.forEach((size) => {
  sharp("frontend/public/favicon.svg")
    .resize(size, size)
    .png()
    .toFile(`frontend/public/icon-${size}x${size}.png`, (err) => {
      if (err) console.error(err);
    });
});
