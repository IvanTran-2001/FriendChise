/**
 * Server-only Supabase client.
 * Never import this from a "use client" component.
 */
import { createClient } from "@supabase/supabase-js";

export function getSupabaseClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.SUPABASE_SECRET_KEY;
	if (!url || !key) {
		throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
	}
	return createClient(url, key);
}
