import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Textarea,
  Input,
  Label,
} from "../ui";

interface DocumentFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { content: string; filename: string }) => void;
  isSubmitting?: boolean;
}

function DocumentForm({
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: DocumentFormProps) {
  const [content, setContent] = useState("");
  const [filename, setFilename] = useState("");
  const [errors, setErrors] = useState<{ content?: string }>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { content?: string } = {};
    if (!content.trim()) {
      newErrors.content = "Content is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({
      content: content.trim(),
      filename: filename.trim() || "manual_input.txt",
    });
    setContent("");
    setFilename("");
  };

  const handleClose = () => {
    setContent("");
    setFilename("");
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Text Document</DialogTitle>
            <DialogDescription>
              Paste or type text content to add to your knowledge graph.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filename">Filename (optional)</Label>
              <Input
                id="filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="e.g., notes.txt"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">
                Content <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste or type your text content here..."
                disabled={isSubmitting}
                rows={10}
                className="font-mono text-sm"
              />
              {errors.content && (
                <p className="text-sm text-destructive">{errors.content}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {content.length} characters
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { DocumentForm };
