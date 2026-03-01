import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import AdmZip from "adm-zip";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // GitHub API proxy
  app.get("/api/github/repos", async (req, res) => {
    try {
      const token = process.env.GITHUB_TOKEN;
      if (!token) return res.status(401).json({ error: "GitHub token missing" });

      const response = await axios.get("https://api.github.com/user/repos", {
        headers: { Authorization: `token ${token}` },
        params: { sort: 'updated', per_page: 100 }
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json({ error: error.message });
    }
  });

  app.get("/api/github/contents", async (req, res) => {
    const { owner, repo, path: filePath } = req.query;
    try {
      const token = process.env.GITHUB_TOKEN;
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath || ""}`, {
        headers: { Authorization: `token ${token}` }
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json({ error: error.message });
    }
  });

  app.post("/api/github/deploy-url", async (req, res) => {
    const { url } = req.body;
    try {
      const githubToken = process.env.GITHUB_TOKEN;
      const netlifyToken = process.env.NETLIFY_TOKEN;
      
      if (!netlifyToken) return res.status(401).json({ error: "Netlify token missing" });

      const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return res.status(400).json({ error: "Invalid GitHub URL" });
      
      const owner = match[1];
      const repo = match[2].replace(/\.git$/, "");
      
      // Download zipball from GitHub
      const zipResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/zipball/main`, {
        headers: githubToken ? { Authorization: `token ${githubToken}` } : {},
        responseType: 'arraybuffer'
      });

      // GitHub zipball has a top-level directory. Netlify needs files at root.
      // We'll use adm-zip to flatten it.
      const zip = new AdmZip(Buffer.from(zipResponse.data));
      const newZip = new AdmZip();
      const zipEntries = zip.getEntries();
      
      // The first entry is usually the root folder
      const rootFolder = zipEntries[0].entryName.split('/')[0];
      
      zipEntries.forEach(entry => {
        if (!entry.isDirectory) {
          const relativePath = entry.entryName.substring(rootFolder.length + 1);
          if (relativePath) {
            newZip.addFile(relativePath, entry.getData());
          }
        }
      });

      const flattenedZipBuffer = newZip.toBuffer();

      // Create Netlify site
      const createSiteResponse = await axios.post("https://api.netlify.com/api/v1/sites", {
        name: `gdeploy-${repo.toLowerCase()}-${Math.floor(Math.random() * 10000)}`
      }, {
        headers: { Authorization: `Bearer ${netlifyToken}` }
      });

      const siteId = createSiteResponse.data.id;

      // Deploy to Netlify
      const deployResponse = await axios.post(
        `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
        flattenedZipBuffer,
        {
          headers: {
            Authorization: `Bearer ${netlifyToken}`,
            "Content-Type": "application/zip"
          }
        }
      );

      res.json({
        site_url: createSiteResponse.data.url,
        admin_url: createSiteResponse.data.admin_url,
        deploy_url: deployResponse.data.deploy_url,
        site_id: siteId,
        name: repo
      });
    } catch (error: any) {
      console.error(error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ error: error.message });
    }
  });

  // Netlify API proxy
  app.post("/api/netlify/deploy", upload.single('file'), async (req: any, res) => {
    try {
      const token = process.env.NETLIFY_TOKEN;
      if (!token) return res.status(401).json({ error: "Netlify token missing" });

      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      // Create a site first if needed, or use an existing one
      // For simplicity, we'll create a new site for each deploy or use a specific one
      // Here we just deploy to a new site
      const createSiteResponse = await axios.post("https://api.netlify.com/api/v1/sites", {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const siteId = createSiteResponse.data.id;

      const deployResponse = await axios.post(
        `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
        req.file.buffer,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/zip"
          }
        }
      );

      res.json({
        site_url: createSiteResponse.data.url,
        admin_url: createSiteResponse.data.admin_url,
        deploy_url: deployResponse.data.deploy_url,
        site_id: siteId
      });
    } catch (error: any) {
      console.error(error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ error: error.message });
    }
  });

  // Deploy from GitHub URL
  app.post("/api/deploy/github-url", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      const githubToken = process.env.GITHUB_TOKEN;
      const netlifyToken = process.env.NETLIFY_TOKEN;

      if (!netlifyToken) return res.status(401).json({ error: "Netlify token missing" });

      // Parse GitHub URL
      // Expected format: https://github.com/owner/repo
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return res.status(400).json({ error: "Invalid GitHub URL" });

      const [_, owner, repo] = match;
      const cleanRepo = repo.replace(/\.git$/, "");

      // Download zipball from GitHub
      const githubResponse = await axios.get(
        `https://api.github.com/repos/${owner}/${cleanRepo}/zipball`,
        {
          headers: githubToken ? { Authorization: `token ${githubToken}` } : {},
          responseType: 'arraybuffer'
        }
      );

      // Create Netlify site
      const createSiteResponse = await axios.post("https://api.netlify.com/api/v1/sites", {
        name: `deploy-${cleanRepo.toLowerCase()}-${Math.floor(Math.random() * 10000)}`
      }, {
        headers: { Authorization: `Bearer ${netlifyToken}` }
      });

      const siteId = createSiteResponse.data.id;

      // Deploy to Netlify
      const deployResponse = await axios.post(
        `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
        githubResponse.data,
        {
          headers: {
            Authorization: `Bearer ${netlifyToken}`,
            "Content-Type": "application/zip"
          }
        }
      );

      res.json({
        site_url: createSiteResponse.data.url,
        admin_url: createSiteResponse.data.admin_url,
        deploy_url: deployResponse.data.deploy_url,
        site_id: siteId,
        name: cleanRepo
      });
    } catch (error: any) {
      console.error("GitHub URL Deploy Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
