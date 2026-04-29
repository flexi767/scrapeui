import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function SavedSearchDeleteDialog({
  open,
  busy,
  onOpenChange,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-gray-700 bg-gray-900 text-gray-100">
        <DialogHeader>
          <DialogTitle>Delete saved search?</DialogTitle>
          <DialogDescription className="text-gray-400">
            This will permanently remove the saved search.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-gray-600 bg-transparent text-gray-200 hover:bg-gray-800 hover:text-white"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-red-700 bg-red-950/80 text-red-200 hover:bg-red-900 hover:text-white"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-4 w-4" />
            )}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
