export async function readApiJsonOrText(response: Response): Promise<{ data: any | null; text: string | null }> {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return { data: await response.json(), text: null }
  }
  return { data: null, text: await response.text() }
}
