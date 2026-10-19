import { errorResponse, readJson } from "@/http/responses";
import { getContainer } from "@/server/container";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const result = getContainer().consentService.createRequest(body);
    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const subjectId = new URL(request.url).searchParams.get("subjectId") ?? "";
    const requests = getContainer().consentService.listRequests(subjectId);
    return Response.json({ requests }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
