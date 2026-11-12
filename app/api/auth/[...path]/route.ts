// Forwards the browser's auth requests to Neon Auth (same-origin proxy).
import { auth } from "@/lib/auth/server";

export const { GET, POST, PUT, DELETE, PATCH } = auth.handler();
