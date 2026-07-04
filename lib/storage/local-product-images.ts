import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function sanitizeExtension(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  return extension.replace(/[^a-z0-9]/g, "") || "jpg";
}

export async function saveProductImageLocally(productId: string, file: File) {
  const extension = sanitizeExtension(file.name);
  const fileName = `${productId}-${crypto.randomUUID()}.${extension}`;
  const relativeDirectory = path.join("uploads", "products");
  const absoluteDirectory = path.join(process.cwd(), "public", relativeDirectory);
  const absolutePath = path.join(absoluteDirectory, fileName);
  const publicUrl = `/${relativeDirectory}/${fileName}`;

  await mkdir(absoluteDirectory, { recursive: true });
  const arrayBuffer = await file.arrayBuffer();
  await writeFile(absolutePath, Buffer.from(arrayBuffer));

  return {
    storagePath: absolutePath,
    publicUrl,
  };
}
