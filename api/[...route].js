import { MongoClient, ObjectId, GridFSBucket } from "mongodb";
import crypto from "node:crypto";
import Busboy from "busboy";

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

async function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  if (!mongoClient) mongoClient = new MongoClient(uri);
  if (!mongoConnecting) mongoConnecting = mongoClient.connect();
  await mongoConnecting;
  return mongoClient;
}

async function getUsersCollection() {
  if (usersCollection) return usersCollection;
  const client = await getMongoClient();
  const db = client.db(defaultDbName);
  usersCollection = db.collection("users");
  await usersCollection.createIndex({ email: 1 }, { unique: true });
  return usersCollection;
}

async function getSongsCollection() {
  if (songsCollection) return songsCollection;
  const client = await getMongoClient();
  const db = client.db(defaultDbName);
  songsCollection = db.collection("songs");
  await songsCollection.createIndex({ ownerEmail: 1, createdAt: 1 });
  return songsCollection;
}

async function ensureBuckets() {
  if (audioBucket && artworkBucket) return { audioBucket, artworkBucket };
  const client = await getMongoClient();
  const db = client.db(defaultDbName);
  audioBucket = new GridFSBucket(db, { bucketName: "audio" });
  artworkBucket = new GridFSBucket(db, { bucketName: "artwork" });
  return { audioBucket, artworkBucket };
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

async function findUserByEmail(email) {
  const col = await getUsersCollection();
  return col.findOne({ email: String(email).trim().toLowerCase() });
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

async function enrichSongs(songDocs) {
  const emails = [
    ...new Set(
      songDocs
        .map((song) => String(song.ownerEmail || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
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

async function readJsonBody(req) {
  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on("data", (c) => chunks.push(c));
    req.on("end", resolve);
    req.on("error", reject);
  });
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function parseSongUpload(req) {
  const bb = Busboy({ headers: req.headers });
  const fields = { title: "", description: "", email: "" };
  const uploads = [];
  let artworkId = null;
  let audioId = null;

  const done = new Promise((resolve, reject) => {
    bb.on("field", (name, val) => {
      if (name in fields) fields[name] = String(val || "").trim();
    });

    bb.on("file", (name, file, info) => {
      const task = (async () => {
        const { filename, mimeType } = info;
        const { audioBucket: aBucket, artworkBucket: wBucket } = await ensureBuckets();
        if (name !== "artwork" && name !== "audio") {
          file.resume();
          return;
        }
        const bucket = name === "artwork" ? wBucket : aBucket;
        const fallbackName = name === "artwork" ? "artwork" : "audio";
        const fallbackType = name === "artwork" ? "image/jpeg" : "audio/mpeg";
        const upload = bucket.openUploadStream(filename || fallbackName, {
          contentType: mimeType || fallbackType,
        });
        await new Promise((res, rej) => {
          upload.on("finish", res);
          upload.on("error", rej);
          file.on("error", rej);
          file.pipe(upload);
        });
        if (name === "artwork") artworkId = upload.id;
        if (name === "audio") audioId = upload.id;
      })();
      uploads.push(task);
    });

    bb.on("error", reject);
    bb.on("finish", async () => {
      try {
        await Promise.all(uploads);
        resolve({
          fields,
          artworkId: artworkId ? String(artworkId) : null,
          audioId: audioId ? String(audioId) : null,
        });
      } catch (e) {
        reject(e);
      }
    });
  });

  req.pipe(bb);
  return done;
}

async function streamArtwork(req, res, id) {
  try {
    const { artworkBucket: bucket } = await ensureBuckets();
    const oid = new ObjectId(String(id));
    const files = await bucket.find({ _id: oid }).toArray();
    const ct = files[0]?.contentType || "image/jpeg";
    if (req.method === "HEAD") {
      res.writeHead(200, { "Content-Type": ct, "X-Content-Type-Options": "nosniff" });
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": ct, "X-Content-Type-Options": "nosniff" });
    const dl = bucket.openDownloadStream(oid);
    dl.on("error", () => writeText(res, 404, "Not Found"));
    dl.pipe(res);
  } catch {
    writeText(res, 404, "Not Found");
  }
}

async function streamAudio(req, res, id) {
  try {
    const { audioBucket: bucket } = await ensureBuckets();
    const oid = new ObjectId(String(id));
    const files = await bucket.find({ _id: oid }).toArray();
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
      const dl = bucket.openDownloadStream(oid, { start, end: end + 1 });
      dl.on("error", () => writeText(res, 404, "Not Found"));
      dl.pipe(res);
      return;
    }

    res.writeHead(200, {
      "Content-Type": ct,
      ...(length ? { "Content-Length": length } : {}),
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    });
    const dl = bucket.openDownloadStream(oid);
    dl.on("error", () => writeText(res, 404, "Not Found"));
    dl.pipe(res);
  } catch {
    writeText(res, 404, "Not Found");
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;

  if (req.method === "OPTIONS" && pathname.startsWith("/api/")) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  try {
    if (req.method === "POST" && pathname === "/api/register") {
      try {
        const body = await readJsonBody(req);
        const email = String(body.email || "").trim();
        const name = String(body.name || "").trim();
        const password = String(body.password || "");
        if (!email || !name || !password) {
          writeJson(res, 400, { error: "Missing fields" });
          return;
        }
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
        return;
      } catch (e) {
        writeJson(res, 500, { error: e?.message || "Server error" });
        return;
      }
    }

    if (req.method === "POST" && pathname === "/api/login") {
      try {
        const body = await readJsonBody(req);
        const email = String(body.email || "").trim();
        const password = String(body.password || "");
        if (!email || !password) {
          writeJson(res, 400, { error: "Missing fields" });
          return;
        }
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
        return;
      } catch (e) {
        writeJson(res, 500, { error: e?.message || "Server error" });
        return;
      }
    }

    if (req.method === "POST" && (pathname === "/api/songs" || pathname === "/api/songs/")) {
      try {
        const upload = await parseSongUpload(req);
        const email = upload.fields.email.trim().toLowerCase();
        if (!email || !upload.fields.title) {
          writeJson(res, 400, { error: "Missing email or title" });
          return;
        }
        const user = await findUserByEmail(email);
        if (!user) {
          writeJson(res, 404, { error: "Account not found" });
          return;
        }
        const col = await getSongsCollection();
        const doc = {
          id: crypto.randomUUID(),
          ownerEmail: email,
          title: upload.fields.title,
          description: upload.fields.description || "",
          artworkFileId: upload.artworkId,
          audioFileId: upload.audioId,
          createdAt: new Date().toISOString(),
        };
        await col.insertOne(doc);
        writeJson(res, 201, doc);
        return;
      } catch (e) {
        writeJson(res, 500, { error: e?.message || "Server error" });
        return;
      }
    }

    if (req.method === "GET" && pathname === "/api/feed") {
      try {
        const col = await getSongsCollection();
        const list = await col.find({}).sort({ createdAt: -1 }).toArray();
        writeJson(res, 200, await enrichSongs(list));
        return;
      } catch (e) {
        writeJson(res, 500, { error: e?.message || "Server error" });
        return;
      }
    }

    if (req.method === "GET" && pathname.startsWith("/api/songs")) {
      const email = url.searchParams.get("email") || "";
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
        return;
      } catch (e) {
        writeJson(res, 500, { error: e?.message || "Server error" });
        return;
      }
    }

    if (req.method === "GET" && pathname === "/api/user") {
      const email = url.searchParams.get("email") || "";
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
        return;
      } catch (e) {
        writeJson(res, 500, { error: e?.message || "Server error" });
        return;
      }
    }

    if ((req.method === "GET" || req.method === "HEAD") && pathname.startsWith("/api/artwork/")) {
      await streamArtwork(req, res, pathname.split("/").pop());
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && pathname.startsWith("/api/audio/")) {
      await streamAudio(req, res, pathname.split("/").pop());
      return;
    }

    writeText(res, 404, "Not Found");
  } catch (e) {
    writeJson(res, 500, { error: e?.message || "Server error" });
  }
}
