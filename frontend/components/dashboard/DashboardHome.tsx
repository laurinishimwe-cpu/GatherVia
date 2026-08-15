"use client";

import { useState, useRef } from "react";
import { RecentProjects } from "./RecentProjects";
import { TemplateGallery } from "./TemplateGallery";
import { CreateEventModal } from "./CreateEventModal";

export function DashboardHome() {
  const [modalOpen, setModalOpen] = useState(false);
  const templatesRef = useRef<HTMLDivElement>(null);

  const scrollToTemplates = () => {
    templatesRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const openCreateEventModal = () => {
    // Clear any previously stored template so the workspace starts blank
    sessionStorage.removeItem("pendingFlyerTemplate");
    setModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-12">
        <RecentProjects onCreateClick={openCreateEventModal} />

        <div ref={templatesRef}>
          <TemplateGallery />
        </div>

        <CreateEventModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSelectTemplates={() => {
            setModalOpen(false);
            scrollToTemplates();
          }}
        />
      </div>
    </div>
  );
}
