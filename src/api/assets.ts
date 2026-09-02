import { fetchApi } from "./client";

export async function uploadAsset(
  workspaceId: string,
  file: File,
): Promise<string> {
  // 1. Calculate SHA-256
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const checksum = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // 2. Create Upload
  const createResponse = await fetchApi(
    `/v1/workspaces/${workspaceId}/assets/uploads`,
    {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        byteSize: file.size,
        checksum,
      }),
    },
  );
  const { data: uploadInfo } = await createResponse.json();

  // 3. Put Bytes
  await fetchApi(uploadInfo.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: arrayBuffer,
  });

  // 4. Complete Upload
  const completeResponse = await fetchApi(
    `/v1/workspaces/${workspaceId}/assets/uploads/${uploadInfo.uploadId}/complete`,
    {
      method: "POST",
    },
  );
  const { data: assetInfo } = await completeResponse.json();

  return assetInfo.id;
}
