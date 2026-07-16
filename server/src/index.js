import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { verifySmtp } from "./mail.js";
import { parseInventoryCsv } from "./csvImport.js";

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

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

app.get("/api/inventory", async (req, res) => {
  try {
    const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const items = await prisma.inventory.findMany({
      where: category ? { category } : undefined,
      select: {
        id: true,
        assetId: true,
        type: true,
        location: true,
      },
      orderBy: { assetId: "asc" },
    });
    res.json(items);
  } catch (error) {
    console.error("Failed to fetch inventory:", error);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

app.get("/api/inventory/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid inventory id" });
    }

    const item = await prisma.inventory.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ error: "Inventory item not found" });
    }
    res.json(item);
  } catch (error) {
    console.error("Failed to fetch inventory item:", error);
    res.status(500).json({ error: "Failed to fetch inventory item" });
  }
});

app.put("/api/inventory/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid inventory id" });
    }

    const {
      assetId,
      manufacturer,
      type,
      status,
      issued,
      lastCheckIn,
      location,
      lastName,
      firstName,
      notes,
    } = req.body;

    if (!assetId || !String(assetId).trim()) {
      return res.status(400).json({ error: "assetId is required" });
    }

    const emptyToNull = (value) => {
      if (value == null) return null;
      const trimmed = String(value).trim();
      return trimmed === "" ? null : trimmed;
    };

    const parseDate = (value) => {
      const raw = emptyToNull(value);
      if (!raw) return null;
      const date = new Date(raw);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const item = await prisma.inventory.update({
      where: { id },
      data: {
        assetId: String(assetId).trim(),
        manufacturer: emptyToNull(manufacturer),
        type: emptyToNull(type),
        status: emptyToNull(status),
        issued: parseDate(issued),
        lastCheckIn: parseDate(lastCheckIn),
        location: emptyToNull(location),
        lastName: emptyToNull(lastName),
        firstName: emptyToNull(firstName),
        notes: emptyToNull(notes),
      },
    });
    res.json(item);
  } catch (error) {
    console.error("Failed to update inventory item:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Inventory item not found" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Asset ID already exists" });
    }
    res.status(500).json({ error: "Failed to update inventory item" });
  }
});

app.delete("/api/inventory/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid inventory id" });
    }

    await prisma.inventory.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete inventory item:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Inventory item not found" });
    }
    res.status(500).json({ error: "Failed to delete inventory item" });
  }
});

app.post("/api/inventory/import", async (req, res) => {
  try {
    const csv = req.body?.csv;
    if (!csv || typeof csv !== "string") {
      return res.status(400).json({ error: "Request body must include a csv string" });
    }

    let parsed;
    try {
      parsed = parseInventoryCsv(csv);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    let created = 0;
    let updated = 0;
    const rowErrors = [...parsed.errors];

    for (const row of parsed.rows) {
      const { line, ...data } = row;
      try {
        const existing = await prisma.inventory.findUnique({
          where: { assetId: data.assetId },
          select: { id: true },
        });

        if (existing) {
          await prisma.inventory.update({
            where: { assetId: data.assetId },
            data,
          });
          updated += 1;
        } else {
          await prisma.inventory.create({ data });
          created += 1;
        }
      } catch (error) {
        console.error(`Failed to import row ${line}:`, error);
        rowErrors.push({
          line,
          error: error.message || "Failed to import row",
        });
      }
    }

    res.json({
      created,
      updated,
      skipped: rowErrors.length,
      errors: rowErrors.slice(0, 50),
    });
  } catch (error) {
    console.error("Failed to import inventory CSV:", error);
    res.status(500).json({ error: "Failed to import inventory CSV" });
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
