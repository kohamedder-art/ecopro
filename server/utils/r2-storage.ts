import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET = process.env.R2_BUCKET || '';
const PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

export function isR2Configured(): boolean {
  return !!(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET && PUBLIC_URL);
}

export async function uploadToR2(
  filePath: string,
  key: string,
  contentType: string
): Promise<{ url: string; key: string }> {
  const fileContent = await fs.readFile(filePath);

  await getClient().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000',
  }));

  return {
    url: `${PUBLIC_URL.replace(/\/$/, '')}/${key}`,
    key,
  };
}

export async function deleteFromR2(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}
