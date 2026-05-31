import express, { Router, type IRouter, type Request, type Response } from "express";
import { RequestUploadUrlBody } from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads
 *
 * Server-side upload: browser sends the file as raw body, server uploads to R2.
 * No browser CORS issues — everything stays same-origin.
 * Returns { objectPath, publicUrl }.
 */
router.post(
  "/storage/uploads",
  express.raw({ type: "*/*", limit: "10mb" }),
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body as Buffer;
    const fileName = (req.headers["x-file-name"] as string | undefined) ?? "upload.bin";
    const contentType = (req.headers["content-type"] ?? "application/octet-stream").split(";")[0].trim();

    if (!body || !Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: "Empty file body" });
      return;
    }

    try {
      const result = await objectStorageService.uploadObject(fileName, body, contentType);
      res.json(result);
    } catch (error) {
      req.log.error({ err: error }, "Error uploading file to R2");
      res.status(500).json({ error: "Failed to upload file" });
    }
  },
);

/**
 * POST /storage/uploads/request-url  (kept for backward compatibility)
 *
 * Request a presigned R2 URL for file upload.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;
    const { uploadURL, objectPath, publicUrl } = await objectStorageService.getObjectEntityUploadURL(name, contentType);

    res.json({ uploadURL, objectPath, publicUrl, metadata: { name, size, contentType } });
  } catch (error) {
    req.log.error({ err: error }, "Error generating R2 upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Backward-compatible proxy: redirects to the R2 public URL.
 * Supports old avatarUrls stored as /objects/uploads/uuid in the DB.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const publicUrl = objectStorageService.getPublicUrlForObjectPath(objectPath);
    res.redirect(302, publicUrl);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
