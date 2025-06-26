import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Schema = {
  folders: {
    id: string;
    name: string;
    secrets: Record<string, unknown>[];
  }[];
};

export function parseToAppJSON(data: string): Schema | null {
  try {
    const newData = JSON.parse(data);
    if (!newData.folders) throw new Error("nah not valid");
    if (!newData.folders[0]?.id) throw new Error("nah not valid");
    if (!newData.folders[0]?.secrets) throw new Error("nah not valid");
    return newData as Schema;
  } catch (e) {
    return null;
  }
}
