import { WorkspaceLayout } from "@/components/layout/WorkspaceLayout";
import { Workspace } from "@/components/workspace/Workspace";
import { FlyerDraftProvider } from "@/context/FlyerDraftContext";

export default function TempWorkspacePage() {
  return (
    <WorkspaceLayout>
      <FlyerDraftProvider>
        <Workspace />
      </FlyerDraftProvider>
    </WorkspaceLayout>
  );
}