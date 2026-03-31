import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function getRepositoryNameFromPackageJson() {
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const packageJsonPath = path.join(currentDir, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const repository = packageJson.repository;

    if (typeof repository === "string") {
      const match = repository.match(/[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
      return match?.[2] || null;
    }

    if (repository && typeof repository.url === "string") {
      const match = repository.url.match(/[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
      return match?.[2] || null;
    }
  } catch {
    return null;
  }

  return null;
}

function getPagesBase() {
  if (!process.env.GITHUB_ACTIONS) {
    return "/";
  }

  const repoSlug = process.env.GITHUB_REPOSITORY;
  const owner = process.env.GITHUB_REPOSITORY_OWNER;
  const repoName = repoSlug?.split("/")[1] || getRepositoryNameFromPackageJson();

  if (!repoName) {
    return "/";
  }

  if (owner && repoName.toLowerCase() === `${owner.toLowerCase()}.github.io`) {
    return "/";
  }

  return `/${repoName}/`;
}

export default defineConfig({
  base: getPagesBase(),
  plugins: [react()],
  server: {
    fs: {
      allow: [path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")]
    }
  }
});
