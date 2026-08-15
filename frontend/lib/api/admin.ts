import { handler } from "@/lib/api/api";
import type {
  FlyerTemplate,
} from "@/lib/types/flyer";

export function fetchAllTemplates(): Promise<
  FlyerTemplate[]
> {
  return handler<FlyerTemplate[]>(
    "/api/v1/admin/templates",
  );
}

export function createTemplate(
  payload: FlyerTemplate,
): Promise<FlyerTemplate> {
  return handler<FlyerTemplate>(
    "/api/v1/admin/templates",
    {
      method: "POST",
      json: payload,
    },
  );
}

export function updateTemplate(
  templateId: string,
  payload: FlyerTemplate,
): Promise<FlyerTemplate> {
  return handler<FlyerTemplate>(
    `/api/v1/admin/templates/${encodeURIComponent(
      templateId,
    )}`,
    {
      method: "PUT",
      json: payload,
    },
  );
}

export function deleteTemplate(
  templateId: string,
): Promise<void> {
  return handler<void>(
    `/api/v1/admin/templates/${encodeURIComponent(
      templateId,
    )}`,
    {
      method: "DELETE",
    },
  );
}

export function checkIsAdmin(): Promise<{
  is_admin: boolean;
}> {
  return handler<{
    is_admin: boolean;
  }>("/api/v1/auth/me/is-admin");
}