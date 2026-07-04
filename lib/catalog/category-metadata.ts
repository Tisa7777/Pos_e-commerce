interface CategoryMetadataPayload {
  text?: string | null;
  icon?: string | null;
  color?: string | null;
}

interface ParsedCategoryMetadata {
  description: string | null;
  visualIcon: string | null;
  accentColor: string | null;
}

export function parseCategoryMetadata(
  rawDescription?: string | null,
): ParsedCategoryMetadata {
  if (!rawDescription) {
    return {
      description: null,
      visualIcon: null,
      accentColor: null,
    };
  }

  const trimmed = rawDescription.trim();
  if (!trimmed.startsWith("{")) {
    return {
      description: rawDescription,
      visualIcon: null,
      accentColor: null,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as CategoryMetadataPayload | null;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid category metadata payload");
    }

    return {
      description: parsed.text?.trim() || null,
      visualIcon: parsed.icon?.trim() || null,
      accentColor: parsed.color?.trim() || null,
    };
  } catch {
    return {
      description: rawDescription,
      visualIcon: null,
      accentColor: null,
    };
  }
}

export function serializeCategoryMetadata(input: {
  description?: string | null;
  visualIcon?: string | null;
  accentColor?: string | null;
}) {
  const description = input.description?.trim() || null;
  const visualIcon = input.visualIcon?.trim() || null;
  const accentColor = input.accentColor?.trim() || null;

  if (!visualIcon && !accentColor) {
    return description;
  }

  return JSON.stringify({
    text: description,
    icon: visualIcon,
    color: accentColor,
  });
}
