/**
 * Shown by Next.js while any page is loading: the notebook page with a small
 * pencil writing "Loading…" at the top, rubbing it out, and writing it again.
 */
import { PaperPage } from "@/components/paper/PaperPage";
import { PencilLoader } from "@/components/paper/PencilLoader";

export default function Loading() {
  return (
    <PaperPage>
      <PencilLoader />
    </PaperPage>
  );
}
