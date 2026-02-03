import { defineConfig } from "vite";
import fs from "fs";
import { resolve } from "path";

const blogDir = resolve(__dirname, "blog");
const postEntries = {};

if (fs.existsSync(blogDir)) {
  for (const entry of fs.readdirSync(blogDir)) {
    const entryPath = resolve(blogDir, entry, "index.html");
    if (fs.existsSync(entryPath)) {
      postEntries[`blog-${entry}`] = entryPath;
    }
  }
}

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        blog: resolve(__dirname, "blog/index.html"),
        publications: resolve(__dirname, "publications/index.html"),
        ...postEntries,
      },
    },
  },
});
