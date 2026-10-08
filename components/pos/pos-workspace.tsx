"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  useActionState,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { completePosSaleAction } from "@/app/actions/orders";
import { createCustomerAction } from "@/app/actions/customers";
import { printReceiptElement } from "@/lib/print-receipt";
import {
  normalizePosCashierOptions,
  publishCashier,
  toStoredCashier,
  usePosCashierContext,
  useStoredPosCashier,
} from "@/components/pos/cashier-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isCustomerDiscountActive } from "@/lib/crm/customer-metadata";
import { isSupabaseConfigured } from "@/lib/env";
import {
  getProductIconName,
  type PremiumIconName,
} from "@/lib/premium-icons";
import {
  DEFAULT_DRINK_SIZE,
  DRINK_SIZES,
  getCartLineLabel,
  getDrinkSizePrice,
  isDrinkProduct,
  isStockTrackedProduct,
  type DrinkSize,
} from "@/lib/catalog/drink-sizes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, formatCurrency, formatKhr } from "@/lib/utils";
import type {
  ActionState,
  CustomerSummary,
  PosCashierOption,
  PosSaleSnapshot,
  PosShiftSummary,
  ProductCardData,
} from "@/types/domain";

interface PosWorkspaceProps {
  products: ProductCardData[];
  customers: CustomerSummary[];
  defaultView?: "register" | "cart" | "checkout";
  lastTransaction?: PosSaleSnapshot | null;
  cashierName?: string;
  cashierOptions?: PosCashierOption[];
  defaultCashier?: PosCashierOption;
  /** KHR exchange rate. 0 or undefined = don't show KHR. */
  khrRate?: number;
  /** Tax rate as a percentage (e.g. 10 means 10%). Default 10. */
  taxPercent?: number;
}

type Step = "build" | "payment" | "receipt";
type FilterKey = "all" | "coffee-tea" | "bakery" | "accessories";
type PosPaymentMethod = "cash" | "card" | "qr";

interface CartItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  size?: DrinkSize | null;
  stockTracked: boolean;
  categoryName?: string | null;
  stockQuantity: number;
  iconName: PremiumIconName;
}

interface CompletedReceipt {
  sale: PosSaleSnapshot;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  cashReceived: number;
  changeDue: number;
  customerName: string;
  cashierName: string;
  paymentMethod: PosPaymentMethod;
  notes?: string;
}

const PRODUCT_FILTERS: Array<{
  key: FilterKey;
  label: string;
  iconName?: PremiumIconName;
  categoryName?: string;
}> = [
  { key: "all", label: "All", iconName: "all-sales" },
  { key: "coffee-tea", label: "Coffee & Tea", iconName: "coffee", categoryName: "Coffee & Tea" },
  { key: "bakery", label: "Bakery", iconName: "bakery", categoryName: "Bakery" },
  { key: "accessories", label: "Accessories", iconName: "accessories", categoryName: "Accessories" },
];

const PAYMENT_OPTIONS: Array<{ key: PosPaymentMethod; label: string; iconName: PremiumIconName }> = [
  { key: "cash", label: "Cash", iconName: "cash" },
  { key: "card", label: "Card", iconName: "card" },
  { key: "qr", label: "QR", iconName: "qr" },
];

const TOAST_DURATION_MS = 3200;
const UNDO_REMOVE_MS = 2000;
const POS_CART_STORAGE_KEY = "tisa-pos-cart-v1";
const EMPTY_CASHIER_OPTIONS: PosCashierOption[] = [];

const initialState: ActionState<PosSaleSnapshot> = {
  ok: false,
  message: "",
};

function getInitialStep(defaultView: PosWorkspaceProps["defaultView"]): Step {
  if (defaultView === "checkout") {
    return "payment";
  }

  return "build";
}

function matchesFilter(product: ProductCardData, activeFilter: FilterKey) {
  if (activeFilter === "all") {
    return true;
  }

  const selectedFilter = PRODUCT_FILTERS.find((filter) => filter.key === activeFilter);
  return product.category?.name === selectedFilter?.categoryName;
}

function formatSaleNumber(orderNumber: string) {
  const segments = orderNumber.split("-");
  const rawValue = segments.at(-1) ?? orderNumber;
  const normalized = rawValue.replace(/^0+/, "");
  return normalized || rawValue;
}

function formatSaleTime(value: string) {
  return format(new Date(value), "h:mm a");
}

function formatReceiptDate(value: string) {
  return format(new Date(value), "h:mm a · MMM d, yyyy");
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function parseCurrencyInput(value: string) {
  const sanitized = value.replace(/[^\d.]/g, "");
  const segments = sanitized.split(".");
  if (segments.length === 1) {
    return Number(segments[0] || 0);
  }

  return Number(`${segments[0]}.${segments.slice(1).join("").slice(0, 2)}`) || 0;
}

function normalizeCurrencyInput(value: string) {
  const amount = parseCurrencyInput(value);
  return amount > 0 ? amount.toFixed(2) : "";
}

function normalizeDiscountInput(value: string, maxValue: number) {
  const amount = Math.min(parseCurrencyInput(value), maxValue);
  return amount > 0 ? amount.toFixed(2) : "0";
}

function getCategoryBadgeClass(categoryName?: string | null) {
  const key = categoryName?.toLowerCase() ?? "";

  if (key.includes("coffee") || key.includes("tea")) {
    return "border-teal-100 bg-teal-50 text-teal-700";
  }

  if (key.includes("bakery")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (key.includes("accessories")) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getPosCartLineId(productId: string, size?: DrinkSize | null) {
  return size ? `${productId}:${size}` : productId;
}

function getPosCartItemLineId(item: Pick<CartItem, "productId" | "size">) {
  return getPosCartLineId(item.productId, item.size);
}

function buildCartItem(
  product: ProductCardData,
  quantity: number,
  size?: DrinkSize | null,
): CartItem {
  const lineSize = isDrinkProduct(product) ? size ?? DEFAULT_DRINK_SIZE : null;
  const stockTracked = isStockTrackedProduct(product);

  return {
    productId: product.id,
    name: product.name,
    sku: product.sku,
    quantity,
    unitPrice: getDrinkSizePrice(product.price, lineSize),
    size: lineSize,
    stockTracked,
    categoryName: product.category?.name ?? "General",
    stockQuantity: product.stockQuantity,
    iconName: getProductIconName(product.name, product.category?.name),
  };
}

function serializeCartItems(items: CartItem[]) {
  return JSON.stringify(
    items.map((item) => ({
      productId: item.productId,
      size: item.size ?? null,
      quantity: item.quantity,
    })),
  );
}

function parseStoredCartItems(rawValue: string | null) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as Array<{
      productId?: unknown;
      size?: unknown;
      quantity?: unknown;
    }>;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => ({
        productId: typeof item.productId === "string" ? item.productId : "",
        size: item.size === "M" || item.size === "L" ? (item.size as DrinkSize) : null,
        quantity: Number(item.quantity),
      }))
      .filter((item) => item.productId && Number.isInteger(item.quantity) && item.quantity > 0);
  } catch {
    return [];
  }
}

function playOnlineOrderSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1174, audioContext.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.32);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.35);
  } catch {
    // Browser audio may be blocked until the cashier interacts with the page.
  }
}

function mapRealtimeOrder(record: Record<string, unknown>) {
  return {
    id: String(record.id ?? ""),
    orderNumber: String(record.order_number ?? "Online order"),
    totalAmount: Number(record.total_amount ?? 0),
  };
}

function buildShiftCashierKey(input: {
  profileId?: string | null;
  name?: string | null;
}) {
  if (input.profileId) {
    return `profile:${input.profileId}`;
  }

  return `name:${(input.name ?? "cashier").trim().toLowerCase()}`;
}

function findOpenShiftForCashier(
  shifts: PosShiftSummary[],
  cashier: PosCashierOption,
) {
  const cashierKey = buildShiftCashierKey({
    profileId: cashier.profileId,
    name: cashier.name,
  });

  return (
    shifts.find(
      (shift) =>
        shift.status === "open" &&
        buildShiftCashierKey({
          profileId: shift.cashierProfileId,
          name: shift.cashierName,
        }) === cashierKey,
    ) ?? null
  );
}

export function PosWorkspace({
  products,
  customers,
  defaultView = "register",
  lastTransaction = null,
  cashierName = "Cashier",
  cashierOptions = EMPTY_CASHIER_OPTIONS,
  defaultCashier,
  khrRate = 0,
  taxPercent = 10,
}: PosWorkspaceProps) {
  const showKhr = khrRate > 0;
  const taxRate = taxPercent / 100;
  const formRef = useRef<HTMLFormElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastHandledSaleRef = useRef<string | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<FilterKey>("all");
  const [step, setStep] = useState<Step>(getInitialStep(defaultView));
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [discountAmount, setDiscountAmount] = useState("0");
  const [amountTenderedInput, setAmountTenderedInput] = useState("");
  const [khrTenderedInput, setKhrTenderedInput] = useState("");
  const [notes, setNotes] = useState("");
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [recentTransaction, setRecentTransaction] = useState<PosSaleSnapshot | null>(
    lastTransaction,
  );
  const [completedReceipt, setCompletedReceipt] = useState<CompletedReceipt | null>(null);
  const [recentlyRemoved, setRecentlyRemoved] = useState<CartItem | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedDrinkSizes, setSelectedDrinkSizes] = useState<Record<string, DrinkSize>>({});
  const [cartHydrated, setCartHydrated] = useState(false);
  const cashierContext = usePosCashierContext();
  const resolvedDefaultCashier = defaultCashier ?? cashierContext?.defaultCashier;
  const resolvedCashierOptions = useMemo(
    () =>
      cashierOptions.length > 0
        ? cashierOptions
        : cashierContext?.options ?? EMPTY_CASHIER_OPTIONS,
    [cashierContext?.options, cashierOptions],
  );
  const defaultPosCashier = useMemo<PosCashierOption>(
    () =>
      resolvedDefaultCashier ?? {
        id: "default-cashier",
        name: cashierName,
        profileId: null,
        role: "cashier",
      },
    [cashierName, resolvedDefaultCashier],
  );
  const cashierChoices = useMemo(
    () => normalizePosCashierOptions(resolvedCashierOptions, defaultPosCashier),
    [defaultPosCashier, resolvedCashierOptions],
  );
  const fallbackCashier = useMemo(
    () => toStoredCashier(defaultPosCashier),
    [defaultPosCashier],
  );
  const storedCashier = useStoredPosCashier(fallbackCashier);
  const selectedCashier =
    cashierChoices.find((cashier) => cashier.id === storedCashier.id) ??
    defaultPosCashier;
  const activeShift = findOpenShiftForCashier(
    cashierContext?.openShifts ?? [],
    selectedCashier,
  );

  const [state, formAction, isSubmitting] = useActionState(
    completePosSaleAction,
    initialState,
  );
  const deferredQuery = useDeferredValue(query);

  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) ?? null;

  const visibleProducts = products.filter((product) => {
    if (!matchesFilter(product, categoryFilter)) {
      return false;
    }

    if (!deferredQuery) {
      return true;
    }

    const keyword = deferredQuery.toLowerCase();
    return [product.name, product.sku, product.barcode]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(keyword));
  });

  const topSearchResult =
    visibleProducts.find(
      (product) => !isStockTrackedProduct(product) || product.stockQuantity > 0,
    ) ?? null;
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const hasItems = items.length > 0;

  const subtotal = roundCurrency(
    items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  );

  const hasCustomerDiscount =
    selectedCustomer !== null && isCustomerDiscountActive(selectedCustomer);
  const customerDiscountPercent = hasCustomerDiscount
    ? selectedCustomer?.discountPercent ?? 0
    : 0;
  const customerDiscountAmount = hasCustomerDiscount
    ? roundCurrency(subtotal * (customerDiscountPercent / 100))
    : 0;
  const tax = roundCurrency(subtotal * taxRate);
  const maxDiscount = roundCurrency(subtotal + tax);
  const manualDiscount = roundCurrency(
    Math.min(parseCurrencyInput(discountAmount), maxDiscount),
  );
  const discount = hasCustomerDiscount ? customerDiscountAmount : manualDiscount;
  const total = roundCurrency(Math.max(subtotal + tax - discount, 0));
  const usdTendered = roundCurrency(parseCurrencyInput(amountTenderedInput));
  const khrTendered = Math.round(parseCurrencyInput(khrTenderedInput));
  const khrTenderedAsUsd = showKhr && khrRate > 0 ? roundCurrency(khrTendered / khrRate) : 0;
  const amountTendered = roundCurrency(usdTendered + khrTenderedAsUsd);
  const isCashUnderpaid = paymentMethod === "cash" && amountTendered < total;
  const changeDue = paymentMethod === "cash" ? roundCurrency(Math.max(amountTendered - total, 0)) : 0;
  const cashRemaining =
    paymentMethod === "cash" ? roundCurrency(Math.max(total - amountTendered, 0)) : 0;
  const paymentReady =
    paymentMethod === "cash"
      ? hasItems && amountTendered >= total
      : hasItems && paymentConfirmed;
  const paymentBlockingMessage = !hasItems
    ? "Add at least one item before checkout."
    : paymentMethod === "cash" && amountTendered < total
      ? `Enter at least ${formatCurrency(total)} received to complete cash payment.`
      : paymentMethod !== "cash" && !paymentConfirmed
        ? `Confirm ${paymentMethod === "card" ? "card" : "QR"} payment before completing the sale.`
        : "";

  const customerDiscountLabel = hasCustomerDiscount
    ? `${selectedCustomer?.fullName}: ${customerDiscountPercent}% discount applied (-${formatCurrency(discount)})`
    : null;

  function focusSearch(selectText = false) {
    setStep("build");
    window.requestAnimationFrame(() => {
      const field = searchInputRef.current;
      if (!field) {
        return;
      }

      field.focus();
      if (selectText) {
        field.select();
      }
    });
  }

  function clearUndoTimer() {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }

  useEffect(() => {
    if (step !== "build") {
      return;
    }

    const handle = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(handle);
  }, [step]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(""), TOAST_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    return () => {
      clearUndoTimer();
    };
  }, []);

  useEffect(() => {
    const productMap = new Map(products.map((product) => [product.id, product]));
    const storedItems = parseStoredCartItems(
      window.localStorage.getItem(POS_CART_STORAGE_KEY),
    )
      .map((storedItem) => {
        const product = productMap.get(storedItem.productId);
        if (!product || (isStockTrackedProduct(product) && product.stockQuantity <= 0)) {
          return null;
        }

        return buildCartItem(
          product,
          isStockTrackedProduct(product)
            ? Math.min(storedItem.quantity, product.stockQuantity)
            : storedItem.quantity,
          storedItem.size,
        );
      })
      .filter((item): item is CartItem => item !== null);

    const frame = window.requestAnimationFrame(() => {
      if (storedItems.length > 0) {
        setItems(storedItems);
      } else if (defaultView === "checkout") {
        setStep("build");
      }

      setCartHydrated(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [defaultView, products]);

  useEffect(() => {
    if (!cartHydrated) {
      return;
    }

    window.localStorage.setItem(POS_CART_STORAGE_KEY, serializeCartItems(items));
  }, [cartHydrated, items]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel("pos-online-orders")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: "channel=eq.ecommerce",
        },
        (payload) => {
          const nextOrder = mapRealtimeOrder(payload.new as Record<string, unknown>);
          setToastMessage(
            `New online order #${formatSaleNumber(nextOrder.orderNumber)} - ${formatCurrency(nextOrder.totalAmount)}`,
          );
          playOnlineOrderSound();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    publishCashier(selectedCashier);
  }, [selectedCashier]);

  function queueUndoRemoval(item: CartItem) {
    clearUndoTimer();
    setRecentlyRemoved(item);
    undoTimerRef.current = window.setTimeout(() => {
      setRecentlyRemoved(null);
      undoTimerRef.current = null;
    }, UNDO_REMOVE_MS);
  }

  function getSelectedProductSize(product: ProductCardData) {
    return isDrinkProduct(product)
      ? selectedDrinkSizes[product.id] ?? DEFAULT_DRINK_SIZE
      : null;
  }

  function updateSelectedProductSize(productId: string, size: DrinkSize) {
    setSelectedDrinkSizes((current) => ({
      ...current,
      [productId]: size,
    }));
  }

  function addProduct(product: ProductCardData, size = getSelectedProductSize(product)) {
    const isStockTracked = isStockTrackedProduct(product);

    if (isStockTracked && product.stockQuantity <= 0) {
      return;
    }

    setItems((current) => {
      const lineId = getPosCartLineId(product.id, size);
      const existing = current.find((item) => getPosCartItemLineId(item) === lineId);
      const quantityForProduct = current
        .filter((item) => item.productId === product.id)
        .reduce((sum, item) => sum + item.quantity, 0);

      if (isStockTracked && quantityForProduct >= product.stockQuantity) {
        setToastMessage(`${product.name} has only ${product.stockQuantity} in stock.`);
        return current;
      }

      if (existing) {
        return current.map((item) =>
          getPosCartItemLineId(item) === lineId
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item,
        );
      }

      return [
        ...current,
        buildCartItem(product, 1, size),
      ];
    });
  }

  function removeItem(lineId: string, options: { allowUndo?: boolean } = {}) {
    const itemToRemove = items.find((item) => getPosCartItemLineId(item) === lineId);
    if (itemToRemove && options.allowUndo) {
      queueUndoRemoval(itemToRemove);
    }

    setItems((current) => current.filter((item) => getPosCartItemLineId(item) !== lineId));
  }

  function updateQuantity(lineId: string, delta: number) {
    const currentItem = items.find((item) => getPosCartItemLineId(item) === lineId);
    if (!currentItem) {
      return;
    }

    if (delta < 0 && currentItem.quantity === 1) {
      removeItem(lineId, { allowUndo: true });
      return;
    }

    const quantityForProduct = items
      .filter((item) => item.productId === currentItem.productId)
      .reduce((sum, item) => sum + item.quantity, 0);

    if (delta > 0 && currentItem.stockTracked && quantityForProduct >= currentItem.stockQuantity) {
      setToastMessage(`${currentItem.name} has only ${currentItem.stockQuantity} in stock.`);
      return;
    }

    setItems((current) =>
      current.map((item) =>
        getPosCartItemLineId(item) === lineId
          ? {
              ...item,
              quantity: item.stockTracked
                ? Math.min(Math.max(item.quantity + delta, 1), item.stockQuantity)
                : Math.max(item.quantity + delta, 1),
            }
          : item,
      ),
    );
  }

  function undoRemove() {
    if (!recentlyRemoved) {
      return;
    }

    const itemToRestore = recentlyRemoved;
    clearUndoTimer();
    setRecentlyRemoved(null);
    setItems((current) => {
      const lineId = getPosCartItemLineId(itemToRestore);
      const existing = current.find((item) => getPosCartItemLineId(item) === lineId);
      if (existing) {
        return current.map((item) =>
          getPosCartItemLineId(item) === lineId
            ? {
                ...item,
                quantity: Math.min(
                  item.quantity + itemToRestore.quantity,
                  item.stockTracked ? item.stockQuantity : Number.POSITIVE_INFINITY,
                ),
              }
            : item,
        );
      }

      return [...current, itemToRestore];
    });
  }

  function clearSale() {
    clearUndoTimer();
    setRecentlyRemoved(null);
    setItems([]);
    setSelectedCustomerId("");
    setPaymentMethod("cash");
    setPaymentConfirmed(false);
    setDiscountAmount("0");
    setAmountTenderedInput("");
    setKhrTenderedInput("");
    setNotes("");
  }

  async function handleAddCustomer() {
    const name = newCustomerName.trim();
    if (!name) return;
    setIsAddingCustomer(true);
    try {
      const rawPhone = newCustomerPhone.trim();
      const result = await createCustomerAction({
        fullName: name,
        phone: rawPhone ? `+855${rawPhone}` : undefined,
      });
      if (result.ok && result.data) {
        customers.push(result.data);
        setSelectedCustomerId(result.data.id);
        setShowAddCustomer(false);
        setNewCustomerName("");
        setNewCustomerPhone("");
        setToastMessage(`Customer "${name}" added`);
      } else {
        setToastMessage(result.message ?? "Failed to add customer");
      }
    } catch {
      setToastMessage("Failed to add customer");
    } finally {
      setIsAddingCustomer(false);
    }
  }
  function confirmClearAll() {
    if (!hasItems) {
      return;
    }

    if (!window.confirm("Clear all items from the current order?")) {
      return;
    }

    clearSale();
  }

  function proceedToPayment() {
    if (!hasItems) {
      return;
    }

    setStep("payment");
  }

  function goBackToOrder() {
    setStep("build");
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }

  function startNewSale() {
    clearSale();
    setCompletedReceipt(null);
    setStep("build");
    setQuery("");
    setCategoryFilter("all");
    focusSearch(true);
  }

  function handlePaymentMethodChange(nextMethod: PosPaymentMethod) {
    setPaymentMethod(nextMethod);
    setPaymentConfirmed(false);

    if (nextMethod !== "cash") {
      setAmountTenderedInput("");
    }
  }

  function handleCashierChange(nextCashierId: string) {
    const nextCashier =
      cashierChoices.find((cashier) => cashier.id === nextCashierId) ??
      defaultPosCashier;

    publishCashier(nextCashier);
  }

  const handleGlobalKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const key = typeof event.key === "string" ? event.key : "";
    const normalizedKey = key.toLowerCase();
    const target = event.target as HTMLElement | null;
    const isSearchFocused = document.activeElement === searchInputRef.current;
    const isEditableField =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      Boolean(target?.isContentEditable);

    if (key === "/") {
      if (!isSearchFocused) {
        event.preventDefault();
        focusSearch(true);
      }
      return;
    }

    if (key === "Escape" && step === "payment") {
      event.preventDefault();
      goBackToOrder();
      return;
    }

    if (normalizedKey === "f" && step === "build" && hasItems && !isEditableField) {
      event.preventDefault();
      proceedToPayment();
      return;
    }

    if (step !== "build" || key !== "Enter" || !topSearchResult) {
      return;
    }

    const isSearchField =
      target instanceof HTMLInputElement && target === searchInputRef.current;
    const shouldAddTopResult =
      isSearchField ||
      target === document.body ||
      target === null ||
      target === document.documentElement;

    if (!shouldAddTopResult) {
      return;
    }

    event.preventDefault();
    addProduct(topSearchResult);
  });

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const handleSaleSuccess = useEffectEvent((sale: PosSaleSnapshot) => {
    lastHandledSaleRef.current = sale.orderId;

    setCompletedReceipt({
      sale,
      items: items.map((item) => ({ ...item })),
      subtotal,
      tax,
      discount,
      total,
      cashReceived: paymentMethod === "cash" ? amountTendered : 0,
      changeDue,
      customerName: selectedCustomer?.fullName ?? "Walk-in Customer",
      cashierName: selectedCashier.name,
      paymentMethod,
      notes: notes.trim() || undefined,
    });
    setRecentTransaction(sale);
    if (activeShift) {
      const nextCashSales =
        paymentMethod === "cash"
          ? roundCurrency(activeShift.cashSalesAmount + total)
          : activeShift.cashSalesAmount;
      cashierContext?.upsertOpenShift({
        ...activeShift,
        cashSalesAmount: nextCashSales,
        cardSalesAmount:
          paymentMethod === "card"
            ? roundCurrency(activeShift.cardSalesAmount + total)
            : activeShift.cardSalesAmount,
        qrSalesAmount:
          paymentMethod === "qr"
            ? roundCurrency(activeShift.qrSalesAmount + total)
            : activeShift.qrSalesAmount,
        totalSalesAmount: roundCurrency(activeShift.totalSalesAmount + total),
        orderCount: activeShift.orderCount + 1,
        expectedCash: roundCurrency(activeShift.openingCash + nextCashSales),
      });
    }
    setToastMessage(
      `Sale #${formatSaleNumber(sale.orderNumber)} complete - ${formatCurrency(total)}`,
    );
    clearSale();
    setStep("receipt");
  });

  useEffect(() => {
    if (!state.ok || !state.data?.orderId) {
      return;
    }

    if (lastHandledSaleRef.current === state.data.orderId) {
      return;
    }

    handleSaleSuccess(state.data);
  }, [state.data, state.ok]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {toastMessage ? (
        <div className="fixed right-6 top-[5.4rem] z-40 flex animate-[pos-toast-enter_180ms_ease-out] items-center gap-2 rounded-[1.35rem] border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-[0_22px_50px_-26px_rgba(13,148,136,0.28)] backdrop-blur-xl">
          <PremiumIcon name="check" className="h-4 w-4" />
          {toastMessage}
        </div>
      ) : null}

      {recentlyRemoved ? (
        <div className="fixed bottom-6 right-6 z-40 animate-[pos-toast-enter_180ms_ease-out] rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 shadow-[0_18px_40px_-26px_rgba(15,23,42,0.24)]">
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <span className="font-medium">
              {getCartLineLabel(recentlyRemoved.name, recentlyRemoved.size)} removed
            </span>
            <button
              type="button"
              onClick={undoRemove}
              className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100"
            >
              Undo
            </button>
          </div>
        </div>
      ) : null}



      {step === "receipt" && completedReceipt ? (
        <>
          <div className="animate-in fade-in zoom-in-95 duration-300 rounded-[2rem] bg-gradient-to-br from-[#0c1712] to-[#0a1f1a] p-8 text-white shadow-[var(--shadow-elevated)] ring-1 ring-white/10 relative overflow-hidden">
          <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-[100px]" />
          <div className="relative z-10 mx-auto flex min-h-[calc(100vh-11rem)] max-w-3xl items-center justify-center">
            <div className="w-full rounded-[2.5rem] bg-white p-10 text-[#0c1712] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)]">
              <div className="text-center print:hidden">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f0fdf8] to-[#ecfdf5] text-primary shadow-sm ring-1 ring-black/[0.04]">
                  <PremiumIcon name="check" className="h-10 w-10" />
                </div>
                <h1 className="mt-6 font-serif text-3xl font-semibold tracking-tight">Sale Complete!</h1>
                <p className="mt-3 font-mono text-sm uppercase tracking-[0.2em] text-muted">
                  Order #{formatSaleNumber(completedReceipt.sale.orderNumber)}
                </p>
              </div>

              <div className="receipt-card mt-10 rounded-[2rem] border border-black/[0.04] bg-[#f8faf9] p-8 shadow-sm">
                <div className="space-y-3 text-center font-mono text-sm text-muted">
                  <p>COFFEE SHOP POS</p>
                  <p>Counter Register</p>
                </div>

                <div className="mt-6 border-t border-dashed border-black/[0.08] pt-6">
                  <div className="space-y-4">
                    {completedReceipt.items.map((item) => (
                      <div key={getPosCartItemLineId(item)} className="flex items-start justify-between gap-4 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#0c1712]">
                            <span className="inline-flex items-center gap-2.5">
                              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-primary shadow-sm ring-1 ring-black/[0.04]">
                                <PremiumIcon name={item.iconName} className="h-3 w-3" />
                              </span>
                              {getCartLineLabel(item.name, item.size)}
                            </span>
                          </p>
                          <p className="mt-1.5 text-xs text-muted">
                            x{item.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-medium text-[#0c1712]">
                            {formatCurrency(item.unitPrice * item.quantity)}
                          </p>
                          {showKhr ? (
                            <p className="font-mono text-xs text-teal-600">
                              {formatKhr(item.unitPrice * item.quantity, khrRate)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 border-t border-dashed border-black/[0.08] pt-6 text-sm">
                    <ReceiptSummaryRow label="Subtotal" value={formatCurrency(completedReceipt.subtotal)} khrValue={showKhr ? formatKhr(completedReceipt.subtotal, khrRate) : undefined} />
                    <ReceiptSummaryRow label={`Tax (${taxPercent}%)`} value={formatCurrency(completedReceipt.tax)} khrValue={showKhr ? formatKhr(completedReceipt.tax, khrRate) : undefined} />
                    <ReceiptSummaryRow
                      label="Discount"
                      value={`-${formatCurrency(completedReceipt.discount)}`}
                      khrValue={showKhr ? `-${formatKhr(completedReceipt.discount, khrRate)}` : undefined}
                      valueClassName="text-primary"
                    />
                    <div className="mt-5 border-t border-dashed border-black/[0.08] pt-5">
                      <div className="flex items-center justify-between font-mono text-xl font-semibold text-[#0c1712]">
                        <span>TOTAL</span>
                        <div className="text-right">
                          <span className="text-primary">{formatCurrency(completedReceipt.total)}</span>
                          {showKhr ? (
                            <p className="text-base font-semibold text-teal-600">
                              {formatKhr(completedReceipt.total, khrRate)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {completedReceipt.paymentMethod === "cash" ? (
                      <div className="mt-5 space-y-3 text-sm">
                        <ReceiptSummaryRow
                          label="Cash received"
                          value={formatCurrency(completedReceipt.cashReceived)}
                          khrValue={showKhr ? formatKhr(completedReceipt.cashReceived, khrRate) : undefined}
                        />
                        <ReceiptSummaryRow
                          label="Change"
                          value={formatCurrency(completedReceipt.changeDue)}
                          khrValue={showKhr ? formatKhr(completedReceipt.changeDue, khrRate) : undefined}
                        />
                      </div>
                    ) : (
                      <div className="mt-5 text-sm text-muted">
                        {completedReceipt.paymentMethod === "card"
                          ? "Card payment confirmed"
                          : "QR payment confirmed"}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 border-t border-dashed border-black/[0.08] pt-6 text-sm text-muted">
                    <p>Cashier: {completedReceipt.cashierName}</p>
                    <p className="mt-1.5">Customer: {completedReceipt.customerName}</p>
                    <p className="mt-1.5">Time: {formatReceiptDate(completedReceipt.sale.createdAt)}</p>
                    {completedReceipt.notes ? (
                      <p className="mt-1.5">Notes: {completedReceipt.notes}</p>
                    ) : null}
                    {showKhr ? (
                      <p className="mt-3 rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2 text-center font-mono text-xs text-teal-700">
                        Exchange Rate: 1 USD = ៛{khrRate.toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row print:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => printReceiptElement()}
                  className="h-[3.5rem] flex-1 rounded-2xl border border-black/[0.08] bg-white text-[15px] font-semibold text-[#0c1712] shadow-sm hover:bg-black/[0.01]"
                >
                  <PremiumIcon name="print" className="h-5 w-5" />
                  Print Receipt
                </Button>
                <Button
                  type="button"
                  onClick={startNewSale}
                  className="h-[3.5rem] flex-[1.2] rounded-2xl bg-gradient-to-r from-primary to-teal-600 text-[15px] font-semibold text-white shadow-[0_4px_24px_-8px_rgba(13,148,136,0.5)] hover:shadow-[0_8px_32px_-8px_rgba(13,148,136,0.6)]"
                >
                  New Sale
                  <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        </div>
        </>
      ) : step === "payment" ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="grid gap-6 lg:h-[calc(100vh-8rem)] lg:grid-cols-[2fr_3fr]">
            <PanelFrame
              title="Order summary"
              subtitle="Review before payment"
              active
              className="min-h-[520px] lg:min-h-0"
            >
              <div className="flex flex-1 min-h-0 flex-col gap-5">
                <button
                  type="button"
                  onClick={goBackToOrder}
                  className="self-start rounded-xl border border-black/[0.06] bg-[#f8faf9] px-3 py-1.5 text-xs font-semibold text-[#0c1712] shadow-sm hover:border-primary/40 hover:text-primary transition-colors"
                >
                  ← Back to Order
                </button>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-[1.5rem] border border-black/[0.04] bg-[#f8faf9] p-6 shadow-sm">
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div
                        key={getPosCartItemLineId(item)}
                        className="flex items-center justify-between gap-4 border-b border-dashed border-black/[0.08] pb-4 text-sm last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#0c1712]">
                            <span className="inline-flex items-center gap-2.5">
                              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-primary shadow-sm ring-1 ring-black/[0.04]">
                                <PremiumIcon name={item.iconName} className="h-4 w-4" />
                              </span>
                              {getCartLineLabel(item.name, item.size)}
                            </span>
                          </p>
                          <p className="mt-1.5 text-xs text-muted">x{item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-medium text-[#0c1712]">
                            {formatCurrency(item.unitPrice * item.quantity)}
                          </p>
                          {showKhr ? (
                            <p className="font-mono text-xs text-teal-600">
                              {formatKhr(item.unitPrice * item.quantity, khrRate)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 border-t border-dashed border-black/[0.08] pt-6">
                    <ReceiptSummaryRow label="Subtotal" value={formatCurrency(subtotal)} khrValue={showKhr ? formatKhr(subtotal, khrRate) : undefined} />
                    <ReceiptSummaryRow
                      label={`Tax (${taxPercent}%)`}
                      value={formatCurrency(tax)}
                      khrValue={showKhr ? formatKhr(tax, khrRate) : undefined}
                    />
                    {discount > 0 ? (
                      <ReceiptSummaryRow
                        label="Discount"
                        value={`-${formatCurrency(discount)}`}
                        khrValue={showKhr ? `-${formatKhr(discount, khrRate)}` : undefined}
                        valueClassName="text-primary"
                      />
                    ) : null}
                    <div className="mt-6 border-t border-solid border-black/[0.08] pt-5">
                      <div className="flex items-center justify-between font-mono text-[1.75rem] font-semibold tracking-tight text-primary">
                        <span className="font-serif text-[#0c1712]">TOTAL</span>
                        <div className="text-right">
                          <span>{formatCurrency(total)}</span>
                          {showKhr ? (
                            <p className="text-lg font-semibold text-teal-600">
                              {formatKhr(total, khrRate)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </PanelFrame>

            <PanelFrame
              title="Payment"
              subtitle="Customer, payment method, notes, and completion."
              active
              className="min-h-[520px] lg:min-h-0"
            >
              <div className="flex flex-1 min-h-0 flex-col">
                <input
                  type="hidden"
                  name="itemsJson"
                  value={JSON.stringify(
                    items.map((item) => ({
                      productId: item.productId,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      productName: getCartLineLabel(item.name, item.size),
                      sku: item.sku,
                    })),
                  )}
                />
                <input type="hidden" name="discountAmount" value={discount.toFixed(2)} />
                <input type="hidden" name="paymentMethod" value={paymentMethod} />
                <input type="hidden" name="cashierName" value={selectedCashier.name} />
                <input
                  type="hidden"
                  name="cashierProfileId"
                  value={selectedCashier.profileId ?? ""}
                />
                <input type="hidden" name="posShiftId" value={activeShift?.id ?? ""} />
                <input
                  type="hidden"
                  name="customerName"
                  value={selectedCustomer?.fullName ?? "Walk-in Customer"}
                />
                <input type="hidden" name="displaySubtotal" value={subtotal.toFixed(2)} />
                <input type="hidden" name="displayTax" value={tax.toFixed(2)} />
                <input type="hidden" name="displayTotal" value={total.toFixed(2)} />
                <input type="hidden" name="taxRate" value={taxRate.toFixed(4)} />
                <input
                  type="hidden"
                  name="cashReceived"
                  value={paymentMethod === "cash" ? amountTendered.toFixed(2) : "0.00"}
                />
                <input
                  type="hidden"
                  name="changeGiven"
                  value={paymentMethod === "cash" ? changeDue.toFixed(2) : "0.00"}
                />

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                  <div className="space-y-2">
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-700">
                      Customer
                    </p>
                    <div className="flex gap-2">
                      <Select
                        id="customerId"
                        name="customerId"
                        value={selectedCustomerId}
                        onChange={(event) => setSelectedCustomerId(event.target.value)}
                        className="min-h-11 flex-1 rounded-[1rem] border-slate-200 bg-white text-slate-950"
                      >
                        <option value="">Walk-in Customer</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.fullName}
                          </option>
                        ))}
                      </Select>
                      <button
                        type="button"
                        onClick={() => setShowAddCustomer((v) => !v)}
                        className="shrink-0 rounded-[1rem] border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-700 hover:bg-teal-100 transition-colors"
                      >
                        + New
                      </button>
                    </div>
                    {showAddCustomer ? (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-200 rounded-[1rem] border border-teal-200 bg-teal-50/80 p-3 space-y-2">
                        <Input
                          placeholder="Customer name *"
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          className="h-10 rounded-xl border-slate-200 bg-white text-sm"
                        />
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-slate-600">Phone</p>
                          <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-white overflow-hidden">
                            <span className="shrink-0 border-r border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-500">+855</span>
                            <input
                              type="tel"
                              value={newCustomerPhone}
                              onChange={(e) => setNewCustomerPhone(e.target.value)}
                              className="h-full w-full bg-transparent px-3 text-sm text-slate-950 outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={!newCustomerName.trim() || isAddingCustomer}
                            onClick={handleAddCustomer}
                            className="h-9 flex-1 rounded-xl bg-teal-700 text-sm font-semibold text-white hover:bg-teal-600 disabled:bg-slate-300 disabled:text-slate-500 transition-colors"
                          >
                            {isAddingCustomer ? "Saving..." : "Save Customer"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowAddCustomer(false); setNewCustomerName(""); setNewCustomerPhone(""); }}
                            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {customerDiscountLabel ? (
                      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                        <PremiumIcon name="check" className="h-4 w-4" />
                        {customerDiscountLabel}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3 rounded-[1.4rem] border border-teal-100 bg-teal-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-700"
                        htmlFor="cashierId"
                      >
                        Cashier
                      </label>
                      <span className="text-xs font-medium text-teal-700">
                        Prints on receipt
                      </span>
                    </div>
                    <Select
                      id="cashierId"
                      value={selectedCashier.id}
                      onChange={(event) => handleCashierChange(event.target.value)}
                      className="min-h-11 rounded-[1rem] border-teal-200 bg-white text-slate-950"
                    >
                      {cashierChoices.map((cashier) => (
                        <option key={cashier.id} value={cashier.id}>
                          {cashier.name}
                          {cashier.role ? ` (${cashier.role})` : ""}
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs leading-5 text-teal-800/80">
                      Choose who made this sale. The selected name is saved to
                      the receipt and POS history.
                    </p>
                  </div>

                  <div className="space-y-2 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-700"
                        htmlFor="manualDiscount"
                      >
                        Manual discount
                      </label>
                      <span className="text-xs font-medium text-slate-500">
                        Max {formatCurrency(maxDiscount)}
                      </span>
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg text-slate-500">
                        $
                      </span>
                      <Input
                        id="manualDiscount"
                        value={discountAmount}
                        onChange={(event) => setDiscountAmount(event.target.value)}
                        onBlur={() =>
                          setDiscountAmount(normalizeDiscountInput(discountAmount, maxDiscount))
                        }
                        disabled={hasCustomerDiscount}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="h-12 rounded-[1rem] border-slate-200 bg-white pl-8 font-mono text-lg text-slate-950 disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                    <p className="text-xs leading-5 text-slate-500">
                      {hasCustomerDiscount
                        ? "Customer discount is active, so manual discount is paused for this sale."
                        : "Apply an amount discount before completing payment."}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-700">
                      Payment method
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {PAYMENT_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => handlePaymentMethodChange(option.key)}
                          className={cn(
                            "min-h-11 rounded-[1rem] border px-3 py-3 text-sm font-semibold",
                            paymentMethod === option.key
                              ? "border-teal-700 bg-teal-700 text-white shadow-[0_16px_34px_-24px_rgba(15,118,110,0.42)]"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950",
                        )}
                      >
                        <span className="inline-flex items-center justify-center gap-1.5">
                          <PremiumIcon name={option.iconName} className="h-4 w-4" />
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  </div>

                  {paymentMethod === "cash" ? (
                    <div className="space-y-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="space-y-2">
                        <label
                          className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-700"
                          htmlFor="amountTendered"
                        >
                          Amount received (USD)
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-xl text-slate-500">
                            $
                          </span>
                          <Input
                            id="amountTendered"
                            value={amountTenderedInput}
                            onChange={(event) => setAmountTenderedInput(event.target.value)}
                            onBlur={() =>
                              setAmountTenderedInput(normalizeCurrencyInput(amountTenderedInput))
                            }
                            placeholder="0.00"
                            className="h-14 rounded-[1rem] border-slate-200 bg-white pl-9 font-mono text-2xl text-slate-950"
                          />
                        </div>
                      </div>

                      {showKhr ? (
                        <div className="space-y-2">
                          <label
                            className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-700"
                            htmlFor="khrTendered"
                          >
                            Amount received (KHR)
                          </label>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg text-slate-500">
                              ៛
                            </span>
                            <Input
                              id="khrTendered"
                              value={khrTenderedInput}
                              onChange={(event) => setKhrTenderedInput(event.target.value)}
                              onBlur={() => {
                                const raw = Math.round(parseCurrencyInput(khrTenderedInput) / 100) * 100;
                                setKhrTenderedInput(raw > 0 ? String(raw) : "");
                              }}
                              placeholder="0"
                              className="h-14 rounded-[1rem] border-slate-200 bg-white pl-9 font-mono text-2xl text-slate-950"
                            />
                          </div>
                          {khrTendered > 0 ? (
                            <p className="text-xs text-slate-500">
                              ៛{khrTendered.toLocaleString()} = {formatCurrency(khrTenderedAsUsd)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-4">
                        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-700">
                          {isCashUnderpaid ? "Amount remaining" : "Change to give"}
                        </p>
                        <p
                          className={cn(
                            "mt-2 font-mono text-3xl font-semibold",
                            isCashUnderpaid ? "text-amber-700" : "text-emerald-700",
                          )}
                        >
                          {formatCurrency(changeDue > 0 ? changeDue : cashRemaining)}
                        </p>
                        {showKhr ? (
                          <p
                            className={cn(
                              "mt-1 font-mono text-lg font-semibold",
                              isCashUnderpaid ? "text-amber-600" : "text-emerald-600",
                            )}
                          >
                            {formatKhr(changeDue > 0 ? changeDue : cashRemaining, khrRate)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm text-slate-600">
                        {paymentMethod === "card"
                          ? "Confirm card payment received"
                          : "Confirm QR payment received"}
                      </p>
                      <button
                        type="button"
                        onClick={() => setPaymentConfirmed((current) => !current)}
                        className={cn(
                          "min-h-11 w-full rounded-[1rem] border px-4 py-3 text-sm font-semibold",
                          paymentConfirmed
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                        )}
                      >
                        <span className="inline-flex items-center justify-center gap-2">
                          {paymentConfirmed ? <PremiumIcon name="check" className="h-4 w-4" /> : null}
                          {paymentConfirmed ? "Payment confirmed" : "Tap to confirm payment"}
                        </span>
                      </button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label
                      className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-700"
                      htmlFor="notes"
                    >
                      Notes
                    </label>
                    <Textarea
                      id="notes"
                      name="notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      className="min-h-24 rounded-[1rem] border-slate-200 bg-white"
                      placeholder="Cashier note or payment reference..."
                    />
                  </div>
                </div>

                <div className="mt-4 shrink-0 space-y-3 border-t border-slate-200 pt-4">
                  {state.message && !state.ok ? (
                    <div className="rounded-[1.2rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {state.message}
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    fullWidth
                    disabled={!paymentReady || isSubmitting}
                    className="h-16 rounded-[1rem] bg-teal-700 text-base font-semibold text-white hover:bg-teal-600 disabled:bg-slate-300 disabled:text-slate-500"
                  >
                    {isSubmitting ? (
                      "Completing..."
                    ) : (
                      <>
                        <PremiumIcon name="check" className="h-5 w-5" />
                        Complete Sale — {formatCurrency(total)}
                      </>
                    )}
                  </Button>

                  {!paymentReady && paymentBlockingMessage ? (
                    <p className="text-center text-sm font-medium text-slate-500">
                      {paymentBlockingMessage}
                    </p>
                  ) : null}

                  <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {recentTransaction ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="min-w-0 truncate">
                          Last: #{formatSaleNumber(recentTransaction.orderNumber)} ·{" "}
                          <span className="font-mono">
                            {formatCurrency(recentTransaction.totalAmount)}
                          </span>{" "}
                          · {formatSaleTime(recentTransaction.createdAt)}
                        </p>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/pos/history/${recentTransaction.orderId}`}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                          >
                            Receipt
                          </Link>
                          <Link
                            href="/pos/history"
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                          >
                            History
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <p>No recent completed sale yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </PanelFrame>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:h-[calc(100vh-8.7rem)] lg:grid-cols-[minmax(360px,0.85fr)_minmax(0,1.25fr)] xl:grid-cols-[minmax(380px,0.8fr)_minmax(0,1.35fr)] 2xl:grid-cols-[minmax(400px,0.75fr)_minmax(0,1.5fr)]">
          <PanelFrame
            title="Current Order"
            subtitle={`${totalUnits} items · ${formatCurrency(total)}`}
            active
            className="min-h-[520px] lg:min-h-0"
            headerRight={
              <button
                type="button"
                onClick={confirmClearAll}
                disabled={!hasItems}
                className="rounded-xl border border-rose-200/50 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-100 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
              >
                Clear All
              </button>
            }
          >
            <div className="flex flex-1 min-h-0 flex-col gap-5">
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <div className="flex h-full min-h-[340px] items-center justify-center rounded-[2rem] border border-dashed border-black/[0.08] bg-[#f8faf9] px-6 text-center">
                    <div>
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
                        <PremiumIcon name="cart" className="h-8 w-8 text-slate-300" />
                      </div>
                      <p className="mt-5 font-serif text-xl font-semibold text-[#0c1712]">
                        Cart is empty
                      </p>
                      <p className="mt-2 text-sm text-muted">
                        Search products on the right to add items
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div
                        key={getPosCartItemLineId(item)}
                        className="animate-in slide-in-from-right-4 duration-200 rounded-[1.75rem] border border-black/[0.04] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.02]"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 shadow-sm ring-1 ring-teal-100">
                            <PremiumIcon name={item.iconName} className="h-6 w-6" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold text-[#0c1712]">
                              {getCartLineLabel(item.name, item.size)}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              {item.sku} · {formatCurrency(item.unitPrice)}
                            </p>
                            <div className="mt-4 flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => updateQuantity(getPosCartItemLineId(item), -1)}
                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600/10 text-xl text-teal-700 hover:bg-teal-600 hover:text-white transition-colors"
                              >
                                <PremiumIcon name="minus" className="h-4 w-4" />
                              </button>
                              <span className="min-w-8 text-center font-mono text-base font-semibold text-[#0c1712]">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(getPosCartItemLineId(item), 1)}
                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600/10 text-xl text-teal-700 hover:bg-teal-600 hover:text-white transition-colors"
                              >
                                <PremiumIcon name="plus" className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-base font-semibold text-[#0c1712]">
                              {formatCurrency(item.unitPrice * item.quantity)}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                removeItem(getPosCartItemLineId(item), { allowUndo: true })
                              }
                              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                            >
                              <PremiumIcon name="close" className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="shrink-0 rounded-[2rem] bg-gradient-to-br from-[#0c1712] to-[#0a1f1a] px-5 py-5 text-white shadow-[var(--shadow-elevated)] ring-1 ring-white/10 relative overflow-hidden">
                <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 -translate-y-1/2 translate-x-1/3 rounded-full bg-primary/20 blur-[50px]" />
                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/60 mb-1">Total</p>
                    <p className="font-mono text-[1.75rem] font-semibold text-white">
                      {formatCurrency(total)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={proceedToPayment}
                    disabled={!hasItems}
                    className="h-14 rounded-2xl bg-primary px-8 text-base font-semibold text-white shadow-sm hover:bg-teal-500 disabled:bg-white/10 disabled:text-white/40"
                  >
                    Proceed to Payment
                  </Button>
                </div>
              </div>
            </div>
          </PanelFrame>

          <PanelFrame
            title="Product Search"
            subtitle="Search products, filter by category, and add them quickly."
            active
            className="min-h-[520px] lg:min-h-0"
          >
            <div className="flex flex-1 min-h-0 flex-col gap-3">
              <div className="rounded-[1.25rem] border border-black/[0.04] bg-[#f8faf9] p-3 shadow-sm ring-1 ring-black/[0.02]">
                <div className="relative">
                  <Input
                    ref={searchInputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search products, SKU, or barcode..."
                    className="h-12 rounded-[1rem] border-black/[0.06] bg-white pr-28 text-base text-[#0c1712] shadow-sm placeholder:text-slate-400 focus-visible:ring-primary/20"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <span className="rounded-lg border border-black/[0.06] bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                      / to focus
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {PRODUCT_FILTERS.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setCategoryFilter(filter.key)}
                    className={cn(
                      "min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200",
                      categoryFilter === filter.key
                        ? "bg-[#0c1712] text-white shadow-sm border-transparent"
                        : "border-black/[0.06] bg-[#f8faf9] text-muted hover:bg-white hover:text-[#0c1712] shadow-sm",
                    )}
                  >
                    {filter.iconName ? <PremiumIcon name={filter.iconName} className="mr-1.5 inline h-4 w-4" /> : null}
                    {filter.label}
                  </button>
                ))}
              </div>

              {visibleProducts.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-black/[0.04] bg-[#f8faf9] px-5 py-3 text-sm text-muted">
                  <p>↵ Enter adds: {topSearchResult?.name ?? visibleProducts[0]?.name}</p>
                  <p className="font-mono text-xs uppercase tracking-[0.2em]">
                    {visibleProducts.length} results
                  </p>
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {visibleProducts.length === 0 ? (
                  <div className="flex h-full min-h-[280px] items-center justify-center rounded-[2rem] border border-dashed border-black/[0.08] bg-[#f8faf9] px-6 text-center">
                    <div>
                      <p className="font-serif text-lg font-semibold text-[#0c1712]">No products found</p>
                      <p className="mt-2 text-sm text-muted">
                        Try a different search term or category filter.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {visibleProducts.map((product) => {
                      const hasDrinkSizes = isDrinkProduct(product);
                      const selectedSize = getSelectedProductSize(product);
                      const selectedLineId = getPosCartLineId(product.id, selectedSize);
                      const quantityInCart =
                        items.find((item) => getPosCartItemLineId(item) === selectedLineId)
                          ?.quantity ?? 0;
                      const displayPrice = getDrinkSizePrice(product.price, selectedSize);
                      const isStockTracked = isStockTrackedProduct(product);
                      const isLowStock =
                        isStockTracked && product.stockQuantity > 0 && product.stockQuantity < 10;
                      const isOutOfStock = isStockTracked && product.stockQuantity <= 0;

                      return (
                        <article
                          key={product.id}
                          className={cn(
                            "group relative rounded-2xl border p-3 shadow-sm ring-1 ring-black/[0.02] flex flex-col transition-all duration-200",
                            isOutOfStock
                              ? "border-black/[0.04] bg-[#f8faf9] opacity-50 grayscale-[0.5]"
                              : quantityInCart > 0
                                ? "border-teal-200 bg-teal-50/30 hover:shadow-md"
                                : "border-black/[0.04] bg-white hover:shadow-md hover:border-black/[0.08]",
                          )}
                        >
                          {/* Category + stock + qty */}
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "truncate rounded-lg px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-semibold",
                                getCategoryBadgeClass(product.category?.name),
                              )}
                            >
                              {product.category?.name ?? "General"}
                            </span>
                            {isOutOfStock ? (
                              <span className="shrink-0 text-[10px] font-semibold text-rose-500">OUT</span>
                            ) : isLowStock ? (
                              <span className="shrink-0 text-[10px] font-semibold text-amber-600">{product.stockQuantity} left</span>
                            ) : quantityInCart > 0 ? (
                              <span className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-600 px-1.5 text-[10px] font-bold text-white">
                                {quantityInCart}
                              </span>
                            ) : null}
                          </div>

                          {/* Product info */}
                          <div className="mt-2 flex-1">
                            <h3
                              className={cn(
                                "text-[13px] font-semibold leading-snug",
                                isOutOfStock ? "text-slate-400" : "text-[#0c1712]",
                              )}
                            >
                              {product.name}
                            </h3>
                            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
                              {product.sku}
                            </p>
                          </div>

                          {/* Size selector */}
                          {hasDrinkSizes ? (
                            <div className="mt-2 flex gap-1 rounded-lg border border-black/[0.04] bg-[#f8faf9] p-0.5">
                              {DRINK_SIZES.map((size) => (
                                <button
                                  key={size}
                                  type="button"
                                  onClick={() => updateSelectedProductSize(product.id, size)}
                                  className={cn(
                                    "h-7 flex-1 rounded-md text-[11px] font-semibold transition-colors",
                                    selectedSize === size
                                      ? "bg-primary text-white shadow-sm"
                                      : "text-[#0c1712] hover:text-primary",
                                  )}
                                >
                                  {size}
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {/* Price + Add */}
                          <div className="mt-2.5">
                            <div className="flex items-center justify-between">
                              <p
                                className={cn(
                                  "font-mono text-base font-bold",
                                  isOutOfStock ? "text-slate-300" : "text-primary",
                                )}
                              >
                                {formatCurrency(displayPrice)}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {isStockTracked ? `Stock ${product.stockQuantity}` : "Drink"}
                              </p>
                            </div>

                            {isOutOfStock ? (
                              <div className="mt-2 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-[11px] font-semibold text-slate-400">
                                Sold Out
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addProduct(product, selectedSize)}
                                className={cn(
                                  "mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold text-white shadow-sm transition-all active:scale-[0.97]",
                                  quantityInCart > 0
                                    ? "bg-[#0c1712] hover:bg-black"
                                    : "bg-primary hover:bg-teal-500",
                                )}
                              >
                                <PremiumIcon name="plus" className="h-3.5 w-3.5" />
                                {quantityInCart > 0 ? "Add More" : "Add"}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </PanelFrame>
        </div>
      )}
    </form>
  );
}

function PanelFrame({
  title,
  subtitle,
  active,
  children,
  className,
  headerRight,
}: {
  title: string;
  subtitle: string;
  active?: boolean;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-[2.5rem] border border-black/[0.04] bg-white shadow-[var(--shadow-elevated)] ring-1 ring-black/[0.02]",
        "before:absolute before:bottom-6 before:left-0 before:top-6 before:w-[4px] before:rounded-r-full before:bg-transparent before:transition-colors",
        active && "before:bg-primary",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-black/[0.04] bg-slate-50/50 px-6 py-3">
        <p className="text-sm text-muted">
          <span className="font-semibold text-foreground">{title}</span>
          {subtitle ? <> · {subtitle}</> : null}
        </p>
        {headerRight}
      </div>
      <div className="flex flex-1 min-h-0 flex-col px-6 py-4">{children}</div>
    </section>
  );
}

function ReceiptSummaryRow({
  label,
  value,
  khrValue,
  valueClassName,
}: {
  label: string;
  value: string;
  khrValue?: string;
  valueClassName?: string;
}) {
  return (
    <div className="mt-2 flex items-center justify-between text-sm text-slate-600 first:mt-0">
      <span>{label}</span>
      <div className="text-right">
        <span className={cn("font-mono text-slate-950", valueClassName)}>{value}</span>
        {khrValue ? (
          <p className="font-mono text-[11px] text-teal-600">{khrValue}</p>
        ) : null}
      </div>
    </div>
  );
}
