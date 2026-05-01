import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

export interface FileObject {
  Key?: string;
  LastModified?: Date;
  ETag?: string;
  Size?: number;
  StorageClass?: string;
}

const R2_BUCKET = process.env.R2_BUCKET!;

function createS3Client() {
  const isLocal = process.env.NODE_ENV !== "production";

  if (isLocal) {
    return new S3Client({
      region: "auto",
      endpoint: "http://localhost:9000",
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    });
  }

  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function uploadFile(file: Buffer, key: string) {
  try {
    const client = createS3Client();
    return client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: file,
      })
    );
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
    const client = createS3Client();
    return client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: file,
        ContentType: contentType,
      })
    );
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}

export async function getFile(key: string) {
  try {
    const client = createS3Client();
    return client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      })
    );
  } catch (error) {
    console.error("Error getting file:", error);
    throw error;
  }
}

export async function listFiles(prefix: string = ""): Promise<FileObject[]> {
  try {
    const client = createS3Client();
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix,
      })
    );
    return response.Contents || [];
  } catch (error) {
    console.error("Error listing files:", error);
    throw error;
  }
}

export async function deleteFile(key: string) {
  try {
    const client = createS3Client();
    return client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      })
    );
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
}
