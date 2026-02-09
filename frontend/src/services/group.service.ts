import { fetchApi } from "./api";
import type {
  Group,
  GroupsListResponse,
  CreateGroupRequest,
  UpdateGroupRequest,
} from "../types";

export const groupService = {
  list: (): Promise<GroupsListResponse> => fetchApi("/groups"),

  get: (id: string): Promise<Group> => fetchApi(`/groups/${id}`),

  create: (data: CreateGroupRequest): Promise<Group> =>
    fetchApi("/groups", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateGroupRequest): Promise<Group> =>
    fetchApi(`/groups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string): Promise<void> =>
    fetchApi(`/groups/${id}`, { method: "DELETE" }),
};
