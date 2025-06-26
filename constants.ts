
import { Category } from './types';

export const CATEGORIES: Record<string, Category> = {
  TECLADO: { name: "Teclado", prefix: "AFIT902-" },
  MOUSE: { name: "Mouse", prefix: "AFIT903-" },
  MONITOR: { name: "Monitor", prefix: "AFIT904-" },
  LAPTOP: { name: "Laptop", prefix: "AFIT905-" },
  CPU: { name: "CPU", prefix: "AFIT906-" },
  IMPRESORA: { name: "Impresora", prefix: "AFIT907-" },
  ESCANER: { name: "Escáner", prefix: "AFIT908-" },
  PROYECTOR: { name: "Proyector", prefix: "AFIT909-" },
  TABLET: { name: "Tablet", prefix: "AFIT910-" },
  TELEFONO: { name: "Teléfono IP", prefix: "AFIT911-" },
};

export const STATUSES: string[] = [
  "En Stock",
  "Asignado",
  "En Reparación",
  "Dañado",
  "De Baja",
];

export const STATUS_COLORS: Record<string, string> = {
  "En Stock": "bg-green-600 hover:bg-green-700",
  "Asignado": "bg-cyan-600 hover:bg-cyan-700",
  "En Reparación": "bg-yellow-500 hover:bg-yellow-600 text-black",
  "Dañado": "bg-orange-600 hover:bg-orange-700",
  "De Baja": "bg-red-700 hover:bg-red-800",
  "default": "bg-gray-600 hover:bg-gray-700",
};
