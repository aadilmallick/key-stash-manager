import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
// export function parseToAppJSON(data: string): Schema | null {
//   try {
//     const newData = JSON.parse(data);
//     // new version
//     if (newData.profiles) {
//       return newData as Profile;
//     }
//     // old version
//     // if (!newData.folders) throw new Error("nah not valid");
//     // if (!newData.folders[0]?.id) throw new Error("nah not valid");
//     // if (!newData.folders[0]?.secrets) throw new Error("nah not valid");
//     // return newData as Schema;
//   } catch (e) {
//     return null;
//   }
// }
