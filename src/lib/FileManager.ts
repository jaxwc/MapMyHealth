// FileManager.ts
import * as z from "zod";

// -----------------
// Zod schema for validation
// -----------------
export const fileSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
});

// -----------------
// File interface
// -----------------
export interface FileData {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
}

// -----------------
// FileManager class
// -----------------
export class FileManager {
  private files: Map<string, FileData> = new Map();

  createFile(data: Omit<FileData, "id" | "createdAt">): FileData {
    const newFile: FileData = {
      id: crypto.randomUUID(), // Use a unique ID
      createdAt: new Date(),
      ...data,
    };
    this.files.set(newFile.id, newFile);
    return newFile;
  }

  getFileById(id: string): FileData | undefined {
    return this.files.get(id);
  }

  listFiles(): FileData[] {
    return Array.from(this.files.values());
  }
}

// Optional: instantiate one manager for use across the app
export const fileManager = new FileManager();

