export type JsonObject = Record<string, unknown>

export function withMergedMeta(
  patch: JsonObject,
  existingMeta: JsonObject,
  meta: JsonObject | undefined,
): JsonObject {
  return meta === undefined ? patch : { ...patch, meta: { ...existingMeta, ...meta } }
}
