import type { OrderLine } from "@/types/domain";

interface PosReceiptMetadataPayload {
  kind?: string;
  text?: string | null;
  cashierName?: string | null;
  cashReceived?: number | null;
  changeGiven?: number | null;
  displaySubtotal?: number | null;
  displayTax?: number | null;
  displayDiscount?: number | null;
  displayTotal?: number | null;
  taxRate?: number | null;
  itemSequence?: string[] | null;
}

interface ParsedPosReceiptMetadata {
  noteText: string | null;
  cashierName: string | null;
  cashReceived: number | null;
  changeGiven: number | null;
  displaySubtotal: number | null;
  displayTax: number | null;
  displayDiscount: number | null;
  displayTotal: number | null;
  taxRate: number | null;
  itemSequence: string[];
}

function toNullableNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function emptyMetadata(noteText: string | null = null): ParsedPosReceiptMetadata {
  return {
    noteText,
    cashierName: null,
    cashReceived: null,
    changeGiven: null,
    displaySubtotal: null,
    displayTax: null,
    displayDiscount: null,
    displayTotal: null,
    taxRate: null,
    itemSequence: [],
  };
}

export function parsePosReceiptMetadata(rawNotes?: string | null): ParsedPosReceiptMetadata {
  if (!rawNotes) {
    return emptyMetadata();
  }

  const trimmed = rawNotes.trim();
  if (!trimmed.startsWith("{")) {
    return emptyMetadata(rawNotes);
  }

  try {
    const parsed = JSON.parse(trimmed) as PosReceiptMetadataPayload | null;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid POS receipt metadata payload");
    }

    return {
      noteText: parsed.text?.trim() || null,
      cashierName: parsed.cashierName?.trim() || null,
      cashReceived: toNullableNumber(parsed.cashReceived),
      changeGiven: toNullableNumber(parsed.changeGiven),
      displaySubtotal: toNullableNumber(parsed.displaySubtotal),
      displayTax: toNullableNumber(parsed.displayTax),
      displayDiscount: toNullableNumber(parsed.displayDiscount),
      displayTotal: toNullableNumber(parsed.displayTotal),
      taxRate: toNullableNumber(parsed.taxRate),
      itemSequence: Array.isArray(parsed.itemSequence)
        ? parsed.itemSequence.filter((value): value is string => typeof value === "string")
        : [],
    };
  } catch {
    return emptyMetadata(rawNotes);
  }
}

export function serializePosReceiptMetadata(input: {
  noteText?: string | null;
  cashierName?: string | null;
  cashReceived?: number | null;
  changeGiven?: number | null;
  displaySubtotal?: number | null;
  displayTax?: number | null;
  displayDiscount?: number | null;
  displayTotal?: number | null;
  taxRate?: number | null;
  itemSequence?: string[];
}) {
  const noteText = input.noteText?.trim() || null;
  const cashierName = input.cashierName?.trim() || null;
  const cashReceived = toNullableNumber(input.cashReceived);
  const changeGiven = toNullableNumber(input.changeGiven);
  const displaySubtotal = toNullableNumber(input.displaySubtotal);
  const displayTax = toNullableNumber(input.displayTax);
  const displayDiscount = toNullableNumber(input.displayDiscount);
  const displayTotal = toNullableNumber(input.displayTotal);
  const taxRate = toNullableNumber(input.taxRate);
  const itemSequence = input.itemSequence?.filter(Boolean) ?? [];

  const hasStructuredFields =
    cashierName !== null ||
    cashReceived !== null ||
    changeGiven !== null ||
    displaySubtotal !== null ||
    displayTax !== null ||
    displayDiscount !== null ||
    displayTotal !== null ||
    taxRate !== null ||
    itemSequence.length > 0;

  if (!hasStructuredFields) {
    return noteText;
  }

  return JSON.stringify({
    kind: "pos_receipt",
    text: noteText,
    cashierName,
    cashReceived,
    changeGiven,
    displaySubtotal,
    displayTax,
    displayDiscount,
    displayTotal,
    taxRate,
    itemSequence,
  } satisfies PosReceiptMetadataPayload);
}

export function sortReceiptItemsBySequence(items: OrderLine[], itemSequence: string[]) {
  if (itemSequence.length === 0) {
    return items;
  }

  const orderIndex = new Map(itemSequence.map((productId, index) => [productId, index]));

  return [...items].sort((left, right) => {
    const leftIndex = orderIndex.get(left.productId) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = orderIndex.get(right.productId) ?? Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.productName.localeCompare(right.productName);
  });
}
