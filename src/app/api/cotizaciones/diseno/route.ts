import { saveQuoteDocumentSettingsAction } from "@/modules/quotes/document-settings";

const initialState = { error: null, success: null };

export async function POST(request: Request) {
  const result = await saveQuoteDocumentSettingsAction(initialState, await request.formData());
  return Response.json(result, { status: result.error ? 400 : 200 });
}
