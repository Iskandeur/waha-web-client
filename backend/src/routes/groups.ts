import type { FastifyInstance } from "fastify";
import { GuardBlockedError, waha, type WahaFileInput } from "../waha-client.js";
import { isValidFile } from "./chats.js";

/** A group name/subject just needs non-empty text, same shape as any other display name. */
export function isValidGroupName(name: unknown): name is string {
  return typeof name === "string" && name.trim().length > 0;
}

/** WAHA allows clearing a group's description with an empty string, so unlike the subject this
 *  only rejects non-string input, not empty strings. */
export function isValidGroupDescription(description: unknown): description is string {
  return typeof description === "string";
}

/** Non-empty array of non-empty participant ids (`@c.us`/`@lid`). The guard layer
 *  (`groupActionGuarded`) separately caps *how many* can be touched in one call — this only
 *  validates shape. */
export function isValidParticipantIds(ids: unknown): ids is string[] {
  return (
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.every((id) => typeof id === "string" && id.trim().length > 0)
  );
}

export function isValidAdminsOnly(v: unknown): v is boolean {
  return typeof v === "boolean";
}

export function isValidInviteCode(code: unknown): code is string {
  return typeof code === "string" && code.trim().length > 0;
}

function guarded<T>(fn: () => Promise<T>, reply: { code: (n: number) => void }) {
  return fn().catch((err) => {
    if (err instanceof GuardBlockedError) {
      reply.code(429);
      return { error: "blocked-by-guard", reason: err.reason };
    }
    throw err;
  });
}

export async function groupsRoutes(app: FastifyInstance) {
  app.get("/api/groups", async () => waha.listGroups());

  app.post<{ Body: { name: string; participantIds: string[] } }>(
    "/api/groups",
    async (req, reply) => {
      const { name, participantIds } = req.body;
      if (!isValidGroupName(name)) {
        reply.code(400);
        return { error: "name is required" };
      }
      if (!isValidParticipantIds(participantIds)) {
        reply.code(400);
        return { error: "participantIds must be a non-empty array of strings" };
      }
      return waha.createGroup(name.trim(), participantIds);
    },
  );

  app.get("/api/groups/count", async () => waha.getGroupsCount());

  app.post("/api/groups/refresh", async () => {
    await waha.refreshGroups();
    return { ok: true };
  });

  app.get<{ Querystring: { code?: string } }>("/api/groups/join-info", async (req, reply) => {
    const code = req.query.code?.trim();
    if (!isValidInviteCode(code)) {
      reply.code(400);
      return { error: "code is required" };
    }
    return waha.getGroupJoinInfo(code);
  });

  app.post<{ Body: { code: string } }>("/api/groups/join", async (req, reply) => {
    const code = req.body.code?.trim();
    if (!isValidInviteCode(code)) {
      reply.code(400);
      return { error: "code is required" };
    }
    return waha.joinGroup(code);
  });

  app.get<{ Params: { id: string } }>("/api/groups/:id", async (req) =>
    waha.getGroup(req.params.id),
  );

  app.delete<{ Params: { id: string } }>("/api/groups/:id", async (req) => {
    await waha.deleteGroup(req.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/api/groups/:id/leave", async (req) => {
    await waha.leaveGroup(req.params.id);
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/api/groups/:id/picture", async (req) =>
    waha.getGroupPicture(req.params.id),
  );

  app.put<{ Params: { id: string }; Body: { file: WahaFileInput } }>(
    "/api/groups/:id/picture",
    async (req, reply) => {
      const { file } = req.body;
      if (!isValidFile(file)) {
        reply.code(400);
        return { error: "file (mimetype + url or data) is required" };
      }
      return waha.setGroupPicture(req.params.id, file);
    },
  );

  app.delete<{ Params: { id: string } }>("/api/groups/:id/picture", async (req) => {
    await waha.deleteGroupPicture(req.params.id);
    return { ok: true };
  });

  app.put<{ Params: { id: string }; Body: { subject: string } }>(
    "/api/groups/:id/subject",
    async (req, reply) => {
      const { subject } = req.body;
      if (!isValidGroupName(subject)) {
        reply.code(400);
        return { error: "subject is required" };
      }
      await waha.setGroupSubject(req.params.id, subject.trim());
      return { ok: true };
    },
  );

  app.put<{ Params: { id: string }; Body: { description: string } }>(
    "/api/groups/:id/description",
    async (req, reply) => {
      const { description } = req.body;
      if (!isValidGroupDescription(description)) {
        reply.code(400);
        return { error: "description must be a string (empty string clears it)" };
      }
      await waha.setGroupDescription(req.params.id, description);
      return { ok: true };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/groups/:id/settings/info-admin-only",
    async (req) => waha.getGroupInfoAdminOnly(req.params.id),
  );

  app.put<{ Params: { id: string }; Body: { adminsOnly: boolean } }>(
    "/api/groups/:id/settings/info-admin-only",
    async (req, reply) => {
      const { adminsOnly } = req.body;
      if (!isValidAdminsOnly(adminsOnly)) {
        reply.code(400);
        return { error: "adminsOnly (boolean) is required" };
      }
      await waha.setGroupInfoAdminOnly(req.params.id, adminsOnly);
      return { ok: true };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/groups/:id/settings/messages-admin-only",
    async (req) => waha.getGroupMessagesAdminOnly(req.params.id),
  );

  app.put<{ Params: { id: string }; Body: { adminsOnly: boolean } }>(
    "/api/groups/:id/settings/messages-admin-only",
    async (req, reply) => {
      const { adminsOnly } = req.body;
      if (!isValidAdminsOnly(adminsOnly)) {
        reply.code(400);
        return { error: "adminsOnly (boolean) is required" };
      }
      await waha.setGroupMessagesAdminOnly(req.params.id, adminsOnly);
      return { ok: true };
    },
  );

  app.get<{ Params: { id: string } }>("/api/groups/:id/invite-code", async (req) =>
    waha.getGroupInviteCode(req.params.id),
  );

  app.post<{ Params: { id: string } }>("/api/groups/:id/invite-code/revoke", async (req) =>
    waha.revokeGroupInviteCode(req.params.id),
  );

  app.get<{ Params: { id: string } }>("/api/groups/:id/participants", async (req) =>
    waha.getGroupParticipants(req.params.id),
  );

  app.post<{ Params: { id: string }; Body: { participantIds: string[] } }>(
    "/api/groups/:id/participants/add",
    async (req, reply) => {
      const { participantIds } = req.body;
      if (!isValidParticipantIds(participantIds)) {
        reply.code(400);
        return { error: "participantIds must be a non-empty array of strings" };
      }
      return guarded(
        () => waha.addGroupParticipants(req.params.id, participantIds).then(() => ({ ok: true })),
        reply,
      );
    },
  );

  app.post<{ Params: { id: string }; Body: { participantIds: string[] } }>(
    "/api/groups/:id/participants/remove",
    async (req, reply) => {
      const { participantIds } = req.body;
      if (!isValidParticipantIds(participantIds)) {
        reply.code(400);
        return { error: "participantIds must be a non-empty array of strings" };
      }
      return guarded(
        () =>
          waha.removeGroupParticipants(req.params.id, participantIds).then(() => ({ ok: true })),
        reply,
      );
    },
  );

  app.post<{ Params: { id: string }; Body: { participantIds: string[] } }>(
    "/api/groups/:id/admin/promote",
    async (req, reply) => {
      const { participantIds } = req.body;
      if (!isValidParticipantIds(participantIds)) {
        reply.code(400);
        return { error: "participantIds must be a non-empty array of strings" };
      }
      return guarded(
        () =>
          waha.promoteGroupParticipants(req.params.id, participantIds).then(() => ({ ok: true })),
        reply,
      );
    },
  );

  app.post<{ Params: { id: string }; Body: { participantIds: string[] } }>(
    "/api/groups/:id/admin/demote",
    async (req, reply) => {
      const { participantIds } = req.body;
      if (!isValidParticipantIds(participantIds)) {
        reply.code(400);
        return { error: "participantIds must be a non-empty array of strings" };
      }
      return guarded(
        () =>
          waha.demoteGroupParticipants(req.params.id, participantIds).then(() => ({ ok: true })),
        reply,
      );
    },
  );
}
