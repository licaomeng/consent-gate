import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as postDecision } from "@/app/api/v1/decisions/route";
import {
  GET as getConsentRequests,
  POST as postConsentRequests,
} from "@/app/api/v1/consent-requests/route";
import { PATCH as patchConsentRequest } from "@/app/api/v1/consent-requests/[id]/route";
import { RepositoryError, type ConsentRepository } from "@/repository/consent-repository";
import { resetEvaluationDate, setEvaluationDate } from "@/server/clock";
import { createContainer, resetContainer, setContainer } from "@/server/container";
import { adultPurchase, childChat, hardBlockedChildChat } from "../support/harness";

const EVALUATION_DATE = "2026-10-19";
const BASE = "http://localhost";

function jsonRequest(method: string, path: string, body?: unknown): Request {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "content-type": "application/json" };
  }
  return new Request(`${BASE}${path}`, init);
}

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function read(response: Response) {
  return { status: response.status, body: await response.json() };
}

function failingRepository(): ConsentRepository {
  const fail = () => {
    throw new RepositoryError("storage unavailable");
  };

  return {
    getByScope: fail,
    getById: fail,
    listBySubject: fail,
    create: fail,
    updateStatus: fail,
  };
}

beforeEach(() => {
  resetContainer();
  setEvaluationDate(EVALUATION_DATE);
});

afterEach(() => {
  resetContainer();
  resetEvaluationDate();
});

describe("POST /api/v1/decisions", () => {
  it("returns an evaluated decision", async () => {
    const response = await postDecision(jsonRequest("POST", "/api/v1/decisions", childChat));
    const { status, body } = await read(response);

    expect(status).toBe(200);
    expect(body.decision).toBe("parental_consent");
    expect(body.reason).toBe("parental_consent_required");
    expect(body.evaluatedAt).toBe(EVALUATION_DATE);
  });

  it("rejects malformed JSON", async () => {
    const response = await postDecision(
      new Request(`${BASE}/api/v1/decisions`, {
        method: "POST",
        body: "{",
        headers: { "content-type": "application/json" },
      }),
    );
    const { status, body } = await read(response);

    expect(status).toBe(400);
    expect(body.error.code).toBe("validation_error");
  });

  it("rejects a subject id over the length limit", async () => {
    const response = await postDecision(
      jsonRequest("POST", "/api/v1/decisions", {
        ...childChat,
        subjectId: "x".repeat(129),
      }),
    );
    const { status, body } = await read(response);

    expect(status).toBe(400);
    expect(body.error.code).toBe("validation_error");
  });

  it("rejects a body over the size limit before parsing it", async () => {
    const response = await postDecision(
      jsonRequest("POST", "/api/v1/decisions", {
        ...childChat,
        subjectId: "x".repeat(9000),
      }),
    );
    const { status, body } = await read(response);

    expect(status).toBe(413);
    expect(body.error.code).toBe("payload_too_large");
  });

  it("rejects a client-supplied evaluation date", async () => {
    const response = await postDecision(
      jsonRequest("POST", "/api/v1/decisions", {
        ...childChat,
        evaluationDate: "2040-01-01",
      }),
    );
    const { status, body } = await read(response);

    expect(status).toBe(400);
    expect(body.error.code).toBe("validation_error");
  });

  it("rejects an undeclared feature", async () => {
    const response = await postDecision(
      jsonRequest("POST", "/api/v1/decisions", { ...childChat, feature: "teleport" }),
    );
    const { status, body } = await read(response);

    expect(status).toBe(400);
    expect(body.error.code).toBe("validation_error");
  });

  it("never creates state when access is checked over HTTP", async () => {
    await postDecision(jsonRequest("POST", "/api/v1/decisions", childChat));
    await postDecision(jsonRequest("POST", "/api/v1/decisions", childChat));

    const listed = await read(await getConsentRequests(
      new Request(`${BASE}/api/v1/consent-requests?subjectId=${childChat.subjectId}`),
    ));

    expect(listed.body.requests).toEqual([]);
  });
});

describe("/api/v1/consent-requests", () => {
  it("creates once and then reuses the same request", async () => {
    const first = await read(await postConsentRequests(
      jsonRequest("POST", "/api/v1/consent-requests", childChat),
    ));
    const second = await read(await postConsentRequests(
      jsonRequest("POST", "/api/v1/consent-requests", childChat),
    ));

    expect(first.status).toBe(201);
    expect(first.body.created).toBe(true);
    expect(first.body.request.status).toBe("pending");
    expect(second.status).toBe(200);
    expect(second.body.created).toBe(false);
    expect(second.body.request.id).toBe(first.body.request.id);
  });

  it("refuses to create a request for a hard block", async () => {
    const response = await postConsentRequests(
      jsonRequest("POST", "/api/v1/consent-requests", hardBlockedChildChat),
    );
    const { status, body } = await read(response);

    expect(status).toBe(409);
    expect(body.error.code).toBe("consent_not_required");
  });

  it("returns the subject's requests", async () => {
    await postConsentRequests(jsonRequest("POST", "/api/v1/consent-requests", childChat));

    const response = await getConsentRequests(
      new Request(`${BASE}/api/v1/consent-requests?subjectId=${childChat.subjectId}`),
    );
    const { status, body } = await read(response);

    expect(status).toBe(200);
    expect(body.requests).toHaveLength(1);
    expect(body.requests[0].subjectId).toBe(childChat.subjectId);
  });

  it("requires subjectId", async () => {
    const response = await getConsentRequests(
      new Request(`${BASE}/api/v1/consent-requests`),
    );
    const { status, body } = await read(response);

    expect(status).toBe(400);
    expect(body.error.code).toBe("validation_error");
  });

  it("returns an empty list for an unknown subject", async () => {
    const response = await getConsentRequests(
      new Request(`${BASE}/api/v1/consent-requests?subjectId=nobody`),
    );
    const { status, body } = await read(response);

    expect(status).toBe(200);
    expect(body.requests).toEqual([]);
  });

  it("isolates subjects over HTTP", async () => {
    await postConsentRequests(jsonRequest("POST", "/api/v1/consent-requests", childChat));
    await postConsentRequests(
      jsonRequest("POST", "/api/v1/consent-requests", { ...childChat, subjectId: "child-2" }),
    );

    const listed = await read(await getConsentRequests(
      new Request(`${BASE}/api/v1/consent-requests?subjectId=${childChat.subjectId}`),
    ));

    expect(listed.status).toBe(200);
    expect(listed.body.requests).toHaveLength(1);
    expect(listed.body.requests[0].subjectId).toBe(childChat.subjectId);
  });

  it("returns 409 for an adult and for a coverage gap", async () => {
    const cases = [
      adultPurchase,
      {
        subjectId: "child-1",
        dateOfBirth: "2015-03-01",
        jurisdiction: "ZZ",
        feature: "purchases",
      },
    ];

    for (const scenario of cases) {
      const response = await postConsentRequests(
        jsonRequest("POST", "/api/v1/consent-requests", scenario),
      );
      const { status, body } = await read(response);

      expect(status).toBe(409);
      expect(body.error.code).toBe("consent_not_required");
    }
  });
});

describe("PATCH /api/v1/consent-requests/:id", () => {
  it("approves, is idempotent, and reverses", async () => {
    const created = await read(await postConsentRequests(
      jsonRequest("POST", "/api/v1/consent-requests", childChat),
    ));
    const id = created.body.request.id;

    const approved = await read(await patchConsentRequest(
      jsonRequest("PATCH", `/api/v1/consent-requests/${id}`, { status: "approved" }),
      routeContext(id),
    ));
    const repeated = await read(await patchConsentRequest(
      jsonRequest("PATCH", `/api/v1/consent-requests/${id}`, { status: "approved" }),
      routeContext(id),
    ));
    const declined = await read(await patchConsentRequest(
      jsonRequest("PATCH", `/api/v1/consent-requests/${id}`, { status: "declined" }),
      routeContext(id),
    ));

    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("approved");
    expect(repeated.body.status).toBe("approved");
    expect(repeated.body.updatedAt).toBe(approved.body.updatedAt);
    expect(declined.body.status).toBe("declined");
  });

  it("makes a later decision reflect the parent's action", async () => {
    const created = await read(await postConsentRequests(
      jsonRequest("POST", "/api/v1/consent-requests", childChat),
    ));
    const id = created.body.request.id;

    await patchConsentRequest(
      jsonRequest("PATCH", `/api/v1/consent-requests/${id}`, { status: "approved" }),
      routeContext(id),
    );

    const decision = await read(await postDecision(
      jsonRequest("POST", "/api/v1/decisions", childChat),
    ));

    expect(decision.body.decision).toBe("allowed");
    expect(decision.body.reason).toBe("parental_consent_approved");
  });

  it("returns 404 for an unknown request id", async () => {
    const response = await patchConsentRequest(
      jsonRequest("PATCH", "/api/v1/consent-requests/missing", { status: "approved" }),
      routeContext("missing"),
    );
    const { status, body } = await read(response);

    expect(status).toBe(404);
    expect(body.error.code).toBe("request_not_found");
  });

  it("rejects an invalid status", async () => {
    const created = await read(await postConsentRequests(
      jsonRequest("POST", "/api/v1/consent-requests", childChat),
    ));
    const id = created.body.request.id;

    const response = await patchConsentRequest(
      jsonRequest("PATCH", `/api/v1/consent-requests/${id}`, { status: "pending" }),
      routeContext(id),
    );
    const { status, body } = await read(response);

    expect(status).toBe(400);
    expect(body.error.code).toBe("validation_error");
  });
});

describe("storage failure", () => {
  it("returns 503 dependency_unavailable on every operation", async () => {
    setContainer(createContainer({ repository: failingRepository() }));

    const decision = await read(await postDecision(
      jsonRequest("POST", "/api/v1/decisions", childChat),
    ));
    const create = await read(await postConsentRequests(
      jsonRequest("POST", "/api/v1/consent-requests", childChat),
    ));
    const list = await read(await getConsentRequests(
      new Request(`${BASE}/api/v1/consent-requests?subjectId=${childChat.subjectId}`),
    ));
    const patch = await read(await patchConsentRequest(
      jsonRequest("PATCH", "/api/v1/consent-requests/x", { status: "approved" }),
      routeContext("x"),
    ));

    for (const response of [decision, create, list, patch]) {
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe("dependency_unavailable");
      expect(typeof response.body.error.message).toBe("string");
    }
  });
});
