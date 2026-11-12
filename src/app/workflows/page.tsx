import { PageHeader } from "@/components/shell/page-header";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";

export default function WorkflowsPage() {
  return (
    <>
      <PageHeader
        title="Workflows"
        description="See exactly how every lead flows through the automation. Press Run test to send a real test lead through it."
      />
      <WorkflowBuilder />
    </>
  );
}