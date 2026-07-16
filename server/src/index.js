import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { verifySmtp } from "./mail.js";

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  const health = {
    status: "ok",
    database: "unknown",
    smtp: process.env.SMTP_HOST && process.env.SMTP_USER ? "configured" : "missing",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.database = "ok";
  } catch (error) {
    console.error("Database health check failed:", error);
    health.database = "error";
    health.status = "degraded";
  }

  if (health.smtp === "missing") {
    health.status = "degraded";
  }

  res.status(health.status === "ok" ? 200 : 503).json(health);
});

app.get("/api/items", async (_req, res) => {
  try {
    const items = await prisma.item.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(items);
  } catch (error) {
    console.error("Failed to fetch items:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

app.get("/api/items/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.item.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json(item);
  } catch (error) {
    console.error("Failed to fetch item:", error);
    res.status(500).json({ error: "Failed to fetch item" });
  }
});

app.post("/api/items", async (req, res) => {
  try {
    const { name, description, sku, quantity, priceCents } = req.body;
    if (!name || !sku) {
      return res.status(400).json({ error: "name and sku are required" });
    }
    const item = await prisma.item.create({
      data: {
        name,
        description: description ?? null,
        sku,
        quantity: Number(quantity) || 0,
        priceCents: Number(priceCents) || 0,
      },
    });
    res.status(201).json(item);
  } catch (error) {
    console.error("Failed to create item:", error);
    if (error.code === "P2002") {
      return res.status(409).json({ error: "SKU already exists" });
    }
    res.status(500).json({ error: "Failed to create item" });
  }
});

app.put("/api/items/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, description, sku, quantity, priceCents } = req.body;
    const item = await prisma.item.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(sku !== undefined && { sku }),
        ...(quantity !== undefined && { quantity: Number(quantity) }),
        ...(priceCents !== undefined && { priceCents: Number(priceCents) }),
      },
    });
    res.json(item);
  } catch (error) {
    console.error("Failed to update item:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Item not found" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "SKU already exists" });
    }
    res.status(500).json({ error: "Failed to update item" });
  }
});

app.delete("/api/items/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.item.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete item:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Item not found" });
    }
    res.status(500).json({ error: "Failed to delete item" });
  }
});

app.listen(PORT, async () => {
  console.log(`Server listening on http://localhost:${PORT}`);

  try {
    await prisma.$connect();
    console.log("Connected to MySQL");
  } catch (error) {
    console.error("Failed to connect to MySQL:", error.message);
  }

  try {
    await verifySmtp();
    console.log("SMTP connection verified");
  } catch (error) {
    console.error("Failed to verify SMTP:", error.message);
  }
});
