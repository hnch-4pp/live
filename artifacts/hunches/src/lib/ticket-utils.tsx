import type { TFunction } from "i18next";
import {
  Gift, Tag, ShoppingBag, RefreshCw, MinusCircle, Users,
} from "lucide-react";

export type TxType = "welcome" | "promo" | "purchase" | "subscription" | "spent" | "referral";

export interface TicketTransaction {
  id: number;
  userId: number;
  type: TxType;
  amount: number;
  label: string;
  reference: string | null;
  createdAt: string;
}

export function txIcon(type: TxType) {
  switch (type) {
    case "welcome":      return <Gift className="w-4 h-4" />;
    case "promo":        return <Tag className="w-4 h-4" />;
    case "purchase":     return <ShoppingBag className="w-4 h-4" />;
    case "subscription": return <RefreshCw className="w-4 h-4" />;
    case "spent":        return <MinusCircle className="w-4 h-4" />;
    case "referral":     return <Users className="w-4 h-4" />;
  }
}

export function txColors(type: TxType): { icon: string; badge: string } {
  switch (type) {
    case "welcome":      return { icon: "text-violet-600 bg-violet-100",  badge: "bg-violet-100 text-violet-700" };
    case "promo":        return { icon: "text-emerald-600 bg-emerald-100", badge: "bg-emerald-100 text-emerald-700" };
    case "purchase":     return { icon: "text-sky-600 bg-sky-100",        badge: "bg-sky-100 text-sky-700" };
    case "subscription": return { icon: "text-indigo-600 bg-indigo-100",  badge: "bg-indigo-100 text-indigo-700" };
    case "spent":        return { icon: "text-slate-500 bg-slate-100",    badge: "bg-slate-100 text-slate-600" };
    case "referral":     return { icon: "text-amber-600 bg-amber-100",    badge: "bg-amber-100 text-amber-700" };
  }
}

export function txSubtitle(tx: TicketTransaction, t: TFunction): string {
  if (tx.type === "welcome")      return t("tx_welcome");
  if (tx.type === "promo")        return tx.reference ? t("tx_promo_code", { code: tx.reference }) : t("tx_promo");
  if (tx.type === "purchase")     return tx.reference ? t("tx_purchase_ref", { ref: tx.reference.slice(0, 20) + "…" }) : t("tx_purchase");
  if (tx.type === "subscription") return t("tx_subscription");
  if (tx.type === "spent")        return t("tx_spent");
  if (tx.type === "referral")     return tx.reference ? t("tx_referral_ref", { ref: tx.reference }) : t("tx_referral");
  return "";
}

export function formatDate(iso: string, t: TFunction): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return t("date_today");
  if (diffDays === 1) return t("date_yesterday");
  if (diffDays < 7)   return `${diffDays}d`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: diffDays > 365 ? "numeric" : undefined,
  });
}
