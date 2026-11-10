import { NextResponse } from "next/server";
import { htmlEscape, run } from "@/server/api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return run(request, async (store, actor) => {
    const opened = store.openApplication(actor, id);
    if (opened.url) return NextResponse.redirect(opened.url, 303);
    const mailto = htmlEscape(opened.mailto ?? "");
    const email = htmlEscape(opened.email ?? "");
    return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Email HR</title><body style="font-family:sans-serif;padding:24px"><h1>Email HR</h1><p>Pikajobs did not send this email. Your mail app can open a draft.</p><p><a href="${mailto}">Open email draft</a></p><p>Address: ${email}</p><p><button onclick="navigator.clipboard.writeText('${email}')">Copy email</button></p></body></html>`, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }, true);
}
