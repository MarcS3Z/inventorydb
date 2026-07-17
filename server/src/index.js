import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { verifySmtp, sendMail } from "./mail.js";
import { parseInventoryCsv } from "./csvImport.js";
import { createRequireAuth, isAuthDisabled } from "./auth.js";

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const requireAuth = createRequireAuth();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", async (_req, res) => {
  const health = {
    status: "ok",
    database: "unknown",
    smtp: process.env.SMTP_HOST && process.env.SMTP_USER ? "configured" : "missing",
    auth: isAuthDisabled() ? "disabled" : "required",
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

app.use("/api", requireAuth);

app.get("/api/me", (req, res) => {
  const payload = req.auth?.payload ?? req.auth ?? {};
  const roles = payload.roles ?? payload.role ?? [];
  res.json({
    sub: payload.sub ?? null,
    name: payload.name ?? null,
    preferredUsername:
      payload.preferred_username ?? payload.upn ?? null,
    roles: Array.isArray(roles) ? roles : roles ? [roles] : [],
    authDisabled: isAuthDisabled(),
  });
});

app.get("/api/categories", async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        category: true,
        ticketEmail: true,
      },
    });
    res.json(categories);
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

app.get("/api/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid category id" });
    }

    const category = await prisma.category.findUnique({
      where: { id },
      select: {
        id: true,
        category: true,
        ticketEmail: true,
      },
    });
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(category);
  } catch (error) {
    console.error("Failed to fetch category:", error);
    res.status(500).json({ error: "Failed to fetch category" });
  }
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
    const categoryIdRaw =
      typeof req.query.categoryId === "string"
        ? req.query.categoryId.trim()
        : "";
    const categoryId = categoryIdRaw ? Number(categoryIdRaw) : null;
    const category =
      typeof req.query.category === "string" ? req.query.category.trim() : "";
    const assetId =
      typeof req.query.assetId === "string" ? req.query.assetId.trim() : "";
    const status =
      typeof req.query.status === "string" ? req.query.status.trim() : "";
    const location =
      typeof req.query.location === "string" ? req.query.location.trim() : "";
    const name = typeof req.query.name === "string" ? req.query.name.trim() : "";

    let categoryFilter = category || undefined;
    if (categoryId != null) {
      if (!Number.isInteger(categoryId) || categoryId < 1) {
        return res.status(400).json({ error: "Invalid categoryId" });
      }
      const categoryRow = await prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!categoryRow) {
        return res.status(404).json({ error: "Category not found" });
      }
      categoryFilter = categoryRow.category;
    }

    const where = {
      ...(categoryFilter && { category: categoryFilter }),
      ...(assetId && { assetId: { contains: assetId } }),
      ...(status && { status }),
      ...(location && { location }),
      ...(name && {
        OR: [
          { firstName: { contains: name } },
          { lastName: { contains: name } },
        ],
      }),
    };

    const items = await prisma.inventory.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      select: {
        id: true,
        assetId: true,
        type: true,
        status: true,
        location: true,
        lastName: true,
        firstName: true,
      },
      orderBy: { assetId: "asc" },
    });
    res.json(items);
  } catch (error) {
    console.error("Failed to fetch inventory:", error);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

app.post("/api/inventory", async (req, res) => {
  try {
    const {
      category,
      categoryId: categoryIdRaw,
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
    } = req.body ?? {};

    const categoryId =
      categoryIdRaw != null && categoryIdRaw !== ""
        ? Number(categoryIdRaw)
        : null;

    let trimmedCategory =
      typeof category === "string" ? category.trim() : "";

    if (categoryId != null) {
      if (!Number.isInteger(categoryId) || categoryId < 1) {
        return res.status(400).json({ error: "Invalid categoryId" });
      }
      const categoryRow = await prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!categoryRow) {
        return res.status(404).json({ error: "Category not found" });
      }
      trimmedCategory = categoryRow.category;
    }

    const trimmedAssetId =
      typeof assetId === "string" ? assetId.trim() : "";

    if (!trimmedCategory) {
      return res.status(400).json({ error: "category or categoryId is required" });
    }
    if (!trimmedAssetId) {
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

    const item = await prisma.inventory.create({
      data: {
        assetId: trimmedAssetId,
        category: trimmedCategory,
        manufacturer: emptyToNull(manufacturer),
        type: emptyToNull(type),
        status: emptyToNull(status) ?? "Available",
        issued: parseDate(issued),
        lastCheckIn: parseDate(lastCheckIn),
        location: emptyToNull(location),
        lastName: emptyToNull(lastName),
        firstName: emptyToNull(firstName),
        notes: emptyToNull(notes),
      },
    });
    res.status(201).json(item);
  } catch (error) {
    console.error("Failed to create inventory item:", error);
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Asset ID already exists" });
    }
    res.status(500).json({ error: "Failed to create inventory item" });
  }
});

app.get("/api/locations", async (_req, res) => {
  try {
    const locations = await prisma.location.findMany({
      select: {
        id: true,
        shortcode: true,
        name: true,
      },
      orderBy: { shortcode: "asc" },
    });
    res.json(locations);
  } catch (error) {
    console.error("Failed to fetch locations:", error);
    res.status(500).json({ error: "Failed to fetch locations" });
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

app.post("/api/inventory/:id/ticket", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid inventory id" });
    }

    const description =
      typeof req.body?.description === "string"
        ? req.body.description.trim()
        : "";
    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }

    const item = await prisma.inventory.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    const assetId = item.assetId || String(item.id);
    const assetType = item.type || "Unknown";

    const categoryRow = item.category
      ? await prisma.category.findUnique({ where: { category: item.category } })
      : null;
    const to =
      categoryRow?.ticketEmail ||
      process.env.TICKET_EMAIL ||
      "lhmpticomhelpdesk@lhmphysicaltherapy.freshservice.com";

    if (!to) {
      return res.status(500).json({
        error: "No ticket email configured for this category",
      });
    }

    const payload = req.auth?.payload ?? req.auth ?? {};
    const userEmail =
      payload.preferred_username ||
      payload.upn ||
      payload.unique_name ||
      payload.email ||
      null;
    const userName = payload.name || null;
    const fromAddress = userEmail
      ? userName
        ? `"${String(userName).replace(/"/g, "")}" <${userEmail}>`
        : userEmail
      : process.env.SMTP_FROM;

    await sendMail({
      to,
      from: fromAddress,
      subject: `ASSET ISSUE: ${assetId} - ${assetType}`,
      text: description,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to submit asset ticket:", error);
    res.status(500).json({ error: "Failed to submit ticket email" });
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

app.use((err, _req, res, next) => {
  if (err?.name === "UnauthorizedError" || err?.status === 401) {
    console.warn("API auth rejected:", err.message || err.code || err);
    return res.status(401).json({
      error: "Unauthorized",
      detail: err.message || err.code || null,
    });
  }
  if (err?.status === 403) {
    return res.status(403).json({ error: "Forbidden" });
  }
  return next(err);
});

app.listen(PORT, async () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  if (isAuthDisabled()) {
    console.warn("AUTH_DISABLED=true — API authentication is off");
  } else {
    console.log("API authentication requires Microsoft Entra ID bearer tokens");
  }
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
