import { errorResponse, readJson } from "@/http/responses";
import { getContainer } from "@/server/container";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const body = await readJson(request);
    const updated = getContainer().consentService.updateRequest(id, body);
    return Response.json(updated, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
