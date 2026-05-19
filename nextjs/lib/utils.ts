import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isSuperAdmin(user: { role?: string } | null | undefined): boolean {
  return user?.role === "superadmin";
}

export function isAdmin(user: { role?: string } | null | undefined): boolean {
  return user?.role === "admin" || user?.role === "superadmin";
}
