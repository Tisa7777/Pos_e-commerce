interface CustomerMetadataPayload {
  text?: string | null;
  discountPercent?: number | null;
  discountExpiresAt?: string | null;
}

export function parseCustomerMetadata(rawNotes?: string | null) {
  if (!rawNotes) {
    return {
      notes: null,
      discountPercent: 0,
      discountExpiresAt: null,
    };
  }

  const trimmed = rawNotes.trim();
  if (!trimmed.startsWith("{")) {
    return {
      notes: rawNotes,
      discountPercent: 0,
      discountExpiresAt: null,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as CustomerMetadataPayload | null;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid customer metadata payload");
    }

    return {
      notes: parsed.text?.trim() || null,
      discountPercent: Math.max(Number(parsed.discountPercent) || 0, 0),
      discountExpiresAt: parsed.discountExpiresAt?.trim() || null,
    };
  } catch {
    return {
      notes: rawNotes,
      discountPercent: 0,
      discountExpiresAt: null,
    };
  }
}

export function serializeCustomerMetadata(input: {
  notes?: string | null;
  discountPercent?: number | null;
  discountExpiresAt?: string | null;
}) {
  const notes = input.notes?.trim() || null;
  const discountPercent = Math.max(Number(input.discountPercent) || 0, 0);
  const discountExpiresAt = input.discountExpiresAt?.trim() || null;

  if (!discountPercent && !discountExpiresAt) {
    return notes;
  }

  return JSON.stringify({
    text: notes,
    discountPercent,
    discountExpiresAt,
  });
}

export function isCustomerDiscountActive(customer: {
  discountPercent?: number;
  discountExpiresAt?: string | null;
}) {
  if (!customer.discountPercent || customer.discountPercent <= 0) {
    return false;
  }

  if (!customer.discountExpiresAt) {
    return true;
  }

  return new Date(customer.discountExpiresAt).getTime() >= Date.now();
}

export function getCustomerSegment(customer: {
  fullName: string;
  visitCount?: number;
}) {
  if (customer.fullName.toLowerCase().includes("walk-in")) {
    return "walk-in" as const;
  }

  const visits = customer.visitCount ?? 0;
  if (visits >= 6) {
    return "vip" as const;
  }

  if (visits >= 3) {
    return "regular" as const;
  }

  return "new" as const;
}
