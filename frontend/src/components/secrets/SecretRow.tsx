import React, { useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Check,
  Copy,
  Edit,
  Eye,
  EyeOff,
  GripVertical,
  Trash2,
} from "lucide-react";
import { ItemTypes, DraggedSecretItem } from "@/lib/dnd/itemTypes";
import { DecryptedSecret } from "@/hooks/useSecrets";

function maskValue(value: string): string {
  return "*".repeat(Math.min(value.length, 20));
}

const TRUNCATE_LENGTH = 20;

function truncateValue(value: string): string {
  return value.length > TRUNCATE_LENGTH
    ? `${value.substring(0, TRUNCATE_LENGTH)}...`
    : value;
}

interface SecretRowProps {
  secret: DecryptedSecret;
  isSelected: boolean;
  // Receives the click's shiftKey so callers can support range-select
  // (see useSecretSelection.handleCheckboxClick).
  onToggleSelect: (shiftKey: boolean) => void;
  isVisible: boolean;
  onToggleVisibility: () => void;
  isCopied: boolean;
  onCopyValue: () => void;
  onCopyEnv: () => void;
  onEdit: () => void;
  onDelete: () => void;
  // Drag-and-drop reordering within the current folder. Disabled while a
  // search term is active - reordering a filtered subset against the
  // folder's true order would be confusing.
  reorderingDisabled: boolean;
  onReorderDrop: (
    draggedSecretId: string,
    targetSecretId: string,
    dropBefore: boolean,
  ) => void;
}

const SecretRow = ({
  secret,
  isSelected,
  onToggleSelect,
  isVisible,
  onToggleVisibility,
  isCopied,
  onCopyValue,
  onCopyEnv,
  onEdit,
  onDelete,
  reorderingDisabled,
  onReorderDrop,
}: SecretRowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  const [{ isOver }, drop] = useDrop<
    DraggedSecretItem,
    void,
    { isOver: boolean }
  >({
    accept: ItemTypes.SECRET,
    canDrop: () => !reorderingDisabled,
    collect: (monitor) => ({ isOver: monitor.isOver() }),
    drop: (item, monitor) => {
      if (!rowRef.current || item.secretId === secret.id) return;
      const rect = rowRef.current.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();
      const dropBefore = clientOffset
        ? clientOffset.y < rect.top + rect.height / 2
        : true;
      onReorderDrop(item.secretId, secret.id, dropBefore);
    },
  });

  const [{ isDragging }, drag, preview] = useDrag<
    DraggedSecretItem,
    void,
    { isDragging: boolean }
  >({
    type: ItemTypes.SECRET,
    item: { secretId: secret.id, name: secret.name, folderId: secret.folderId },
    canDrag: () => !reorderingDisabled,
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  drag(handleRef);
  drop(preview(rowRef));

  return (
    <div
      ref={rowRef}
      role="listitem"
      className={`bg-white border rounded-lg p-4 shadow-sm transition-colors ${
        isDragging ? "opacity-40" : ""
      } ${isOver ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          ref={handleRef}
          className={`mt-1 text-gray-400 rounded ${
            reorderingDisabled
              ? "cursor-not-allowed opacity-40"
              : "cursor-grab hover:text-gray-600"
          }`}
          aria-label={`Drag to reorder ${secret.name}`}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <Checkbox
          id={`select-secret-${secret.id}`}
          className="mt-1"
          checked={isSelected}
          onClick={(e) => onToggleSelect(e.shiftKey)}
          aria-label={`Select ${secret.name}`}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <label
              htmlFor={`select-secret-${secret.id}`}
              className="font-medium text-gray-900 text-base cursor-pointer"
            >
              {secret.name}
            </label>
          </div>
          {secret.description && (
            <div className="mb-2">
              <p className="text-sm text-gray-700 line-clamp-1 max-w-[60ch] text-ellipsis">
                {secret.description}
              </p>
            </div>
          )}

          {/* secret value, toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono flex-1 truncate">
                  {isVisible ? truncateValue(secret.value) : maskValue(secret.value)}
                </code>
              </TooltipTrigger>
              <TooltipContent className="max-w-[40ch] break-all">
                <p>
                  {isVisible ? truncateValue(secret.value) : maskValue(secret.value)}
                </p>
              </TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onToggleVisibility}
                    aria-label={isVisible ? "Hide secret value" : "Show secret value"}
                  >
                    {isVisible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isVisible ? "Hide secret value" : "Show secret value"}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCopyValue}
                    aria-label="Copy secret value"
                  >
                    {isCopied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isCopied ? "Copied!" : "Copy value only"}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCopyEnv}
                    aria-label="Copy secret as environment variable"
                  >
                    {isCopied ? (
                      <Check className="h-4 w-4" color="#36b328" />
                    ) : (
                      <Copy className="h-4 w-4" color="#36b328" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isCopied ? "Copied!" : "Copy as env variable (NAME=value)"}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Edit secret"
                    onClick={onEdit}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit secret</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDelete}
                    aria-label="Delete secret"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete secret</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Created: {new Date(secret.createdAt).toLocaleDateString()}{" "}
            • Updated: {new Date(secret.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SecretRow;
