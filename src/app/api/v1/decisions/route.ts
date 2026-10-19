import { errorResponse, readJson } from "@/http/responses";
import { getContainer } from "@/server/container";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const result = getContainer().decisionService.checkAccess(body);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
