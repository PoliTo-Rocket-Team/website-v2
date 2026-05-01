import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface FileObject {
  Key?: string;
  LastModified?: Date;
  ETag?: string;
  Size?: number;
  StorageClass?: string;
}

const R2_BUCKET = process.env.R2_BUCKET!;
const APPLICATION_FILES_R2_BINDING = "APPLICATION_FILES_R2_BUCKET";

type S3Module = typeof import("@aws-sdk/client-s3");
type BoundR2Bucket = {
  put: (
    key: string,
    value: Buffer,
    options?: { httpMetadata?: { contentType?: string } }
  ) => Promise<{ httpEtag?: string }>;
  get: (key: string) => Promise<{
    body?: ReadableStream | null;
    httpMetadata?: { contentType?: string };
    httpEtag?: string;
  } | null>;
  list: (options?: { prefix?: string }) => Promise<{
    objects: Array<{
      key: string;
      uploaded: Date;
      httpEtag?: string;
      size: number;
    }>;
  }>;
  delete: (key: string) => Promise<void>;
};

async function getLocalS3Module(): Promise<S3Module> {
  return import("@aws-sdk/client-s3");
}

function getProductionBucket(): BoundR2Bucket {
  const { env } = getCloudflareContext();
  const bucket = env[APPLICATION_FILES_R2_BINDING as keyof typeof env];

  if (!bucket) {
    throw new Error(
      `${APPLICATION_FILES_R2_BINDING} binding is not configured in wrangler.jsonc`
    );
  }

  return bucket as BoundR2Bucket;
}

function isLocalStorage() {
  return process.env.NODE_ENV !== "production";
}

export async function uploadFile(file: Buffer, key: string) {
  try {
    if (isLocalStorage()) {
      const { S3Client, PutObjectCommand } = await getLocalS3Module();
      const client = new S3Client({
        region: "auto",
        endpoint: "http://localhost:9000",
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
        forcePathStyle: true,
      });

      return client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: file,
        })
      );
    }

    await getProductionBucket().put(key, file);
    return { ETag: undefined };
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}

export async function uploadFileWithType(
  file: Buffer,
  key: string,
  contentType: string
) {
  try {
    if (isLocalStorage()) {
      const { S3Client, PutObjectCommand } = await getLocalS3Module();
      const client = new S3Client({
        region: "auto",
        endpoint: "http://localhost:9000",
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
        forcePathStyle: true,
      });

      return client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: file,
          ContentType: contentType,
        })
      );
    }

    const result = await getProductionBucket().put(key, file, {
      httpMetadata: {
        contentType,
      },
    });

    return { ETag: result.httpEtag };
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}

export async function getFile(key: string) {
  try {
    if (isLocalStorage()) {
      const { S3Client, GetObjectCommand } = await getLocalS3Module();
      const client = new S3Client({
        region: "auto",
        endpoint: "http://localhost:9000",
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
        forcePathStyle: true,
      });

      return client.send(
        new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
        })
      );
    }

    const object = await getProductionBucket().get(key);
    return {
      Body: object?.body ?? null,
      ContentType: object?.httpMetadata?.contentType,
      ETag: object?.httpEtag,
    };
  } catch (error) {
    console.error("Error getting file:", error);
    throw error;
  }
}

export async function listFiles(prefix: string = ""): Promise<FileObject[]> {
  try {
    if (isLocalStorage()) {
      const { S3Client, ListObjectsV2Command } = await getLocalS3Module();
      const client = new S3Client({
        region: "auto",
        endpoint: "http://localhost:9000",
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
        forcePathStyle: true,
      });

      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: R2_BUCKET,
          Prefix: prefix,
        })
      );

      return response.Contents || [];
    }

    const listed = await getProductionBucket().list({ prefix });
    return listed.objects.map(object => ({
      Key: object.key,
      LastModified: object.uploaded,
      ETag: object.httpEtag,
      Size: object.size,
    }));
  } catch (error) {
    console.error("Error listing files:", error);
    throw error;
  }
}

export async function deleteFile(key: string) {
  try {
    if (isLocalStorage()) {
      const { S3Client, DeleteObjectCommand } = await getLocalS3Module();
      const client = new S3Client({
        region: "auto",
        endpoint: "http://localhost:9000",
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
        forcePathStyle: true,
      });

      return client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
        })
      );
    }

    await getProductionBucket().delete(key);
    return {};
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
}
