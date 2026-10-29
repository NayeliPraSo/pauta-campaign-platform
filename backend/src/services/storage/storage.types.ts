
export interface StoredFile {
  key: string;
}

export interface StorageService {
  save(
    fileBuffer: Buffer,
    originalFilename: string,
  ): Promise<StoredFile>;

  delete(key: string): Promise<void>;
}
