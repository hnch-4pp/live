import { S3Client, HeadObjectCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

function r2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function bucketName(): string {
  const b = process.env.R2_BUCKET_NAME;
  if (!b) throw new Error("R2_BUCKET_NAME not configured");
  return b;
}

function publicBase(): string {
  const u = process.env.R2_PUBLIC_URL;
  if (!u) throw new Error("R2_PUBLIC_URL not configured");
  return u.replace(/\/$/, "");
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  /**
   * Configure CORS on the R2 bucket so browsers can PUT directly.
   * Called once at server startup.
   */
  async configureCors(): Promise<void> {
    try {
      await r2Client().send(
        new PutBucketCorsCommand({
          Bucket: bucketName(),
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: ["*"],
                AllowedMethods: ["PUT", "GET", "HEAD"],
                AllowedHeaders: ["*"],
                MaxAgeSeconds: 86400,
              },
            ],
          },
        }),
      );
    } catch (err) {
      // Non-fatal — log and continue
      console.error("[R2] Failed to configure CORS:", err);
    }
  }

  /**
   * Generate a presigned PUT URL for a new upload.
   * Returns:
   *  - uploadURL  → client PUTs the file here (expires in 15 min)
   *  - objectPath → internal path stored in DB (e.g. /objects/uploads/uuid.jpg)
   *  - publicUrl  → direct R2 public URL to display the image immediately
   */
  async getObjectEntityUploadURL(fileName = "file", contentType = "application/octet-stream"): Promise<{
    uploadURL: string;
    objectPath: string;
    publicUrl: string;
  }> {
    const uuid = randomUUID();
    const ext = (fileName.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const key = `uploads/${uuid}.${ext}`;

    const uploadURL = await getSignedUrl(
      r2Client(),
      new PutObjectCommand({ Bucket: bucketName(), Key: key, ContentType: contentType }),
      { expiresIn: 900 },
    );

    return {
      uploadURL,
      objectPath: `/objects/${key}`,
      publicUrl: `${publicBase()}/${key}`,
    };
  }

  /**
   * Returns the public R2 URL for an objectPath stored in the DB.
   * Handles both the old-style path (/objects/uploads/uuid) and full URLs.
   */
  getPublicUrlForObjectPath(objectPath: string): string {
    if (objectPath.startsWith("http://") || objectPath.startsWith("https://")) {
      return objectPath;
    }
    const key = objectPath.startsWith("/objects/") ? objectPath.slice("/objects/".length) : objectPath;
    return `${publicBase()}/${key}`;
  }

  /**
   * Check whether an object exists in R2.
   * Used by the proxy /storage/objects/* endpoint.
   */
  async objectExists(objectPath: string): Promise<boolean> {
    const key = objectPath.startsWith("/objects/") ? objectPath.slice("/objects/".length) : objectPath;
    try {
      await r2Client().send(new HeadObjectCommand({ Bucket: bucketName(), Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}
