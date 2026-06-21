import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MongoClient, ObjectId, GridFSBucket } from "mongodb";
import crypto from "node:crypto";
import Busboy from "busboy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, "dist");
const publicDir = path.join(__dirname, "public");
const indexHtmlPath = path.join(distDir, "index.html");
const defaultDbName = process.env.MONGODB_DB || "sc22";
let mongoClient;
let mongoConnecting;
let usersCollection;
let songsCollection;
let audioBucket;
let artworkBucket;

function writeJson(res, status, payload, extraHeaders) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...(extraHeaders || {}),
  });
  res.end(JSON.stringify(payload));
}

function writeText(res, status, text, extraHeaders) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...(extraHeaders || {}),
  });
  res.end(text);
}

function getMongoUri() {
  const candidates = [
    process.env.MONGODB_URI,
    process.env.MONGO_URI,
    process.env.MONGO_URL,
    process.env.DATABASE_URL,
    process.env.VITE_MONGODB_URI,
  ];
  const found = candidates.find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  if (!found) throw new Error("MONGODB_URI not set");
  return found.trim();
}

async function ensureBuilt() {
  if (fs.existsSync(indexHtmlPath)) return;
  const vite = await import("vite");
  await vite.build();
}

function random9Digit() {
  return String(100000000 + Math.floor(Math.random() * 900000000));
}

async function passwordHash(password) {
  const data = Buffer.from(String(password));
  const digest = crypto.createHash("sha256").update(data).digest("hex");
  return `sha256:${digest}`;
}

async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== "string") return false;
  if (storedHash.startsWith("sha256:")) return storedHash === (await passwordHash(password));
  return false;
}

async function getUsersCollection() {
  if (usersCollection) return usersCollection;
  const uri = getMongoUri();
  if (!mongoClient) mongoClient = new MongoClient(uri);
  if (!mongoConnecting) mongoConnecting = mongoClient.connect();
  await mongoConnecting;
  const db = mongoClient.db(defaultDbName);
  usersCollection = db.collection("users");
  await usersCollection.createIndex({ email: 1 }, { unique: true });
  return usersCollection;
}

async function getSongsCollection() {
  if (songsCollection) return songsCollection;
  const uri = getMongoUri();
  if (!mongoClient) mongoClient = new MongoClient(uri);
  if (!mongoConnecting) mongoConnecting = mongoClient.connect();
  await mongoConnecting;
  const db = mongoClient.db(defaultDbName);
  songsCollection = db.collection("songs");
  await songsCollection.createIndex({ ownerEmail: 1, createdAt: 1 });
  return songsCollection;
}

async function ensureBuckets() {
  if (audioBucket && artworkBucket) return { audioBucket, artworkBucket };
  const uri = getMongoUri();
  if (!mongoClient) mongoClient = new MongoClient(uri);
  if (!mongoConnecting) mongoConnecting = mongoClient.connect();
  await mongoConnecting;
  const db = mongoClient.db(defaultDbName);
  audioBucket = new GridFSBucket(db, { bucketName: "audio" });
  artworkBucket = new GridFSBucket(db, { bucketName: "artwork" });
  return { audioBucket, artworkBucket };
}

async function registerUser({ email, name, password }) {
  const col = await getUsersCollection();
  const now = new Date();
  const doc = {
    id: crypto.randomUUID(),
    email: String(email).trim().toLowerCase(),
    name: String(name || "").trim(),
    password: await passwordHash(password),
    wallet_address: random9Digit(),
    createdAt: now.toISOString(),
  };
  await col.insertOne(doc);
  return doc;
}

async function findUserByEmail(email) {
  const col = await getUsersCollection();
  const normalized = String(email).trim().toLowerCase();
  return col.findOne({ email: normalized });
}

async function enrichSongs(songDocs) {
  const emails = [...new Set(songDocs.map((song) => String(song.ownerEmail || "").trim().toLowerCase()).filter(Boolean))];
  const usersCol = await getUsersCollection();
  const users = await usersCol
    .find({ email: { $in: emails } }, { projection: { email: 1, name: 1, createdAt: 1 } })
    .toArray();
  const usersByEmail = new Map(
    users.map((user) => [String(user.email).trim().toLowerCase(), user]),
  );
  return songDocs.map((song) => {
    const ownerEmail = String(song.ownerEmail || "").trim().toLowerCase();
    const owner = usersByEmail.get(ownerEmail);
    return {
      ...song,
      ownerName:
        owner && typeof owner.name === "string" && owner.name.trim()
          ? owner.name.trim()
          : ownerEmail.split("@")[0] || "User",
      ownerCreatedAt: owner?.createdAt || null,
    };
  });
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".ico") return "image/x-icon";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".map") return "application/json; charset=utf-8";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

function hasHtmlAcceptHeader(req) {
  const accept = req.headers.accept;
  if (typeof accept !== "string") return false;
  return accept.includes("text/html") || accept.includes("*/*");
}

function safeResolve(distRoot, urlPathname) {
  const decoded = decodeURIComponent(urlPathname);
  const cleaned = decoded.replace(/\0/g, "");
  const relative = cleaned.startsWith("/") ? cleaned.slice(1) : cleaned;
  const resolved = path.resolve(distRoot, relative);
  if (!resolved.startsWith(distRoot)) return null;
  return resolved;
}

export function createAppServer() {
  return http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const pathname = url.pathname === "/" ? "/index.html" : url.pathname;

      if (req.method === "OPTIONS" && pathname.startsWith("/api/")) {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end();
        return;
      }
      if (req.method === "POST" && pathname === "/api/register") {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", async () => {
          try {
            const bodyStr = Buffer.concat(chunks).toString("utf8");
            const body = JSON.parse(bodyStr || "{}");
            const email = String(body.email || "").trim();
            const name = String(body.name || "").trim();
            const password = String(body.password || "");
            if (!email || !name || !password) {
              writeJson(res, 400, { error: "Missing fields" });
              return;
            }
            try {
              const exists = await findUserByEmail(email);
              if (exists) {
                writeJson(res, 409, { error: "Account exists" });
                return;
              }
              const doc = await registerUser({ email, name, password });
              writeJson(res, 201, {
                id: doc.id,
                email: doc.email,
                name: doc.name,
                wallet_address: doc.wallet_address,
                createdAt: doc.createdAt,
              });
            } catch (e) {
              const msg =
                e && typeof e.message === "string" ? e.message : "Server error";
              writeJson(res, 500, { error: msg });
            }
          } catch {
            writeJson(res, 400, { error: "Invalid JSON" });
          }
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/login") {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", async () => {
          try {
            const bodyStr = Buffer.concat(chunks).toString("utf8");
            const body = JSON.parse(bodyStr || "{}");
            const email = String(body.email || "").trim();
            const password = String(body.password || "");
            if (!email || !password) {
              writeJson(res, 400, { error: "Missing fields" });
              return;
            }

            try {
              const user = await findUserByEmail(email);
              if (!user) {
                writeJson(res, 404, { error: "Account not found" });
                return;
              }

              const ok = await verifyPassword(password, user.password);
              if (!ok) {
                writeJson(res, 401, { error: "Incorrect password" });
                return;
              }

              writeJson(res, 200, {
                id: user.id,
                email: user.email,
                name: user.name,
                wallet_address: user.wallet_address,
                createdAt: user.createdAt,
              });
            } catch (e) {
              const msg =
                e && typeof e.message === "string" ? e.message : "Server error";
              writeJson(res, 500, { error: msg });
            }
          } catch {
            writeJson(res, 400, { error: "Invalid JSON" });
          }
        });
        return;
      }

      if (req.method === "POST" && (pathname === "/api/songs" || pathname === "/api/songs/")) {
        const bb = Busboy({ headers: req.headers });
        const fields = { title: "", description: "", email: "" };
        let artworkId = null;
        let audioId = null;
        let finished = false;
        bb.on("field", (name, val) => {
          if (name in fields) fields[name] = String(val || "").trim();
        });
        bb.on("file", async (name, file, info) => {
          const { filename, mimeType } = info;
          const { audioBucket: aBucket, artworkBucket: wBucket } = await ensureBuckets();
          if (name === "artwork") {
            const upload = wBucket.openUploadStream(filename || "artwork", { contentType: mimeType || "image/jpeg" });
            artworkId = upload.id;
            file.pipe(upload);
          } else if (name === "audio") {
            const upload = aBucket.openUploadStream(filename || "audio", { contentType: mimeType || "audio/mpeg" });
            audioId = upload.id;
            file.pipe(upload);
          } else {
            file.resume();
          }
        });
        bb.on("close", async () => {
          if (finished) return;
          finished = true;
          try {
            const email = fields.email.trim().toLowerCase();
            if (!email || !fields.title) {
              writeJson(res, 400, { error: "Missing email or title" });
              return;
            }
            const user = await findUserByEmail(email);
            if (!user) {
              writeJson(res, 404, { error: "Account not found" });
              return;
            }
            const col = await getSongsCollection();
            const now = new Date().toISOString();
            const doc = {
              id: crypto.randomUUID(),
              ownerEmail: email,
              title: fields.title,
              description: fields.description || "",
              artworkFileId: artworkId ? String(artworkId) : null,
              audioFileId: audioId ? String(audioId) : null,
              createdAt: now,
            };
            await col.insertOne(doc);
            writeJson(res, 201, doc);
          } catch (e) {
            const msg = e && typeof e.message === "string" ? e.message : "Server error";
            writeJson(res, 500, { error: msg });
          }
        });
        req.pipe(bb);
        return;
      }

      if (req.method === "GET" && pathname.startsWith("/api/songs")) {
        (async () => {
          const email = (new URL(req.url ?? "/", "http://localhost")).searchParams.get("email") || "";
          if (!email) {
            writeJson(res, 400, { error: "Missing email" });
            return;
          }
          try {
            const col = await getSongsCollection();
            const list = await col
              .find({ ownerEmail: String(email).trim().toLowerCase() })
              .sort({ createdAt: -1 })
              .limit(100)
              .toArray();
            writeJson(res, 200, list);
          } catch (e) {
            const msg = e && typeof e.message === "string" ? e.message : "Server error";
            writeJson(res, 500, { error: msg });
          }
        })();
        return;
      }

      if (req.method === "GET" && pathname === "/api/feed") {
        (async () => {
          try {
            const col = await getSongsCollection();
            const list = await col.find({}).sort({ createdAt: -1 }).toArray();
            writeJson(res, 200, await enrichSongs(list));
          } catch (e) {
            const msg = e && typeof e.message === "string" ? e.message : "Server error";
            writeJson(res, 500, { error: msg });
          }
        })();
        return;
      }

      if (req.method === "GET" && pathname === "/api/user") {
        (async () => {
          const email = (new URL(req.url ?? "/", "http://localhost")).searchParams.get("email") || "";
          if (!email) {
            writeJson(res, 400, { error: "Missing email" });
            return;
          }
          try {
            const user = await findUserByEmail(email);
            if (!user) {
              writeJson(res, 404, { error: "Account not found" });
              return;
            }
            const col = await getSongsCollection();
            const songs = await col
              .find({ ownerEmail: String(email).trim().toLowerCase() })
              .sort({ createdAt: -1 })
              .limit(100)
              .toArray();
            writeJson(res, 200, {
              email: user.email,
              name: user.name,
              createdAt: user.createdAt,
              wallet_address: user.wallet_address,
              songs: await enrichSongs(songs),
            });
          } catch (e) {
            const msg = e && typeof e.message === "string" ? e.message : "Server error";
            writeJson(res, 500, { error: msg });
          }
        })();
        return;
      }

      if ((req.method === "GET" || req.method === "HEAD") && pathname.startsWith("/api/artwork/")) {
        (async () => {
          const id = pathname.split("/").pop();
          try {
            const { artworkBucket: wBucket } = await ensureBuckets();
            const oid = new ObjectId(String(id));
            const files = await wBucket.find({ _id: oid }).toArray();
            const ct = files[0]?.contentType || "image/jpeg";
            if (req.method === "HEAD") {
              res.writeHead(200, { "Content-Type": ct, "X-Content-Type-Options": "nosniff" });
              res.end();
              return;
            }
            res.writeHead(200, { "Content-Type": ct, "X-Content-Type-Options": "nosniff" });
            const dl = wBucket.openDownloadStream(oid);
            dl.on("error", () => {
              res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
              res.end("Not Found");
            });
            dl.pipe(res);
          } catch {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Not Found");
          }
        })();
        return;
      }

      if ((req.method === "GET" || req.method === "HEAD") && pathname.startsWith("/api/audio/")) {
        (async () => {
          const id = pathname.split("/").pop();
          try {
            const { audioBucket: aBucket } = await ensureBuckets();
            const oid = new ObjectId(String(id));
            const files = await aBucket.find({ _id: oid }).toArray();
            const ct = files[0]?.contentType || "audio/mpeg";
            const length = files[0]?.length || undefined;
            const range = req.headers.range;
            if (req.method === "HEAD") {
              res.writeHead(200, {
                "Content-Type": ct,
                ...(length ? { "Content-Length": length } : {}),
                "Accept-Ranges": "bytes",
                "X-Content-Type-Options": "nosniff",
              });
              res.end();
              return;
            }
            if (typeof range === "string" && range.startsWith("bytes=") && length) {
              const [startStr, endStr] = range.replace("bytes=", "").split("-");
              const start = Math.max(0, parseInt(startStr || "0", 10));
              const end = Math.min(length - 1, endStr ? parseInt(endStr, 10) : length - 1);
              const chunkSize = end - start + 1;
              res.writeHead(206, {
                "Content-Type": ct,
                "Content-Length": chunkSize,
                "Content-Range": `bytes ${start}-${end}/${length}`,
                "Accept-Ranges": "bytes",
                "X-Content-Type-Options": "nosniff",
              });
              const dl = aBucket.openDownloadStream(oid, { start, end: end + 1 });
              dl.on("error", () => {
                res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
                res.end("Not Found");
              });
              dl.pipe(res);
              return;
            }
            res.writeHead(200, {
              "Content-Type": ct,
              ...(length ? { "Content-Length": length } : {}),
              "Accept-Ranges": "bytes",
              "X-Content-Type-Options": "nosniff",
            });
            const dl = aBucket.openDownloadStream(oid);
            dl.on("error", () => {
              res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
              res.end("Not Found");
            });
            dl.pipe(res);
          } catch {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Not Found");
          }
        })();
        return;
      }

      if (req.method !== "GET" && req.method !== "HEAD") {
        writeText(res, 405, "Method Not Allowed");
        return;
      }

      if (!fs.existsSync(distDir) || !fs.existsSync(indexHtmlPath)) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Server is initializing. Try again in a moment.");
        return;
      }

      const resolved = safeResolve(distDir, pathname);
      if (!resolved) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Bad Request");
        return;
      }

      let filePath = resolved;
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }

      const sendFile = (finalPath) => {
        const stream = fs.createReadStream(finalPath);
        stream.on("error", () => {
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Internal Server Error");
        });

        res.writeHead(200, {
          "Content-Type": getContentType(finalPath),
          "X-Content-Type-Options": "nosniff",
        });

        if (req.method === "HEAD") {
          res.end();
          stream.destroy();
          return;
        }

        stream.pipe(res);
      };

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        sendFile(filePath);
        return;
      }

      if (fs.existsSync(publicDir)) {
        const publicResolved = safeResolve(publicDir, pathname);
        if (publicResolved && fs.existsSync(publicResolved) && fs.statSync(publicResolved).isFile()) {
          sendFile(publicResolved);
          return;
        }
      }

      if (hasHtmlAcceptHeader(req)) {
        sendFile(indexHtmlPath);
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
    } catch {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error");
    }
  });
}

export function start({ port } = {}) {
  const server = createAppServer();
  const envPort = process.env.PORT ? Number(process.env.PORT) : undefined;
  const listenPort = port ?? envPort ?? 3003;
  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      console.error(
        `Port ${listenPort} is already in use. If another server.js is running, stop it first.`,
      );
      process.exit(1);
    }
    console.error("Server error:", err);
    process.exit(1);
  });
  ensureBuilt()
    .catch((e) => {
      console.error("Build failed:", e?.message || e);
      process.exit(1);
    })
    .then(() => {
      server.listen(listenPort, () => {
    const address = server.address();
    if (address && typeof address === "object") {
      console.log(`Server running on http://localhost:${address.port}`);
    }
      });
    });
  return server;
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isMain) start();
