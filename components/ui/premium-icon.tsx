import type { LucideIcon, LucideProps } from "lucide-react";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Banknote,
  BarChart3,
  Bell,
  Camera,
  ChartColumn,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Coffee,
  CreditCard,
  Croissant,
  CupSoda,
  Eye,
  FileText,
  Folder,
  Globe,
  Heart,
  Home,
  LaptopMinimal,
  Leaf,
  Mail,
  Minus,
  Music2,
  Package,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Rocket,
  Search,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trash2,
  TriangleAlert,
  Trophy,
  Truck,
  ThumbsUp,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import type { PremiumIconName } from "@/lib/premium-icons";

const premiumIconMap: Record<PremiumIconName, LucideIcon> = {
  accessories: ShoppingBag,
  "all-sales": BarChart3,
  alert: TriangleAlert,
  "arrow-right": ArrowRight,
  "avg-order": CreditCard,
  bakery: Croissant,
  bell: Bell,
  "bar-chart": ChartColumn,
  camera: Camera,
  card: CreditCard,
  cart: ShoppingCart,
  cash: Banknote,
  check: Check,
  "chevron-right": ChevronRight,
  close: X,
  coffee: Coffee,
  csv: ChartColumn,
  customers: Users,
  delete: Trash2,
  delivery: Truck,
  drink: CupSoda,
  edit: Pencil,
  fast: Zap,
  file: FileText,
  folder: Folder,
  fresh: Leaf,
  heart: Heart,
  home: Home,
  "low-stock": TriangleAlert,
  mail: Mail,
  minus: Minus,
  online: Globe,
  orders: PackageCheck,
  package: Package,
  payment: Wallet,
  pdf: FileText,
  phone: Phone,
  plus: Plus,
  pos: LaptopMinimal,
  print: Printer,
  "product-links": PackageCheck,
  qr: QrCode,
  rated: BadgeCheck,
  receipt: Receipt,
  revenue: CircleDollarSign,
  rocket: Rocket,
  search: Search,
  store: Store,
  supplies: PackageCheck,
  trophy: Trophy,
  "thumbs-up": ThumbsUp,
  time: Clock,
  music: Music2,
  view: Eye,
};

interface PremiumIconProps extends Omit<LucideProps, "ref"> {
  name: PremiumIconName;
}

export function PremiumIcon({
  name,
  "aria-hidden": ariaHidden = true,
  strokeWidth = 1.85,
  ...props
}: PremiumIconProps) {
  const Icon = premiumIconMap[name];

  return <Icon aria-hidden={ariaHidden} strokeWidth={strokeWidth} {...props} />;
}

export function RankIcon({
  rank,
  ...props
}: Omit<PremiumIconProps, "name"> & {
  rank: number;
}) {
  if (rank === 0) {
    return <PremiumIcon name="trophy" {...props} />;
  }

  if (rank === 1) {
    return <Award aria-hidden={true} strokeWidth={1.85} {...props} />;
  }

  return <PremiumIcon name="rated" {...props} />;
}
