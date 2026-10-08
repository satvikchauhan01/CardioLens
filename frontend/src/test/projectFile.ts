// Reads a file of the frontend project in a test, e.g. the heart model in public/.
// Node's type package is not installed here, so the two functions used are typed by hand.

interface NodeFileSystem {
  readFileSync(path: string): Uint8Array;
}
interface NodeUrl {
  fileURLToPath(url: string): string;
}

async function nodeModule<T>(name: string): Promise<T> {
  return (await import(/* @vite-ignore */ name)) as T;
}

/** `path` is relative to the frontend folder, e.g. "public/models/heart.glb". */
export async function readProjectFile(path: string): Promise<Uint8Array> {
  const fs = await nodeModule<NodeFileSystem>("node:fs");
  const { fileURLToPath } = await nodeModule<NodeUrl>("node:url");
  // Kept in a variable: Vite rewrites `new URL(..., import.meta.url)` when it sees it spelled out.
  const here = import.meta.url;
  return fs.readFileSync(fileURLToPath(new URL(`../../${path}`, here).href));
}
