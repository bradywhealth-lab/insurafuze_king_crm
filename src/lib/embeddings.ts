/**
 * Embedding utilities for AI learning system.
 *
 * MVP: Uses hash-based embeddings for development (no external API required).
 * Production: Replace with OpenAI embeddings or similar for better semantic quality.
 */

/**
 * Generates a 1536-dimensional embedding vector for text.
 *
 * MVP Implementation: Uses a hash function to generate consistent
 * pseudo-random values based on the input text. This ensures the same
 * input always produces the same embedding, enabling similarity testing.
 *
 * Production: Replace with OpenAI embedding API or similar.
 *
 * @param text - Input text to embed
 * @returns A 1536-dimensional vector of numbers between 0 and 1
 */
export function generateEmbedding(text: string): number[] {
  const dimensions = 1536
  const embedding: number[] = []

  for (let i = 0; i < dimensions; i++) {
    // Generate a pseudo-random value based on text and position
    const hash = simpleHash(text + i)
    embedding.push((hash % 1000) / 1000) // Normalize to 0-1
  }

  return embedding
}

/**
 * Simple string hash function for consistent pseudo-random values.
 * @param str - String to hash
 * @returns A 32-bit integer hash value
 */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Calculates cosine similarity between two embedding vectors.
 *
 * Returns a value between -1 and 1, where:
 * - 1.0 = identical vectors (same direction)
 * - 0.0 = orthogonal vectors (no similarity)
 * - -1.0 = opposite vectors
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Cosine similarity score between -1 and 1
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Computes Euclidean distance between two embedding vectors.
 * Useful for alternative similarity metrics.
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Euclidean distance (lower = more similar)
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity

  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

/**
 * Finds the most similar embedding from a list of candidates.
 *
 * @param query - Query embedding to match
 * @param candidates - Array of candidate embeddings with their IDs
 * @param threshold - Minimum similarity score to return a match (default: 0.5)
 * @returns Best match with similarity score, or null if no match exceeds threshold
 */
export function findMostSimilar<T extends { embedding: number[]; id: string }>(
  query: number[],
  candidates: T[],
  threshold = 0.5
): { item: T; similarity: number } | null {
  let best: { item: T; similarity: number } | null = null

  for (const candidate of candidates) {
    const similarity = cosineSimilarity(query, candidate.embedding)
    if (similarity > threshold && (!best || similarity > best.similarity)) {
      best = { item: candidate, similarity }
    }
  }

  return best
}
