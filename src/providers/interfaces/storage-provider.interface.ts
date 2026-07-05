export interface UploadOptions {
  bucket?: string;
  key: string;
  body: Buffer;
  contentType: string;
}

export interface IStorageProvider {
  upload(options: UploadOptions): Promise<{ url: string; key: string }>;
  delete(key: string, bucket?: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number, bucket?: string): Promise<string>;
}
